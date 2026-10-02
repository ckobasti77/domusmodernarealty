import { ConvexCredentials } from "@convex-dev/auth/providers/ConvexCredentials";
import { convexAuth, createAccount, retrieveAccount } from "@convex-dev/auth/server";
import { Scrypt } from "lucia";
import { internal } from "./_generated/api";
import type { MutationCtx } from "./_generated/server";
import type { DataModel, Id } from "./_generated/dataModel";
import { appError } from "./lib/errors";
import { MIN_TOKEN_LENGTH, hashToken } from "./lib/tokens";
import type { Role } from "./lib/validators";

type PasswordProfile = {
  email: string;
  name?: string;
  pendingInviteToken?: string;
};

const PROVIDER = "password";
const INVITE_ONLY =
  "Registracija je moguća samo preko važeće pozivnice. Obratite se administratoru.";
/** Same bounds as the invite form (`InviteScreen.tsx`); the server is the rule. */
const PASSWORD_MIN = 10;
const PASSWORD_MAX = 128;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function trimmed(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

/**
 * Invite-only password auth.
 *
 * The provider is written out (instead of the library's `Password`) because
 * `Password`'s sign-up path treats an EXISTING account as a password check that
 * logs the caller in and never counts a failure: an unlimited guessing channel
 * past the sign-in lockout, and an oracle telling staff addresses apart. Here:
 *
 * - `signIn` is the library's rate-limited `retrieveAccount` (10 failures/hour
 *   lock the account), exactly as before.
 * - `signUp` first asks `invites.canSignUp`: the invite must be open for this
 *   address AND no account may exist for it yet. Every refusal is the same
 *   `FORBIDDEN`, and no password is ever compared on this path.
 * - Any other flow is refused.
 *
 * `createOrUpdateUser` stays the single gate that creates a user: it re-checks
 * the invite token inside the account-creating mutation (atomic acceptance) and
 * takes the role from the invite. The token travels on the transient
 * `users.pendingInviteToken` profile field; it is never written to the row. The
 * bootstrap (`seed:createAdmin`) mints a real invite and passes its token the
 * same way, so there is exactly one code path.
 *
 * Hashes use lucia's Scrypt, the same scheme `Password` used, so existing
 * accounts keep signing in.
 */
export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [
    ConvexCredentials<DataModel>({
      id: PROVIDER,
      authorize: async (params, ctx) => {
        const email = trimmed(params.email).toLowerCase();
        if (!EMAIL_RE.test(email)) {
          appError("INVALID_INPUT", "Unesite ispravnu email adresu.");
        }
        const password = params.password;
        if (typeof password !== "string" || password.length === 0) {
          appError("INVALID_INPUT", "Unesite lozinku.");
        }

        if (params.flow === "signIn") {
          // Throws on an unknown address, a wrong password or a locked account;
          // the login form shows one generic message for all three.
          const { user } = await retrieveAccount(ctx, {
            provider: PROVIDER,
            account: { id: email, secret: password },
          });
          return { userId: user._id };
        }

        if (params.flow === "signUp") {
          const inviteToken = trimmed(params.inviteToken);
          const allowed =
            inviteToken.length >= MIN_TOKEN_LENGTH &&
            (await ctx.runQuery(internal.invites.canSignUp, {
              tokenHash: await hashToken(inviteToken),
              email,
              now: Date.now(),
            }));
          if (!allowed) appError("FORBIDDEN", INVITE_ONLY);
          if (password.length < PASSWORD_MIN || password.length > PASSWORD_MAX) {
            appError(
              "INVALID_INPUT",
              `Lozinka mora imati od ${PASSWORD_MIN} do ${PASSWORD_MAX} znakova.`,
            );
          }
          const name = trimmed(params.name);
          const { user } = await createAccount(ctx, {
            provider: PROVIDER,
            account: { id: email, secret: password },
            profile: {
              email,
              ...(name.length > 0 ? { name } : {}),
              // Overridden from the invite in `createOrUpdateUser`; never trusted.
              role: "agent" as Role,
              status: "active" as const,
              pendingInviteToken: inviteToken,
            },
            shouldLinkViaEmail: false,
            shouldLinkViaPhone: false,
          });
          return { userId: user._id };
        }

        return appError("INVALID_INPUT", "Nepodržan način prijave.");
      },
      crypto: {
        hashSecret: (secret) => new Scrypt().hash(secret),
        verifySecret: (secret, hash) => new Scrypt().verify(hash, secret),
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

      // The promised profile must still exist and be free (an admin may have
      // removed or linked it since the invite was sent).
      const agent = invite.agentId !== undefined ? await ctx.db.get("agents", invite.agentId) : null;
      if (invite.agentId !== undefined && (agent === null || agent.userId !== undefined)) {
        appError("FORBIDDEN", INVITE_ONLY);
      }

      const userId: Id<"users"> = await ctx.db.insert("users", {
        email,
        name: (profile.name ?? invite.name)?.trim().slice(0, 120),
        // The role comes from the invite, never from the sign-up form.
        role: invite.role,
        status: "active",
        ...(invite.agentId !== undefined ? { agentId: invite.agentId } : {}),
      });

      await ctx.db.patch("invites", invite._id, { acceptedAt: Date.now() });

      if (invite.agentId !== undefined) {
        await ctx.db.patch("agents", invite.agentId, { userId, isDemo: false });
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
