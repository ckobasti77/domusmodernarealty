import { Password } from "@convex-dev/auth/providers/Password";
import { convexAuth } from "@convex-dev/auth/server";
import type { MutationCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { appError } from "./lib/errors";
import { MIN_TOKEN_LENGTH, hashToken } from "./lib/tokens";
import type { Role } from "./lib/validators";

type PasswordProfile = {
  email: string;
  name?: string;
  pendingInviteToken?: string;
};

const INVITE_ONLY =
  "Registracija je moguća samo preko važeće pozivnice. Obratite se administratoru.";

/**
 * Invite-only Password auth.
 *
 * `createOrUpdateUser` is the single gate. A brand-new account is accepted only
 * when the caller presents the INVITE TOKEN itself — matching on the invited
 * email alone would let anyone who knows a colleague's address claim their
 * account (and their role) before they read the mail.
 *
 * The token travels as an extra `signIn` param, through `profile()`, on the
 * transient `users.pendingInviteToken` field; it is never written to the row.
 * The bootstrap (`seed:createAdmin`) mints a real invite and passes its token the
 * same way, so there is exactly one code path.
 */
export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [
    Password({
      profile(params) {
        const email = String(params.email ?? "").trim().toLowerCase();
        const rawName = params.name;
        const name = typeof rawName === "string" ? rawName.trim() : undefined;
        const rawToken = params.inviteToken;
        const inviteToken =
          typeof rawToken === "string" ? rawToken.trim() : undefined;

        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
          appError("INVALID_INPUT", "Unesite ispravnu email adresu.");
        }
        return {
          email,
          ...(name !== undefined && name.length > 0 ? { name } : {}),
          // Overridden from the invite in `createOrUpdateUser`; never trusted.
          role: "agent" as Role,
          status: "active" as const,
          ...(inviteToken !== undefined && inviteToken.length > 0
            ? { pendingInviteToken: inviteToken }
            : {}),
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

      const token = profile.pendingInviteToken;
      if (token === undefined || token.length < MIN_TOKEN_LENGTH) {
        appError("FORBIDDEN", INVITE_ONLY);
      }

      const tokenHash = await hashToken(token);
      const invite = await ctx.db
        .query("invites")
        .withIndex("by_tokenHash", (q) => q.eq("tokenHash", tokenHash))
        .unique();

      if (
        invite === null ||
        invite.email !== email ||
        invite.acceptedAt !== undefined ||
        invite.revokedAt !== undefined ||
        invite.expiresAt < Date.now()
      ) {
        appError("FORBIDDEN", INVITE_ONLY);
      }

      const userId: Id<"users"> = await ctx.db.insert("users", {
        email,
        name: profile.name ?? invite.name,
        // The role comes from the invite, never from the sign-up form.
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
