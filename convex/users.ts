import { getAuthSessionId, modifyAccountCredentials, retrieveAccount } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import {
  action,
  internalMutation,
  internalQuery,
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";
import { openInvitesForAgent } from "./agentsAdmin";
import { logActivity } from "./lib/activity";
import { getViewer, requireRole, requireRoleAction } from "./lib/auth";
import { appError, forbidden, invalidInput, notFound } from "./lib/errors";
import { PASSWORD_MAX, PASSWORD_MIN, PASSWORD_PROVIDER, passwordLengthOk } from "./lib/password";
import { ALL_ROLES, roleV, userStatusV, type Role, type UserStatus } from "./lib/validators";

const ADMINS = ["admin"] as const;

const ROLE_SR: Record<Role, string> = {
  admin: "Administrator",
  manager: "Menadžer",
  agent: "Agent",
  editor: "Urednik",
};

const STATUS_SR: Record<UserStatus, string> = {
  invited: "Pozvan",
  active: "Aktivan",
  disabled: "Deaktiviran",
};

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

/**
 * When the person last used the panel, from the auth tables: a session is
 * created at sign-in and a refresh token roughly every hour of activity, so
 * the newest of the two is accurate to about an hour. No secret is read out.
 */
async function lastSeenOf(ctx: QueryCtx, user: Doc<"users">): Promise<number | undefined> {
  let latest = user.lastSeenAt ?? 0;
  const sessions = await ctx.db
    .query("authSessions")
    .withIndex("userId", (q) => q.eq("userId", user._id))
    .order("desc")
    .take(3);
  for (const session of sessions) {
    latest = Math.max(latest, session._creationTime);
    const token = await ctx.db
      .query("authRefreshTokens")
      .withIndex("sessionId", (q) => q.eq("sessionId", session._id))
      .order("desc")
      .first();
    if (token !== null) latest = Math.max(latest, token._creationTime);
  }
  return latest > 0 ? latest : undefined;
}

/** Staff accounts for the Team page. Never returns tokens, hashes or sessions. */
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
      lastSeenAt: v.optional(v.number()),
    }),
  ),
  handler: async (ctx) => {
    await requireRole(ctx, ADMINS);
    const docs = await ctx.db.query("users").order("desc").take(200);
    const out = [];
    for (const doc of docs) {
      const agent =
        doc.agentId !== undefined ? await ctx.db.get("agents", doc.agentId) : null;
      const lastSeenAt = await lastSeenOf(ctx, doc);
      out.push({
        _id: doc._id,
        ...(doc.email !== undefined ? { email: doc.email } : {}),
        ...(doc.name !== undefined ? { name: doc.name } : {}),
        role: doc.role,
        status: doc.status,
        ...(doc.agentId !== undefined ? { agentId: doc.agentId } : {}),
        ...(agent !== null ? { agentName: agent.name } : {}),
        createdAt: doc._creationTime,
        ...(lastSeenAt !== undefined ? { lastSeenAt } : {}),
      });
    }
    return out;
  },
});

function labelOf(user: Doc<"users">): string {
  return user.name ?? user.email ?? user._id;
}

/**
 * The agency must keep at least one active administrator, or nobody could
 * manage accounts and settings any more. Throws when `target` is the last one.
 */
async function assertAnotherActiveAdmin(ctx: QueryCtx, target: Id<"users">): Promise<void> {
  const admins = await ctx.db
    .query("users")
    .withIndex("by_role", (q) => q.eq("role", "admin"))
    .take(50);
  const others = admins.filter((item) => item._id !== target && item.status === "active");
  if (others.length === 0) {
    appError(
      "FORBIDDEN",
      "Ovo je jedini aktivni administrator. Prvo dodelite ulogu administratora nekom drugom.",
    );
  }
}

/**
 * Signs a deactivated account out everywhere: its sessions (and their refresh
 * tokens) are deleted, so no client can renew its access token. Requests made
 * with a still-valid token are refused anyway (`requireUser` checks status).
 */
async function endSessions(
  ctx: MutationCtx,
  userId: Id<"users">,
  keep?: Id<"authSessions">,
): Promise<number> {
  const sessions = (
    await ctx.db
      .query("authSessions")
      .withIndex("userId", (q) => q.eq("userId", userId))
      .take(100)
  ).filter((session) => session._id !== keep);
  for (const session of sessions) {
    const tokens = await ctx.db
      .query("authRefreshTokens")
      .withIndex("sessionId", (q) => q.eq("sessionId", session._id))
      .take(100);
    for (const token of tokens) await ctx.db.delete("authRefreshTokens", token._id);
    await ctx.db.delete("authSessions", session._id);
  }
  return sessions.length;
}

export const setRole = mutation({
  args: { id: v.id("users"), role: roleV },
  returns: v.null(),
  handler: async (ctx, args) => {
    const viewer = await requireRole(ctx, ADMINS);
    const target = await ctx.db.get("users", args.id);
    if (target === null) notFound("Korisnik");
    if (target.role === args.role) return null;

    if (target.role === "admin" && target.status === "active") {
      await assertAnotherActiveAdmin(ctx, target._id);
    }
    if (args.role === "agent" && target.agentId === undefined) {
      invalidInput(
        "Nalog sa ulogom Agent mora biti povezan sa profilom agenta. Prvo povežite profil.",
      );
    }

    await ctx.db.patch("users", target._id, { role: args.role });
    await logActivity(ctx, {
      entity: "user",
      entityId: target._id,
      action: "user.role",
      summary: `${labelOf(target)}: ${ROLE_SR[target.role]} → ${ROLE_SR[args.role]}`,
      diff: [{ field: "role", from: ROLE_SR[target.role], to: ROLE_SR[args.role] }],
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
    if (args.status === "invited") {
      invalidInput("Status „Pozvan” se ne dodeljuje ručno.");
    }
    if (target._id === viewer._id && args.status !== "active") {
      forbidden("deaktivaciju sopstvenog naloga");
    }
    if (target.status === args.status) return null;
    if (args.status === "active" && target.role === "agent") {
      const profile = target.agentId !== undefined ? await ctx.db.get("agents", target.agentId) : null;
      if (profile === null) {
        invalidInput("Agent mora imati profil pre aktivacije. Povežite nalog sa profilom agenta.");
      }
    }
    if (target.role === "admin" && target.status === "active") {
      await assertAnotherActiveAdmin(ctx, target._id);
    }

    await ctx.db.patch("users", target._id, { status: args.status });
    const ended = args.status === "disabled" ? await endSessions(ctx, target._id) : 0;
    await logActivity(ctx, {
      entity: "user",
      entityId: target._id,
      action: "user.status",
      summary:
        `${labelOf(target)}: ${STATUS_SR[target.status]} → ${STATUS_SR[args.status]}` +
        (ended > 0 ? ` (završene sesije: ${ended})` : ""),
      diff: [{ field: "status", from: STATUS_SR[target.status], to: STATUS_SR[args.status] }],
      by: viewer._id,
    });
    return null;
  },
});

/**
 * Links an account to an agent profile (an agent then sees only that
 * profile's listings, leads and viewings), or unlinks it.
 */
export const linkAgent = mutation({
  args: { id: v.id("users"), agentId: v.optional(v.id("agents")) },
  returns: v.null(),
  handler: async (ctx, args) => {
    const viewer = await requireRole(ctx, ADMINS);
    const target = await ctx.db.get("users", args.id);
    if (target === null) notFound("Korisnik");
    if (target.agentId === args.agentId) return null;

    if (args.agentId === undefined && target.role === "agent" && target.status === "active") {
      invalidInput(
        "Aktivan agent mora imati profil. Povežite drugi profil ili prvo promenite ulogu.",
      );
    }

    const previous =
      target.agentId !== undefined ? await ctx.db.get("agents", target.agentId) : null;
    let next: Doc<"agents"> | null = null;
    if (args.agentId !== undefined) {
      next = await ctx.db.get("agents", args.agentId);
      if (next === null) notFound("Profil agenta");
      if (next.userId !== undefined && next.userId !== target._id) {
        const owner = await ctx.db.get("users", next.userId);
        if (owner !== null) {
          invalidInput(`Taj profil je već povezan sa nalogom ${labelOf(owner)}.`);
        }
      }
      if ((await openInvitesForAgent(ctx, next._id, Date.now())).length > 0) {
        invalidInput("Za taj profil postoji otvorena pozivnica. Prvo je opozovite.");
      }
      await ctx.db.patch("agents", next._id, { userId: target._id, isDemo: false });
    }
    if (previous !== null && previous.userId === target._id) {
      await ctx.db.patch("agents", previous._id, { userId: undefined });
    }

    await ctx.db.patch("users", target._id, { agentId: args.agentId });
    await logActivity(ctx, {
      entity: "user",
      entityId: target._id,
      action: "user.agentLinked",
      summary: `${labelOf(target)}: ${next !== null ? `profil ${next.name}` : "bez profila"}`,
      diff: [
        {
          field: "agentId",
          ...(previous !== null ? { from: previous.name } : {}),
          ...(next !== null ? { to: next.name } : {}),
        },
      ],
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

/** The password account of a user (its id is the sign-in e-mail), or null. */
export const passwordAccountId = internalQuery({
  args: { userId: v.id("users") },
  returns: v.union(v.null(), v.string()),
  handler: async (ctx, { userId }) => {
    const account = await ctx.db
      .query("authAccounts")
      .withIndex("userIdAndProvider", (q) => q.eq("userId", userId).eq("provider", PASSWORD_PROVIDER))
      .unique();
    return account?.providerAccountId ?? null;
  },
});

/** Ends every other session of the account and logs the change. */
export const finishPasswordChange = internalMutation({
  args: { userId: v.id("users"), keepSessionId: v.optional(v.id("authSessions")) },
  returns: v.number(),
  handler: async (ctx, { userId, keepSessionId }) => {
    const user = await ctx.db.get("users", userId);
    if (user === null) notFound("Korisnik");
    const ended = await endSessions(ctx, userId, keepSessionId);
    await logActivity(ctx, {
      entity: "user",
      entityId: userId,
      action: "user.password",
      summary:
        `${labelOf(user)}: lozinka je promenjena` + (ended > 0 ? ` (završene ostale sesije: ${ended})` : ""),
      by: userId,
    });
    return ended;
  },
});

/**
 * "Promenite lozinku" in the admin top bar: any active staff member changes
 * their own password.
 *
 * The current password goes through the library's `retrieveAccount`, the same
 * check sign-in uses, so wrong answers count toward the sign-in lockout (10 per
 * hour) and this cannot be used to guess faster. The new hash is written by
 * `modifyAccountCredentials` with the provider's own Scrypt settings. Every
 * other session of the account then ends; the one making the change stays.
 */
export const changeOwnPassword = action({
  args: { currentPassword: v.string(), newPassword: v.string() },
  returns: v.object({ endedSessions: v.number() }),
  handler: async (ctx, args): Promise<{ endedSessions: number }> => {
    const viewer = await requireRoleAction(ctx, ALL_ROLES);
    if (!passwordLengthOk(args.newPassword)) {
      invalidInput(`Nova lozinka mora imati od ${PASSWORD_MIN} do ${PASSWORD_MAX} znakova.`);
    }
    if (args.newPassword === args.currentPassword) {
      invalidInput("Nova lozinka mora da se razlikuje od trenutne.");
    }
    const accountId = await ctx.runQuery(internal.users.passwordAccountId, { userId: viewer._id });
    if (accountId === null) notFound("Nalog sa lozinkom");

    try {
      await retrieveAccount(ctx, {
        provider: PASSWORD_PROVIDER,
        account: { id: accountId, secret: args.currentPassword },
      });
    } catch (error) {
      const reason = error instanceof Error ? error.message : "";
      if (reason === "InvalidSecret") invalidInput("Trenutna lozinka nije tačna.");
      if (reason === "TooManyFailedAttempts") {
        appError(
          "RATE_LIMITED",
          "Previše pogrešnih pokušaja. Provera je privremeno blokirana; pokušajte ponovo za nekoliko minuta.",
        );
      }
      throw error;
    }

    await modifyAccountCredentials(ctx, {
      provider: PASSWORD_PROVIDER,
      account: { id: accountId, secret: args.newPassword },
    });
    const sessionId = await getAuthSessionId(ctx);
    const endedSessions = await ctx.runMutation(internal.users.finishPasswordChange, {
      userId: viewer._id,
      ...(sessionId !== null ? { keepSessionId: sessionId } : {}),
    });
    return { endedSessions };
  },
});
