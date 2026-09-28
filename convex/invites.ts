import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { logActivity } from "./lib/activity";
import { requireRole } from "./lib/auth";
import { invalidInput, notFound } from "./lib/errors";
import { requireEmail } from "./lib/rateLimit";
import { roleV } from "./lib/validators";

const ADMINS = ["admin"] as const;
const INVITE_TTL_MS = 7 * 86_400_000;

/** base64url of the SHA-256 digest — only the hash is ever stored. */
export async function hashToken(token: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(token),
  );
  let binary = "";
  for (const byte of new Uint8Array(digest)) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function newToken(): string {
  return `${crypto.randomUUID()}${crypto.randomUUID()}`.replace(/-/g, "");
}

export const list = query({
  args: {},
  returns: v.array(
    v.object({
      _id: v.id("invites"),
      email: v.string(),
      name: v.optional(v.string()),
      role: roleV,
      expiresAt: v.number(),
      acceptedAt: v.optional(v.number()),
      revokedAt: v.optional(v.number()),
      createdAt: v.number(),
    }),
  ),
  handler: async (ctx) => {
    await requireRole(ctx, ADMINS);
    const docs = await ctx.db.query("invites").order("desc").take(100);
    return docs.map((doc) => ({
      _id: doc._id,
      email: doc.email,
      ...(doc.name !== undefined ? { name: doc.name } : {}),
      role: doc.role,
      expiresAt: doc.expiresAt,
      ...(doc.acceptedAt !== undefined ? { acceptedAt: doc.acceptedAt } : {}),
      ...(doc.revokedAt !== undefined ? { revokedAt: doc.revokedAt } : {}),
      createdAt: doc._creationTime,
    }));
  },
});

/**
 * Creates an invite and returns the RAW token exactly once. The acceptance page
 * (step 08) posts it back with `flow: "signUp"`, and `auth.ts` consumes it.
 */
export const create = mutation({
  args: {
    email: v.string(),
    name: v.optional(v.string()),
    role: roleV,
    agentId: v.optional(v.id("agents")),
  },
  returns: v.object({
    id: v.id("invites"),
    token: v.string(),
    expiresAt: v.number(),
  }),
  handler: async (ctx, args) => {
    const viewer = await requireRole(ctx, ADMINS);
    const email = requireEmail(args.email);

    const existingUser = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", email))
      .first();
    if (existingUser !== null) {
      invalidInput("Korisnik sa tom email adresom već postoji.");
    }

    if (args.agentId !== undefined) {
      const agent = await ctx.db.get("agents", args.agentId);
      if (agent === null) notFound("Agent");
    }

    // Supersede any open invite for the same address.
    const open = await ctx.db
      .query("invites")
      .withIndex("by_email", (q) => q.eq("email", email))
      .take(10);
    const now = Date.now();
    for (const invite of open) {
      if (invite.acceptedAt === undefined && invite.revokedAt === undefined) {
        await ctx.db.patch("invites", invite._id, { revokedAt: now });
      }
    }

    const token = newToken();
    const id = await ctx.db.insert("invites", {
      email,
      ...(args.name !== undefined ? { name: args.name.trim().slice(0, 120) } : {}),
      role: args.role,
      tokenHash: await hashToken(token),
      expiresAt: now + INVITE_TTL_MS,
      createdBy: viewer._id,
      ...(args.agentId !== undefined ? { agentId: args.agentId } : {}),
    });

    await logActivity(ctx, {
      entity: "user",
      entityId: id,
      action: "invite.created",
      summary: `${email} (${args.role})`,
      by: viewer._id,
    });

    return { id, token, expiresAt: now + INVITE_TTL_MS };
  },
});

export const revoke = mutation({
  args: { id: v.id("invites") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const viewer = await requireRole(ctx, ADMINS);
    const doc = await ctx.db.get("invites", args.id);
    if (doc === null) notFound("Pozivnica");
    if (doc.acceptedAt !== undefined) {
      invalidInput("Pozivnica je već prihvaćena.");
    }
    await ctx.db.patch("invites", doc._id, { revokedAt: Date.now() });
    await logActivity(ctx, {
      entity: "user",
      entityId: doc._id,
      action: "invite.revoked",
      summary: doc.email,
      by: viewer._id,
    });
    return null;
  },
});

/**
 * Public: the acceptance page checks the token before showing the form, so a bad
 * link fails fast instead of failing inside the sign-up call. Returns the email
 * only — never the role or who invited.
 */
export const checkToken = query({
  args: { token: v.string() },
  returns: v.union(
    v.object({ valid: v.literal(true), email: v.string(), name: v.optional(v.string()) }),
    v.object({ valid: v.literal(false), reason: v.string() }),
  ),
  handler: async (ctx, args) => {
    if (args.token.length < 32) {
      return { valid: false as const, reason: "Pozivnica nije ispravna." };
    }
    const tokenHash = await hashToken(args.token);
    const invite = await ctx.db
      .query("invites")
      .withIndex("by_tokenHash", (q) => q.eq("tokenHash", tokenHash))
      .unique();

    if (invite === null) {
      return { valid: false as const, reason: "Pozivnica nije pronađena." };
    }
    if (invite.revokedAt !== undefined) {
      return { valid: false as const, reason: "Pozivnica je otkazana." };
    }
    if (invite.acceptedAt !== undefined) {
      return { valid: false as const, reason: "Pozivnica je već iskorišćena." };
    }
    if (invite.expiresAt < Date.now()) {
      return { valid: false as const, reason: "Pozivnica je istekla." };
    }
    return {
      valid: true as const,
      email: invite.email,
      ...(invite.name !== undefined ? { name: invite.name } : {}),
    };
  },
});
