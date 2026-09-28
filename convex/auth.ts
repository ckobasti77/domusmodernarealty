import { Password } from "@convex-dev/auth/providers/Password";
import { convexAuth } from "@convex-dev/auth/server";
import type { MutationCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { appError } from "./lib/errors";
import type { Role } from "./lib/validators";

type PasswordProfile = { email: string; name?: string };

/**
 * Invite-only Password auth.
 *
 * `createOrUpdateUser` is the single gate: a brand-new account is accepted only
 * when a pending, non-expired, unrevoked invite exists for that email. The
 * bootstrap path (`seed:createAdmin`) creates such an invite first, so there is
 * exactly one code path and no "first user is free" hole.
 */
export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [
    Password({
      profile(params) {
        const email = String(params.email ?? "").trim().toLowerCase();
        const rawName = params.name;
        const name = typeof rawName === "string" ? rawName.trim() : undefined;
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
          appError("INVALID_INPUT", "Unesite ispravnu email adresu.");
        }
        return {
          email,
          ...(name !== undefined && name.length > 0 ? { name } : {}),
          role: "agent" as Role,
          status: "active" as const,
        };
      },
    }),
  ],
  callbacks: {
    async createOrUpdateUser(ctx: MutationCtx, args) {
      if (args.existingUserId !== null) {
        const existing = await ctx.db.get("users", args.existingUserId);
        if (existing !== null && existing.status === "disabled") {
          appError("FORBIDDEN", "Pristup je onemogućen za ovaj račun.");
        }
        return args.existingUserId;
      }

      const profile = args.profile as PasswordProfile;
      const email = (profile.email ?? "").trim().toLowerCase();
      if (email.length === 0) {
        appError("INVALID_INPUT", "Email adresa je obavezna.");
      }

      const invite = await ctx.db
        .query("invites")
        .withIndex("by_email", (q) => q.eq("email", email))
        .order("desc")
        .first();

      if (
        invite === null ||
        invite.acceptedAt !== undefined ||
        invite.revokedAt !== undefined ||
        invite.expiresAt < Date.now()
      ) {
        appError(
          "FORBIDDEN",
          "Registracija je moguća samo po pozivnici. Obratite se administratoru.",
        );
      }

      const userId: Id<"users"> = await ctx.db.insert("users", {
        email,
        name: profile.name ?? invite.name,
        role: invite.role,
        status: "active",
        ...(invite.agentId !== undefined ? { agentId: invite.agentId } : {}),
      });

      await ctx.db.patch("invites", invite._id, { acceptedAt: Date.now() });

      if (invite.agentId !== undefined) {
        await ctx.db.patch("agents", invite.agentId, { userId });
      }

      await ctx.db.insert("activity", {
        entity: "user",
        entityId: userId,
        action: "invite.accepted",
        summary: `${email} je prihvatio pozivnicu (${invite.role})`,
        by: userId,
        at: Date.now(),
      });

      return userId;
    },

    async beforeSessionCreation(ctx: MutationCtx, { userId }) {
      const user = await ctx.db.get("users", userId);
      if (user === null) {
        appError("FORBIDDEN", "Račun ne postoji.");
      }
      if (user.status === "disabled") {
        appError("FORBIDDEN", "Pristup je onemogućen za ovaj račun.");
      }
    },
  },
});
