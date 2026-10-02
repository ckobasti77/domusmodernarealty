import { expect, test, type Locator } from "@playwright/test";
import { presetVisitor } from "./helpers/routes";

/**
 * Step 15: the result cards' badges are painted over their photographs.
 *
 * On a touch screen a card's photo strip is raised above the title's stretched
 * link, so a swipe reaches the carousel. It once rose above the badge row too,
 * and every phone and tablet showed a reserved home without "Rezervisano".
 * `toBeVisible()` cannot catch that (the badge keeps its box, it is only painted
 * under the photo), so the test asks the browser what is topmost at the
 * badge's centre, on a touch phone and on a desktop with a mouse.
 */

const DEVICES = [
  { name: "a touch phone", viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true },
  { name: "a desktop", viewport: { width: 1440, height: 900 }, hasTouch: false, isMobile: false },
] as const;

/**
 * "badge" when the badge is the topmost element at its own centre, otherwise
 * what covers it. `elementFromPoint` skips `pointer-events: none`, which the
 * badge row has so that taps and swipes pass through it; the row joins the hit
 * test for this one measurement. Paint order, which is what is under test, does
 * not depend on `pointer-events`.
 */
function topmostAtCentre(badge: Locator): Promise<string> {
  return badge.evaluate((node) => {
    const row = node.parentElement;
    if (row === null) return "a badge outside its row";
    const box = node.getBoundingClientRect();
    const previous = row.style.pointerEvents;
    row.style.pointerEvents = "auto";
    try {
      const hit = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2);
      if (hit === null) return "nothing (the badge is off screen)";
      if (hit === node || node.contains(hit)) return "badge";
      const where = hit.closest('[aria-roledescription="carousel"]') !== null ? " in the photo carousel" : "";
      return `<${hit.tagName.toLowerCase()}>${where}`;
    } finally {
      row.style.pointerEvents = previous;
    }
  });
}

test.describe("step 15: card badges over the photographs", () => {
  for (const device of DEVICES) {
    test(`the first badge on a result card with a carousel is on top on ${device.name} @public`, async ({
      browser,
    }, testInfo) => {
      test.skip(testInfo.project.name !== "desktop", "sets its own device; one project is enough");
      const context = await browser.newContext({
        baseURL: testInfo.project.use.baseURL,
        viewport: device.viewport,
        hasTouch: device.hasTouch,
        isMobile: device.isMobile,
      });
      try {
        const page = await context.newPage();
        await presetVisitor(page);
        await page.goto("/sr/nekretnine");
        await expect(page.locator('[data-search-bar][data-ready="true"]')).toBeVisible({ timeout: 30_000 });
        // The raised photo strip is a `(pointer: coarse)` rule: the context must emulate the right pointer.
        expect(await page.evaluate(() => matchMedia("(pointer: coarse)").matches), "a coarse pointer").toBe(
          device.hasTouch,
        );

        // Only a card with several photos raises its photo strip on touch.
        const card = page
          .getByTestId("results-list")
          .locator("article[data-listing-id]")
          .filter({ has: page.locator('[aria-roledescription="carousel"]') })
          .filter({ has: page.getByTestId("card-badges").locator("span") })
          .first();
        const badge = card.getByTestId("card-badges").locator("span").first();
        await expect(badge, "a result card with several photos and a badge (demo data)").toBeVisible();

        // Mid-screen: clear of the sticky header and filter bar, and of the phone's List/Mapa switch.
        await badge.evaluate((node) => node.scrollIntoView({ block: "center" }));
        await expect
          .poll(() => topmostAtCentre(badge), {
            message: `what is painted at the centre of the badge "${await badge.textContent()}"`,
          })
          .toBe("badge");
      } finally {
        await context.close();
      }
    });
  }
});
