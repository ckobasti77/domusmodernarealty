import { v } from "convex/values";
import { internalQuery, mutation, query } from "./_generated/server";
import { logActivity } from "./lib/activity";
import { getViewer, requireRole } from "./lib/auth";
import { forbidden, invalidInput, notFound } from "./lib/errors";
import { ALL_ROLES, roleV, userStatusV } from "./lib/validators";

const ADMINS = ["admin"] as const;

const meV = v.object({
  _id: v.id("users"),
  email: v.optional(v.string()),
  name: v.optional(v.string()),
  role: roleV,
  status: userStatusV,
  agentId: v.optional(v.id("agents")),
  agentSlug: v.optional(v.string()),
  agentName: v.optional(v.string()),
});

/** The only query the admin shell needs before it knows who you are. */
export const getMe = query({
  args: {},
  returns: v.union(meV, v.null()),
  handler: async (ctx) => {
    const viewer = await getViewer(ctx);
    if (viewer === null) return null;
    const agent =
      viewer.agentId !== undefined ? await ctx.db.get("agents", viewer.agentId) : null;
    return {
      _id: viewer._id,
      ...(viewer.email !== undefined ? { email: viewer.email } : {}),
      ...(viewer.name !== undefined ? { name: viewer.name } : {}),
      role: viewer.role,
      status: viewer.status,
      ...(viewer.agentId !== undefined ? { agentId: viewer.agentId } : {}),
      ...(agent !== null ? { agentSlug: agent.slug, agentName: agent.name } : {}),
    };
  },
});

export const list = query({
  args: {},
  returns: v.array(
    v.object({
      _id: v.id("users"),
      email: v.optional(v.string()),
      name: v.optional(v.string()),
      role: roleV,
      status: userStatusV,
      agentId: v.optional(v.id("agents")),
      agentName: v.optional(v.string()),
      createdAt: v.number(),
    }),
  ),
  handler: async (ctx) => {
    await requireRole(ctx, ADMINS);
    const docs = await ctx.db.query("users").order("desc").take(200);
    const out = [];
    for (const doc of docs) {
      const agent =
        doc.agentId !== undefined ? await ctx.db.get("agents", doc.agentId) : null;
      out.push({
        _id: doc._id,
        ...(doc.email !== undefined ? { email: doc.email } : {}),
        ...(doc.name !== undefined ? { name: doc.name } : {}),
        role: doc.role,
        status: doc.status,
        ...(doc.agentId !== undefined ? { agentId: doc.agentId } : {}),
        ...(agent !== null ? { agentName: agent.name } : {}),
        createdAt: doc._creationTime,
      });
    }
    return out;
  },
});

export const setRole = mutation({
  args: { id: v.id("users"), role: roleV },
  returns: v.null(),
  handler: async (ctx, args) => {
    const viewer = await requireRole(ctx, ADMINS);
    const target = await ctx.db.get("users", args.id);
    if (target === null) notFound("Korisnik");

    // Never allow the last admin to demote themselves out of the panel.
    if (target._id === viewer._id && args.role !== "admin") {
      const admins = await ctx.db
        .query("users")
        .withIndex("by_role", (q) => q.eq("role", "admin"))
        .take(5);
      const otherActiveAdmins = admins.filter(
        (item) => item._id !== viewer._id && item.status === "active",
      );
      if (otherActiveAdmins.length === 0) {
        forbidden("promenu uloge poslednjeg administratora");
      }
    }

    await ctx.db.patch("users", target._id, { role: args.role });
    await logActivity(ctx, {
      entity: "user",
      entityId: target._id,
      action: "user.role",
      summary: `${target.email ?? target._id}: ${target.role} → ${args.role}`,
      by: viewer._id,
    });
    return null;
  },
});

export const setStatus = mutation({
  args: { id: v.id("users"), status: userStatusV },
  returns: v.null(),
  handler: async (ctx, args) => {
    const viewer = await requireRole(ctx, ADMINS);
    const target = await ctx.db.get("users", args.id);
    if (target === null) notFound("Korisnik");
    if (target._id === viewer._id && args.status !== "active") {
      forbidden("deaktivaciju sopstvenog računa");
    }

    await ctx.db.patch("users", target._id, { status: args.status });
    await logActivity(ctx, {
      entity: "user",
      entityId: target._id,
      action: "user.status",
      summary: `${target.email ?? target._id}: ${target.status} → ${args.status}`,
      by: viewer._id,
    });
    return null;
  },
});

export const linkAgent = mutation({
  args: { id: v.id("users"), agentId: v.optional(v.id("agents")) },
  returns: v.null(),
  handler: async (ctx, args) => {
    const viewer = await requireRole(ctx, ADMINS);
    const target = await ctx.db.get("users", args.id);
    if (target === null) notFound("Korisnik");

    if (args.agentId !== undefined) {
      const agent = await ctx.db.get("agents", args.agentId);
      if (agent === null) notFound("Agent");
      if (agent.userId !== undefined && agent.userId !== target._id) {
        invalidInput("Taj profil agenta je već povezan sa drugim korisnikom.");
      }
      await ctx.db.patch("agents", args.agentId, { userId: target._id });
    }
    if (target.agentId !== undefined && target.agentId !== args.agentId) {
      await ctx.db.patch("agents", target.agentId, { userId: undefined });
    }

    await ctx.db.patch("users", target._id, { agentId: args.agentId });
    await logActivity(ctx, {
      entity: "user",
      entityId: target._id,
      action: "user.agentLinked",
      by: viewer._id,
    });
    return null;
  },
});

export { ALL_ROLES };

/**
 * Actions have no `ctx.db`, so `requireRoleAction` reads the caller through
 * this. `ctx.runQuery` from an action carries the caller's auth identity.
 */
export const viewerForAction = internalQuery({
  args: {},
  returns: v.union(v.null(), v.object({ _id: v.id("users"), role: roleV, status: userStatusV })),
  handler: async (ctx) => {
    const viewer = await getViewer(ctx);
    if (viewer === null) return null;
    return { _id: viewer._id, role: viewer.role, status: viewer.status };
  },
});
