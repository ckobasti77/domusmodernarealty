import { expect, test, type Page, type TestInfo } from "@playwright/test";
import { locales, type Locale } from "../../i18n/routing";
import {
  localizedPath,
  ORDINARY_LISTING,
  presetVisitor,
  realSlugs,
  scrollThrough,
  SHOWCASE_LISTING,
  type Route,
  type Slugs,
} from "./helpers/routes";

/**
 * Night-run step 12: security crawl.
 *
 *  1. Every public route in all four locales, plus /admin/login, is loaded in a
 *     real browser, waited on until the network settles, then scrolled to the
 *     bottom in steps so lazy sections, maps and scroll triggers mount. The page
 *     must produce ZERO `securitypolicyviolation` events (captured on `window`
 *     by an init script, so violations raised before hydration count too), ZERO
 *     `console.error` messages and ZERO uncaught page errors.
 *  2. The security headers on one public HTML response and on /admin/login.
 *  3. The 360° tour on the showcase listing loads without a CSP violation.
 *
 * ONE allowlist, deliberately narrow: a NETWORK-LEVEL failure (`net::ERR_*`,
 * `Failed to fetch`) of a request to https://tiles.openfreemap.org. The tile host
 * has been unreachable from this machine (DECISIONS [07] "Maps give up after
 * 12 s and say so"), and the browser logs each dead tile request as a console
 * error the app cannot suppress. An HTTP error status from that host, a CSP
 * refusal of it, or anything from any other host is still a failure. Allowed
 * entries are attached to the test as an annotation, never silently dropped.
 *
 * The visitor has accepted ALL cookie categories (the strictest CSP case:
 * anything consent-gated would load) and has two real listings in favorites
 * and compare, so those two pages render cards rather than their empty state.
 */

const TILE_HOST = "https://tiles.openfreemap.org";

type CspViolation = {
  directive: string;
  blocked: string;
  source: string;
  sample: string;
  disposition: string;
  document: string;
};

type Watch = { errors: string[]; allowed: string[] };

/* ------------------------------------------------------------------ helpers */

/** Stores every CSP violation of the page on `window.__cspViolations`, from the first byte of script. */
async function watchCsp(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const store: unknown[] = [];
    Object.defineProperty(window, "__cspViolations", { value: store, configurable: true });
    // Capture phase on window: the event is dispatched on the offending element
    // (bubbling through document) or on the global object itself; both pass here.
    window.addEventListener(
      "securitypolicyviolation",
      (event) => {
        store.push({
          directive: event.effectiveDirective || event.violatedDirective,
          blocked: event.blockedURI,
          source: event.sourceFile ? `${event.sourceFile}:${event.lineNumber}:${event.columnNumber}` : "",
          sample: event.sample,
          disposition: event.disposition,
          document: event.documentURI,
        });
      },
      true,
    );
  });
}

async function cspViolations(page: Page): Promise<CspViolation[]> {
  return await page.evaluate(
    () => ((window as unknown as { __cspViolations?: CspViolation[] }).__cspViolations ?? []).slice(),
  );
}

/** A dead tile request: network-level only, and only to the OpenFreeMap host. */
function isAllowedTileFailure(text: string, url: string): boolean {
  const fromTileHost = url.startsWith(`${TILE_HOST}/`) || text.includes(`${TILE_HOST}/`);
  const networkLevel = /net::ERR_[A-Z_]+|Failed to fetch/.test(text);
  const cspRefusal = /Content Security Policy/i.test(text);
  return fromTileHost && networkLevel && !cspRefusal;
}

/** console.error messages (page and its workers) and uncaught page errors, from now on. */
function watchConsole(page: Page): Watch {
  const watch: Watch = { errors: [], allowed: [] };
  page.on("console", (message) => {
    if (message.type() !== "error") return;
    const { url, lineNumber } = message.location();
    const text = message.text();
    if (isAllowedTileFailure(text, url ?? "")) {
      watch.allowed.push(`${text} (${url})`);
      return;
    }
    const where = url ? ` [at ${url}:${lineNumber}]` : "";
    watch.errors.push(`console.error: ${text}${where}`);
  });
  page.on("pageerror", (error) => {
    const stack = (error.stack ?? "").split("\n").slice(1, 4).join(" | ");
    watch.errors.push(`pageerror: ${error.message}${stack ? ` — ${stack}` : ""}`);
  });
  return watch;
}

/** The Header publishes `--header-h` from an effect: proof the public shell has hydrated. */
async function publicShellHydrated(page: Page): Promise<void> {
  await expect
    .poll(() => page.evaluate(() => document.documentElement.style.getPropertyValue("--header-h")), {
      message: "the public shell should hydrate (Header writes --header-h)",
      timeout: 20_000,
    })
    .not.toBe("");
}

/** Every map on the page reaches a final state: drawn, gave up (tiles), or no WebGL. */
async function mapsSettled(page: Page): Promise<void> {
  const maps = page.locator("[data-map-state]");
  const count = await maps.count();
  for (let i = 0; i < count; i += 1) {
    await expect(maps.nth(i), `map ${i + 1} of ${count}`).toHaveAttribute(
      "data-map-state",
      /^(ready|unavailable|unsupported)$/,
      { timeout: 30_000 },
    );
  }
}

function report(testInfo: TestInfo, path: string, watch: Watch): void {
  if (watch.allowed.length > 0) {
    testInfo.annotations.push({
      type: "allowlisted",
      description: `${watch.allowed.length} OpenFreeMap tile request(s) failed at network level on ${path}`,
    });
  }
}

function formatViolations(violations: CspViolation[]): string {
  return violations
    .map((v) => `  - ${v.disposition} ${v.directive}: blocked ${v.blocked || "(inline)"} ${v.source} ${v.sample ? `"${v.sample}"` : ""}`)
    .join("\n");
}

/**
 * Load → settle → scroll to the bottom in steps → settle again, then judge.
 * `ready` is an extra page-specific condition awaited before scrolling.
 */
async function crawl(page: Page, path: string, testInfo: TestInfo, admin = false): Promise<void> {
  const watch = watchConsole(page);
  await watchCsp(page);

  const response = await page.goto(path);
  expect(response?.status(), `${path} status`).toBe(200);
  await page.waitForLoadState("networkidle");
  if (!admin) await publicShellHydrated(page);

  await scrollThrough(page);
  await mapsSettled(page);
  await page.waitForLoadState("networkidle");
  // Violations are queued as tasks; one round-trip through the page drains them.
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => setTimeout(resolve, 0))));

  const violations = await cspViolations(page);
  report(testInfo, path, watch);
  expect.soft(violations, `CSP violations on ${path}:\n${formatViolations(violations)}`).toEqual([]);
  expect.soft(watch.errors, `console errors on ${path}:\n${watch.errors.join("\n")}`).toEqual([]);
}

/* ------------------------------------------------------------- the routes */

type Target = { route: Route; label: string; slug?: (slugs: Slugs) => string };

const TARGETS: Target[] = [
  { route: "/", label: "home" },
  { route: "/properties", label: "search" },
  { route: "/properties/[slug]", label: "listing ME-1049 (showcase)", slug: () => SHOWCASE_LISTING },
  { route: "/properties/[slug]", label: "listing ME-1042", slug: () => ORDINARY_LISTING },
  { route: "/locations", label: "locations" },
  { route: "/locations/[slug]", label: "location detail", slug: (s) => s.location },
  { route: "/agents", label: "agents" },
  { route: "/agents/[slug]", label: "agent profile", slug: (s) => s.agent },
  { route: "/valuation", label: "valuation" },
  { route: "/sell", label: "sell" },
  { route: "/about", label: "about" },
  { route: "/contact", label: "contact" },
  { route: "/journal", label: "journal" },
  { route: "/journal/[slug]", label: "journal article", slug: (s) => s.post },
  { route: "/favorites", label: "favorites" },
  { route: "/compare", label: "compare" },
  { route: "/privacy", label: "privacy" },
  { route: "/terms", label: "terms" },
  { route: "/cookies", label: "cookies" },
];

test.describe("security crawl: zero CSP violations and a clean console", () => {
  let slugs: Slugs;

  test.beforeAll(async ({}, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "The crawl runs once, on the desktop project.");
    slugs = await realSlugs();
  });

  for (const locale of locales) {
    for (const target of TARGETS) {
      test(`${target.label} (${target.route}) in ${locale} @public @i18n`, async ({ page }, testInfo) => {
        test.setTimeout(120_000);
        const path = localizedPath(target.route, locale as Locale, target.slug?.(slugs));
        await presetVisitor(page, { acceptAll: true, favorites: slugs.listingIds, compare: slugs.listingIds });
        await crawl(page, path, testInfo);
      });
    }
  }

  test("/admin/login @admin", async ({ page }, testInfo) => {
    test.setTimeout(90_000);
    await crawl(page, "/admin/login", testInfo, true);
    await expect(page.getByRole("button", { name: "Prijavite se" })).toBeVisible();
  });
});

/* -------------------------------------------------------- security headers */

function directives(csp: string): Map<string, string[]> {
  const map = new Map<string, string[]>();
  for (const part of csp.split(";")) {
    const [name, ...values] = part.trim().split(/\s+/);
    if (name) map.set(name.toLowerCase(), values);
  }
  return map;
}

test.describe("security headers", () => {
  test.beforeEach(async ({}, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "Headers do not depend on the viewport.");
  });

  for (const path of ["/sr", "/admin/login"] as const) {
    test(`${path} carries the hardened header set ${path === "/sr" ? "@public" : "@admin"}`, async ({ request }) => {
      const response = await request.get(path, { maxRedirects: 0 });
      expect(response.status(), path).toBe(200);
      const headers = response.headers();
      expect(headers["content-type"], "an HTML document").toMatch(/^text\/html/);

      const csp = headers["content-security-policy"];
      expect(csp, `${path} Content-Security-Policy`).toBeTruthy();
      const policy = directives(csp ?? "");
      expect(policy.get("frame-ancestors"), "frame-ancestors").toEqual(["'none'"]);
      expect(policy.get("object-src"), "object-src").toEqual(["'none'"]);
      expect(policy.get("base-uri"), "base-uri").toEqual(["'self'"]);

      expect(headers["x-content-type-options"], "X-Content-Type-Options").toBe("nosniff");
      expect(headers["referrer-policy"], "Referrer-Policy").toBe("strict-origin-when-cross-origin");
      const permissions = (headers["permissions-policy"] ?? "").split(",").map((entry) => entry.trim());
      expect(permissions, "Permissions-Policy").toContain("camera=()");
      expect(permissions, "Permissions-Policy").toContain("microphone=()");
      expect(headers["x-frame-options"], "X-Frame-Options").toBe("DENY");
      expect(headers["x-powered-by"], "no framework banner").toBeUndefined();

      if (path === "/admin/login") {
        expect(headers["x-robots-tag"], "X-Robots-Tag").toBe("noindex, nofollow");
        // The admin policy, not the public one: the panel embeds no third-party frames.
        expect(policy.get("frame-src"), "admin frame-src").toEqual(["'none'"]);
      } else {
        expect(policy.get("frame-src"), "public frame-src").toContain("https://my.matterport.com");
      }
    });
  }
});

/* ---------------------------------------------------------------- 360° tour */

test.describe("360° tour under the CSP", () => {
  test("the showcase tour (ME-1049) loads its panorama without a CSP violation @public", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "One proof is enough; tours.spec.ts covers both projects.");
    test.setTimeout(90_000);
    const path = localizedPath("/properties/[slug]", "sr-Latn", SHOWCASE_LISTING);
    const watch = watchConsole(page);
    await watchCsp(page);
    await presetVisitor(page, { acceptAll: true });
    await page.goto(path);
    await publicShellHydrated(page);

    // `listing.tabs.label` ("Fotografije, planovi i ture"); the prefix keeps a copy edit from breaking the proof.
    const tabs = page.getByRole("tablist", { name: /^Fotografije, planovi/ });
    await tabs.getByRole("tab", { name: /360° tura/ }).click();
    const panel = page.locator('[data-tour-slot="tour360"]');
    await expect(panel).toContainText("4 prostorije");
    await panel.locator('[data-launch="tour360"]').click();

    const dialog = page.getByRole("dialog", { name: /360° tura/ });
    await expect(dialog).toBeVisible();
    const viewer = dialog.locator("[data-tour360]");
    await expect(viewer.locator("canvas").first()).toBeVisible({ timeout: 30_000 });
    // The first scene is drawn once the viewer names it; switching rooms loads a second panorama.
    await expect(viewer).toHaveAttribute("data-current-scene", /\S/, { timeout: 30_000 });
    const first = await viewer.getAttribute("data-current-scene");
    await dialog.getByRole("navigation", { name: "Prostorije" }).getByRole("button", { name: "Kupatilo" }).click();
    await expect(viewer).not.toHaveAttribute("data-current-scene", first ?? "", { timeout: 30_000 });
    await page.waitForLoadState("networkidle");

    const violations = await cspViolations(page);
    report(testInfo, path, watch);
    expect.soft(violations, `CSP violations while the 360° tour loads:\n${formatViolations(violations)}`).toEqual([]);
    expect.soft(watch.errors, `console errors while the 360° tour loads:\n${watch.errors.join("\n")}`).toEqual([]);
  });
});
