import { randomBytes } from "node:crypto";
import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import type { ConvexHttpClient } from "convex/browser";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { adminHttpClient, desktopOnly, loginViaUi, projectContext, readAdminCreds } from "./helpers/admin";

/**
 * Review 14, admin fixes proven in the browser:
 *   - a half room typed with a decimal comma ("1,5") is stored as 1.5 rooms
 *     (the field used to be a native number input, which drops the comma in
 *     Chromium: 15 rooms);
 *   - the browser's Back with unsaved changes in an editor asks first with the
 *     panel's own dialog, stays on "Ostani" and leaves on "Napusti bez
 *     čuvanja", with no native leave-page prompt on top.
 *
 * Isolation: the listing is titled `[E2E-R14] … <run>`, not `[E2E] …` (the
 * global `qa:purgeE2EListings` in admin.spec's afterAll would delete it in a
 * parallel run), and the post is created here; both are removed by id in
 * afterAll.
 */

const RUN = `${Date.now().toString(36)}${randomBytes(2).toString("hex")}`;
const LISTING_TITLE = `[E2E-R14] Jednoiposoban stan ${RUN}`;
const POST_TITLE = `[E2E-R14] Nesačuvan naslov ${RUN}`;

test.describe("review 14: admin editors @admin", () => {
  test.describe.configure({ mode: "serial", timeout: 120_000 });

  let active = false;
  let admin: ConvexHttpClient;
  let context: BrowserContext | undefined;
  let page: Page;
  let listingId: Id<"listings"> | null = null;
  let postId: Id<"posts"> | null = null;
  /** Native dialogs on the admin tab: a `beforeunload` prompt would land here. */
  const dialogs: string[] = [];

  test.beforeAll(async ({ browser }, testInfo) => {
    desktopOnly(testInfo);
    active = true;
    admin = await adminHttpClient();
    context = await projectContext(browser, testInfo);
    page = await context.newPage();
    page.on("dialog", (dialog) => {
      dialogs.push(`${dialog.type()}: ${dialog.message()}`);
      void dialog.accept();
    });
    const { email, password } = readAdminCreds();
    await loginViaUi(page, email, password);
  });

  // Always runs, even after a failure.
  test.afterAll(async () => {
    if (!active) return;
    await context?.close();
    const problems: string[] = [];
    const attempt = async (label: string, run: () => Promise<unknown>) => {
      try {
        await run();
      } catch (error) {
        problems.push(`${label}: ${String(error).slice(0, 200)}`);
      }
    };
    const listing = listingId;
    if (listing !== null) {
      await attempt("listingsAdmin.remove", () => admin.mutation(api.listingsAdmin.remove, { id: listing }));
    }
    const post = postId;
    if (post !== null) {
      await attempt("postsAdmin.remove", () => admin.mutation(api.postsAdmin.remove, { id: post }));
    }
    expect(problems, "e2e cleanup").toEqual([]);
  });

  test("a half room typed with a decimal comma is stored as 1.5 rooms @admin @forms", async () => {
    const places = await admin.query(api.locations.tree, {});
    const city =
      places.find((place) => place.kind === "city" && place.slug === "beograd") ??
      places.find((place) => place.kind === "city");
    if (city === undefined) throw new Error("locations.tree has no city");
    const made = await admin.mutation(api.listingsAdmin.create, {
      transaction: "sale",
      propertyType: "apartment",
      cityId: city._id,
      titleSr: LISTING_TITLE,
    });
    listingId = made.id;

    await page.goto(`/admin/nekretnine/${made.id}?tab=karakteristike`);
    const rooms = page.locator("#f-rooms");
    await expect(rooms).toBeVisible({ timeout: 20_000 });
    // Key by key, as a person types it: the comma is the keystroke that used to vanish.
    await rooms.fill("");
    await rooms.pressSequentially("1,5");
    await rooms.press("Tab");
    await expect(rooms).toHaveValue("1,5");
    await expect(page.getByText("Struktura: jednoiposoban.")).toBeVisible();

    await expect
      .poll(async () => (await admin.query(api.listingsAdmin.get, { id: made.id, now: Date.now() }))?.listing.rooms, {
        timeout: 20_000,
        message: "the typed rooms reach Convex",
      })
      .toBe(1.5);
    await expect(page.getByTestId("save-state")).toHaveAttribute("data-state", "saved", { timeout: 20_000 });

    // Read back after a reload, with its decimal comma.
    await page.reload();
    await expect(page.locator("#f-rooms")).toHaveValue("1,5", { timeout: 20_000 });
    expect(dialogs).toEqual([]);
  });

  test("Back with an unsaved post title asks first, stays on 'Ostani' and leaves on 'Napusti bez čuvanja' @admin @forms", async () => {
    const id = await admin.mutation(api.postsAdmin.create, {});
    postId = id;
    const editorUrl = new RegExp(`/admin/magazin/${id}$`);

    // The dashboard is the page Back leads to.
    await page.goto("/admin");
    await expect(page.getByTestId("kpi-cards")).toBeVisible({ timeout: 20_000 });
    await page.goto(`/admin/magazin/${id}`);
    const title = page.getByTestId("post-title-sr");
    await expect(title).toBeVisible({ timeout: 20_000 });
    await title.fill(POST_TITLE);
    await expect(page.getByTestId("save-bar")).toContainText("Imate nesačuvane izmene.");

    const leave = page.getByRole("alertdialog", { name: "Imate nesačuvane izmene" });
    await page.goBack();
    await expect(leave).toBeVisible();
    await expect(leave).toContainText("izmene u ovom tekstu biće izgubljene");
    await expect(page).toHaveURL(editorUrl);

    // "Ostani": still on the editor with the edit, and Back is guarded again.
    await leave.getByRole("button", { name: "Ostani" }).click();
    await expect(leave).toBeHidden();
    await expect(title).toHaveValue(POST_TITLE);
    await expect(page).toHaveURL(editorUrl);

    await page.goBack();
    await expect(leave).toBeVisible();
    await leave.getByRole("button", { name: "Napusti bez čuvanja" }).click();
    await expect(page).toHaveURL(/\/admin\/?$/, { timeout: 20_000 });
    await expect(page.getByTestId("kpi-cards")).toBeVisible({ timeout: 20_000 });

    expect(dialogs, "no native leave-page prompt on top of the panel's dialog").toEqual([]);
    const stored = await admin.query(api.postsAdmin.get, { id });
    expect(stored?.post.title.sr, "nothing was saved").toBe("");
  });
});
