import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { mutation, query, type MutationCtx } from "./_generated/server";
import {
  DEFAULT_AGENT_ROLE,
  insertAgentProfile,
  openInvitesForAgent,
} from "./agentsAdmin";
import { logActivity } from "./lib/activity";
import { requireRole } from "./lib/auth";
import { invalidInput, notFound } from "./lib/errors";
import { requireEmail } from "./lib/rateLimit";
import { MIN_TOKEN_LENGTH, hashToken, randomToken } from "./lib/tokens";
import { roleV, type Role } from "./lib/validators";

const ADMINS = ["admin"] as const;
/** An invite link works for 7 days and exactly once (`auth.ts` consumes it). */
const INVITE_TTL_MS = 7 * 86_400_000;

const ROLE_SR: Record<Role, string> = {
  admin: "Administrator",
  manager: "Menadžer",
  agent: "Agent",
  editor: "Urednik",
};

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
      agentId: v.optional(v.id("agents")),
      agentName: v.optional(v.string()),
      createdByName: v.optional(v.string()),
    }),
  ),
  handler: async (ctx) => {
    await requireRole(ctx, ADMINS);
    const docs = await ctx.db.query("invites").order("desc").take(100);
    const out = [];
    for (const doc of docs) {
      const agent = doc.agentId !== undefined ? await ctx.db.get("agents", doc.agentId) : null;
      const author = doc.createdBy !== undefined ? await ctx.db.get("users", doc.createdBy) : null;
      const authorName = author?.name ?? author?.email;
      out.push({
        _id: doc._id,
        email: doc.email,
        ...(doc.name !== undefined ? { name: doc.name } : {}),
        role: doc.role,
        expiresAt: doc.expiresAt,
        ...(doc.acceptedAt !== undefined ? { acceptedAt: doc.acceptedAt } : {}),
        ...(doc.revokedAt !== undefined ? { revokedAt: doc.revokedAt } : {}),
        createdAt: doc._creationTime,
        ...(doc.agentId !== undefined ? { agentId: doc.agentId } : {}),
        ...(agent !== null ? { agentName: agent.name } : {}),
        ...(authorName !== undefined ? { createdByName: authorName } : {}),
      });
    }
    return out;
  },
});

async function assertNoAccount(ctx: MutationCtx, email: string): Promise<void> {
  const existingUser = await ctx.db
    .query("users")
    .withIndex("by_email", (q) => q.eq("email", email))
    .first();
  if (existingUser !== null) {
    invalidInput("Korisnik sa tom email adresom već postoji.");
  }
}

/**
 * The profile an invite will link: it must exist, have no account yet, and
 * not be promised to a different address by another open invite.
 */
async function assertLinkableAgent(
  ctx: MutationCtx,
  agentId: Id<"agents">,
  email: string,
  now: number,
): Promise<Doc<"agents">> {
  const agent = await ctx.db.get("agents", agentId);
  if (agent === null) notFound("Profil agenta");
  if (agent.userId !== undefined && (await ctx.db.get("users", agent.userId)) !== null) {
    invalidInput("Taj profil agenta je već povezan sa nalogom.");
  }
  const rival = (await openInvitesForAgent(ctx, agentId, now)).find(
    (invite) => invite.email !== email,
  );
  if (rival !== undefined) {
    invalidInput(
      `Za profil „${agent.name}” već postoji otvorena pozivnica (${rival.email}). Opozovite je pre nove.`,
    );
  }
  return agent;
}

/**
 * Creates an invite and returns the RAW token exactly once; only its hash is
 * stored. The acceptance page (`/admin/pozivnica/<token>`) posts it back with
 * `flow: "signUp"`, and `auth.ts::createOrUpdateUser` consumes it.
 *
 * Role `agent` must come with a profile: an existing unlinked one (`agentId`)
 * or a new hidden one made here (`agentName`), so the new agent sees exactly
 * their own leads and listings from the first sign-in.
 */
export const create = mutation({
  args: {
    email: v.string(),
    name: v.optional(v.string()),
    role: roleV,
    agentId: v.optional(v.id("agents")),
    /** Creates a new (non-public) agent profile with this name and links it. */
    agentName: v.optional(v.string()),
  },
  returns: v.object({
    id: v.id("invites"),
    token: v.string(),
    expiresAt: v.number(),
    agentId: v.optional(v.id("agents")),
  }),
  handler: async (ctx, args) => {
    const viewer = await requireRole(ctx, ADMINS);
    const email = requireEmail(args.email);
    const name = args.name?.trim().replace(/\s+/g, " ").slice(0, 120);
    const agentName = args.agentName?.trim().replace(/\s+/g, " ").slice(0, 80);

    await assertNoAccount(ctx, email);
    if (args.agentId !== undefined && agentName !== undefined) {
      invalidInput("Izaberite postojeći profil ili unesite ime novog, ne oba.");
    }
    if (args.role === "editor" && (args.agentId !== undefined || agentName !== undefined)) {
      invalidInput("Urednik se ne povezuje sa profilom agenta.");
    }
    if (args.role === "agent" && args.agentId === undefined && agentName === undefined) {
      invalidInput("Za ulogu Agent izaberite profil agenta ili napravite novi.");
    }
    if (agentName !== undefined && agentName.length < 2) {
      invalidInput("Unesite ime za novi profil agenta.");
    }

    const now = Date.now();
    if (args.agentId !== undefined) {
      await assertLinkableAgent(ctx, args.agentId, email, now);
    }

    // Supersede any open invite for the same address: only the newest link works.
    const open = await ctx.db
      .query("invites")
      .withIndex("by_email", (q) => q.eq("email", email))
      .order("desc")
      .take(20);
    for (const invite of open) {
      if (invite.acceptedAt === undefined && invite.revokedAt === undefined) {
        await ctx.db.patch("invites", invite._id, { revokedAt: now });
      }
    }

    let agentId = args.agentId;
    if (agentName !== undefined) {
      const created = await insertAgentProfile(ctx, {
        name: agentName,
        role: DEFAULT_AGENT_ROLE,
        languages: ["sr"],
        areas: [],
        // Hidden until someone completes it (photo, bio, contact channels).
        // The login address is deliberately not copied to the public profile.
        isPublic: false,
      });
      agentId = created.id;
      await logActivity(ctx, {
        entity: "agent",
        entityId: created.id,
        action: "agent.created",
        summary: `${agentName} (uz pozivnicu za ${email})`,
        by: viewer._id,
      });
    }

    const token = randomToken();
    const expiresAt = now + INVITE_TTL_MS;
    const id = await ctx.db.insert("invites", {
      email,
      ...(name !== undefined && name.length > 0 ? { name } : {}),
      role: args.role,
      tokenHash: await hashToken(token),
      expiresAt,
      createdBy: viewer._id,
      ...(agentId !== undefined ? { agentId } : {}),
    });

    await logActivity(ctx, {
      entity: "user",
      entityId: id,
      action: "invite.created",
      summary: `${email} (${ROLE_SR[args.role]})`,
      by: viewer._id,
    });

    return { id, token, expiresAt, ...(agentId !== undefined ? { agentId } : {}) };
  },
});

/**
 * A fresh link for an invite that was not used yet (lost link, or it
 * expired): the old token stops working and the 7 days start again. The raw
 * token is returned once, like `create`.
 */
export const renew = mutation({
  args: { id: v.id("invites") },
  returns: v.object({ token: v.string(), expiresAt: v.number() }),
  handler: async (ctx, args) => {
    const viewer = await requireRole(ctx, ADMINS);
    const doc = await ctx.db.get("invites", args.id);
    if (doc === null) notFound("Pozivnica");
    if (doc.acceptedAt !== undefined) invalidInput("Pozivnica je već prihvaćena.");
    if (doc.revokedAt !== undefined) {
      invalidInput("Pozivnica je opozvana. Pošaljite novu pozivnicu.");
    }
    await assertNoAccount(ctx, doc.email);
    const now = Date.now();
    if (doc.agentId !== undefined) {
      await assertLinkableAgent(ctx, doc.agentId, doc.email, now);
    }

    const token = randomToken();
    const expiresAt = now + INVITE_TTL_MS;
    await ctx.db.patch("invites", doc._id, {
      tokenHash: await hashToken(token),
      expiresAt,
    });
    await logActivity(ctx, {
      entity: "user",
      entityId: doc._id,
      action: "invite.renewed",
      summary: doc.email,
      by: viewer._id,
    });
    return { token, expiresAt };
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
    if (doc.revokedAt !== undefined) return null;
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
 * only — never the role, nor who invited.
 *
 * `now` is an argument because a query must not read the wall clock: a cached
 * result would keep claiming a lapsed invite is still valid. The authoritative
 * expiry check is in `auth.ts::createOrUpdateUser`, which runs in a mutation.
 */
export const checkToken = query({
  args: { token: v.string(), now: v.number() },
  returns: v.union(
    v.object({ valid: v.literal(true), email: v.string(), name: v.optional(v.string()) }),
    v.object({ valid: v.literal(false), reason: v.string() }),
  ),
  handler: async (ctx, args) => {
    if (args.token.length < MIN_TOKEN_LENGTH) {
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
    if (invite.expiresAt < args.now) {
      return { valid: false as const, reason: "Pozivnica je istekla." };
    }
    return {
      valid: true as const,
      email: invite.email,
      ...(invite.name !== undefined ? { name: invite.name } : {}),
    };
  },
});
