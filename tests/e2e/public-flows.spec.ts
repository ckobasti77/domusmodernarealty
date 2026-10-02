import { readFileSync } from "node:fs";
import path from "node:path";
import { expect, test, type Locator, type Page } from "@playwright/test";
import { ConvexHttpClient } from "convex/browser";
import type { FunctionReturnType } from "convex/server";
import { api } from "../../convex/_generated/api";
import { htmlLang, locales, type Locale } from "../../i18n/routing";
import { convexUrl } from "./helpers/admin";
import { localizedPath, ORDINARY_LISTING, presetVisitor, realSlugs, scrollToY, SHOWCASE_LISTING } from "./helpers/routes";

/**
 * Night-run step 13: the PRD public user-flow acceptance criteria that no other
 * spec proves yet (see the coverage map in the step report). Nothing here
 * writes to Convex: favorites, compare and consent live in the browser, so every
 * test cleans up simply by closing its context.
 *
 * "Convex truth" is always read at test time through the public queries (the
 * same ones the site calls), so a listing another agent publishes mid-run does
 * not make an expectation stale.
 *
 *  A1  language switcher on a listing and a location page; header solid past
 *      80 px with no layout shift.
 *  A2  first-visit preloader: shows once per session, ends by 1.8 s, skippable.
 *  A3  "added within", the empty state's "clear filters", sort by €/m².
 *  A4  card carousel (arrows, keyboard, swipe), €/m² and the monthly rate.
 *  A5  share links, similar listings, only the media tabs that have data.
 *  A8  location listing counts against their pages and the live search.
 *  A9  an agent's active listings, each naming that agent.
 *  A11 journal category filter; article reading time and share links.
 *  A12 favorites: heart → header counter → /omiljeno → removal (+ undo).
 *  A13 legal pages in four locales without the staff-only draft notice.
 *  A1  cookie consent: no analytics/marketing request without consent.
 */

/* ------------------------------------------------------------------ types */

type SaleCard = FunctionReturnType<typeof api.listings.search>["page"][number];
type ListingDetail = Extract<NonNullable<FunctionReturnType<typeof api.listings.bySlug>>, { kind: "listing" }>["listing"];

/* ---------------------------------------------------------------- helpers */

function client(): ConvexHttpClient {
  return new ConvexHttpClient(convexUrl());
}

/** Every listed card of a transaction, straight from Convex (the demo data fits one page). */
async function allListed(transaction: "sale" | "rent", filters: Record<string, unknown> = {}): Promise<SaleCard[]> {
  const result = await client().query(api.listings.search, {
    filters: { transaction, ...filters },
    sort: "newest",
    paginationOpts: { numItems: 500, cursor: null },
  });
  expect(result.isDone, "the listed cards fit one page").toBe(true);
  return result.page;
}

async function listingBySlug(slug: string): Promise<ListingDetail> {
  const result = await client().query(api.listings.bySlug, { slug });
  if (result === null || result.kind !== "listing") throw new Error(`no public listing ${slug}`);
  return result.listing;
}

/** A plain message string from messages/<locale>.json (no ICU arguments). */
const messageCache = new Map<Locale, Record<string, unknown>>();
function msg(locale: Locale, key: string): string {
  let messages = messageCache.get(locale);
  if (messages === undefined) {
    messages = JSON.parse(readFileSync(path.join(process.cwd(), "messages", `${locale}.json`), "utf8")) as Record<
      string,
      unknown
    >;
    messageCache.set(locale, messages);
  }
  let node: unknown = messages;
  for (const part of key.split(".")) node = (node as Record<string, unknown> | undefined)?.[part];
  if (typeof node !== "string") throw new Error(`messages/${locale}.json has no string at ${key}`);
  return node;
}

/** "2.092 €" → 2092; "Trenutno bez ponude" → 0. */
function digits(text: string | null): number {
  const only = (text ?? "").replace(/\D+/g, "");
  return only.length === 0 ? 0 : Number(only);
}

/** The Header publishes `--header-h` from an effect: proof the public shell has hydrated. */
async function shellHydrated(page: Page): Promise<void> {
  await expect
    .poll(() => page.evaluate(() => document.documentElement.style.getPropertyValue("--header-h")), {
      message: "the public shell should hydrate (Header writes --header-h)",
      timeout: 20_000,
    })
    .not.toBe("");
}

/** The search island marks its filter bar ready once hydrated. */
async function searchReady(page: Page): Promise<void> {
  await expect(page.locator('[data-search-bar][data-ready="true"]')).toBeVisible({ timeout: 30_000 });
}

function resultCards(page: Page): Locator {
  return page.getByTestId("results-list").locator("article[data-listing-id]");
}

async function shownIds(page: Page): Promise<string[]> {
  return await resultCards(page).evaluateAll((nodes) => nodes.map((node) => node.getAttribute("data-listing-id") ?? ""));
}

async function shownCount(page: Page): Promise<number> {
  return digits(await page.getByTestId("results-count").textContent());
}

/** The count text and the card set match `expected` (the whole set when it fits the first page). */
async function expectResults(page: Page, expected: readonly SaleCard[]): Promise<void> {
  const ids: string[] = expected.map((card) => card._id as string).sort();
  await expect.poll(() => shownCount(page), { message: "result count" }).toBe(ids.length);
  if (ids.length === 0) {
    await expect(page.getByTestId("results-empty")).toBeVisible();
    return;
  }
  await expect
    .poll(
      async () => {
        const shown = (await shownIds(page)).sort();
        return ids.length <= 24
          ? shown.join(",") === ids.join(",")
          : shown.length >= 24 && shown.every((id) => ids.includes(id));
      },
      { message: "result ids" },
    )
    .toBe(true);
}

/** Two animation frames: long enough for a scroll-driven class flip that WOULD happen to have happened. */
async function twoFrames(page: Page): Promise<void> {
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
}

/**
 * The language switcher lives in the header from 1024px and in the full-screen
 * menu below it; the toggle is found by `aria-controls` (DECISIONS [04]) since
 * its label is localized.
 */
async function switchLocale(page: Page, target: Locale): Promise<void> {
  const toggle = page.locator('button[aria-controls="site-menu"]');
  if (await toggle.isVisible()) {
    await toggle.click();
    await expect(page.locator("#site-menu")).toBeVisible();
  }
  const names: Record<Locale, string> = { "sr-Latn": "Srpski", en: "English", ru: "Русский", de: "Deutsch" };
  // Desktop: "English (EN)"; the phone menu row: "English".
  await page
    .getByRole("button", { name: new RegExp(`^${names[target]}`) })
    .filter({ visible: true })
    .first()
    .click();
}

/** The share row: the list holding the "copy link" button (it has no group name of its own). */
function shareList(page: Page, locale: Locale = "sr-Latn"): Locator {
  return page.getByRole("list").filter({ has: page.getByRole("button", { name: msg(locale, "common.copyLink") }) });
}

/** Asserts the four share actions carry `url` (the canonical page URL). */
async function expectShareActions(page: Page, url: string): Promise<void> {
  const list = shareList(page);
  await expect(list).toHaveCount(1);
  await list.scrollIntoViewIfNeeded();

  const whatsapp = list.getByRole("link", { name: msg("sr-Latn", "common.whatsapp") });
  const viber = list.getByRole("link", { name: msg("sr-Latn", "common.viber") });
  const email = list.getByRole("link", { name: msg("sr-Latn", "listing.share.email") });

  const wa = (await whatsapp.getAttribute("href")) ?? "";
  expect(wa, "WhatsApp share").toMatch(/^https:\/\/wa\.me\/\?text=/);
  expect(decodeURIComponent(wa.slice(wa.indexOf("text=") + 5)), "WhatsApp text carries the URL").toContain(url);
  await expect(whatsapp).toHaveAttribute("target", "_blank");
  await expect(whatsapp).toHaveAttribute("rel", /noopener/);

  const vb = (await viber.getAttribute("href")) ?? "";
  expect(vb, "Viber share").toMatch(/^viber:\/\/forward\?text=/);
  expect(decodeURIComponent(vb.slice(vb.indexOf("text=") + 5)), "Viber text carries the URL").toContain(url);

  const mail = (await email.getAttribute("href")) ?? "";
  expect(mail, "e-mail share").toMatch(/^mailto:\?subject=[^&]+&body=/);
  expect(decodeURIComponent(mail.slice(mail.indexOf("body=") + 5)), "e-mail body is the URL").toBe(url);

  // Copy link: the clipboard holds the URL and the change is announced.
  await list.getByRole("button", { name: msg("sr-Latn", "common.copyLink") }).click();
  await expect(page.getByRole("status").filter({ hasText: msg("sr-Latn", "common.copied") })).toBeVisible();
  expect(await page.evaluate(() => navigator.clipboard.readText()), "copied URL").toBe(url);
}

/* ================================================================== A12 */

test.describe("favorites (PRD A12)", () => {
  test("a search-card heart fills the store, the header counter follows, /omiljeno lists it and a removal there updates list and counter @public", async ({
    page,
  }) => {
    await presetVisitor(page);
    await page.goto("/sr/nekretnine");
    await searchReady(page);

    const counter = page.locator("header").first().getByRole("link", { name: /^Omiljeno/ });
    await expect(counter).toHaveAccessibleName("Omiljeno");

    const first = resultCards(page).nth(0);
    const second = resultCards(page).nth(1);
    const firstId = (await first.getAttribute("data-listing-id")) ?? "";
    const secondId = (await second.getAttribute("data-listing-id")) ?? "";
    const firstHeart = first.getByRole("button", { name: /^Dodaj u omiljeno: / });
    const secondHeart = second.getByRole("button", { name: /^Dodaj u omiljeno: / });
    await expect(firstHeart).toHaveAttribute("aria-pressed", "false");

    // Two hearts on, one back off: the counter follows every toggle.
    await firstHeart.click();
    await expect(firstHeart).toHaveAttribute("aria-pressed", "true");
    await expect(counter).toHaveAccessibleName("Omiljeno (1)");
    await secondHeart.click();
    await expect(counter).toHaveAccessibleName("Omiljeno (2)");
    await secondHeart.click();
    await expect(secondHeart).toHaveAttribute("aria-pressed", "false");
    await expect(counter).toHaveAccessibleName("Omiljeno (1)");
    const stored = await page.evaluate(() => window.localStorage.getItem("me.favorites.v1"));
    expect(JSON.parse(stored ?? "null"), "the localStorage store").toEqual({ v: 1, ids: [firstId] });
    expect(secondId).not.toBe(firstId);

    // The favorites page lists exactly that listing.
    await counter.click();
    await expect(page).toHaveURL(/\/sr\/omiljeno$/);
    const grid = page.getByTestId("favorites-grid");
    await expect(grid.locator("article[data-listing-id]")).toHaveCount(1);
    await expect(grid.locator(`article[data-listing-id="${firstId}"]`)).toBeVisible();
    await expect(page.getByRole("heading", { level: 2, name: "1 sačuvana nekretnina" })).toBeVisible();

    // Removing it there empties the list and the counter.
    const heart = grid.getByRole("button", { name: /^Dodaj u omiljeno: / });
    await expect(heart).toHaveAttribute("aria-pressed", "true");
    const title = ((await heart.getAttribute("aria-label")) ?? "").replace(/^Dodaj u omiljeno: /, "");
    await heart.click();
    await expect(page.getByTestId("favorites-empty")).toBeVisible();
    await expect(page.getByTestId("favorites-grid")).toHaveCount(0);
    await expect(counter).toHaveAccessibleName("Omiljeno");
    await expect(page.getByRole("status").filter({ hasText: `Uklonjeno iz omiljenog: ${title}` })).toBeAttached();
    expect(JSON.parse((await page.evaluate(() => window.localStorage.getItem("me.favorites.v1"))) ?? "null")).toEqual({
      v: 1,
      ids: [],
    });

    // "Vrati" puts it back, list and counter alike.
    await page.getByRole("button", { name: `Vrati u omiljeno: ${title}` }).click();
    await expect(page.getByTestId("favorites-grid").locator(`article[data-listing-id="${firstId}"]`)).toBeVisible();
    await expect(counter).toHaveAccessibleName("Omiljeno (1)");
  });

  test("the listing page itself has the heart that the empty favorites page tells visitors to tap @public", async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "one proof is enough");
    // favorites.emptyBody: "Dodirnite srce na kartici ili na stranici nekretnine…" (all four locales say so).
    expect(msg("sr-Latn", "favorites.emptyBody")).toContain("stranici nekretnine");
    await presetVisitor(page);
    await page.goto(`/sr/nekretnine/${ORDINARY_LISTING}`);
    await shellHydrated(page);

    const counter = page.locator("header").first().getByRole("link", { name: /^Omiljeno/ });
    await expect(counter).toHaveAccessibleName("Omiljeno");
    // Named after THIS listing: the similar-listing cards below carry hearts for other listings.
    const listing = await listingBySlug(ORDINARY_LISTING);
    const ownHeart = page.getByRole("button", { name: `Dodaj u omiljeno: ${listing.title.sr}` });
    await expect(ownHeart, "a favorite toggle for this listing on its own page").toHaveCount(1);
    await ownHeart.click();
    const listingId = listing._id;
    await expect(counter).toHaveAccessibleName("Omiljeno (1)");
    expect(JSON.parse((await page.evaluate(() => window.localStorage.getItem("me.favorites.v1"))) ?? "null")).toEqual({
      v: 1,
      ids: [listingId],
    });
  });
});

/* =================================================================== A1 */

test.describe("footer (PRD A1)", () => {
  test("carries the agency's legal data from the settings, the three legal links and the year, in every locale @public @i18n", async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "server-rendered content; one project is enough");
    const settings = await client().query(api.settings.publicSettings, {});
    expect(settings, "public settings").not.toBeNull();
    if (settings === null) return;
    await presetVisitor(page);

    for (const locale of locales) {
      await page.goto(localizedPath("/", locale));
      const footer = page.getByRole("contentinfo");
      await expect(footer).toHaveCount(1);
      await expect(footer).toContainText(settings.legalName);
      await expect(footer).toContainText(settings.address);
      // "Registar posrednika br. 000" (Art. 18) and "PIB … · MB …", in the locale's own words.
      await expect(footer).toContainText(msg(locale, "footer.registryNumber").replace("{number}", settings.registryNo));
      await expect(footer).toContainText(msg(locale, "footer.companyId").replace("{pib}", settings.pib).replace("{mb}", settings.mb));
      for (const phone of settings.phones) {
        await expect(footer.locator(`a[href="tel:${phone.replace(/[^+\d]/g, "")}"]`), `tel: ${phone}`).toHaveCount(1);
      }
      await expect(footer.getByRole("link", { name: settings.email })).toHaveAttribute("href", `mailto:${settings.email}`);
      for (const key of ["privacy", "terms", "cookies"] as const) {
        await expect(footer.getByRole("link", { name: msg(locale, `legal.${key}Heading`) }), `${locale} ${key}`).toHaveAttribute(
          "href",
          localizedPath(`/${key}`, locale),
        );
      }
      await expect(footer).toContainText(`© ${new Date().getFullYear()} ${settings.companyName}`);
    }
  });

  test("offers the Viber and WhatsApp channels from the settings and a language switcher @public @i18n", async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "server-rendered content; one project is enough");
    const settings = await client().query(api.settings.publicSettings, {});
    await presetVisitor(page);
    await page.goto("/sr");
    const footer = page.getByRole("contentinfo");
    await expect(footer).toHaveCount(1);
    // PRD A1 footer: "phones, email, Viber/WhatsApp" and "Nav, social links, language switcher".
    if (settings?.viber !== undefined) {
      await expect.soft(footer.locator('a[href^="viber://"]'), "a Viber link in the footer").toHaveCount(1);
    }
    if (settings?.whatsapp !== undefined) {
      await expect.soft(footer.locator('a[href^="https://wa.me/"]'), "a WhatsApp link in the footer").toHaveCount(1);
    }
    await expect(
      footer.getByRole("navigation", { name: msg("sr-Latn", "nav.languageLabel") }),
      "a language switcher in the footer",
    ).toHaveCount(1);
  });
});

test.describe("language switcher keeps the record (PRD A1)", () => {
  test("on a listing detail every locale keeps the same slug under its own segment @public @i18n", async ({ page }) => {
    await presetVisitor(page);
    const slug = ORDINARY_LISTING;
    await page.goto(localizedPath("/properties/[slug]", "sr-Latn", slug));
    await shellHydrated(page);
    const heading = page.getByRole("heading", { level: 1 });

    for (const target of ["en", "ru", "de", "sr-Latn"] as const) {
      await switchLocale(page, target);
      await expect(page).toHaveURL(new RegExp(`${localizedPath("/properties/[slug]", target, slug)}$`));
      await expect(page.locator("html")).toHaveAttribute("lang", htmlLang[target]);
      await expect(heading).toBeVisible();
      // The same record: its reference code is on the page in every language.
      await expect(page.getByTestId("listing-price")).toBeVisible();
      await expect(page.getByText("ME-1042").first()).toBeAttached();
      await shellHydrated(page);
    }
  });

  test("on a location page every locale keeps the same place slug @public @i18n", async ({ page }) => {
    const { location } = await realSlugs();
    await presetVisitor(page);
    await page.goto(localizedPath("/locations/[slug]", "sr-Latn", location));
    await shellHydrated(page);

    for (const target of ["de", "ru", "en", "sr-Latn"] as const) {
      await switchLocale(page, target);
      await expect(page).toHaveURL(new RegExp(`${localizedPath("/locations/[slug]", target, location)}$`));
      await expect(page.locator("html")).toHaveAttribute("lang", htmlLang[target]);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      await shellHydrated(page);
    }
  });
});

test.describe("header (PRD A1)", () => {
  for (const [label, url] of [
    ["the landing", "/sr"],
    ["a listing", `/sr/nekretnine/${ORDINARY_LISTING}`],
  ] as const) {
    test(`on ${label} the header turns solid only past 80px, with no layout shift while scrolling @public`, async ({
      page,
    }) => {
      await presetVisitor(page);
      // Every layout-shift entry of the page, recorded from the first byte.
      await page.addInitScript(() => {
        const shifts: { t: number; value: number; input: boolean }[] = [];
        Object.defineProperty(window, "__shifts", { value: shifts });
        new PerformanceObserver((list) => {
          for (const entry of list.getEntries() as (PerformanceEntry & { value: number; hadRecentInput: boolean })[]) {
            shifts.push({ t: entry.startTime, value: entry.value, input: entry.hadRecentInput });
          }
        }).observe({ type: "layout-shift", buffered: true });
      });
      await page.goto(url);
      await shellHydrated(page);

      const header = page.locator("header").first();
      await expect(header).toHaveAttribute("data-solid", "false");
      const heightAtTop = await header.evaluate((node) => node.getBoundingClientRect().height);
      const mark = await page.evaluate(() => performance.now());

      // Under the threshold the bar stays transparent...
      await scrollToY(page, 60);
      await twoFrames(page);
      await expect(header).toHaveAttribute("data-solid", "false");
      // ...past it, it turns solid, and back at the top transparent again.
      await scrollToY(page, 140);
      await expect(header).toHaveAttribute("data-solid", "true");
      await scrollToY(page, 900);
      await expect(header).toHaveAttribute("data-solid", "true");
      await scrollToY(page, 0);
      await expect(header).toHaveAttribute("data-solid", "false");
      await twoFrames(page);

      const shift = await page.evaluate((since) => {
        const all = (window as unknown as { __shifts: { t: number; value: number; input: boolean }[] }).__shifts;
        return all.filter((entry) => entry.t >= since && !entry.input).reduce((sum, entry) => sum + entry.value, 0);
      }, mark);
      expect(shift, "sum of layout-shift entries while scrolling across the header threshold").toBeLessThan(0.1);
      // The fixed header flips colour, never its box: nothing below it can move.
      expect(await header.evaluate((node) => getComputedStyle(node).position)).toBe("fixed");
      expect(heightAtTop).toBeGreaterThan(0);
    });
  }
});

/* =================================================================== A2 */

test.describe("first-visit preloader (PRD A2)", () => {
  /** Consent decided (so the banner never covers anything), but NOT `me.preloaded.v1`. */
  async function firstVisitor(page: Page): Promise<void> {
    await page.addInitScript(() => {
      window.localStorage.setItem(
        "me.consent.v1",
        JSON.stringify({ v: 1, decidedAt: Date.now(), categories: { necessary: true, analytics: false, marketing: false } }),
      );
    });
  }

  /** ms since the curtain's keyframes started, from the CSS animation clock (null when not running). */
  function curtainClock(page: Page): Promise<number | null> {
    return page.evaluate(() => {
      const curtain = document.querySelector("[data-preloader]");
      for (const animation of curtain?.getAnimations() ?? []) {
        if (animation instanceof CSSAnimation && animation.animationName === "me-preloader-lift") {
          const time = animation.currentTime;
          return typeof time === "number" ? time : null;
        }
      }
      return null;
    });
  }

  test("shows on the first visit only, is gone by 1.8 s, and stays away for the rest of the session @public", async ({
    page,
  }) => {
    await firstVisitor(page);
    await page.goto("/sr", { waitUntil: "commit" });
    await expect(page.locator("html")).toHaveAttribute("data-intro", "play");
    const curtain = page.locator("[data-preloader]");
    await expect(curtain).toBeVisible();

    // The whole sequence is scheduled to end by 1.8 s (DESIGN §6.1)...
    const end = await curtain.evaluate((node) =>
      Math.max(...node.getAnimations().map((animation) => Number(animation.effect?.getComputedTiming().endTime ?? 0))),
    );
    expect(end, "the curtain's last keyframe ends (ms)").toBeLessThanOrEqual(1800);
    // ...and it really is gone within that, measured from when it was first seen.
    await expect(curtain).toBeHidden({ timeout: 2_300 });
    expect(await page.evaluate(() => window.sessionStorage.getItem("me.preloaded.v1"))).toBe("1");

    // The next navigations of the same session never show it again.
    for (const url of ["/sr/nekretnine", "/sr"]) {
      await page.goto(url, { waitUntil: "commit" });
      await expect(page.locator("html")).toHaveAttribute("data-intro", "skip");
      await expect(page.locator("[data-preloader]")).toBeHidden();
    }
  });

  test("can be skipped: a click or Escape on the curtain removes it before it would lift by itself @public", async ({
    page,
  }) => {
    await firstVisitor(page);
    await page.goto("/sr", { waitUntil: "commit" });
    await expect(page.locator("html")).toHaveAttribute("data-intro", "play");
    const curtain = page.locator("[data-preloader]");
    await expect(curtain).toBeVisible();

    const clock = await curtainClock(page);
    test.skip(clock === null || clock > 1_200, `the curtain was already ${clock} ms in; a skip could not be told apart`);

    // The two ways a visitor says "skip": a key and a click on the curtain.
    await page.keyboard.press("Escape");
    const viewport = page.viewportSize() ?? { width: 800, height: 600 };
    await page.mouse.click(viewport.width / 2, viewport.height / 2);

    // On its own the curtain only disappears at 1.8 s, at least 600 ms from here.
    await expect(curtain, `skipped at ${clock} ms into the intro; it should be gone within 400 ms`).toBeHidden({
      timeout: 400,
    });
  });
});

/* =================================================================== A3 */

test.describe("search: recency, empty state, €/m² sort (PRD A3)", () => {
  test("'added within' narrows the results to listings published in that window @public", async ({ page }, testInfo) => {
    const sale = await allListed("sale");
    const now = Date.now();
    const HOUR = 3_600_000;
    const windows = { "14d": 336, "7d": 168, "3d": 72, "1d": 24 } as const;
    // The widest window that actually narrows the set (lib/search-params.ts rounds the bound down to the hour).
    const choice = (Object.keys(windows) as (keyof typeof windows)[])
      .map((key) => {
        const after = Math.floor(now / HOUR) * HOUR - windows[key] * HOUR;
        return { key, expected: sale.filter((card) => (card.publishedAt ?? 0) >= after) };
      })
      .find(({ expected }) => expected.length > 0 && expected.length < sale.length);
    test.skip(choice === undefined, "no recency window narrows the current data");
    if (choice === undefined) return;
    const label = { "14d": "U poslednjih 14 dana", "7d": "U poslednjih 7 dana", "3d": "U poslednja 3 dana", "1d": "U poslednja 24 sata" }[
      choice.key
    ];

    await presetVisitor(page);
    await page.goto("/sr/nekretnine");
    await searchReady(page);
    await expectResults(page, sale);

    const mobile = testInfo.project.name === "mobile";
    await page.getByTestId(mobile ? "open-filter-sheet" : "bar-more").click();
    const panel = page.getByTestId(mobile ? "filter-sheet" : "filter-drawer");
    await expect(panel).toBeVisible();
    const radio = panel.getByRole("group", { name: "Objavljeno" }).getByRole("radio", { name: label });
    // The radio is visually hidden inside its chip: pick it the way a visitor does, by the label.
    await radio.locator("xpath=ancestor::label[1]").scrollIntoViewIfNeeded();
    await radio.locator("xpath=ancestor::label[1]").click();
    await expect(radio).toBeChecked();
    await panel.getByTestId("filters-apply").click();
    await expect(panel).toBeHidden();

    await expect(page).toHaveURL(new RegExp(`[?&]added=${choice.key}\\b`));
    await expectResults(page, choice.expected);
    await expect(page.getByTestId("active-chip")).toHaveCount(1);
  });

  test("an empty result offers its filters as suggestions, and 'clear filters' restores every listing @public", async ({
    page,
  }) => {
    const sale = await allListed("sale");
    await presetVisitor(page);
    await page.goto("/sr/nekretnine?priceMax=1000&rooms=5");
    await searchReady(page);

    const empty = page.getByTestId("results-empty");
    await expect(empty).toBeVisible();
    await expect.poll(() => shownCount(page)).toBe(0);
    // Each active filter is offered as a one-click removal.
    await expect(empty.getByRole("button", { name: /^Ukloni filter/ })).toHaveCount(2);

    await empty.getByTestId("empty-clear").click();
    await expect(page).toHaveURL(/\/sr\/nekretnine$/);
    await expect(empty).toBeHidden();
    await expectResults(page, sale);
  });

  test("sort by €/m² ascending orders the visible cards by their €/m² @public", async ({ page }) => {
    const sale = await allListed("sale");
    const expected = [...sale].sort((a, b) => a.pricePerM2 - b.pricePerM2);
    await presetVisitor(page);
    await page.goto("/sr/nekretnine");
    await searchReady(page);

    await page.getByLabel("Sortiraj").selectOption("ppm2_asc");
    await expect(page).toHaveURL(/[?&]sort=ppm2_asc\b/);
    const n = Math.min(8, expected.length);
    await expect
      .poll(async () => (await shownIds(page)).slice(0, n).join(","), { message: "the first cards, cheapest €/m² first" })
      .toBe(
        expected
          .slice(0, n)
          .map((card) => card._id)
          .join(","),
      );

    // And what the visitor reads on the cards is non-decreasing.
    const figures = await resultCards(page).evaluateAll((cards) =>
      cards.map((card) => {
        const match = /([\d.]+)[\s  ]*€\/m²/.exec(card.textContent ?? "");
        return match === null ? Number.NaN : Number(match[1].replace(/\./g, ""));
      }),
    );
    expect(figures.length).toBeGreaterThan(1);
    expect(figures.every((value) => Number.isFinite(value)), `every card shows €/m²: ${figures.join(", ")}`).toBe(true);
    for (let i = 1; i < figures.length; i += 1) {
      expect(figures[i], `card ${i + 1} €/m² ≥ card ${i}`).toBeGreaterThanOrEqual(figures[i - 1]);
    }
  });
});

/* =================================================================== A4 */

test.describe("listing card (PRD A4)", () => {
  /** The first result card with more than one photo, scrolled into view. */
  async function carouselCard(page: Page): Promise<{ card: Locator; carousel: Locator; counter: Locator; total: number }> {
    await presetVisitor(page);
    await page.goto("/sr/nekretnine");
    await searchReady(page);
    const card = resultCards(page).filter({ has: page.locator('[aria-roledescription="carousel"]') }).first();
    await card.scrollIntoViewIfNeeded();
    const carousel = card.locator('[aria-roledescription="carousel"]');
    const counter = carousel.locator('p[aria-live="polite"]');
    await expect(counter).toHaveText(/^1 \/ \d+$/);
    const total = Number(((await counter.textContent()) ?? "").split("/")[1]);
    expect(total, "photos in the card carousel").toBeGreaterThan(2);
    return { card, carousel, counter, total };
  }

  test("the photo carousel advances with its arrow buttons and from the keyboard @public", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "touch screens hide the arrows and swipe instead (next case)");
    const { card, carousel, counter, total } = await carouselCard(page);
    const [prev, next] = [carousel.getByRole("button").nth(0), carousel.getByRole("button").nth(1)];

    // Pointer: the arrows appear on hover and move one photo per click.
    await card.hover();
    await next.click();
    await expect(counter).toHaveText(`2 / ${total}`);
    await expect(carousel.getByRole("group", { name: `2 / ${total}` })).toBeInViewport({ ratio: 0.9 });
    await prev.click();
    await expect(counter).toHaveText(`1 / ${total}`);

    // Keyboard: both arrows are Tab stops, shown while focused, and work with Enter and Space.
    await page.mouse.move(2, 2);
    await prev.focus();
    await expect(prev).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(next).toBeFocused();
    expect(
      await next.evaluate((node) => Number(getComputedStyle(node.parentElement as HTMLElement).opacity)),
      "the arrows are shown while one holds keyboard focus",
    ).toBe(1);
    await page.keyboard.press("Enter");
    await expect(counter).toHaveText(`2 / ${total}`);
    await page.keyboard.press("Space");
    await expect(counter).toHaveText(`3 / ${total}`);
    await page.keyboard.press("Shift+Tab");
    await expect(prev).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(counter).toHaveText(`2 / ${total}`);
  });

  test("on a touch screen the photo carousel follows a swipe @public", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "mobile", "a touch gesture; the desktop case uses the arrows");
    const { carousel, counter, total } = await carouselCard(page);
    const box = await carousel.boundingBox();
    expect(box).not.toBeNull();
    if (box === null) return;

    // A real touch swipe, right to left, through the DevTools protocol.
    const cdp = await page.context().newCDPSession(page);
    const y = box.y + box.height / 2;
    const from = box.x + box.width * 0.85;
    const to = box.x + box.width * 0.1;
    await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: from, y }] });
    for (let step = 1; step <= 8; step += 1) {
      await cdp.send("Input.dispatchTouchEvent", {
        type: "touchMove",
        touchPoints: [{ x: from + ((to - from) * step) / 8, y }],
      });
    }
    await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    await expect(counter).toHaveText(`2 / ${total}`);
  });

  test("the carousel arrows are named for what they do @public @a11y", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "the arrows are hidden on touch screens");
    const { carousel } = await carouselCard(page);
    const [prev, next] = [carousel.getByRole("button").nth(0), carousel.getByRole("button").nth(1)];
    // The lightbox already has the right words: "Prethodna fotografija" / "Sledeća fotografija".
    await expect.soft(prev, "the previous-photo arrow").toHaveAccessibleName(/fotografij/i);
    await expect(next, "the next-photo arrow").toHaveAccessibleName(/fotografij/i);
  });

  test("each card shows €/m² next to the price and the monthly-rate estimate from the settings @public", async ({
    page,
  }) => {
    const [sale, settings] = await Promise.all([allListed("sale"), client().query(api.settings.publicSettings, {})]);
    expect(settings, "public settings").not.toBeNull();
    const mortgage = settings?.mortgage ?? { rate: 0, years: 0, downPct: 0 };
    // PRD A4: 20% down, 25 years, the rate from the settings. Independent annuity maths.
    const monthly = (price: number) => {
      const principal = price * (1 - mortgage.downPct / 100);
      const r = mortgage.rate / 100 / 12;
      const n = mortgage.years * 12;
      return r === 0 ? principal / n : (principal * r) / (1 - Math.pow(1 + r, -n));
    };
    expect(mortgage.downPct).toBe(20);
    expect(mortgage.years).toBe(25);

    await presetVisitor(page);
    await page.goto("/sr/nekretnine");
    await searchReady(page);
    await expectResults(page, sale);

    const byId = new Map<string, SaleCard>(sale.map((card) => [card._id, card]));
    const ids = (await shownIds(page)).slice(0, 6);
    for (const id of ids) {
      const data = byId.get(id);
      expect(data, `card ${id} is a listed sale`).toBeDefined();
      if (data === undefined) continue;
      const card = page.locator(`article[data-listing-id="${id}"]`);
      const text = (await card.textContent()) ?? "";
      const perM2 = /([\d.]+)[\s  ]*€\/m²/.exec(text);
      expect(perM2, `${data.ref} shows €/m²`).not.toBeNull();
      expect(digits(perM2?.[1] ?? ""), `${data.ref} €/m²`).toBe(Math.round(data.pricePerM2));

      const rate = card.getByTestId("card-monthly-rate");
      await expect(rate, `${data.ref} monthly rate`).toContainText(/^Rata od ~/);
      const shown = digits(/~([\d.]+)/.exec((await rate.textContent()) ?? "")?.[1] ?? "");
      expect(shown, `${data.ref} "Rata od ~X €/mes." for ${data.price} €`).toBe(Math.round(monthly(data.price)));
    }
  });
});

/* =================================================================== A5 */

test.describe("listing detail extras (PRD A5)", () => {
  test("share: copy link, WhatsApp, Viber and e-mail all carry the listing's canonical URL @public", async ({
    page,
    context,
  }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await presetVisitor(page);
    await page.goto(`/sr/nekretnine/${ORDINARY_LISTING}`);
    await shellHydrated(page);
    const canonical = (await page.locator('link[rel="canonical"]').getAttribute("href")) ?? "";
    expect(canonical).toMatch(new RegExp(`/sr/nekretnine/${ORDINARY_LISTING}$`));
    await expectShareActions(page, canonical);
  });

  test("similar listings: the PRD matches (same municipality and type, ±25%) lead, never the listing itself @public", async ({
    page,
  }) => {
    const sale = await allListed("sale");
    // A listing that HAS strict matches, so the PRD rule is actually exercised.
    const strictFor = (listing: SaleCard) =>
      sale.filter(
        (other) =>
          other._id !== listing._id &&
          other.municipalityId !== undefined &&
          other.municipalityId === listing.municipalityId &&
          other.propertyType === listing.propertyType &&
          other.price >= listing.price * 0.75 &&
          other.price <= listing.price * 1.25,
      );
    const subject = sale.find((listing) => listing.status === "published" && strictFor(listing).length > 0);
    test.skip(subject === undefined, "no listing has a same-municipality, same-type match within ±25%");
    if (subject === undefined) return;
    const strict = strictFor(subject).map((card) => card._id);
    const similar = await client().query(api.listings.similar, { id: subject._id, limit: 6 });

    await presetVisitor(page);
    await page.goto(`/sr/nekretnine/${subject.slug}`);
    const region = page.getByRole("region", { name: "Slične nekretnine" });
    await region.scrollIntoViewIfNeeded();
    const ids = await region
      .locator("article[data-listing-id]")
      .evaluateAll((nodes) => nodes.map((node) => node.getAttribute("data-listing-id") ?? ""));

    expect(ids, "the rail shows the Convex similar set").toEqual(similar.map((card) => card._id));
    expect(ids.length).toBeGreaterThan(0);
    expect(ids, "never the listing itself").not.toContain(subject._id);
    // The strict PRD matches lead the rail (as many as fit in it).
    const lead = ids.slice(0, Math.min(ids.length, strict.length));
    for (const id of lead) expect(strict as string[], `${subject.ref}: ${id} in the first ${lead.length} is a strict match`).toContain(id);
    // Every card is from the same city, the same transaction, and within ±50% of the price.
    for (const card of similar) {
      expect(card.cityId, `${card.ref} city`).toBe(subject.cityId);
      expect(card.transaction).toBe(subject.transaction);
      expect(card.price, `${card.ref} price`).toBeGreaterThanOrEqual(subject.price * 0.5);
      expect(card.price, `${card.ref} price`).toBeLessThanOrEqual(subject.price * 1.5);
    }
  });

  test("only the media tabs that have data are rendered, and each one opens its panel @public", async ({ page }) => {
    const sale = await allListed("sale");
    const noTour = sale.find((card) => !card.hasTour && card.status === "published");
    const slugs = [ORDINARY_LISTING, SHOWCASE_LISTING, ...(noTour !== undefined ? [noTour.slug] : [])];
    await presetVisitor(page);

    for (const slug of slugs) {
      const listing = await listingBySlug(slug);
      const expected = [msg("sr-Latn", "listing.tabs.photos")];
      if (listing.floorPlans.length > 0) expected.push(msg("sr-Latn", "listing.tabs.floorPlans"));
      if (listing.videoUrl !== undefined) expected.push(msg("sr-Latn", "listing.tabs.video"));
      const tour = listing.tour360;
      if (tour !== undefined && ((tour.provider === "self" && listing.sceneCount > 0) || tour.embedUrl !== undefined)) {
        expected.push(msg("sr-Latn", "listing.tabs.tour360"));
      }
      if (listing.hasWalk3d) expected.push(msg("sr-Latn", "listing.tabs.walk3d"));

      await page.goto(`/sr/nekretnine/${slug}`);
      await shellHydrated(page);
      const tablist = page.getByRole("tablist", { name: msg("sr-Latn", "listing.tabs.label") });
      if (expected.length === 1) {
        await expect(tablist, `${listing.ref}: photos only, so no tab strip`).toHaveCount(0);
        await expect(page.getByRole("button", { name: /^Otvorite fotografiju 1 od/ })).toBeVisible();
        continue;
      }
      await expect(tablist.getByRole("tab"), `${listing.ref} tabs`).toHaveText(expected);
      for (const name of expected) {
        const tab = tablist.getByRole("tab", { name });
        await tab.click();
        await expect(tab).toHaveAttribute("aria-selected", "true");
        await expect(page.getByRole("tabpanel", { name })).toBeVisible();
      }
    }
  });
});

/* =================================================================== A8 */

test.describe("locations (PRD A8)", () => {
  test("a location page carries its own title, description, canonical and hreflang set in every locale @public @i18n", async ({
    browser,
  }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "server-rendered metadata; one project is enough");
    const { location } = await realSlugs();
    const node = (await client().query(api.locations.tree, {})).find((entry) => entry.slug === location);
    expect(node, `location ${location}`).toBeDefined();
    if (node === undefined) return;
    const names = node.name as Record<string, string | undefined>;

    const context = await browser.newContext({ javaScriptEnabled: false, baseURL: testInfo.project.use.baseURL });
    try {
      const page = await context.newPage();
      for (const locale of locales) {
        const own = localizedPath("/locations/[slug]", locale, location);
        await page.goto(own);
        const name = names[locale === "sr-Latn" ? "sr" : locale] ?? names.sr ?? "";
        await expect(page, `${own} <title> names the place`).toHaveTitle(new RegExp(name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
        const description = (await page.locator('meta[name="description"]').getAttribute("content")) ?? "";
        expect(description.length, `${own} meta description`).toBeGreaterThan(40);
        await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", new RegExp(`${own}$`));
        for (const other of locales) {
          await expect(page.locator(`link[rel="alternate"][hreflang="${htmlLang[other]}"]`), `${own} hreflang ${other}`).toHaveAttribute(
            "href",
            new RegExp(`${localizedPath("/locations/[slug]", other, location)}$`),
          );
        }
        await expect(page.locator('link[rel="alternate"][hreflang="x-default"]')).toHaveAttribute(
          "href",
          new RegExp(`${localizedPath("/locations/[slug]", "sr-Latn", location)}$`),
        );
      }
    } finally {
      await context.close();
    }
  });

  test("every place's listing count on the index matches its own page and the live search @public", async ({
    browser,
  }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "a data check; the viewport changes nothing");
    test.setTimeout(240_000);
    const tree = await client().query(api.locations.tree, {});
    const bySlug = new Map(tree.map((node) => [node.slug, node]));

    // Server HTML is what is judged: the counts are server-rendered.
    const context = await browser.newContext({ javaScriptEnabled: false, baseURL: testInfo.project.use.baseURL });
    try {
      const page = await context.newPage();
      await page.goto("/sr/lokacije");
      const entries = await page.getByTestId("location-card").evaluateAll((cards) => {
        const out: { href: string; text: string }[] = [];
        for (const card of cards) {
          const head = card.querySelector("h3 a");
          if (head !== null) out.push({ href: head.getAttribute("href") ?? "", text: card.querySelector("h3 + p")?.textContent ?? "" });
          for (const link of card.querySelectorAll("ul li a")) {
            out.push({ href: link.getAttribute("href") ?? "", text: link.querySelector(".sr-only")?.textContent ?? "" });
          }
        }
        return out;
      });
      const shown = new Map<string, number>();
      for (const entry of entries) {
        const slug = entry.href.replace(/^\/sr\/lokacije\//, "");
        if (!shown.has(slug)) shown.set(slug, digits(entry.text));
      }
      expect(shown.size, "places on the index").toBeGreaterThan(5);

      const mismatches: string[] = [];
      for (const [slug, count] of shown) {
        const node = bySlug.get(slug);
        if (node === undefined) {
          mismatches.push(`${slug}: on the index but not in the location tree`);
          continue;
        }
        // The live search for this place, sale + rent.
        const key = node.kind === "city" ? "cityId" : node.kind === "municipality" ? "municipalityId" : "neighborhoodId";
        const [sale, rent] = await Promise.all([
          allListed("sale", { [key]: [node._id] }),
          allListed("rent", { [key]: [node._id] }),
        ]);
        const truth = sale.length + rent.length;
        if (count !== truth) mismatches.push(`${slug}: index says ${count}, the search finds ${truth}`);

        await page.goto(`/sr/lokacije/${slug}`);
        const offer = page.locator("#ponuda");
        const cards = await offer.locator("article[data-listing-id]").count();
        const headline = digits(await offer.locator("p").first().textContent());
        if (count <= 9 && cards !== count) mismatches.push(`${slug}: index says ${count}, its page shows ${cards} cards`);
        if (count > 9 && cards !== 9) mismatches.push(`${slug}: ${count} listings but the page shows ${cards} cards (expected 9)`);
        if (headline !== count) mismatches.push(`${slug}: index says ${count}, its page heading says ${headline}`);
      }
      expect(mismatches, mismatches.join("\n")).toEqual([]);
    } finally {
      await context.close();
    }
  });
});

/* =================================================================== A9 */

test.describe("agents (PRD A9)", () => {
  test("a profile lists exactly that agent's active listings, and each one names the same agent @public", async ({
    browser,
  }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "a data check; the viewport changes nothing");
    test.setTimeout(120_000);
    const agents = await client().query(api.agents.list, {});
    const details = await Promise.all(agents.map((agent) => client().query(api.agents.bySlug, { slug: agent.slug })));
    const best = details
      .filter((detail): detail is NonNullable<typeof detail> => detail !== null)
      .sort((a, b) => b.active.length - a.active.length)[0];
    test.skip(best === undefined || best.active.length === 0, "no public agent has an active listing");
    if (best === undefined) return;
    const { agent } = best;
    const [sale, rent] = await Promise.all([
      allListed("sale", { agentId: agent._id }),
      allListed("rent", { agentId: agent._id }),
    ]);
    const truth: string[] = [...sale, ...rent].map((card) => card._id as string).sort();

    const context = await browser.newContext({ javaScriptEnabled: false, baseURL: testInfo.project.use.baseURL });
    try {
      const page = await context.newPage();
      await page.goto(`/sr/agenti/${agent.slug}`);
      await expect(page.getByRole("heading", { level: 1 })).toContainText(agent.name);
      const section = page.getByTestId("agent-listings");
      const cards = section.locator("article[data-listing-id]");
      const ids = await cards.evaluateAll((nodes) => nodes.map((node) => node.getAttribute("data-listing-id") ?? ""));
      // The profile caps at 12; below that it is the agent's whole listed set.
      if (truth.length <= 12) expect([...ids].sort(), `${agent.name}: active listings`).toEqual(truth);
      else expect(ids.every((id) => truth.includes(id))).toBe(true);

      const hrefs = await cards.evaluateAll((nodes) =>
        nodes.map((node) => node.querySelector("h3 a")?.getAttribute("href") ?? ""),
      );
      for (const href of hrefs) {
        expect(href).toMatch(/^\/sr\/nekretnine\/[a-z0-9-]+$/);
        await page.goto(href);
        await expect(page.getByRole("complementary", { name: agent.name }), `${href} names ${agent.name}`).toBeVisible();
      }
    } finally {
      await context.close();
    }
  });

  test("a profile shows the agent's sold or let examples apart from the active ones, each marked closed @public", async ({
    browser,
  }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "a data check; the viewport changes nothing");
    const agents = await client().query(api.agents.list, {});
    const details = await Promise.all(agents.map((agent) => client().query(api.agents.bySlug, { slug: agent.slug })));
    const withClosed = details.find((detail) => detail !== null && detail.closed.length > 0);
    test.skip(withClosed === undefined || withClosed === null, "no public agent has a sold or let listing");
    if (withClosed === undefined || withClosed === null) return;
    const { agent, active, closed } = withClosed;

    const context = await browser.newContext({ javaScriptEnabled: false, baseURL: testInfo.project.use.baseURL });
    try {
      const page = await context.newPage();
      await page.goto(`/sr/agenti/${agent.slug}`);
      const region = page.getByRole("region", { name: msg("sr-Latn", "agents.closedHeading") });
      await expect(region).toHaveCount(1);
      const ids = await region
        .locator("article[data-listing-id]")
        .evaluateAll((nodes) => nodes.map((node) => node.getAttribute("data-listing-id") ?? ""));
      expect([...ids].sort(), `${agent.name}: closed examples`).toEqual(closed.map((card) => card._id as string).sort());
      for (const id of ids) {
        expect(active.map((card) => card._id as string), `${id} is not also listed as active`).not.toContain(id);
        await expect(region.locator(`article[data-listing-id="${id}"]`)).toContainText(
          new RegExp(`${msg("sr-Latn", "listing.statusSold")}|${msg("sr-Latn", "listing.statusRented")}`),
        );
      }
    } finally {
      await context.close();
    }
  });
});

/* ================================================================== A11 */

test.describe("journal (PRD A11)", () => {
  test("the category filter narrows the list to that topic and 'Svi tekstovi' restores it @public", async ({ page }) => {
    const all = (await client().query(api.posts.list, { paginationOpts: { numItems: 50, cursor: null } })).page.filter(
      (post) => !post.slug.startsWith("e2e-"),
    );
    const counts = new Map<string, number>();
    for (const post of all) counts.set(post.category, (counts.get(post.category) ?? 0) + 1);
    // A topic other agents' e2e posts never use ("guide"), with fewer posts than the whole journal.
    const category = [...counts.keys()].find((key) => key !== "guide" && (counts.get(key) ?? 0) < all.length);
    test.skip(category === undefined, "the journal needs two topics");
    if (category === undefined) return;
    const inCategory = (
      await client().query(api.posts.list, {
        category: category as never,
        paginationOpts: { numItems: 50, cursor: null },
      })
    ).page.map((post) => post.slug);
    const label = msg("sr-Latn", `journal.categories.${category}`);

    await presetVisitor(page);
    await page.goto("/sr/magazin");
    await shellHydrated(page);
    const posts = page.locator('[data-testid="journal-featured"], [data-testid="journal-card"]');
    const slugsShown = () =>
      posts.evaluateAll((nodes) =>
        nodes.map((node) => (node.querySelector('a[href*="/magazin/"]')?.getAttribute("href") ?? "").replace(/^.*\/magazin\//, "")),
      );
    for (const post of all) expect(await slugsShown(), `"${post.slug}" is listed under all topics`).toContain(post.slug);

    const filter = page.getByRole("navigation", { name: "Teme magazina" });
    await filter.getByRole("link", { name: label }).click();
    await expect(page).toHaveURL(new RegExp(`/sr/magazin\\?category=${category}$`));
    await expect(filter.getByRole("link", { name: label })).toHaveAttribute("aria-current", "page");
    await expect.poll(async () => (await slugsShown()).sort().join(","), { message: "posts of the topic" }).toBe(
      [...inCategory].sort().join(","),
    );
    const shownCount = await posts.count();
    expect(shownCount).toBeLessThan(all.length);
    for (let i = 0; i < shownCount; i += 1) await expect(posts.nth(i)).toContainText(label);

    await filter.getByRole("link", { name: "Svi tekstovi" }).click();
    await expect(page).toHaveURL(/\/sr\/magazin$/);
    await expect.poll(async () => (await slugsShown()).length).toBeGreaterThanOrEqual(all.length);
  });

  test("an article shows its reading time and share links carrying its URL @public", async ({ page, context }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    const { post } = await realSlugs();
    const card = (await client().query(api.posts.list, { paginationOpts: { numItems: 50, cursor: null } })).page.find(
      (entry) => entry.slug === post,
    );
    await presetVisitor(page);
    await page.goto(`/sr/magazin/${post}`);
    await shellHydrated(page);

    const minutes = card?.readingMinutes;
    // The article's own meta line comes first; related-article cards further
    // down can show the same figure.
    await expect(
      page.getByText(minutes !== undefined ? `${minutes} min čitanja` : /^\d+ min čitanja$/).first(),
    ).toBeVisible();
    const canonical = (await page.locator('link[rel="canonical"]').getAttribute("href")) ?? "";
    expect(canonical).toMatch(new RegExp(`/sr/magazin/${post}$`));
    await expectShareActions(page, canonical);
  });
});

/* ================================================================== A13 */

test.describe("legal pages (PRD A13)", () => {
  for (const locale of locales) {
    test(`privacy, terms and cookies render their content in ${locale}, without the staff-only draft notice @public @i18n`, async ({
      browser,
    }, testInfo) => {
      test.skip(testInfo.project.name !== "desktop", "server-rendered text; one project is enough");
      const context = await browser.newContext({ javaScriptEnabled: false, baseURL: testInfo.project.use.baseURL });
      try {
        const page = await context.newPage();
        for (const key of ["privacy", "terms", "cookies"] as const) {
          const doc = await client().query(api.pages.get, { key });
          expect(doc, `pages.get(${key})`).not.toBeNull();
          const route = `/${key}` as "/privacy" | "/terms" | "/cookies";
          const url = localizedPath(route, locale);
          const response = await page.goto(url);
          expect(response?.status(), url).toBe(200);
          await expect(page.locator("html")).toHaveAttribute("lang", htmlLang[locale]);
          // By accessible name: SplitReveal renders the title twice (an sr-only twin plus the aria-hidden copy).
          await expect(page.getByRole("heading", { level: 1 })).toHaveAccessibleName(msg(locale, `legal.${key}Heading`));

          // The document's own sections, with real text in them.
          const sections = page.getByTestId("legal-section");
          expect(await sections.count(), `${url} sections`).toBeGreaterThanOrEqual(2);
          for (const text of await sections.allTextContents()) {
            expect(text.trim().length, `${url} section text`).toBeGreaterThan(40);
          }
          const html = await page.content();
          expect(html, `${url} has no unfilled placeholder`).not.toMatch(/\{\{\s*\w+\s*\}\}/);

          // The "NACRT — proveriti sa pravnikom" block is for the staff only.
          const notice = doc?.blocks.find((block) => block.type === "richText" && block.key === "notice");
          if (notice !== undefined && notice.type === "richText") {
            const short = locale === "sr-Latn" ? "sr" : locale;
            const pick = (value: Record<string, string | undefined> | undefined) => value?.[short] ?? value?.sr ?? "";
            const title = pick(notice.title as Record<string, string | undefined> | undefined).trim();
            const body = pick(notice.body as Record<string, string | undefined>)
              .replace(/<[^>]+>/g, " ")
              .replace(/\s+/g, " ")
              .trim()
              .slice(0, 30);
            if (title.length > 0) {
              await expect(page.getByText(title, { exact: false }), `${url} hides the notice title`).toHaveCount(0);
              expect(html.includes(title), `${url} HTML carries the notice title`).toBe(false);
            }
            if (body.length > 0) expect(html.includes(body), `${url} HTML carries the notice body`).toBe(false);
          }
        }
      } finally {
        await context.close();
      }
    });
  }
});

/* ============================================================ consent */

/** Analytics and marketing hosts and globals; none may appear before (or without) consent. */
const TRACKERS =
  /google-analytics\.com|googletagmanager\.com|\/gtag\/js|plausible\.io|connect\.facebook\.net|facebook\.com\/tr|doubleclick\.net|clarity\.ms|hotjar\.com|static\.hotjar|segment\.(io|com)|mixpanel|umami|matomo|yandex|mc\.yandex/i;

function watchTrackers(page: Page): string[] {
  const hits: string[] = [];
  page.on("request", (request) => {
    if (TRACKERS.test(request.url())) hits.push(request.url());
  });
  return hits;
}

async function trackerGlobals(page: Page): Promise<string[]> {
  return await page.evaluate(() => {
    const w = window as unknown as Record<string, unknown>;
    const found = ["gtag", "dataLayer", "plausible", "fbq", "_fbq", "clarity", "hj", "ym"].filter((key) => key in w);
    const scripts = Array.from(document.scripts)
      .map((script) => script.src)
      .filter((src) => /google|plausible|facebook|clarity|hotjar|yandex/i.test(src));
    const cookies = document.cookie
      .split(";")
      .map((entry) => entry.trim().split("=")[0])
      .filter((name) => /^(_ga|_gid|_gat|_fbp|_fbc|_clck|_hj)/.test(name ?? ""));
    return [...found.map((key) => `window.${key}`), ...scripts, ...cookies.map((name) => `cookie ${name}`)];
  });
}

test.describe("cookie consent gates analytics (PRD A1)", () => {
  test("the opt-in banner speaks every locale, with equal 'accept all' and 'necessary only' choices and the settings @public @i18n", async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "copy check; one project is enough");
    await page.addInitScript(() => window.sessionStorage.setItem("me.preloaded.v1", "1"));
    for (const locale of locales) {
      // No decision is ever stored here, so the banner is up on every page.
      await page.goto(localizedPath("/", locale));
      const banner = page.getByRole("dialog", { name: msg(locale, "consent.bannerHeading") });
      await expect(banner, `${locale} banner`).toBeVisible();
      await expect(banner.getByRole("button", { name: msg(locale, "consent.acceptAll") })).toBeVisible();
      await expect(banner.getByRole("button", { name: msg(locale, "consent.necessaryOnly") })).toBeVisible();
      // Per-category choice (necessary / analytics / marketing) behind the settings disclosure.
      await banner.getByRole("button", { name: msg(locale, "consent.settings") }).click();
      await expect(banner.getByRole("checkbox")).toHaveCount(3);
      await expect(banner.getByRole("checkbox").first()).toBeDisabled();
      await expect(banner.getByRole("checkbox").first()).toBeChecked();
      await expect(banner.getByRole("checkbox").nth(1)).not.toBeChecked();
      await expect(banner.getByRole("checkbox").nth(2)).not.toBeChecked();
    }
  });

  test("before a decision and after 'Samo neophodni' no analytics or marketing script, request or cookie appears @public", async ({
    page,
  }) => {
    // A repeat visitor in this tab (no curtain), but no consent stored yet.
    await page.addInitScript(() => window.sessionStorage.setItem("me.preloaded.v1", "1"));
    const hits = watchTrackers(page);
    await page.goto("/sr");
    const banner = page.getByRole("dialog", { name: "Kolačići" });
    await expect(banner).toBeVisible();
    await page.waitForLoadState("networkidle");
    expect(hits, "tracker requests before a decision").toEqual([]);
    expect(await trackerGlobals(page), "tracker globals before a decision").toEqual([]);

    await banner.getByRole("button", { name: "Samo neophodni" }).click();
    await expect(banner).toBeHidden();
    for (const url of ["/sr/nekretnine", `/sr/nekretnine/${ORDINARY_LISTING}`]) {
      await page.goto(url);
      await shellHydrated(page);
      await page.waitForLoadState("networkidle");
      expect(hits, `tracker requests after "necessary only" (${url})`).toEqual([]);
      expect(await trackerGlobals(page), `tracker globals after "necessary only" (${url})`).toEqual([]);
    }
  });

  test("after 'Prihvatam sve' analytics load only for the IDs configured in the settings @public", async ({ page }) => {
    const settings = await client().query(api.settings.publicSettings, {});
    const configured = settings?.analytics ?? {};
    test.info().annotations.push({
      type: "analytics IDs",
      description: JSON.stringify(configured) === "{}" ? "none configured in settings: nothing may load" : JSON.stringify(configured),
    });
    await page.addInitScript(() => window.sessionStorage.setItem("me.preloaded.v1", "1"));
    const hits = watchTrackers(page);
    await page.goto("/sr");
    const banner = page.getByRole("dialog", { name: "Kolačići" });
    await banner.getByRole("button", { name: "Prihvatam sve" }).click();
    await expect(banner).toBeHidden();
    await page.goto("/sr/nekretnine");
    await shellHydrated(page);
    await page.waitForLoadState("networkidle");

    const expected: RegExp[] = [];
    if (configured.ga4Id !== undefined) expected.push(/googletagmanager\.com\/gtag\/js/);
    if (configured.plausibleDomain !== undefined) expected.push(/plausible\.io/);
    if (configured.metaPixelId !== undefined) expected.push(/connect\.facebook\.net/);
    for (const host of expected) expect(hits.some((url) => host.test(url)), `${host} loads after consent`).toBe(true);
    if (expected.length === 0) {
      expect(hits, "no analytics ID is configured, so nothing loads").toEqual([]);
      expect(await trackerGlobals(page)).toEqual([]);
    }
  });
});
