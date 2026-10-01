import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import type { ConvexHttpClient } from "convex/browser";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { adminHttpClient, desktopOnly, loginViaUi, projectContext, readAdminCreds } from "./helpers/admin";

/**
 * The listing editor's "360° / 3D" tab (night-run step 11, PRD admin 7):
 * a self-hosted tour built from uploaded panoramas (two scenes, a link with a
 * direction, persisted across a reload), then a splat walkthrough set by URL
 * with its size measured in the browser, an eye height, a floor polygon pasted
 * as JSON and a start point, all autosaved.
 *
 * Runs on a listing it creates (`[E2E]` title) and deletes in `afterAll`
 * together with the uploaded panoramas; the demo listings are never touched.
 */

const RUN = Date.now().toString(36);
const TITLE = `[E2E] Tura i 3D šetnja ${RUN}`;
const SOG_URL = "https://d28zzqy0iyovbz.cloudfront.net/9917211a/v1/meta.json";
const POLYGON = [
  [-2, -2],
  [2, -2],
  [0, 2],
];

/** A 1024×512 JPEG (2:1, like an equirectangular panorama) drawn in the page. */
async function panoramaJpeg(page: Page, hue: number): Promise<Buffer> {
  const dataUrl = await page.evaluate((h) => {
    const canvas = document.createElement("canvas");
    canvas.width = 1024;
    canvas.height = 512;
    const context = canvas.getContext("2d");
    if (context === null) throw new Error("no 2d canvas");
    const sky = context.createLinearGradient(0, 0, 0, 512);
    sky.addColorStop(0, `hsl(${h} 60% 75%)`);
    sky.addColorStop(1, `hsl(${h} 30% 35%)`);
    context.fillStyle = sky;
    context.fillRect(0, 0, 1024, 512);
    context.fillStyle = "#ffffff";
    for (let x = 0; x < 1024; x += 128) context.fillRect(x, 230, 6, 52);
    return canvas.toDataURL("image/jpeg", 0.8);
  }, hue);
  return Buffer.from(dataUrl.slice(dataUrl.indexOf(",") + 1), "base64");
}

async function savedState(page: Page): Promise<void> {
  await expect(page.getByTestId("save-state")).toHaveAttribute("data-state", "saved", { timeout: 20_000 });
}

test.describe("listing editor: 360° tour and 3D walkthrough @admin", () => {
  test.describe.configure({ mode: "serial", timeout: 180_000 });

  let active = false;
  let admin: ConvexHttpClient;
  let context: BrowserContext | undefined;
  let page: Page;
  let listingId: Id<"listings"> | null = null;

  function requireListing(): Id<"listings"> {
    if (listingId === null) throw new Error("the listing was not created");
    return listingId;
  }

  test.beforeAll(async ({ browser }, testInfo) => {
    desktopOnly(testInfo);
    active = true;
    admin = await adminHttpClient();
    const places = await admin.query(api.locations.tree, {});
    const city = places.find((place) => place.kind === "city" && place.slug === "beograd") ?? places.find((place) => place.kind === "city");
    if (city === undefined) throw new Error("locations.tree has no city");
    const made = await admin.mutation(api.listingsAdmin.create, {
      transaction: "sale",
      propertyType: "apartment",
      cityId: city._id,
      titleSr: TITLE,
    });
    listingId = made.id;

    context = await projectContext(browser, testInfo);
    page = await context.newPage();
    // A leave-page guard would otherwise stall a reload.
    page.on("dialog", (dialog) => void dialog.accept());
    const { email, password } = readAdminCreds();
    await loginViaUi(page, email, password);
  });

  // Scenes first (removeScene deletes their uploaded panoramas), then the listing.
  test.afterAll(async () => {
    if (!active) return;
    await context?.close();
    const id = listingId;
    if (id === null) return;
    const scenes = await admin.query(api.toursAdmin.scenes, { listingId: id });
    for (const scene of scenes) await admin.mutation(api.toursAdmin.removeScene, { listingId: id, sceneId: scene._id });
    await admin.mutation(api.listingsAdmin.remove, { id });
    expect(await admin.query(api.listingsAdmin.get, { id, now: Date.now() })).toBeNull();
  });

  test("uploads two panoramas, links scene 1 to scene 2 with a direction that survives a reload, reorders and deletes @admin", async () => {
    const id = requireListing();
    await page.goto(`/admin/nekretnine/${id}?tab=3d`);
    await expect(page.getByTestId("listing-editor")).toBeVisible({ timeout: 30_000 });

    await page.locator("#f-tour360-provider").click();
    await page.getByRole("option", { name: "Sopstvene 360° panorame" }).click();
    const editor = page.getByTestId("scenes-editor");
    await expect(editor).toBeVisible();
    await expect(editor).toContainText("Još nema scena");

    const upload = page.getByTestId("scene-upload-input");
    await expect(upload).toHaveAttribute("accept", /image\/jpeg/);
    const items = page.getByTestId("scene-item");

    await upload.setInputFiles({ name: "dnevna-soba.jpg", mimeType: "image/jpeg", buffer: await panoramaJpeg(page, 30) });
    await expect(items).toHaveCount(1, { timeout: 60_000 });
    await expect(items.first().getByTestId("scene-item-title")).toContainText("Scena 1");
    // The new scene opens for editing, with its preview.
    await expect(page.getByTestId("scene-editor")).toBeVisible();
    await expect(page.getByTestId("pano-preview")).toBeVisible();

    await upload.setInputFiles({ name: "spavaca-soba.jpg", mimeType: "image/jpeg", buffer: await panoramaJpeg(page, 210) });
    await expect(items).toHaveCount(2, { timeout: 60_000 });
    await expect(items.nth(1).getByTestId("scene-item-title")).toContainText("Scena 2");

    const stored = await admin.query(api.toursAdmin.scenes, { listingId: id });
    expect(stored).toHaveLength(2);
    const [first, second] = stored;
    if (first === undefined || second === undefined) throw new Error("two scenes expected");
    expect(first.pano.kind).toBe("storage");
    expect(first.thumb?.kind, "a thumbnail is made in the browser").toBe("storage");

    // Scene 1 → scene 2 at 45° yaw, −5° pitch.
    await items.first().getByTestId("scene-edit").click();
    const sceneEditor = page.getByTestId("scene-editor");
    await expect(sceneEditor).toHaveAttribute("data-scene-id", first._id);
    await sceneEditor.getByTestId("scene-title-sr").fill("Dnevna soba");
    await sceneEditor.getByTestId("scene-link-add").click();
    const link = sceneEditor.getByTestId("scene-link");
    await expect(link).toHaveCount(1);
    await expect(link.getByTestId("scene-link-target")).toContainText("Scena 2");
    await link.getByTestId("scene-link-yaw").fill("45");
    await link.getByTestId("scene-link-pitch").fill("-5");
    await sceneEditor.getByTestId("scene-save").click();
    await expect(sceneEditor).toContainText("Sve izmene su sačuvane.", { timeout: 20_000 });
    await expect(items.first().getByTestId("scene-item-links")).toHaveText(/^1 veza/);

    const linked = await admin.query(api.toursAdmin.scenes, { listingId: id });
    expect(linked[0]?.title.sr).toBe("Dnevna soba");
    expect(linked[0]?.links).toHaveLength(1);
    expect(linked[0]?.links[0]?.toSceneId).toBe(second._id);
    expect(linked[0]?.links[0]?.yaw).toBeCloseTo(Math.PI / 4, 6);
    expect(linked[0]?.links[0]?.pitch).toBeCloseTo((-5 * Math.PI) / 180, 6);

    // The provider choice was autosaved with the listing.
    await savedState(page);
    const detail = await admin.query(api.listingsAdmin.get, { id, now: Date.now() });
    expect(detail?.listing.tour360?.provider).toBe("self");

    await page.reload();
    await expect(items).toHaveCount(2, { timeout: 30_000 });
    await expect(items.first().getByTestId("scene-item-title")).toContainText("Dnevna soba");
    await expect(items.first().getByTestId("scene-item-links")).toHaveText(/^1 veza/);
    await items.first().getByTestId("scene-edit").click();
    const reopened = page.getByTestId("scene-editor").getByTestId("scene-link");
    await expect(reopened.getByTestId("scene-link-target")).toContainText("Scena 2");
    await expect(reopened.getByTestId("scene-link-yaw")).toHaveValue("45");
    await expect(reopened.getByTestId("scene-link-pitch")).toHaveValue("-5");

    // Reorder with the keyboard-reachable arrow: scene 2 becomes the entrance.
    await page.getByRole("button", { name: "Pomeri scenu „Scena 2” gore" }).click();
    await expect(items.first().getByTestId("scene-item-title")).toContainText("Scena 2");
    await expect
      .poll(async () => (await admin.query(api.toursAdmin.scenes, { listingId: id })).map((scene) => scene._id))
      .toEqual([second._id, first._id]);

    // Deleting the link target asks first, then drops the link that pointed at it.
    await items.first().getByTestId("scene-delete").click();
    await expect(page.getByRole("alertdialog")).toContainText("Obrisati scenu „Scena 2”?");
    await page.getByTestId("confirm-dialog-action").click();
    await expect(items).toHaveCount(1, { timeout: 20_000 });
    await expect(items.first().getByTestId("scene-item-links")).toHaveText(/^0 veza/);
    // The open editor of scene 1 drops the link as well.
    await expect(page.getByTestId("scene-editor").getByTestId("scene-link")).toHaveCount(0);
    const left = await admin.query(api.toursAdmin.scenes, { listingId: id });
    expect(left.map((scene) => scene._id)).toEqual([first._id]);
    expect(left[0]?.links).toEqual([]);
  });

  test("a splat URL, its measured size, eye height, a pasted floor polygon and a start point autosave and reload @admin", async () => {
    const id = requireListing();
    await page.goto(`/admin/nekretnine/${id}?tab=3d`);
    await expect(page.getByTestId("listing-editor")).toBeVisible({ timeout: 30_000 });

    const desktop = page.getByTestId("walk-asset-desktop");
    await page.locator("#f-walk3d-desktop-url").fill(SOG_URL);
    // meta.json is an unpacked SOG.
    await expect(page.locator("#f-walk3d-desktop-format")).toContainText("SOG");
    await desktop.getByRole("button", { name: "Izmeri veličinu" }).click();
    await expect(desktop).toContainText(/\d+(,\d)? MB/, { timeout: 30_000 });

    await page.locator("#f-walk3d-eyeHeight").fill("2,75");
    const json = page.getByTestId("floor-polygon-json");
    await json.fill(JSON.stringify(POLYGON));
    await json.blur();
    await expect(page.getByTestId("floor-point")).toHaveCount(3);
    await page.getByRole("button", { name: "Postavi početnu tačku" }).click();
    await expect(page.getByTestId("floor-spawn")).toBeVisible();

    await savedState(page);
    await expect
      .poll(
        async () => {
          const detail = await admin.query(api.listingsAdmin.get, { id, now: Date.now() });
          const walk = detail?.listing.walk3d;
          return {
            url: walk?.desktop?.source.kind === "url" ? walk.desktop.source.url : null,
            format: walk?.desktop?.format ?? null,
            measured: (walk?.desktop?.bytes ?? 0) > 1_000_000,
            eyeHeight: walk?.eyeHeight ?? null,
            floorPolygon: walk?.floorPolygon ?? null,
            spawn: walk?.spawn ?? null,
          };
        },
        { timeout: 20_000, message: "the walkthrough reaches Convex" },
      )
      .toEqual({
        url: SOG_URL,
        format: "sog",
        measured: true,
        eyeHeight: 2.75,
        floorPolygon: POLYGON,
        spawn: { x: 0, y: 0, z: 0, yaw: 0 },
      });

    await page.reload();
    await expect(page.locator("#f-walk3d-desktop-url")).toHaveValue(SOG_URL, { timeout: 30_000 });
    await expect(page.locator("#f-walk3d-eyeHeight")).toHaveValue("2,75");
    await expect(page.getByTestId("floor-point")).toHaveCount(3);
    await expect(page.getByTestId("floor-spawn")).toBeVisible();
    await expect(page.getByTestId("floor-polygon-json")).toHaveValue(/\[-2, -2\],\s*\[2, -2\],\s*\[0, 2\]/);
    await expect(page.locator("#f-walk3d-spawn-x")).toHaveValue("0");
  });
});
