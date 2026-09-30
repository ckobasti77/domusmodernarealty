import { randomBytes } from "node:crypto";
import { expect, test, type BrowserContext, type Locator, type Page } from "@playwright/test";
import type { ConvexHttpClient } from "convex/browser";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import {
  adminHttpClient,
  belgradeDate,
  convexRun,
  desktopOnly,
  fixture,
  loginViaUi,
  projectContext,
  quietPublicPage,
  readAdminCreds,
  refusal,
  sidebar,
  signedInClient,
} from "./helpers/admin";

/**
 * Admin panel (night-run step 08, PRD B1–B3, B14).
 *
 * Proven end to end against the dev deployment: the auth gate, sign-in and
 * sign-out; the listing lifecycle create → photos → required fields → publish
 * (blocked below 5 photos, by the SERVER as well as the UI) → public page and
 * search → unpublish → public 404 → staff preview; and an invited agent who can
 * neither see nor change another agent's listing.
 *
 * Everything the suite creates is marked (`[E2E]` titles, `e2e+…` addresses,
 * `E2E …` agent names) and removed in `afterAll` through the internal
 * `qa:purgeE2EListings` / `qa:purgeE2EUser` helpers.
 */

const RUN = Date.now().toString(36);
const TITLE = `[E2E] Trosoban stan za test ${RUN}`;
const DESCRIPTION =
  "Svetao i tih trosoban stan od 74 m² na trećem spratu, sa lođom okrenutom ka dvorištu i novom stolarijom. " +
  "Oglas je napravio automatski test i biće obrisan odmah posle provere.";
const PRICE = 185_000;
const MANDATE = `E2E-${RUN}`;

type Created = { id: Id<"listings">; slug: string; ref: string };

/* ------------------------------------------------------------------ helpers */

/** Editor fields the flow touched that expose no accessible name (asserted last). */
const unlabeled: string[] = [];

/**
 * An editor control by the id the contract fixes. It must be labelled (a
 * `<Label htmlFor>`, `aria-label` or `aria-labelledby` with text); a missing
 * label is recorded as an a11y bug instead of stopping the flow.
 */
async function field(page: Page, id: string): Promise<Locator> {
  const control = page.locator(`[id="${id}"]`);
  await expect(control, `#${id} is on screen`).toBeVisible();
  const { named, tag } = await control.evaluate((node) => {
    const element = node as HTMLElement & { labels?: NodeListOf<HTMLLabelElement> | null };
    const byIds = (element.getAttribute("aria-labelledby") ?? "")
      .split(/\s+/)
      .filter(Boolean)
      .map((ref) => document.getElementById(ref)?.textContent ?? "");
    const texts = [
      element.getAttribute("aria-label") ?? "",
      ...byIds,
      ...Array.from(element.labels ?? [], (label) => label.textContent ?? ""),
    ];
    return { named: texts.some((text) => text.trim().length > 0), tag: element.tagName.toLowerCase() };
  });
  if (!named && !unlabeled.some((entry) => entry.startsWith(`#${id} `))) unlabeled.push(`#${id} (<${tag}>)`);
  return control;
}

/** Rooms may be a number input, a native select or a Radix select. */
async function setRooms(page: Page, rooms: number): Promise<void> {
  const control = await field(page, "f-rooms");
  const tag = await control.evaluate((node) => node.tagName.toLowerCase());
  if (tag === "input") {
    await control.fill(String(rooms));
  } else if (tag === "select") {
    await control.selectOption(String(rooms));
  } else {
    await control.click();
    // "3", "3 (trosoban)"… but never "3.5" / "3,5".
    await page.getByRole("option", { name: new RegExp(`^${rooms}(?![.,]\\d)`) }).click();
  }
}

/** The facts the flow sets, as Convex stores them (admin read). */
async function snapshot(client: ConvexHttpClient, id: Id<"listings">) {
  const detail = await client.query(api.listingsAdmin.get, { id, now: Date.now() });
  if (detail === null) return null;
  const { listing } = detail;
  return {
    status: listing.status,
    price: listing.price,
    areaM2: listing.areaM2,
    rooms: listing.rooms,
    descriptionSr: listing.description.sr.trim(),
    mandateNumber: listing.mandate?.number ?? null,
    mandateValid: listing.mandate !== undefined && listing.mandate.end > Date.now(),
    photos: listing.media.length,
    covers: listing.media.filter((item) => item.isCover === true).length,
  };
}

/** Confirms whatever ConfirmDialog the last click opened. */
async function confirm(page: Page): Promise<void> {
  await page.getByTestId("confirm-dialog-action").click();
  await expect(page.getByRole("alertdialog")).toBeHidden({ timeout: 20_000 });
}

/**
 * The staff preview URL behind `action-preview`, as a same-origin path. With no
 * valid link yet, `action-preview` is the "Napravi link za pregled" button;
 * once the server has minted a token it becomes the link that opens the
 * preview. An absolute URL is reduced to its path so the test never leaves the
 * server under test.
 */
async function previewPath(page: Page): Promise<string> {
  const trigger = page.getByTestId("action-preview");
  await expect(trigger).toBeVisible();
  if ((await trigger.getAttribute("href")) === null) await trigger.click();
  const link = page.locator('[data-testid="action-preview"][href*="preview="]');
  await expect(link).toBeVisible({ timeout: 15_000 });
  const url = (await link.getAttribute("href")) ?? "";
  const parsed = new URL(url, "http://localhost");
  return `${parsed.pathname}${parsed.search}`;
}

/** A draft owned by the default agent, for running the agent cases on their own (`--grep`). */
async function createTargetListing(client: ConvexHttpClient): Promise<Created> {
  const places = await client.query(api.locations.tree, {});
  const city =
    places.find((place) => place.kind === "city" && place.slug === "beograd") ??
    places.find((place) => place.kind === "city");
  if (city === undefined) throw new Error("locations.tree has no city");
  const made = await client.mutation(api.listingsAdmin.create, {
    transaction: "sale",
    propertyType: "apartment",
    cityId: city._id,
    titleSr: `[E2E] Tuđa nekretnina ${RUN}`,
  });
  return { id: made.id, slug: made.slug, ref: made.ref };
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/* ----------------------------------------------------------- 1–3: access */

test.describe("admin access @admin", () => {
  test.beforeAll(({}, testInfo) => desktopOnly(testInfo));

  test("an unauthenticated visit to an admin page redirects to login with the way back @admin", async ({ page }) => {
    await page.goto("/admin/nekretnine");
    await expect(page).toHaveURL(/\/admin\/login\?next=%2Fadmin%2Fnekretnine$/);
    await expect(page.getByLabel("E-pošta", { exact: true })).toBeVisible();
    await expect(sidebar(page)).toHaveCount(0);

    await page.goto("/admin");
    await expect(page).toHaveURL(/\/admin\/login\?next=%2Fadmin$/);
    await expect(page.getByRole("button", { name: "Prijavite se" })).toBeVisible();
    await expect(sidebar(page)).toHaveCount(0);
  });

  test("signing in from a gated page returns to that page @admin", async ({ page }) => {
    const { email, password } = readAdminCreds();
    await page.goto("/admin/nekretnine");
    await expect(page).toHaveURL(/\/admin\/login\?next=/);
    await page.getByLabel("E-pošta", { exact: true }).fill(email);
    await page.getByLabel("Lozinka", { exact: true }).fill(password);
    await page.getByRole("button", { name: "Prijavite se" }).click();
    await expect(page).toHaveURL(/\/admin\/nekretnine$/, { timeout: 20_000 });
    await expect(page.getByTestId("listings-table")).toBeVisible();
  });

  test("an empty form and a wrong password show inline errors and stay on the login page @admin @forms", async ({
    page,
  }) => {
    const { email } = readAdminCreds();
    await page.goto("/admin/login");
    const emailField = page.getByLabel("E-pošta", { exact: true });
    const passwordField = page.getByLabel("Lozinka", { exact: true });
    const submit = page.getByRole("button", { name: "Prijavite se" });

    // Client-side validation first: nothing reaches the server.
    await submit.click();
    await expect(page.getByText("Unesite e-poštu.")).toBeVisible();
    await expect(page.getByText("Unesite lozinku.")).toBeVisible();
    await expect(emailField).toHaveAttribute("aria-invalid", "true");

    await emailField.fill(email);
    await passwordField.fill(`pogresna-lozinka-${RUN}`);
    await submit.click();
    await expect(page.getByRole("alert").filter({ hasText: "Pogrešna e-pošta ili lozinka." })).toBeVisible({
      timeout: 15_000,
    });
    await expect(passwordField).toBeFocused();
    await expect(page).toHaveURL(/\/admin\/login$/);
    await expect(sidebar(page)).toHaveCount(0);
  });

  test("the admin signs in to the full panel and signs out through the user menu @admin", async ({ page }) => {
    const { email, password } = readAdminCreds();
    await loginViaUi(page, email, password);

    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.getByTestId("kpi-cards")).toBeVisible();
    const nav = sidebar(page);
    await expect(nav.getByRole("link", { name: "Nekretnine", exact: true })).toBeVisible();
    await expect(nav.getByRole("link", { name: "Demo sadržaj", exact: true })).toBeVisible();

    await page.getByTestId("user-menu").click();
    await page.getByRole("menuitem", { name: "Odjavite se" }).click();
    await expect(page).toHaveURL(/\/admin\/login(\?|$)/);
    await expect(page.getByLabel("E-pošta", { exact: true })).toBeVisible();

    // The session is gone, not just the screen: the gate sends /admin back to login.
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/admin\/login\?next=%2Fadmin$/);
    await expect(sidebar(page)).toHaveCount(0);
  });
});

/* ---------------------------------------------- 4–5: lifecycle and agent */

test.describe("listing lifecycle and agent scoping @admin", () => {
  test.describe.configure({ mode: "serial", timeout: 180_000 });

  const agentEmail = `e2e+agent-${RUN}@mihajlo-estate.local`;
  let active = false;
  let admin: ConvexHttpClient;
  let context: BrowserContext | undefined;
  /** The admin panel tab and a public-site tab in the same signed-in browser. */
  let editor: Page;
  let site: Page;
  let created: Created | null = null;
  let agentId: Id<"agents"> | null = null;
  /** Native dialogs on the admin tab (a leave-page guard would otherwise stall `goto`). */
  const dialogs: string[] = [];

  function requireCreated(): Created {
    if (created === null) throw new Error("the create step did not produce a listing");
    return created;
  }

  test.beforeAll(async ({ browser }, testInfo) => {
    desktopOnly(testInfo);
    active = true;
    admin = await adminHttpClient();
    context = await projectContext(browser, testInfo);
    editor = await context.newPage();
    editor.on("dialog", (dialog) => {
      dialogs.push(`${dialog.type()}: ${dialog.message()}`);
      void dialog.accept();
    });
    site = await context.newPage();
    await quietPublicPage(site);
  });

  // Always runs, even after a failure; each step is independent of the others.
  test.afterAll(async () => {
    if (!active) return;
    await context?.close();
    const problems: string[] = [];
    const attempt = async (label: string, run: () => unknown) => {
      try {
        await run();
      } catch (error) {
        problems.push(`${label}: ${String(error).slice(0, 200)}`);
      }
    };
    await attempt("qa:purgeE2EListings", () => convexRun("qa:purgeE2EListings", {}));
    await attempt("qa:purgeE2EUser", () => convexRun("qa:purgeE2EUser", { email: agentEmail }));
    // Only still there if the invite was never accepted (no user row to purge through).
    const profile = agentId;
    if (profile !== null) {
      await attempt("agentsAdmin.remove", async () => {
        try {
          await admin.mutation(api.agentsAdmin.remove, { id: profile });
        } catch (error) {
          if ((error as { data?: { code?: string } }).data?.code !== "NOT_FOUND") throw error;
        }
      });
    }
    expect(problems, "e2e cleanup").toEqual([]);
  });

  test("an admin creates a draft, uploads 3 photos and fills the required fields; the server still refuses to publish @admin @forms", async () => {
    const { email, password } = readAdminCreds();
    await loginViaUi(editor, email, password);

    // Create from the table's "Nova nekretnina".
    await editor.goto("/admin/nekretnine");
    await expect(editor.getByTestId("listings-table")).toBeVisible();
    await editor.getByTestId("new-listing").click();
    await expect(editor).toHaveURL(/\/admin\/nekretnine\/nova$/);
    const form = editor.getByTestId("new-listing-form");
    await expect(form.getByTestId("new-transaction")).toContainText("Prodaja");
    await expect(form.getByTestId("new-type")).toContainText("Stan");
    await expect(form.getByTestId("new-city")).toContainText("Beograd");
    await (await field(editor, "new-title")).fill(TITLE);
    await form.getByRole("button", { name: "Kreiraj nacrt" }).click();

    await expect(editor).toHaveURL(/\/admin\/nekretnine\/(?!nova$)[^/?#]+$/, { timeout: 20_000 });
    const root = editor.getByTestId("listing-editor");
    await expect(root).toHaveAttribute("data-listing-id", /\S/);
    await expect(root).toHaveAttribute("data-slug", /\S/);
    const id = (await root.getAttribute("data-listing-id")) as Id<"listings">;
    const slug = (await root.getAttribute("data-slug")) ?? "";
    expect(editor.url()).toContain(`/admin/nekretnine/${id}`);
    await expect(editor.getByTestId("editor-status")).toHaveAttribute("data-status", "draft");

    const stored = await admin.query(api.listingsAdmin.get, { id, now: Date.now() });
    expect(stored?.listing.title.sr).toBe(TITLE);
    expect(stored?.listing.status).toBe("draft");
    created = { id, slug, ref: stored?.listing.ref ?? "" };
    expect(created.ref).toMatch(/^ME-\d+$/);

    // Mediji: three files in one go; the first becomes the cover.
    await editor.getByTestId("tab-mediji").click();
    const upload = editor.getByTestId("media-upload-input");
    await expect(upload).toHaveAttribute("accept", /image\/jpeg/);
    await upload.setInputFiles([fixture(1), fixture(2), fixture(3)]);
    const items = editor.getByTestId("media-item");
    await expect(items).toHaveCount(3, { timeout: 60_000 });
    await expect(items.first()).toHaveAttribute("data-media-id", /\S/);
    await expect(items.first()).toHaveAttribute("data-cover", "true");
    await expect(editor.locator('[data-testid="media-item"][data-cover="true"]')).toHaveCount(1);

    // The required fields, tab by tab.
    await editor.getByTestId("tab-cena").click();
    await (await field(editor, "f-price")).fill(String(PRICE));

    await editor.getByTestId("tab-karakteristike").click();
    await (await field(editor, "f-areaM2")).fill("74");
    await setRooms(editor, 3);

    await editor.getByTestId("tab-opis").click();
    await (await field(editor, "f-description-sr")).fill(DESCRIPTION);

    await editor.getByTestId("tab-pravno").click();
    await (await field(editor, "f-mandate-number")).fill(MANDATE);
    await (await field(editor, "f-mandate-start")).fill(belgradeDate(0));
    await (await field(editor, "f-mandate-end")).fill(belgradeDate(180));

    await expect(editor.getByTestId("save-state")).toHaveAttribute("data-state", "saved", { timeout: 20_000 });

    // Convex holds what the form shows (autosave really saved).
    await expect
      .poll(() => snapshot(admin, id), { timeout: 20_000, message: "the editor's values reach Convex" })
      .toEqual({
        status: "draft",
        price: PRICE,
        areaM2: 74,
        rooms: 3,
        descriptionSr: DESCRIPTION,
        mandateNumber: MANDATE,
        mandateValid: true,
        photos: 3,
        covers: 1,
      });

    // The live checklist: everything but the photo count is done.
    for (const code of ["mandate", "price", "location", "area", "rooms", "cover", "titleSr", "descriptionSr", "slug"]) {
      await expect(editor.getByTestId(`check-${code}`), `checklist item "${code}"`).toHaveAttribute("data-ok", "true");
    }
    await expect(editor.getByTestId("check-photos")).toHaveAttribute("data-ok", "false");

    // The rule lives on the server too: a direct API call is refused.
    const blocked = await refusal(admin.mutation(api.listingsAdmin.publish, { id }));
    expect(blocked.code).toBe("PUBLISH_BLOCKED");
    expect(blocked.reasons).toContain("Najmanje 5 fotografija");
    expect(blocked.reasons, "the photo count is the only blocker left").toEqual(["Najmanje 5 fotografija"]);
    await expect(editor.getByTestId("editor-status")).toHaveAttribute("data-status", "draft");
  });

  test("with 5 photos the listing publishes and shows on the public page and in search @admin @public", async () => {
    const listing = requireCreated();

    await editor.getByTestId("tab-mediji").click();
    await editor.getByTestId("media-upload-input").setInputFiles([fixture(4), fixture(5)]);
    const items = editor.getByTestId("media-item");
    await expect(items).toHaveCount(5, { timeout: 60_000 });
    await expect(items.first()).toHaveAttribute("data-cover", "true");
    await expect.poll(async () => (await snapshot(admin, listing.id))?.photos, { timeout: 20_000 }).toBe(5);

    await editor.getByTestId("tab-pravno").click();
    await expect(editor.getByTestId("check-photos")).toHaveAttribute("data-ok", "true");
    await editor.getByTestId("action-publish").click();
    await confirm(editor);
    await expect(editor.getByTestId("editor-status")).toHaveAttribute("data-status", "published", { timeout: 20_000 });

    const slug = (await editor.getByTestId("listing-editor").getAttribute("data-slug")) ?? listing.slug;
    listing.slug = slug;

    const response = await site.goto(`/sr/nekretnine/${slug}`);
    expect(response?.status()).toBe(200);
    await expect(site.getByRole("heading", { level: 1 })).toContainText(TITLE);
    await expect(site.getByTestId("listing-price")).toHaveText("185.000 €");
    await expect(site.getByTestId("listing-compliance")).toContainText("Registar posrednika");

    // Search, default sort (newest): the fresh listing is on the first page.
    await site.goto("/sr/nekretnine");
    await expect(site.locator('[data-search-bar][data-ready="true"]')).toBeVisible({ timeout: 30_000 });
    const card = site.getByTestId("results-list").locator(`article[data-listing-id="${listing.id}"]`);
    await expect(card).toBeVisible();
    await expect(card).toContainText(TITLE);
  });

  test("unpublishing withdraws the listing: the public page is a 404 @admin @public", async () => {
    const listing = requireCreated();

    await editor.getByTestId("action-unpublish").click();
    await confirm(editor);
    await expect(editor.getByTestId("editor-status")).toHaveAttribute("data-status", "withdrawn", { timeout: 20_000 });

    const response = await site.goto(`/sr/nekretnine/${listing.slug}`);
    expect(response?.status()).toBe(404);

    // The admin table agrees (search by ref). Everything was saved, so leaving
    // the editor must not raise a leave-page prompt.
    await editor.goto("/admin/nekretnine");
    expect(dialogs, "native dialogs while leaving a saved editor").toEqual([]);
    await expect(editor.getByTestId("listings-table")).toBeVisible();
    await editor.getByTestId("listings-search").fill(listing.ref);
    await expect(editor.locator(`[data-testid="listing-row"][data-ref="${listing.ref}"]`)).toHaveAttribute(
      "data-status",
      "withdrawn",
    );
  });

  test("the preview link shows the withdrawn listing to staff, flagged and noindex @admin @public", async () => {
    const listing = requireCreated();
    await editor.goto(`/admin/nekretnine/${listing.id}`);
    await expect(editor.getByTestId("editor-status")).toHaveAttribute("data-status", "withdrawn");

    const path = await previewPath(editor);
    expect(path).toMatch(new RegExp(`^/sr/nekretnine/${escapeRegExp(listing.slug)}\\?preview=[^&]+`));

    const response = await site.goto(path);
    expect(response?.status()).toBe(200);
    await expect(site.getByTestId("listing-preview-banner")).toBeVisible();
    await expect(site.getByRole("heading", { level: 1 })).toContainText(TITLE);
    await expect(site.locator('meta[name="robots"][content*="noindex"]')).toHaveCount(1);

    // A forged token is not a key: the withdrawn listing stays a 404.
    const forged = await site.goto(`/sr/nekretnine/${listing.slug}?preview=${"0".repeat(64)}`);
    expect(forged?.status()).toBe(404);
  });

  test.describe("an invited agent", () => {
    const password = `E2e-${randomBytes(12).toString("base64url")}`;
    let target: Created;
    let token: string;
    let agentContext: BrowserContext | undefined;
    let agentPage: Page;

    test.beforeAll(async ({ browser }, testInfo) => {
      target = created ?? (await createTargetListing(admin));
      const profile = await admin.mutation(api.agentsAdmin.upsert, {
        name: `E2E Agent ${RUN}`,
        role: { sr: "Agent (e2e test)" },
        languages: ["sr"],
        areas: [],
        isPublic: false,
      });
      agentId = profile.id;
      const invite = await admin.mutation(api.invites.create, { email: agentEmail, role: "agent", agentId: profile.id });
      token = invite.token;
      agentContext = await projectContext(browser, testInfo);
      agentPage = await agentContext.newPage();
    });

    test.afterAll(async () => {
      await agentContext?.close();
    });

    test("accepts the invite with a new password and lands in the panel @admin @forms", async () => {
      await agentPage.goto(`/admin/pozivnica/${encodeURIComponent(token)}`);
      const emailField = agentPage.getByLabel("E-pošta", { exact: true });
      await expect(emailField).toHaveValue(agentEmail);
      await expect(emailField).not.toBeEditable();

      await agentPage.getByLabel("Ime i prezime").fill(`E2E Agent ${RUN}`);
      await agentPage.getByLabel("Nova lozinka").fill(password);
      await agentPage.getByLabel("Ponovite lozinku").fill(`${password}x`);
      const submit = agentPage.getByRole("button", { name: "Aktivirajte nalog" });
      await submit.click();
      await expect(agentPage.getByText("Lozinke se ne poklapaju.")).toBeVisible();
      await expect(agentPage).toHaveURL(/\/admin\/pozivnica\//);

      await agentPage.getByLabel("Ponovite lozinku").fill(password);
      await submit.click();
      await expect(agentPage).toHaveURL(/\/admin\/?$/, { timeout: 20_000 });
      await expect(sidebar(agentPage)).toBeVisible();
      await expect(sidebar(agentPage)).toContainText(`E2E Agent ${RUN}`);
    });

    test("sees neither the demo panel nor another agent's listing @admin", async () => {
      const nav = sidebar(agentPage);
      await expect(nav.getByRole("link", { name: "Nekretnine", exact: true })).toBeVisible();
      await expect(nav.getByRole("link", { name: "Demo sadržaj" })).toHaveCount(0);

      await agentPage.goto("/admin/demo");
      await expect(agentPage.getByTestId("admin-forbidden")).toBeVisible();
      await expect(agentPage.getByTestId("demo-purge")).toHaveCount(0);

      // The table is scoped to the agent (the server-side proof is the next case).
      await agentPage.goto("/admin/nekretnine");
      await expect(agentPage.getByTestId("listings-table")).toBeVisible();
      await agentPage.getByTestId("listings-search").fill(target.ref);
      await expect(agentPage.locator(`[data-testid="listing-row"][data-ref="${target.ref}"]`)).toHaveCount(0);

      await agentPage.goto(`/admin/nekretnine/${target.id}`);
      await expect(agentPage.getByTestId("admin-forbidden")).toBeVisible();
      await expect(agentPage.getByTestId("listing-editor")).toHaveCount(0);
    });

    test("the server refuses the agent's reads and writes on that listing @admin", async () => {
      const agent = await signedInClient({ email: agentEmail, password });
      const me = await agent.query(api.users.getMe, {});
      expect(me?.role).toBe("agent");
      expect(me?.agentId).toBe(agentId);

      const before = await snapshot(admin, target.id);
      expect(before).not.toBeNull();

      const update = await refusal(agent.mutation(api.listingsAdmin.update, { id: target.id, patch: { price: 1 } }));
      expect(update.code).toBe("FORBIDDEN");
      const read = await refusal(agent.query(api.listingsAdmin.get, { id: target.id, now: Date.now() }));
      expect(read.code).toBe("FORBIDDEN");
      const publish = await refusal(agent.mutation(api.listingsAdmin.publish, { id: target.id }));
      expect(publish.code).toBe("FORBIDDEN");

      const searched = await agent.query(api.listingsAdmin.list, {
        q: target.ref,
        paginationOpts: { cursor: null, numItems: 25 },
      });
      expect(searched.page.map((row) => row._id)).not.toContain(target.id);
      const all = await agent.query(api.listingsAdmin.list, { paginationOpts: { cursor: null, numItems: 25 } });
      expect(all.page, "a new agent owns no listings").toEqual([]);

      // Nothing moved.
      expect(await snapshot(admin, target.id)).toEqual(before);
    });

    test("the invite link cannot be used a second time @admin", async ({ browser }, testInfo) => {
      const fresh = await projectContext(browser, testInfo);
      try {
        const page = await fresh.newPage();
        await page.goto(`/admin/pozivnica/${encodeURIComponent(token)}`);
        const invalid = page.getByTestId("invite-invalid");
        await expect(invalid).toBeVisible();
        await expect(invalid).toContainText("Pozivnica je već iskorišćena.");
        await expect(page.getByTestId("invite-form")).toHaveCount(0);
      } finally {
        await fresh.close();
      }
    });
  });

  // Last, so a missing label is reported without blocking the flow above.
  test("every editor field the flow used has an accessible name @admin", () => {
    expect(unlabeled, "fields without an accessible name (a11y bug)").toEqual([]);
  });
});
