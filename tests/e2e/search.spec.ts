import { execFileSync } from "node:child_process";
import path from "node:path";
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

/**
 * Search, filters and map (PRD A3, night-run step 06).
 *
 * "Convex truth" is computed independently of the UI's own filter code: the
 * test reads every listed card of a transaction straight from Convex (one
 * `listings.search` call with no filters and a page large enough for the demo
 * data) and applies its own predicate. The UI must then show exactly that set
 * and that count.
 */

const CONVEX_CLI = path.join(process.cwd(), "node_modules", "convex", "bin", "main.js");

type Card = {
  _id: string;
  slug: string;
  propertyType: string;
  price: number;
  areaM2: number;
  rooms: number;
  floorNum: number;
  cityId: string;
  municipalityId?: string;
  neighborhoodId?: string;
  isExclusive: boolean;
  hasTour: boolean;
  registered: boolean;
  constructionType: string;
  mortgageEligible?: boolean;
};
type LocationNode = { _id: string; slug: string; kind: string };

function convexRun<T>(fn: string, args: Record<string, unknown>): T {
  const out = execFileSync(process.execPath, [CONVEX_CLI, "run", fn, JSON.stringify(args)], {
    cwd: process.cwd(),
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  return JSON.parse(out) as T;
}

let sale: Card[] = [];
let rent: Card[] = [];
let places: LocationNode[] = [];

test.beforeAll(() => {
  const all = (transaction: "sale" | "rent") =>
    convexRun<{ page: Card[]; isDone: boolean }>("listings:search", {
      filters: { transaction },
      sort: "newest",
      paginationOpts: { numItems: 500, cursor: null },
    });
  const saleResult = all("sale");
  const rentResult = all("rent");
  expect(saleResult.isDone && rentResult.isDone, "the demo data fits one page").toBe(true);
  sale = saleResult.page;
  rent = rentResult.page;
  places = convexRun<LocationNode[]>("locations:tree", {});
});

/** A decided consent and a seen preloader, so neither overlay intercepts clicks. */
async function visit(page: Page, url: string) {
  await page.addInitScript(() => {
    window.localStorage.setItem(
      "me.consent.v1",
      JSON.stringify({ v: 1, decidedAt: Date.now(), categories: { necessary: true, analytics: false, marketing: false } }),
    );
    window.sessionStorage.setItem("me.preloaded.v1", "1");
  });
  await page.goto(url);
  // The filter bar marks itself ready once the client island has hydrated.
  await expect(page.locator('[data-search-bar][data-ready="true"]')).toBeVisible({ timeout: 30_000 });
}

/** "25 rezultata" → 25. */
async function shownCount(page: Page): Promise<number> {
  const text = (await page.getByTestId("results-count").textContent()) ?? "";
  return Number(text.replace(/\D+/g, ""));
}

/** The ids of the rendered result cards (the list may be dimmed while loading). */
async function shownIds(page: Page): Promise<string[]> {
  return await page
    .getByTestId("results-list")
    .locator("article[data-listing-id]")
    .evaluateAll((nodes) => nodes.map((node) => node.getAttribute("data-listing-id") ?? ""));
}

/**
 * Waits until the UI shows exactly `expected`: the count text, and the cards —
 * the whole set when it fits one page, otherwise a first page drawn from it.
 */
async function expectResults(page: Page, expected: Card[]) {
  const ids = expected.map((card) => card._id).sort();
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

function placeId(slug: string): string {
  const node = places.find((place) => place.slug === slug);
  if (node === undefined) throw new Error(`no location ${slug}`);
  return node._id;
}

test.describe("search — filters against Convex truth", () => {
  test.skip(({ isMobile }) => isMobile, "the desktop filter bar; the phone sheet has its own case");

  test("type, rooms, price, area, location and the drawer filters each narrow correctly", async ({ page }) => {
    await visit(page, "/sr/nekretnine");
    await expectResults(page, sale);

    // 1. Property type (popover chip).
    await page.getByTestId("bar-type").click();
    await page.getByTestId("type-house").click();
    await page.keyboard.press("Escape");
    await expect(page).toHaveURL(/[?&]type=house\b/);
    await expectResults(page, sale.filter((card) => card.propertyType === "house"));
    await page.getByTestId("chips-clear").click();
    await expectResults(page, sale);

    // 2. Rooms (popover chips, "5" = 5+).
    await page.getByTestId("bar-rooms").click();
    await page.getByTestId("rooms-2").click();
    await page.getByTestId("rooms-3").click();
    await page.keyboard.press("Escape");
    await expect(page).toHaveURL(/rooms=2,3$/);
    await expectResults(page, sale.filter((card) => card.rooms === 2 || card.rooms === 3));
    await page.getByTestId("chips-clear").click();

    // 3. Price range (typed, committed on Enter).
    await page.getByTestId("bar-price").click();
    await page.getByTestId("price-range-min").fill("150000");
    await page.getByTestId("price-range-max").fill("400000");
    await page.getByTestId("price-range-max").press("Enter");
    await page.keyboard.press("Escape");
    await expect(page).toHaveURL(/priceMin=150000/);
    await expectResults(page, sale.filter((card) => card.price >= 150_000 && card.price <= 400_000));
    await page.getByTestId("chips-clear").click();

    // 4. Area (typed minimum only).
    await page.getByTestId("bar-area").click();
    await page.getByTestId("area-range-min").fill("100");
    await page.getByTestId("area-range-min").press("Enter");
    await page.keyboard.press("Escape");
    await expectResults(page, sale.filter((card) => card.areaM2 >= 100));
    await page.getByTestId("chips-clear").click();

    // 5. Location (a municipality: its neighborhoods' listings are included).
    await page.getByTestId("bar-location").click();
    await page.getByTestId("location-vracar").check();
    await page.keyboard.press("Escape");
    await expect(page).toHaveURL(/location=vracar/);
    const vracar = placeId("vracar");
    await expectResults(page, sale.filter((card) => card.municipalityId === vracar));
    await page.getByTestId("chips-clear").click();

    // 6–8. Drawer: construction, exclusive, 3D tour.
    await page.getByTestId("bar-more").click();
    const drawer = page.getByTestId("filter-drawer");
    await drawer.getByTestId("construction-new").click();
    await expectResults(page, sale.filter((card) => card.constructionType === "new"));
    await drawer.getByTestId("construction-new").click();
    await drawer.getByTestId("toggle-exclusive").check();
    await expectResults(page, sale.filter((card) => card.isExclusive));
    await drawer.getByTestId("toggle-exclusive").uncheck();
    await drawer.getByTestId("toggle-registered").check();
    await expectResults(page, sale.filter((card) => card.registered));
    await drawer.getByTestId("filters-apply").click();
    await expect(drawer).toBeHidden();

    // 9. Transaction switch (price ranges never survive it).
    await page.getByTestId("chips-clear").click();
    await page.locator('label:has(input[name="transaction-bar"][value="rent"])').click();
    await expect(page).toHaveURL(/transaction=rent/);
    await expectResults(page, rent);
    await expect(page.getByTestId("search-title")).toHaveText("Nekretnine za izdavanje");
  });

  test("a combined deep filter matches Convex and is noindex", async ({ page }) => {
    const vracar = placeId("vracar");
    const expected = sale.filter(
      (card) => card.municipalityId === vracar && card.propertyType === "apartment" && card.price <= 600_000,
    );
    await visit(page, "/sr/nekretnine?type=apartment&location=vracar&priceMax=600000");
    await expectResults(page, expected);
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
  });

  test("a curated combination is indexable with a clean canonical and a matching title", async ({ page }) => {
    await visit(page, "/sr/nekretnine?location=vracar&type=apartment&sort=newest");
    await expect(page).toHaveTitle("Stanovi na prodaju — Vračar — Mihajlo Estate");
    await expect(page.getByTestId("search-title")).toHaveText("Stanovi na prodaju — Vračar");
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
      "href",
      /\/sr\/nekretnine\?type=apartment&location=vracar$/,
    );
    await expect(page.locator('meta[name="robots"]')).toHaveCount(0);
    const crumbs = await page.locator('script[type="application/ld+json"]').first().textContent();
    expect(JSON.parse(crumbs ?? "{}")).toMatchObject({ "@type": "BreadcrumbList" });
  });

  test("sort orders the visible results", async ({ page }) => {
    await visit(page, "/sr/nekretnine");
    await page.getByTestId("sort-select").selectOption("price_asc");
    await expect(page).toHaveURL(/sort=price_asc/);
    const expected = [...sale].sort((a, b) => a.price - b.price).slice(0, 3).map((card) => card._id);
    await expect.poll(async () => (await shownIds(page)).slice(0, 3).join(",")).toBe(expected.join(","));
  });
});

test.describe("search — URL state", () => {
  test.skip(({ isMobile }) => isMobile, "desktop filter bar");

  test("the URL round-trips and Back undoes one filter at a time", async ({ page }) => {
    await visit(page, "/sr/nekretnine");
    await page.getByTestId("bar-rooms").click();
    await page.getByTestId("rooms-2").click();
    await page.keyboard.press("Escape");
    await expect(page).toHaveURL(/rooms=2$/);
    await page.getByTestId("bar-type").click();
    await page.getByTestId("type-apartment").click();
    await page.keyboard.press("Escape");
    await expect(page).toHaveURL(/type=apartment&rooms=2$/);
    const both = sale.filter((card) => card.rooms === 2 && card.propertyType === "apartment");
    await expectResults(page, both);

    // Back: only the last choice is undone.
    await page.goBack();
    await expect(page).toHaveURL(/nekretnine\?rooms=2$/);
    await expectResults(page, sale.filter((card) => card.rooms === 2));
    await expect(page.getByTestId("active-chip")).toHaveCount(1);

    // Forward and a hard reload (server render) show the same state.
    await page.goForward();
    await expect(page).toHaveURL(/type=apartment&rooms=2$/);
    await page.reload();
    await expectResults(page, both);
    await expect(page.getByTestId("active-chip")).toHaveCount(2);

    // A listing and back again: the filters are still there.
    const first = page.getByTestId("results-list").locator("article h3 a").first();
    await first.click();
    await expect(page).toHaveURL(/\/sr\/nekretnine\/[a-z0-9-]+$/);
    await page.goBack();
    await expect(page).toHaveURL(/type=apartment&rooms=2$/);
    await expectResults(page, both);
  });

  test("the language switch keeps every filter", async ({ page }) => {
    await visit(page, "/sr/nekretnine?type=apartment&rooms=2");
    await page.locator('header button[lang="en"]').click();
    await expect(page).toHaveURL(/\/en\/properties\?type=apartment&rooms=2$/);
  });
});

test.describe("search — load more", () => {
  test("the next page appends the remaining results", async ({ page }) => {
    test.skip(sale.length <= 24, "needs more than one page of demo listings");
    await visit(page, "/sr/nekretnine");
    await expect(page.getByTestId("results-list").locator("article[data-listing-id]")).toHaveCount(24);
    await page.getByTestId("load-more").click();
    await expect(page.getByTestId("results-list").locator("article[data-listing-id]")).toHaveCount(
      Math.min(sale.length, 48),
    );
    const ids = await shownIds(page);
    expect(new Set(ids).size).toBe(ids.length);
    if (sale.length <= 48) await expect(page.getByTestId("load-more")).toHaveCount(0);
  });
});

test.describe("search — map", () => {
  test.skip(({ isMobile }) => isMobile, "the split view; the phone map has its own case");

  test("renders pins for the result set and syncs hover both ways", async ({ page }) => {
    // Novi Sad: few listings, so every one is an unclustered price pin.
    await visit(page, "/sr/nekretnine?location=novi-sad");
    const map = page.getByTestId("search-map");
    await expect(map).toHaveAttribute("data-map-state", /ready|unsupported/, { timeout: 30_000 });
    test.skip((await map.getAttribute("data-map-state")) === "unsupported", "no WebGL2 in this browser");

    const expected = sale.filter((card) => card.cityId === placeId("novi-sad") || card.municipalityId === placeId("novi-sad"));
    expect(expected.length).toBeGreaterThan(0);
    const pins = map.getByTestId("map-pin");
    await expect(pins).toHaveCount(expected.length);

    const id = expected[0]._id;
    const card = page.locator(`article[data-listing-id="${id}"]`);
    const pin = map.locator(`[data-testid="map-pin"][data-listing-id="${id}"]`);
    await card.hover();
    await expect(pin).toHaveAttribute("data-hovered", "true");
    await page.mouse.move(5, 5);
    await pin.hover();
    await expect(card).toHaveAttribute("data-hovered", "true");
  });

  test("the whole-country view clusters, and 'search as I move the map' filters by the viewport", async ({ page }) => {
    await visit(page, "/sr/nekretnine");
    const map = page.getByTestId("search-map");
    await expect(map).toHaveAttribute("data-map-state", /ready|unsupported/, { timeout: 30_000 });
    test.skip((await map.getAttribute("data-map-state")) === "unsupported", "no WebGL2 in this browser");

    const markers = map.locator('[data-testid="map-pin"], [data-testid="map-cluster"]');
    await expect.poll(() => markers.count()).toBeGreaterThan(0);

    await map.getByTestId("map-search-as-move").click();
    await expect(page).toHaveURL(/bbox=/);
    const count = await shownCount(page);
    expect(count).toBeGreaterThan(0);
    expect(count).toBeLessThanOrEqual(sale.length);
    await expect(page.getByTestId("active-chip").filter({ hasText: "Oblast na mapi" })).toHaveCount(1);
  });
});

test.describe("search — phone", () => {
  test.skip(({ isMobile }) => !isMobile, "phone layout");

  test("the filter sheet previews the count and applies on 'Prikaži'", async ({ page }) => {
    await visit(page, "/sr/nekretnine");
    await page.getByTestId("open-filter-sheet").click();
    const sheet = page.getByTestId("filter-sheet");
    await expect(sheet).toBeVisible();
    await sheet.getByTestId("rooms-2").click();
    const expected = sale.filter((card) => card.rooms === 2);
    await expect(sheet.getByTestId("filters-apply")).toContainText(String(expected.length));
    // A draft: the URL has not changed yet.
    await expect(page).toHaveURL(/\/sr\/nekretnine$/);
    await sheet.getByTestId("filters-apply").click();
    await expect(sheet).toBeHidden();
    await expect(page).toHaveURL(/rooms=2$/);
    await expectResults(page, expected);
  });

  test("the list/map switch shows the map", async ({ page }) => {
    await visit(page, "/sr/nekretnine");
    await page.getByTestId("view-map").click();
    const map = page.getByTestId("search-map");
    await expect(map).toBeVisible();
    await expect(map).toHaveAttribute("data-map-state", /ready|unsupported/, { timeout: 30_000 });
    await expect(page.getByTestId("results-list")).toBeHidden();
    await page.getByTestId("view-list").click();
    await expect(page.getByTestId("results-list")).toBeVisible();
  });
});

test.describe("search — compare and health", () => {
  test("two compared listings open the tray, which links to /uporedi", async ({ page }) => {
    await visit(page, "/sr/nekretnine");
    const toggles = page.getByTestId("card-compare");
    await toggles.nth(0).click();
    await expect(page.getByTestId("compare-tray")).toHaveCount(0);
    await toggles.nth(1).click();
    const tray = page.getByTestId("compare-tray");
    await expect(tray).toBeVisible();
    await expect(tray.getByTestId("compare-cta")).toHaveAttribute("href", /\/sr\/uporedi\?ids=[^&]+%2C|\/sr\/uporedi\?ids=[^&]+,/);
  });

  test("no console errors across filtering, paging and the map", async ({ page }) => {
    const errors: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
    });
    page.on("pageerror", (error) => errors.push(error.message));
    await visit(page, "/sr/nekretnine?rooms=2,3&elevator=1");
    await visit(page, "/en/properties?transaction=rent");
    await visit(page, "/ru/nedvizhimost?type=house");
    await visit(page, "/de/immobilien?priceMax=5000");
    await page.waitForTimeout(1_500);
    expect(errors).toEqual([]);
  });
});

test.describe("search — accessibility", () => {
  async function seriousViolations(page: Page): Promise<string[]> {
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
      .analyze();
    return results.violations
      .filter((violation) => violation.impact === "serious" || violation.impact === "critical")
      .map((violation) => `${violation.impact} ${violation.id}: ${violation.nodes.map((node) => node.target.join(" ")).join(" | ")}`);
  }

  test("no serious or critical axe violations: results, an open filter panel, the empty state", async ({ page, isMobile }) => {
    await visit(page, "/sr/nekretnine?type=apartment");
    expect(await seriousViolations(page)).toEqual([]);

    if (isMobile) {
      await page.getByTestId("open-filter-sheet").click();
      await expect(page.getByTestId("filter-sheet")).toBeVisible();
    } else {
      await page.getByTestId("bar-more").click();
      await expect(page.getByTestId("filter-drawer")).toBeVisible();
    }
    expect(await seriousViolations(page)).toEqual([]);
    await page.keyboard.press("Escape");

    await visit(page, "/sr/nekretnine?priceMax=1000");
    await expect(page.getByTestId("results-empty")).toBeVisible();
    expect(await seriousViolations(page)).toEqual([]);
  });
});
