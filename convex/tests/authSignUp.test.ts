/// <reference types="vite/client" />
import { beforeAll, describe, expect, test } from "vitest";
import { Scrypt } from "lucia";
import { api } from "../_generated/api";
import { testApp } from "../../tests/unit/convex-harness";
import { hashToken } from "../lib/tokens";

/**
 * Review 14, SEC-1: the library's sign-up path used to treat an EXISTING account
 * as an unthrottled password check that logged the caller in, and answered
 * staff addresses differently from unknown ones. Sign-up now needs an open
 * invite for an address without an account, and every refusal is identical.
 */

const STAFF = "boss@agency.test";
const PASSWORD = "CorrectHorse9";
const INVITED = "new.agent@agency.test";
const TOKEN = "a".repeat(32) + "b".repeat(32);

function base64(bytes: ArrayBuffer): string {
  let out = "";
  for (const byte of new Uint8Array(bytes)) out += String.fromCharCode(byte);
  return btoa(out);
}

// Sessions are signed JWTs, so the auth runtime needs a real key pair.
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

async function setup() {
  const t = testApp();
  const hash = await new Scrypt().hash(PASSWORD);
  const tokenHash = await hashToken(TOKEN);
  await t.run(async (ctx) => {
    const userId = await ctx.db.insert("users", { email: STAFF, name: "Boss", role: "admin", status: "active" });
    await ctx.db.insert("authAccounts", { userId, provider: "password", providerAccountId: STAFF, secret: hash });
    await ctx.db.insert("invites", {
      email: INVITED,
      role: "manager",
      tokenHash,
      expiresAt: Date.now() + 86_400_000,
    });
  });
  return t;
}

type Flow = { email: string; password: string; flow: string; inviteToken?: string; name?: string };

function signIn(t: ReturnType<typeof testApp>, params: Flow) {
  return t.action(api.auth.signIn, { provider: "password", params });
}

async function failure(promise: Promise<unknown>): Promise<string> {
  try {
    await promise;
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
  throw new Error("expected the call to fail");
}

async function sessionCount(t: ReturnType<typeof testApp>): Promise<number> {
  return t.run(async (ctx) => (await ctx.db.query("authSessions").take(20)).length);
}

describe("sign-up cannot be used against existing accounts", () => {
  test("the right password through signUp is refused and opens no session", async () => {
    const t = await setup();
    const message = await failure(signIn(t, { email: STAFF, password: PASSWORD, flow: "signUp" }));
    expect(message).toMatch(/FORBIDDEN/);
    expect(await sessionCount(t)).toBe(0);
  });

  test("a locked account stays locked: signUp is no side door", async () => {
    const t = await setup();
    for (let i = 0; i < 10; i += 1) {
      await failure(signIn(t, { email: STAFF, password: `wrong-pass-${i}`, flow: "signIn" }));
    }
    expect(await failure(signIn(t, { email: STAFF, password: PASSWORD, flow: "signIn" }))).toMatch(
      /TooManyFailedAttempts/,
    );
    expect(await failure(signIn(t, { email: STAFF, password: PASSWORD, flow: "signUp" }))).toMatch(/FORBIDDEN/);
    expect(await sessionCount(t)).toBe(0);
  });

  test("staff and unknown addresses get the same answer", async () => {
    const t = await setup();
    const staff = await failure(signIn(t, { email: STAFF, password: "whatever-123", flow: "signUp" }));
    const unknown = await failure(signIn(t, { email: "nobody@agency.test", password: "whatever-123", flow: "signUp" }));
    const strip = (text: string) => text.replace(/\[Request ID: [^\]]+\]\s*/g, "");
    expect(strip(staff)).toBe(strip(unknown));
  });

  test("an invite for an address that already has an account is refused", async () => {
    const t = await setup();
    const tokenHash = await hashToken("c".repeat(64));
    await t.run(async (ctx) =>
      ctx.db.insert("invites", { email: STAFF, role: "agent", tokenHash, expiresAt: Date.now() + 86_400_000 }),
    );
    const message = await failure(
      signIn(t, { email: STAFF, password: PASSWORD, flow: "signUp", inviteToken: "c".repeat(64) }),
    );
    expect(message).toMatch(/FORBIDDEN/);
    expect(await sessionCount(t)).toBe(0);
  });
});

describe("the invite and sign-in flows still work", () => {
  test("an open invite creates the account with the invite's role, exactly once", async () => {
    const t = await setup();
    const result = await signIn(t, {
      email: INVITED,
      password: "a-long-password",
      flow: "signUp",
      inviteToken: TOKEN,
      name: "Nova Agentkinja",
    });
    expect(result.tokens?.token).toMatch(/^ey/);
    const user = await t.run(async (ctx) =>
      ctx.db.query("users").withIndex("by_email", (q) => q.eq("email", INVITED)).unique(),
    );
    expect(user?.role).toBe("manager");
    expect(user).not.toHaveProperty("pendingInviteToken");

    const again = await failure(
      signIn(t, { email: INVITED, password: "a-long-password", flow: "signUp", inviteToken: TOKEN }),
    );
    expect(again).toMatch(/FORBIDDEN/);
  });

  test("the server enforces the password length on sign-up", async () => {
    const t = await setup();
    const message = await failure(
      signIn(t, { email: INVITED, password: "short", flow: "signUp", inviteToken: TOKEN }),
    );
    expect(message).toMatch(/INVALID_INPUT/);
  });

  test("an existing password hash still signs in", async () => {
    const t = await setup();
    const result = await signIn(t, { email: STAFF, password: PASSWORD, flow: "signIn" });
    expect(result.tokens?.token).toMatch(/^ey/);
  });

  test("unknown flows are refused", async () => {
    const t = await setup();
    expect(await failure(signIn(t, { email: STAFF, password: PASSWORD, flow: "reset" }))).toMatch(/INVALID_INPUT/);
  });
});
