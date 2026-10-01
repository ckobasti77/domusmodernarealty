import { expect, test, type Page } from "@playwright/test";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { adminHttpClient, quietPublicPage } from "./helpers/admin";

/**
 * Step 11: the immersive viewers on the public listing page.
 *
 *  - The showcase listing (ME-1049, seeded by `seedStages:applyDemoTours`) has a
 *    4-scene self-hosted 360° tour and the CC-BY splat walkthrough.
 *  - Nothing heavy loads before the click: no canvas exists until a viewer opens.
 *  - The 3D viewer either mounts its canvas or, without WebGL2 (some headless
 *    browsers), shows the graceful fallback message.
 *  - A Matterport tour is a click-to-load facade (set on another demo listing
 *    for the test and restored afterwards).
 */

const SHOWCASE = "penthaus-na-24-spratu-u-beogradu-na-vodi-pogled-na-savu-me-1049";
const EXTERNAL_REF = "ME-1048";
const EXTERNAL_SLUG = "vila-na-dedinju-iz-2019-sa-bazenom-i-vrtom-od-620-m-me-1048";
const MATTERPORT_SAMPLE = "https://my.matterport.com/show/?m=SxQL3iGyoDo";

async function openTab(page: Page, name: RegExp) {
  const tabs = page.getByRole("tablist", { name: "Fotografije, planovi i obilasci" });
  await tabs.getByRole("tab", { name }).click();
}

test.describe("360° tour", () => {
  test("opens on the showcase listing, switches rooms and disposes on close", async ({ page }) => {
    await quietPublicPage(page);
    await page.goto(`/sr/nekretnine/${SHOWCASE}`);
    await expect(page.locator("canvas")).toHaveCount(0);

    await openTab(page, /360° tura/);
    const panel = page.locator('[data-tour-slot="tour360"]');
    await expect(panel).toContainText("4 prostorije");
    await expect(panel).toContainText("Panorame: Poly Haven (CC0)");
    await panel.locator('[data-launch="tour360"]').click();

    const dialog = page.getByRole("dialog", { name: /360° tura/ });
    await expect(dialog).toBeVisible();
    const viewer = dialog.locator("[data-tour360]");
    await expect(viewer.locator("canvas").first()).toBeVisible({ timeout: 30_000 });

    const rooms = dialog.getByRole("navigation", { name: "Prostorije" });
    await expect(rooms.getByRole("button")).toHaveCount(4);
    await expect(rooms.getByRole("button").first()).toHaveAttribute("aria-current", "true");
    const first = await viewer.getAttribute("data-current-scene");

    await rooms.getByRole("button", { name: "Kupatilo" }).click();
    await expect(viewer).not.toHaveAttribute("data-current-scene", first ?? "", { timeout: 20_000 });
    await expect(rooms.getByRole("button", { name: "Kupatilo" })).toHaveAttribute("aria-current", "true");
    await expect(dialog.getByText("Prostorija 3 od 4")).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
    await expect(page.locator("canvas")).toHaveCount(0);
  });
});

test.describe("3D walkthrough", () => {
  test("shows the size and attribution, then mounts the viewer or the WebGL2 fallback", async ({ page }) => {
    await quietPublicPage(page);
    await page.goto(`/sr/nekretnine/${SHOWCASE}`);
    await openTab(page, /3D šetnja/);

    const panel = page.locator('[data-tour-slot="walk3d"]');
    await expect(panel).toContainText("Beta");
    await expect(panel.getByRole("link", { name: /3D snimak: „Living Room and Kitchen”, ethan3111 \(CC\sBY\s4\.0\)/ })).toHaveAttribute(
      "href",
      "https://superspl.at/scene/9917211a",
    );

    const launch = panel.locator('[data-launch="walk3d"]');
    const unsupported = panel.locator("[data-walk-unsupported]");
    await expect(launch.or(unsupported)).toBeVisible();

    if (await unsupported.isVisible()) {
      await expect(unsupported).toContainText("ne podržava 3D šetnju");
      return;
    }
    await expect(launch).toContainText(/43\s?MB/);
    await launch.click();

    const dialog = page.getByRole("dialog", { name: /3D šetnja/ });
    await expect(dialog).toBeVisible();
    const walk = dialog.locator("[data-walk3d]");
    await expect(walk.locator("canvas")).toHaveCount(1, { timeout: 30_000 });
    await expect(walk.getByRole("link", { name: /CC\sBY\s4\.0/ })).toBeVisible();
    // Loading (or ready on a fast machine); never an error state.
    await expect(walk).toHaveAttribute("data-walk-phase", /download|process|ready/);

    // Closing disposes the renderer, mid-download included.
    await dialog.getByRole("button", { name: "Zatvorite obilazak" }).click();
    await expect(dialog).toHaveCount(0);
    await expect(page.locator("canvas")).toHaveCount(0);
  });
});

test.describe("external tour", () => {
  test.describe.configure({ mode: "serial" });

  test("a Matterport tour loads only after the visitor starts it", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "one project edits the shared listing");
    const client = await adminHttpClient();
    const found = await client.query(api.listingsAdmin.quickFind, { q: EXTERNAL_REF });
    const match = found.find((item) => item.ref === EXTERNAL_REF);
    expect(match, `${EXTERNAL_REF} must exist (seed)`).toBeDefined();
    const listingId = match?._id as Id<"listings">;
    const before = await client.query(api.listingsAdmin.get, { id: listingId, now: Date.now() });
    const previous = before?.listing.tour360;

    await client.mutation(api.toursAdmin.setTour360, {
      listingId,
      tour360: { provider: "matterport", url: MATTERPORT_SAMPLE, published: true },
    });
    try {
      await quietPublicPage(page);
      await page.goto(`/sr/nekretnine/${EXTERNAL_SLUG}`);
      await openTab(page, /360° tura/);
      const panel = page.locator('[data-tour-slot="tour360"]');
      await expect(panel).toContainText("Tura se učitava sa servisa Matterport tek kada je pokrenete.");
      await expect(page.locator("iframe")).toHaveCount(0);

      await panel.locator('[data-launch="external"]').click();
      const frame = page.locator("[data-tour-external] iframe");
      await expect(frame).toHaveAttribute("src", "https://my.matterport.com/show/?m=SxQL3iGyoDo&play=1&qs=1&brand=0");
      await expect(frame).toHaveAttribute("title", /360° tura/);
    } finally {
      await client.mutation(api.toursAdmin.setTour360, {
        listingId,
        ...(previous !== undefined ? { tour360: previous } : {}),
      });
    }
  });
});
