import { expect, test, type Page } from "@playwright/test";
import { presetVisitor, scrollThrough, scrollToY, SHOWCASE_LISTING } from "./helpers/routes";

/**
 * Night-run step 13: no keyboard traps (WCAG 2.1.2, PRD C "full keyboard
 * support").
 *
 * On home, search, listing ME-1049 and contact the test presses Tab up to 250
 * times from the top of the page and records every stop. It fails when focus
 * stays on the same element for 3 consecutive presses, or when the site footer
 * is never reached (a cycle trap anywhere above it would stop it there).
 *
 * Maps (MapLibre, inside `data-lenis-prevent`) are mounted first (the page is
 * scrolled through, then back to the top) so the walk crosses a live map when
 * the tile server answers. Every stop inside a map is listed in the output,
 * and focus must leave the map again on its own.
 *
 * Runs on both projects (a phone with a hardware keyboard tabs as well).
 */

type Stop = {
  /** Per-page identity of the focused element (0 = nothing / `<body>`). */
  key: number;
  desc: string;
  inFooter: boolean;
  inMap: boolean;
  frame: boolean;
};

/** Identifies the focused element (through open shadow roots) without leaking DOM handles. */
function focusStop(page: Page): Promise<Stop> {
  return page.evaluate(() => {
    const w = window as unknown as { __a11yIds?: WeakMap<Element, number>; __a11yNext?: number };
    w.__a11yIds ??= new WeakMap();
    w.__a11yNext ??= 1;
    let el: Element | null = document.activeElement;
    while (el?.shadowRoot?.activeElement) el = el.shadowRoot.activeElement;
    if (el === null || el === document.body || el === document.documentElement) {
      return { key: 0, desc: "<body>", inFooter: false, inMap: false, frame: false };
    }
    let key = w.__a11yIds.get(el);
    if (key === undefined) {
      key = w.__a11yNext;
      w.__a11yNext += 1;
      w.__a11yIds.set(el, key);
    }
    const siteFooter = Array.from(document.querySelectorAll("footer")).find((footer) => footer.closest("main, article") === null);
    const name = (el.getAttribute("aria-label") ?? (el as HTMLElement).innerText ?? "").trim().replace(/\s+/g, " ").slice(0, 40);
    const cls = typeof (el as HTMLElement).className === "string" ? (el as HTMLElement).className.split(" ")[0] : "";
    return {
      key,
      desc: `<${el.tagName.toLowerCase()}${el.id ? `#${el.id}` : ""}${cls ? `.${cls}` : ""}> "${name}"`,
      inFooter: siteFooter?.contains(el) === true,
      // The MapLibre container, or the map wrappers (both carry data-lenis-prevent).
      inMap: el.closest('.maplibregl-map, [data-map-state], [data-testid="search-map"]') !== null,
      frame: el.tagName === "IFRAME",
    };
  });
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

type Target = { label: string; path: string; ready?: string; map?: string };

const PAGES: Target[] = [
  { label: "home", path: "/sr" },
  { label: "search", path: "/sr/nekretnine", ready: '[data-search-bar][data-ready="true"]', map: '[data-testid="search-map"]' },
  { label: "listing ME-1049", path: `/sr/nekretnine/${SHOWCASE_LISTING}`, map: "[data-map-state]" },
  { label: "contact", path: "/sr/kontakt", map: "[data-map-state]" },
];

const MAX_PRESSES = 250;

test.describe("keyboard: no traps, Tab reaches the footer", () => {
  for (const target of PAGES) {
    test(`${target.label}: 250 Tab presses never stall and reach the footer @public @a11y`, async ({ page }, testInfo) => {
      test.setTimeout(150_000);
      await presetVisitor(page);
      const response = await page.goto(target.path);
      expect(response?.status()).toBe(200);
      await shellHydrated(page);
      if (target.ready !== undefined) await expect(page.locator(target.ready)).toBeVisible({ timeout: 30_000 });

      // Mount lazy sections and maps, then start from the top with nothing focused.
      await scrollThrough(page);
      let mapState = "none";
      if (target.map !== undefined) {
        const map = page.locator(target.map).first();
        if ((await map.count()) > 0 && (await map.isVisible())) {
          await map.scrollIntoViewIfNeeded();
          await expect(map).toHaveAttribute("data-map-state", /ready|unsupported|unavailable/, { timeout: 30_000 });
          mapState = (await map.getAttribute("data-map-state")) ?? "unknown";
        } else {
          mapState = "hidden";
        }
      }
      testInfo.annotations.push({ type: "map", description: `${target.label}: ${mapState}` });
      await scrollToY(page, 0);
      await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());

      const stops: Stop[] = [];
      let footerAt = -1;
      for (let press = 1; press <= MAX_PRESSES; press += 1) {
        await page.keyboard.press("Tab");
        const stop = await focusStop(page);
        stops.push(stop);
        const n = stops.length;
        // An iframe holds its own tab order; the page sees the <iframe> until focus leaves it.
        if (n >= 3 && !stop.frame && stops[n - 2].key === stop.key && stops[n - 3].key === stop.key) {
          throw new Error(
            `Keyboard trap on ${target.path} (${testInfo.project.name}): focus stayed on ${stop.desc} for 3 consecutive Tab presses (presses ${press - 2}–${press}).\n` +
              `Last stops: ${stops.slice(-8).map((s) => s.desc).join(" → ")}`,
          );
        }
        if (stop.inFooter) {
          footerAt = press;
          break;
        }
      }

      const mapStops = stops.filter((stop) => stop.inMap);
      console.log(
        `[keyboard] ${testInfo.project.name} ${target.path}: footer after ${footerAt} presses; ${new Set(stops.map((s) => s.key)).size} distinct stops; map ${mapState}, ${mapStops.length} map stop(s)${
          mapStops.length > 0 ? `: ${[...new Set(mapStops.map((s) => s.desc))].slice(0, 6).join(" | ")}` : ""
        }`,
      );

      expect(
        footerAt,
        `Tab reaches the site footer within ${MAX_PRESSES} presses on ${target.path}. Last stops: ${stops
          .slice(-10)
          .map((s) => s.desc)
          .join(" → ")}`,
      ).toBeGreaterThan(0);

      // Focus that entered a map left it again on its own (it is followed by a non-map stop).
      if (mapStops.length > 0) {
        const lastMapIndex = stops.map((stop) => stop.inMap).lastIndexOf(true);
        expect(lastMapIndex, "focus left the map before the footer").toBeLessThan(stops.length - 1);
        expect(stops[lastMapIndex + 1].inMap).toBe(false);
      }
    });
  }
});
