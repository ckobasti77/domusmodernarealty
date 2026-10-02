/// <reference types="vite/client" />
import { beforeAll, describe, expect, test } from "vitest";
import { Scrypt } from "lucia";
import { api } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { testApp } from "../../tests/unit/convex-harness";

/**
 * Step 15: staff change their own password ("Promenite lozinku"). The current
 * password goes through the sign-in check (same lockout), the new one is stored
 * with the provider's Scrypt settings, and every other session of the account
 * ends while the one making the change stays signed in.
 */

const EMAIL = "owner@agency.test";
const PASSWORD = "CorrectHorse9";
const NEW_PASSWORD = "Battery-Staple-42";

function base64(bytes: ArrayBuffer): string {
  let out = "";
  for (const byte of new Uint8Array(bytes)) out += String.fromCharCode(byte);
  return btoa(out);
}

// Signing in with the new password issues a signed JWT, so the auth runtime needs a key pair.
beforeAll(async () => {
  const pair = (await crypto.subtle.generateKey(
    { name: "RSASSA-PKCS1-v1_5", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" },
    true,
    ["sign", "verify"],
  )) as CryptoKeyPair;
  const pkcs8 = await crypto.subtle.exportKey("pkcs8", pair.privateKey);
  const lines = base64(pkcs8).match(/.{1,64}/g) ?? [];
  process.env.JWT_PRIVATE_KEY = `-----BEGIN PRIVATE KEY-----\n${lines.join("\n")}\n-----END PRIVATE KEY-----`;
  process.env.JWKS = "{}";
  process.env.CONVEX_SITE_URL = "https://example.convex.site";
});

type Ids = { userId: Id<"users">; current: Id<"authSessions">; other: Id<"authSessions"> };

async function setup(status: "active" | "disabled" = "active") {
  const t = testApp();
  const hash = await new Scrypt().hash(PASSWORD);
  const ids: Ids = await t.run(async (ctx) => {
    const userId = await ctx.db.insert("users", { email: EMAIL, name: "Vlasnik", role: "agent", status });
    await ctx.db.insert("authAccounts", { userId, provider: "password", providerAccountId: EMAIL, secret: hash });
    const expirationTime = Date.now() + 86_400_000;
    const current = await ctx.db.insert("authSessions", { userId, expirationTime });
    const other = await ctx.db.insert("authSessions", { userId, expirationTime });
    await ctx.db.insert("authRefreshTokens", { sessionId: other, expirationTime });
    return { userId, current, other };
  });
  // The auth library reads "<userId>|<sessionId>" from the token's subject.
  const asOwner = t.withIdentity({ subject: `${ids.userId}|${ids.current}` });
  return { t, ids, asOwner };
}

async function failure(promise: Promise<unknown>): Promise<string> {
  try {
    await promise;
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
  throw new Error("expected the call to fail");
}

async function storedSecret(t: ReturnType<typeof testApp>): Promise<string> {
  return t.run(async (ctx) => {
    const account = await ctx.db
      .query("authAccounts")
      .withIndex("providerAndAccountId", (q) => q.eq("provider", "password").eq("providerAccountId", EMAIL))
      .unique();
    return account?.secret ?? "";
  });
}

describe("users.changeOwnPassword", () => {
  test("the right current password stores the new one and ends only the other sessions", async () => {
    const { t, ids, asOwner } = await setup();
    const result = await asOwner.action(api.users.changeOwnPassword, {
      currentPassword: PASSWORD,
      newPassword: NEW_PASSWORD,
    });
    expect(result).toEqual({ endedSessions: 1 });

    const secret = await storedSecret(t);
    expect(await new Scrypt().verify(secret, NEW_PASSWORD)).toBe(true);
    expect(await new Scrypt().verify(secret, PASSWORD)).toBe(false);

    const left = await t.run(async (ctx) => ({
      current: await ctx.db.get("authSessions", ids.current),
      other: await ctx.db.get("authSessions", ids.other),
      tokens: await ctx.db
        .query("authRefreshTokens")
        .withIndex("sessionId", (q) => q.eq("sessionId", ids.other))
        .take(5),
      log: await ctx.db
        .query("activity")
        .withIndex("by_entityId_and_at", (q) => q.eq("entityId", ids.userId))
        .take(5),
    }));
    expect(left.current).not.toBeNull();
    expect(left.other).toBeNull();
    expect(left.tokens).toHaveLength(0);
    expect(left.log.map((row) => row.action)).toContain("user.password");
    expect(JSON.stringify(left.log)).not.toContain(NEW_PASSWORD);
  });

  test("sign-in then takes the new password and refuses the old one", async () => {
    const { t, asOwner } = await setup();
    await asOwner.action(api.users.changeOwnPassword, { currentPassword: PASSWORD, newPassword: NEW_PASSWORD });
    const signIn = (password: string) =>
      t.action(api.auth.signIn, { provider: "password", params: { email: EMAIL, password, flow: "signIn" } });
    expect((await signIn(NEW_PASSWORD)).tokens?.token).toMatch(/^ey/);
    expect(await failure(signIn(PASSWORD))).toMatch(/InvalidSecret/);
  });

  test("a wrong current password changes nothing and counts toward the sign-in lockout", async () => {
    const { t, ids, asOwner } = await setup();
    const before = await storedSecret(t);
    const message = await failure(
      asOwner.action(api.users.changeOwnPassword, { currentPassword: "not-my-password", newPassword: NEW_PASSWORD }),
    );
    expect(message).toMatch(/Trenutna lozinka nije tačna/);
    expect(await storedSecret(t)).toBe(before);
    const other = await t.run(async (ctx) => ctx.db.get("authSessions", ids.other));
    expect(other).not.toBeNull();

    for (let i = 0; i < 9; i += 1) {
      await failure(
        asOwner.action(api.users.changeOwnPassword, { currentPassword: `wrong-${i}-pass`, newPassword: NEW_PASSWORD }),
      );
    }
    // Ten failures: even the right password is refused now, here and at sign-in.
    expect(
      await failure(
        asOwner.action(api.users.changeOwnPassword, { currentPassword: PASSWORD, newPassword: NEW_PASSWORD }),
      ),
    ).toMatch(/RATE_LIMITED/);
    expect(
      await failure(
        t.action(api.auth.signIn, {
          provider: "password",
          params: { email: EMAIL, password: PASSWORD, flow: "signIn" },
        }),
      ),
    ).toMatch(/TooManyFailedAttempts/);
  });

  test("the new password must have 10-128 characters and differ from the current one", async () => {
    const { asOwner } = await setup();
    expect(
      await failure(asOwner.action(api.users.changeOwnPassword, { currentPassword: PASSWORD, newPassword: "short" })),
    ).toMatch(/INVALID_INPUT/);
    expect(
      await failure(
        asOwner.action(api.users.changeOwnPassword, { currentPassword: PASSWORD, newPassword: "x".repeat(129) }),
      ),
    ).toMatch(/INVALID_INPUT/);
    expect(
      await failure(asOwner.action(api.users.changeOwnPassword, { currentPassword: PASSWORD, newPassword: PASSWORD })),
    ).toMatch(/razlikuje od trenutne/);
  });

  test("anonymous callers and disabled accounts are refused", async () => {
    const anonymous = await setup();
    expect(
      await failure(
        anonymous.t.action(api.users.changeOwnPassword, { currentPassword: PASSWORD, newPassword: NEW_PASSWORD }),
      ),
    ).toMatch(/UNAUTHENTICATED/);

    const disabled = await setup("disabled");
    expect(
      await failure(
        disabled.asOwner.action(api.users.changeOwnPassword, { currentPassword: PASSWORD, newPassword: NEW_PASSWORD }),
      ),
    ).toMatch(/FORBIDDEN/);
  });
});
