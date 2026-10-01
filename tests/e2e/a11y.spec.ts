import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Locator, type Page, type TestInfo } from "@playwright/test";
import {
  localizedPath,
  ORDINARY_LISTING,
  presetVisitor,
  realSlugs,
  SHOWCASE_LISTING,
  scrollThrough,
  scrollToY,
  waitForVisualSettle,
  type Route,
  type Slugs,
} from "./helpers/routes";

/**
 * Night-run steps 12 + 13: accessibility (PRD C).
 *
 *  1. axe (WCAG 2.0/2.1 A+AA and 2.2 AA tags) on EVERY public Serbian route,
 *     the localized 404 and /admin/login, on both projects (desktop 1440 and
 *     Pixel 7). Every violation is printed (impact, rule, targets) and
 *     attached as JSON; the test fails on any `serious` or `critical` one.
 *     Cookie banner: the choice ("necessary only") is recorded in localStorage
 *     BEFORE the page loads, so the banner is absent on every page. The
 *     banner-open state is judged by landing.spec.ts and a11y-focus.spec.ts.
 *     Each page is scrolled top to bottom (every reveal plays, lazy sections
 *     mount), back to the top, and judged only once nothing animates any more.
 *  2. Keyboard: the skip link and the main navigation (desktop), the phone menu
 *     (mobile project), the search filter panel, the gallery lightbox and the
 *     contact form's tab order and error wiring.
 *
 * More: a11y-focus.spec.ts (dialogs, banner, funnel, inquiry errors),
 * a11y-keyboard.spec.ts (no keyboard traps) and a11y-motion.spec.ts (reduced
 * motion).
 */

const AXE_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

/** The main navigation's links, in order (messages/sr-Latn.json `nav`). */
const NAV_LINKS = ["Nekretnine", "Lokacije", "Procena", "Prodajte", "Magazin", "O nama", "Kontakt"];

/* ------------------------------------------------------------------ helpers */

/** The Header publishes `--header-h` from an effect: proof the public shell has hydrated. */
async function shellHydrated(page: Page): Promise<void> {
  await expect
    .poll(() => page.evaluate(() => document.documentElement.style.getPropertyValue("--header-h")), {
      message: "the public shell should hydrate (Header writes --header-h)",
      timeout: 20_000,
    })
    .not.toBe("");
}

/** A short description of whatever has focus, for failure messages. */
function describeFocus(page: Page): Promise<string> {
  return page.evaluate(() => {
    const el = document.activeElement;
    if (el === null || el === document.body) return "<body>";
    const name = el.getAttribute("aria-label") ?? (el as HTMLElement).innerText?.trim().slice(0, 40) ?? "";
    return `<${el.tagName.toLowerCase()}${el.id ? `#${el.id}` : ""}> "${name}"`;
  });
}

/** Presses Tab until `target` has focus; fails if it is not reached within `max` presses. */
async function tabTo(page: Page, target: Locator, what: string, max = 60): Promise<number> {
  for (let presses = 1; presses <= max; presses += 1) {
    await page.keyboard.press("Tab");
    if (await target.evaluate((element) => element === document.activeElement).catch(() => false)) return presses;
  }
  throw new Error(`${what} was not reached within ${max} Tab presses (focus is on ${await describeFocus(page)})`);
}

/** True when `container` holds the focused element. */
function holdsFocus(container: Locator): Promise<boolean> {
  return container.evaluate((element) => element.contains(document.activeElement));
}

/** The keyboard focus indicator is painted: an outline or a box-shadow. */
function focusIndicator(locator: Locator): Promise<{ visible: boolean; outline: string; shadow: string }> {
  return locator.evaluate((element) => {
    const style = getComputedStyle(element);
    const outline = `${style.outlineStyle} ${style.outlineWidth} ${style.outlineColor}`;
    const hasOutline = style.outlineStyle !== "none" && parseFloat(style.outlineWidth) > 0;
    const hasShadow = style.boxShadow !== "none" && style.boxShadow !== "";
    return { visible: hasOutline || hasShadow, outline, shadow: style.boxShadow };
  });
}

type AxeLine = { impact: string; id: string; help: string; targets: string[] };

async function axeAudit(page: Page, label: string, testInfo: TestInfo): Promise<AxeLine[]> {
  const results = await new AxeBuilder({ page }).withTags(AXE_TAGS).analyze();
  const lines: AxeLine[] = results.violations.map((violation) => ({
    impact: violation.impact ?? "unknown",
    id: violation.id,
    help: violation.help,
    targets: violation.nodes.map((node) => node.target.join(" ")),
  }));
  // Every violation, whatever its impact, goes to the test output.
  for (const line of lines) {
    console.log(`[axe] ${label} | ${line.impact} | ${line.id} (${line.help}) | ${line.targets.join(" || ")}`);
  }
  if (lines.length === 0) console.log(`[axe] ${label} | no violations`);
  await testInfo.attach(`axe-${label.replace(/[^a-z0-9]+/gi, "-")}.json`, {
    body: JSON.stringify(lines, null, 2),
    contentType: "application/json",
  });
  return lines;
}

/* -------------------------------------------------------------------- axe */

/** ME-1063 is seeded as sold: the "Prodato" state of the detail page. */
const SOLD_LISTING = "dvoiposoban-stan-na-julinom-brdu-osmi-sprat-sa-lodjom-me-1063";
/** The city page (the top of the location tree). */
const CITY = "beograd";
/** Any path no route matches: the localized `[locale]/not-found.tsx`. */
const UNKNOWN_PATH = "/sr/ova-stranica-ne-postoji-a11y";

type AxeTarget = {
  label: string;
  /** A localized public route, or a literal path (the 404 and the admin). */
  route: Route | { path: string };
  slug?: (slugs: Slugs) => string;
  status?: number;
  /** Seeds the favorites / compare stores with two real listings. */
  store?: "favorites" | "compare";
  /** Proof the page's own content has rendered, beyond the shell. */
  ready?: (page: Page) => Locator;
  /** Not inside the public locale layout (no Header to hydrate). */
  admin?: boolean;
};

/**
 * Every public route in Serbian, plus the localized 404 and the admin sign-in
 * (night-run step 13). Runs on BOTH projects: desktop 1440 and Pixel 7.
 */
const AXE_PAGES: AxeTarget[] = [
  { label: "home", route: "/" },
  {
    label: "search",
    route: "/properties",
    ready: (page) => page.locator('[data-search-bar][data-ready="true"]'),
  },
  { label: "listing ME-1049 (showcase, tours)", route: "/properties/[slug]", slug: () => SHOWCASE_LISTING },
  { label: "listing ME-1042", route: "/properties/[slug]", slug: () => ORDINARY_LISTING },
  { label: "listing ME-1063 (sold)", route: "/properties/[slug]", slug: () => SOLD_LISTING },
  { label: "locations", route: "/locations" },
  { label: "city beograd", route: "/locations/[slug]", slug: () => CITY },
  { label: "neighborhood", route: "/locations/[slug]", slug: (s) => s.location },
  { label: "valuation", route: "/valuation", ready: (page) => page.getByTestId("valuation-step-1") },
  { label: "sell", route: "/sell" },
  { label: "agents", route: "/agents" },
  { label: "agent profile", route: "/agents/[slug]", slug: (s) => s.agent },
  { label: "about", route: "/about" },
  { label: "contact", route: "/contact", ready: (page) => page.getByTestId("contact-form") },
  { label: "journal", route: "/journal" },
  { label: "journal article", route: "/journal/[slug]", slug: (s) => s.post },
  { label: "favorites", route: "/favorites", store: "favorites", ready: (page) => page.getByTestId("favorites-grid") },
  { label: "compare", route: "/compare", store: "compare", ready: (page) => page.getByTestId("compare-table") },
  { label: "privacy", route: "/privacy" },
  { label: "terms", route: "/terms" },
  { label: "cookies", route: "/cookies" },
  { label: "localized 404", route: { path: UNKNOWN_PATH }, status: 404 },
  {
    label: "admin login",
    route: { path: "/admin/login" },
    admin: true,
    ready: (page) => page.getByRole("button", { name: "Prijavite se" }),
  },
];

test.describe("axe: WCAG 2.2 AA on every public route (sr) and the admin sign-in", () => {
  let slugs: Slugs;

  test.beforeAll(async () => {
    slugs = await realSlugs();
  });

  for (const target of AXE_PAGES) {
    const area = target.admin === true ? "@admin" : "@public";
    test(`${target.label} has no serious or critical violations ${area} @a11y`, async ({ page }, testInfo) => {
      test.setTimeout(150_000);
      const path =
        typeof target.route === "string"
          ? localizedPath(target.route, "sr-Latn", target.slug?.(slugs))
          : target.route.path;
      await presetVisitor(page, {
        ...(target.store === "favorites" ? { favorites: slugs.listingIds } : {}),
        ...(target.store === "compare" ? { compare: slugs.listingIds } : {}),
      });
      const response = await page.goto(path);
      expect(response?.status(), path).toBe(target.status ?? 200);
      if (target.admin !== true) await shellHydrated(page);
      if (target.ready !== undefined) await expect(target.ready(page)).toBeVisible({ timeout: 30_000 });
      await page.waitForLoadState("networkidle");

      // Every reveal plays once it has been scrolled past; judge the final paint.
      await scrollThrough(page);
      await scrollToY(page, 0);
      await waitForVisualSettle(page);

      const lines = await axeAudit(page, `${testInfo.project.name} ${path}`, testInfo);
      const blocking = lines
        .filter((line) => line.impact === "serious" || line.impact === "critical")
        .map((line) => `${line.impact} ${line.id}: ${line.targets.join(" | ")}`);
      expect(blocking, `serious/critical axe violations on ${path} (${testInfo.project.name})`).toEqual([]);
    });
  }
});

/* --------------------------------------------------------------- keyboard */

test.describe("keyboard: header", () => {
  test("the skip link is the first Tab stop and moves focus to #main @public @a11y", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "desktop project");
    await presetVisitor(page);
    await page.goto("/sr");
    await shellHydrated(page);

    await page.keyboard.press("Tab");
    const skip = page.getByRole("link", { name: "Pređi na sadržaj" });
    await expect(skip, "the first Tab stop is the skip link").toBeFocused();
    await expect(skip, "a focused skip link is shown on screen").toBeInViewport();
    expect((await focusIndicator(skip)).visible, "the skip link draws a focus indicator").toBe(true);

    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/#main$/);
    // What the brief asks for: the main landmark itself takes focus. Soft, so
    // the functional fallback below is still reported when this fails.
    await expect
      .soft(page.locator("#main"), `#main should hold focus after the skip link (focus is on ${await describeFocus(page)})`)
      .toBeFocused();

    // Either way, the next Tab must continue INSIDE main, past the header.
    await page.keyboard.press("Tab");
    expect(
      await page.locator("#main").evaluate((main) => main.contains(document.activeElement) && main !== document.activeElement),
      `the Tab after the skip link should land inside #main (focus is on ${await describeFocus(page)})`,
    ).toBe(true);
  });

  test("the main navigation is reachable by Tab, in order, with a visible focus style @public @a11y", async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "the inline navigation is shown from 1024px up");
    await presetVisitor(page);
    await page.goto("/sr");
    await shellHydrated(page);

    const nav = page.getByRole("navigation", { name: "Glavna navigacija" });
    const first = nav.getByRole("link", { name: NAV_LINKS[0], exact: true });
    // Skip link, then the logo, then the navigation.
    const presses = await tabTo(page, first, `the "${NAV_LINKS[0]}" nav link`, 5);
    expect(presses, "Tab stops before the first nav link (skip link, logo)").toBe(3);

    for (const [index, name] of NAV_LINKS.entries()) {
      const link = nav.getByRole("link", { name, exact: true });
      if (index > 0) await page.keyboard.press("Tab");
      await expect(link, `Tab ${index + 3} focuses "${name}"`).toBeFocused();
      const indicator = await focusIndicator(link);
      expect(indicator.visible, `"${name}" focus style (outline: ${indicator.outline}; box-shadow: ${indicator.shadow})`).toBe(
        true,
      );
      expect(await link.evaluate((element) => element.matches(":focus-visible")), `"${name}" matches :focus-visible`).toBe(true);
    }
  });

  test("phone: the menu button opens the menu with Enter, Escape closes it and returns focus @public @a11y", async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== "mobile", "the menu button only exists below 1024px (mobile project)");
    await presetVisitor(page);
    await page.goto("/sr");
    await shellHydrated(page);

    const toggle = page.getByRole("button", { name: "Otvori meni" });
    await tabTo(page, toggle, "the menu button", 10);
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
    await page.keyboard.press("Enter");

    const menu = page.getByRole("dialog", { name: "Meni" });
    await expect(menu).toBeVisible();
    await expect(toggle).toHaveAttribute("aria-expanded", "true");
    await expect.poll(() => holdsFocus(menu), { message: "focus moves into the menu" }).toBe(true);
    await expect(menu.getByRole("button", { name: "Zatvori meni" })).toBeFocused();

    // Focus stays inside while the visitor tabs through it.
    for (let i = 0; i < 3; i += 1) {
      await page.keyboard.press("Tab");
      expect(await holdsFocus(menu), `Tab ${i + 1} inside the open menu keeps focus in it`).toBe(true);
    }

    await page.keyboard.press("Escape");
    await expect(menu).toBeHidden();
    await expect(toggle, "Escape returns focus to the menu button").toBeFocused();
  });
});

test.describe("keyboard: search filters", () => {
  test("the filters panel opens from the keyboard, holds focus, and Escape returns it to the trigger @public @a11y", async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "the desktop filter bar");
    await presetVisitor(page);
    await page.goto("/sr/nekretnine");
    await expect(page.locator('[data-search-bar][data-ready="true"]')).toBeVisible({ timeout: 30_000 });

    const trigger = page.getByRole("button", { name: /^Svi filteri/ });
    await tabTo(page, trigger, 'the "Svi filteri" trigger', 60);
    await page.keyboard.press("Enter");

    const panel = page.getByRole("dialog");
    await expect(panel).toBeVisible();
    await expect(panel).toHaveAccessibleName(/\S/);
    await expect.poll(() => holdsFocus(panel), { message: "focus moves into the filters panel" }).toBe(true);
    await page.keyboard.press("Tab");
    expect(await holdsFocus(panel), "Tab keeps focus inside the modal panel").toBe(true);

    await page.keyboard.press("Escape");
    await expect(panel).toBeHidden();
    await expect(trigger, "Escape returns focus to the trigger").toBeFocused();
  });
});

test.describe("keyboard: gallery lightbox", () => {
  test("the cover opens the lightbox with Enter, ArrowRight advances, Escape closes and returns focus @public @a11y", async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "desktop project");
    await presetVisitor(page);
    await page.goto(`/sr/nekretnine/${ORDINARY_LISTING}`);
    await shellHydrated(page);

    const cover = page.getByRole("button", { name: /^Otvorite fotografiju 1 od \d+$/ });
    const total = Number(((await cover.getAttribute("aria-label")) ?? "").match(/od (\d+)$/)?.[1] ?? "0");
    expect(total, "the listing has more than one photo").toBeGreaterThan(1);
    await tabTo(page, cover, "the gallery cover", 60);
    await page.keyboard.press("Enter");

    const lightbox = page.getByRole("dialog", { name: "Galerija fotografija" });
    await expect(lightbox).toBeVisible();
    await expect.poll(() => holdsFocus(lightbox), { message: "focus moves into the lightbox" }).toBe(true);

    // The position counter: the current slide is announced as "N od TOTAL".
    const current = lightbox.locator(".yarl__slide_current");
    await expect(current).toHaveAttribute("aria-label", `1 od ${total}`);
    await page.keyboard.press("ArrowRight");
    await expect(current).toHaveAttribute("aria-label", `2 od ${total}`);
    await page.keyboard.press("ArrowRight");
    await expect(current).toHaveAttribute("aria-label", `3 od ${total}`);

    await page.keyboard.press("Escape");
    await expect(lightbox).toHaveCount(0);
    await expect(cover, "Escape returns focus to the cover").toBeFocused();
  });
});

test.describe("keyboard: contact form", () => {
  test("Tab walks the fields in reading order; an empty submit marks and describes every required field @public @forms @a11y", async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "desktop project");
    await presetVisitor(page);
    await page.goto("/sr/kontakt");
    await shellHydrated(page);

    const form = page.getByTestId("contact-form");
    const name = form.getByLabel("Ime i prezime");
    const phone = form.getByLabel(/^Telefon/);
    const email = form.getByLabel("E-pošta");
    const subject = form.getByLabel(/^Tema/);
    const message = form.getByLabel("Poruka", { exact: true });
    const privacy = form.getByRole("checkbox", { name: /Saglasan\/na sam/ });
    const marketing = form.getByRole("checkbox", { name: /povremeno primam/ });
    const submit = form.getByRole("button", { name: "Pošaljite" });

    await tabTo(page, name, "the name field", 80);

    // Walk forward from the name field to the submit button, recording each stop.
    const order: { key: string; box: { x: number; y: number } }[] = [];
    const fields: [string, Locator][] = [
      ["name", name],
      ["phone", phone],
      ["email", email],
      ["subject", subject],
      ["message", message],
      ["privacy", privacy],
      ["marketing", marketing],
      ["submit", submit],
    ];
    for (let stop = 0; stop < 15; stop += 1) {
      for (const [key, locator] of fields) {
        // Document coordinates (rect + scroll, read in one frame): focusing a
        // field scrolls the page, so viewport coordinates are not comparable.
        const box = await locator.evaluate((element) => {
          if (element !== document.activeElement) return null;
          const rect = element.getBoundingClientRect();
          return { x: Math.round(rect.left + window.scrollX), y: Math.round(rect.top + window.scrollY) };
        });
        if (box !== null) order.push({ key, box });
      }
      if (order.at(-1)?.key === "submit") break;
      await page.keyboard.press("Tab");
    }
    const keys = order.map((entry) => entry.key);
    console.log(`[keyboard] /sr/kontakt tab order: ${keys.join(" → ")}`);

    // Every required control (name, e-mail, message, consent) and the submit are reached...
    for (const key of ["name", "email", "message", "privacy", "submit"]) {
      expect(keys, `Tab reaches ${key}`).toContain(key);
    }
    // ...in reading order: the same row left to right, otherwise top to bottom.
    for (let i = 1; i < order.length; i += 1) {
      const before = order[i - 1];
      const after = order[i];
      const sameRow = Math.abs(after.box.y - before.box.y) < 8;
      expect(
        sameRow ? after.box.x > before.box.x : after.box.y > before.box.y,
        `"${after.key}" follows "${before.key}" in reading order (${JSON.stringify(before.box)} → ${JSON.stringify(after.box)})`,
      ).toBe(true);
    }
    expect(keys.indexOf("name")).toBeLessThan(keys.indexOf("email"));
    expect(keys.indexOf("email")).toBeLessThan(keys.indexOf("message"));
    expect(keys.indexOf("message")).toBeLessThan(keys.indexOf("privacy"));
    expect(keys.indexOf("privacy")).toBeLessThan(keys.indexOf("submit"));

    // Submit the empty form with Enter.
    await expect(submit).toBeFocused();
    await page.keyboard.press("Enter");

    for (const [key, field] of [
      ["name", name],
      ["email", email],
      ["message", message],
      ["privacy", privacy],
    ] as const) {
      await expect(field, `${key} is marked invalid`).toHaveAttribute("aria-invalid", "true");
      await expect(field, `${key} is described by its error`).toHaveAccessibleDescription(/\S/);
      const describedBy = (await field.getAttribute("aria-describedby")) ?? "";
      expect(describedBy, `${key} has aria-describedby`).not.toBe("");
      const message = page.locator(`[id="${describedBy.split(/\s+/)[0]}"]`);
      await expect(message, `${key}'s error is announced`).toHaveRole("alert");
      await expect(message).toHaveText(/\S/);
    }
    // The optional fields stay valid.
    await expect(phone).toHaveAttribute("aria-invalid", "false");
    await expect(subject).toHaveAttribute("aria-invalid", "false");
    // And the visitor is taken to the first problem.
    await expect(name, "focus moves to the first invalid field").toBeFocused();
  });
});
