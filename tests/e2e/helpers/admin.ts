import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { expect, test, type Browser, type BrowserContext, type Locator, type Page, type TestInfo } from "@playwright/test";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../convex/_generated/api";

/**
 * Shared helpers for the admin e2e suite (night-run step 08).
 *
 * Credentials come from `E2E_ADMIN_EMAIL` + `E2E_ADMIN_PASSWORD`, or else from
 * night-run/state/admin.json (gitignored, written by the night-run bootstrap),
 * and are never logged: no helper puts the password into an error message.
 */

const ROOT = process.cwd();
const CONVEX_CLI = path.join(ROOT, "node_modules", "convex", "bin", "main.js");

export type Creds = { email: string; password: string };

/** An admin account on the dev deployment: the environment first, then the night-run file. */
export function readAdminCreds(): Creds {
  const email = process.env.E2E_ADMIN_EMAIL;
  const password = process.env.E2E_ADMIN_PASSWORD;
  if (email !== undefined && email.length > 0 && password !== undefined && password.length > 0) {
    return { email, password };
  }
  const file = path.join(ROOT, "night-run", "state", "admin.json");
  if (!existsSync(file)) {
    throw new Error(
      "No admin credentials: set E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD (an admin on the dev deployment), " +
        "or provide night-run/state/admin.json",
    );
  }
  const raw = JSON.parse(readFileSync(file, "utf8")) as Partial<Creds>;
  if (typeof raw.email !== "string" || typeof raw.password !== "string" || raw.password.length === 0) {
    throw new Error("night-run/state/admin.json must hold { email, password }");
  }
  return { email: raw.email, password: raw.password };
}

/** The dev deployment URL, read the same way scripts/check-auth.mjs reads it. */
export function convexUrl(): string {
  const envFile = path.join(ROOT, ".env.local");
  const line = existsSync(envFile)
    ? readFileSync(envFile, "utf8")
        .split(/\r?\n/)
        .find((entry) => entry.startsWith("NEXT_PUBLIC_CONVEX_URL="))
    : undefined;
  const url =
    line
      ?.slice(line.indexOf("=") + 1)
      .trim()
      .replace(/^["']|["']$/g, "") ?? process.env.NEXT_PUBLIC_CONVEX_URL;
  if (url === undefined || url.length === 0) throw new Error("NEXT_PUBLIC_CONVEX_URL missing from .env.local");
  return url;
}

/**
 * Runs an INTERNAL Convex function against the dev deployment. Same pattern as
 * listing-detail.spec.ts: node + the CLI entry directly, no shell, so the JSON
 * argument needs no quoting on Windows.
 */
export function convexRun<T>(fn: string, args: Record<string, unknown>): T {
  const out = execFileSync(process.execPath, [CONVEX_CLI, "run", fn, JSON.stringify(args)], {
    cwd: ROOT,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  // `convex run` prints nothing at all for a `null` return value.
  return (out.trim().length === 0 ? null : JSON.parse(out)) as T;
}

/** A ConvexHttpClient signed in through the real Password flow (`flow: "signIn"`). */
export async function signedInClient(creds: Creds): Promise<ConvexHttpClient> {
  const url = convexUrl();
  const result = await new ConvexHttpClient(url).action(api.auth.signIn, {
    provider: "password",
    params: { email: creds.email, password: creds.password, flow: "signIn" },
  });
  const token = result.tokens?.token;
  if (typeof token !== "string" || token.length === 0) {
    throw new Error(`Password sign-in for ${creds.email} returned no token`);
  }
  const client = new ConvexHttpClient(url);
  client.setAuth(token);
  return client;
}

let adminClient: Promise<ConvexHttpClient> | undefined;

/** One signed-in admin client per worker. */
export function adminHttpClient(): Promise<ConvexHttpClient> {
  adminClient ??= signedInClient(readAdminCreds()).catch((error: unknown) => {
    adminClient = undefined;
    throw error;
  });
  return adminClient;
}

export type ConvexErrorData = { code?: string; message?: string; reasons?: string[] };

/**
 * Awaits a call that MUST be refused and returns the ConvexError payload
 * (`{ code, message, reasons? }` from convex/lib/errors.ts).
 */
export async function refusal(call: Promise<unknown>): Promise<ConvexErrorData> {
  try {
    await call;
  } catch (error) {
    const data = (error as { data?: unknown }).data;
    if (typeof data === "object" && data !== null) return data as ConvexErrorData;
    throw new Error(`Expected a ConvexError with a data payload, got: ${String(error).slice(0, 300)}`);
  }
  throw new Error("Expected the Convex call to be refused, but it succeeded");
}

/** The admin suite proves each flow once, on the desktop project. */
export function desktopOnly(testInfo: TestInfo): void {
  test.skip(testInfo.project.name !== "desktop", "The admin suite runs once, on the desktop project.");
}

/**
 * `browser.newContext()` does not inherit the project's `use` options (baseURL,
 * viewport, locale, timezone), so contexts made in hooks get them explicitly.
 */
export async function projectContext(browser: Browser, testInfo: TestInfo): Promise<BrowserContext> {
  const use = testInfo.project.use;
  return await browser.newContext({
    baseURL: use.baseURL,
    viewport: use.viewport,
    locale: use.locale,
    timezoneId: use.timezoneId,
    userAgent: use.userAgent,
    deviceScaleFactor: use.deviceScaleFactor,
    isMobile: use.isMobile,
    hasTouch: use.hasTouch,
  });
}

/** The admin sidebar (shadcn `Sidebar`; desktop panel and mobile sheet both carry this marker). */
export function sidebar(page: Page): Locator {
  return page.locator('[data-sidebar="sidebar"]');
}

/** Signs in through /admin/login and waits for the dashboard shell. */
export async function loginViaUi(page: Page, email: string, password: string): Promise<void> {
  await page.goto("/admin/login");
  await page.getByLabel("E-pošta", { exact: true }).fill(email);
  await page.getByLabel("Lozinka", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Prijavite se" }).click();
  await expect(page).toHaveURL(/\/admin\/?$/, { timeout: 20_000 });
  await expect(sidebar(page)).toBeVisible();
}

/**
 * Marks consent as decided and the intro curtain as seen before any public page
 * script runs, so neither overlay intercepts clicks (same keys as the other specs).
 */
export async function quietPublicPage(page: Page): Promise<void> {
  await page.addInitScript(() => {
    window.localStorage.setItem(
      "me.consent.v1",
      JSON.stringify({ v: 1, decidedAt: Date.now(), categories: { necessary: true, analytics: false, marketing: false } }),
    );
    window.sessionStorage.setItem("me.preloaded.v1", "1");
  });
}

/** tests/fixtures/listing-N.jpg, generated by `node scripts/make-fixtures.mjs`. */
export function fixture(n: number): string {
  const file = path.join(ROOT, "tests", "fixtures", `listing-${n}.jpg`);
  if (!existsSync(file)) throw new Error(`${file} is missing: run \`node scripts/make-fixtures.mjs\``);
  return file;
}

/** yyyy-mm-dd in Belgrade time (the project timezone), `days` from today. */
export function belgradeDate(days = 0): string {
  const at = new Date(Date.now() + days * 86_400_000);
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Belgrade",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(at);
}
