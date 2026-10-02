import { randomBytes } from "node:crypto";
import { expect, test, type BrowserContext, type Locator, type Page } from "@playwright/test";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import {
  adminHttpClient,
  belgradeDate,
  convexRun,
  convexUrl,
  desktopOnly,
  loginViaUi,
  projectContext,
  quietPublicPage,
  readAdminCreds,
  refusal,
  sidebar,
  signedInClient,
} from "./helpers/admin";

/**
 * Admin modules not proven elsewhere (night-run step 13, PRD B1–B14):
 *
 *   B1  every admin module refuses an anonymous caller; the shell (breadcrumbs,
 *       collapsible sidebar, Ctrl+K search, "Pogledaj sajt"); an invited agent
 *       can neither read nor change another agent's lead or viewing by id; the
 *       manager and editor role matrices, server-side and in the menu;
 *   B2  the dashboard's KPI cards, 30-day chart, to-do lists and activity feed;
 *   B3  a status change asks first and is logged, "Dupliraj", a bulk action;
 *   B4  lead detail: note, agent, next-action date, logged stage change;
 *   B5  viewings: requested → confirmed, confirmed → done with feedback, logged;
 *   B6  anonymizing a contact (an e2e one);
 *   B7  changing a staff account's role and deactivating it;
 *   B8  a neighborhood created under a city, edited and deleted;
 *   B11 an office-hours change shows on /sr/kontakt and is restored exactly;
 *   B12 the analytics cards; B13 the activity filter; B14 the demo counts.
 *
 * Isolation (other specs and agents share the dev deployment):
 *   - listings are titled `[E2E-M] … <run>`, NOT `[E2E] …`: admin.spec's
 *     afterAll runs the global `qa:purgeE2EListings`, which would delete this
 *     spec's listings mid-run in a parallel run. They are deleted here by id;
 *   - leads/contacts/viewings hang off `e2e+…-<run>@mihajlo-estate.local`
 *     addresses and go with `qa:purgeByEmail` (BEFORE the listings: deleting a
 *     listing drops the lead → listing pointer purgeByEmail follows);
 *   - the staff account goes with `qa:purgeE2EUser`, the throwaway agent
 *     profile and the neighborhood with their admin `remove` mutations;
 *   - settings.officeHours is read first and written back in afterAll;
 *   - the demo purge button is never pressed.
 *
 * One residue is unavoidable: the anonymized contact (B6) and its lead. After
 * anonymization they carry no address to purge by, no mutation deletes a
 * contact, and merge refuses anonymized contacts. They hold no personal data
 * and the lead is moved to "Izgubljen" so it leaves every work queue.
 */

const RUN = `${Date.now().toString(36)}${randomBytes(2).toString("hex")}`;
const PREFIX = "[E2E-M]";
const TITLE = `${PREFIX} Modul nekretnina ${RUN}`;
const VIEWING_TITLE = `${PREFIX} Razgledanje ${RUN}`;
const AGENT_A = `E2E Modul Prodavac ${RUN}`;
const AGENT_B = `E2E Modul Agent ${RUN}`;
const LEAD_NAME = `E2E Modul Upit ${RUN}`;
const ANON_NAME = `E2E Modul Brisanje ${RUN}`;
const VISITOR_NAME = `E2E Modul Posetilac ${RUN}`;
const EMAIL = {
  lead: `e2e+mod-lead-${RUN}@mihajlo-estate.local`,
  anon: `e2e+mod-anon-${RUN}@mihajlo-estate.local`,
  visitor: `e2e+mod-visit-${RUN}@mihajlo-estate.local`,
  agent: `e2e+mod-agent-${RUN}@mihajlo-estate.local`,
  probe: `e2e+mod-probe-${RUN}@mihajlo-estate.local`,
};
const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const DESCRIPTION =
  "Dvosoban stan od 60 m² koji je napravio automatski test modula admin panela; oglas je na sajtu samo nekoliko sekundi i briše se odmah posle provere.";
/** From docs/assets/demo-media.json (verified URLs; never invented). */
const PHOTO_URLS = [
  "https://images.unsplash.com/photo-1618221195710-dd6b41faaea6",
  "https://images.unsplash.com/photo-1699239116624-85268dce7377",
  "https://images.unsplash.com/photo-1682184805271-11671b7ecf4c",
  "https://images.unsplash.com/photo-1757924461488-ef9ad0670978",
  "https://images.unsplash.com/photo-1697947656193-a87d460b5fb5",
];
const countFmt = new Intl.NumberFormat("sr-Latn-RS");

type OfficeSlot = { weekday: number; from: string; to: string };

/* ------------------------------------------------------------------ helpers */

/** Console errors and uncaught page errors on `page` until `stop()` is called. */
function watchConsole(page: Page): { errors: string[]; stop: () => void } {
  const errors: string[] = [];
  const onConsole = (message: { type(): string; text(): string }) => {
    if (message.type() === "error") errors.push(`console.error: ${message.text().slice(0, 300)}`);
  };
  const onError = (error: Error) => errors.push(`pageerror: ${error.message.slice(0, 300)}`);
  page.on("console", onConsole);
  page.on("pageerror", onError);
  return {
    errors,
    stop: () => {
      page.off("console", onConsole);
      page.off("pageerror", onError);
    },
  };
}

/** Confirms the ConfirmDialog the last click opened and waits for it to close. */
async function confirmDialog(page: Page, title: string | RegExp): Promise<void> {
  const dialog = page.getByRole("alertdialog");
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("heading")).toHaveText(title);
  await dialog.getByTestId("confirm-dialog-action").click();
  await expect(dialog).toBeHidden({ timeout: 20_000 });
}

/** A Radix select: open it by its label, pick the option by its exact name. */
async function pick(page: Page, trigger: Locator, option: string): Promise<void> {
  await trigger.click();
  await page.getByRole("option", { name: option, exact: true }).click();
}

function sameHours(a: readonly OfficeSlot[], b: readonly OfficeSlot[]): boolean {
  const key = (slots: readonly OfficeSlot[]) => JSON.stringify(slots.map(({ weekday, from, to }) => ({ weekday, from, to })));
  return key(a) === key(b);
}

function isNotFound(error: unknown): boolean {
  return (error as { data?: { code?: string } }).data?.code === "NOT_FOUND";
}

/* -------------------------------------------------------------------- suite */

test.describe("admin modules @admin", () => {
  test.describe.configure({ mode: "serial", timeout: 180_000 });

  let active = false;
  let admin: ConvexHttpClient;
  let context: BrowserContext | undefined;
  let page: Page;
  let cityId: Id<"locations">;
  let cityName = "";
  let adminUserId: Id<"users">;
  let agentA: Id<"agents"> | null = null;
  let listing: { id: Id<"listings">; ref: string } | null = null;
  let copy: { id: Id<"listings">; ref: string } | null = null;
  let viewingListing: { id: Id<"listings">; ref: string } | null = null;
  let leadId: Id<"leads">;
  let anonLeadId: Id<"leads">;
  let anonContactId: Id<"contacts">;
  /** The public request (requested) and the office's past viewing (confirmed). */
  let requested: { viewingId: Id<"viewings">; leadId: Id<"leads"> } | null = null;
  let held: Id<"viewings"> | null = null;
  let locationId: Id<"locations"> | null = null;
  let originalHours: OfficeSlot[] | null = null;
  /** "Sub 10:00–13:45": the Saturday hours B11 set, as the activity diff prints them. */
  let saturdayChange: string | null = null;
  let originalSettingsDemo: boolean | null = null;
  const probePosts: Id<"posts">[] = [];

  function need<T>(value: T | null, what: string): T {
    if (value === null) throw new Error(`${what} was not created by an earlier step`);
    return value;
  }

  async function activityOf(entityId: string): Promise<string[]> {
    const result = await admin.query(api.activity.list, { entityId, paginationOpts: { numItems: 50, cursor: null } });
    return result.page.map((row) => row.action);
  }

  test.beforeAll(async ({ browser }, testInfo) => {
    desktopOnly(testInfo);
    active = true;
    admin = await adminHttpClient();

    const me = await admin.query(api.users.getMe, {});
    if (me === null) throw new Error("the admin client is not signed in");
    adminUserId = me._id;

    const places = await admin.query(api.locations.tree, {});
    const city =
      places.find((place) => place.kind === "city" && place.slug === "beograd") ??
      places.find((place) => place.kind === "city");
    if (city === undefined) throw new Error("locations.tree has no city");
    cityId = city._id;
    cityName = city.name.sr;

    // A throwaway, hidden agent profile owns every listing and viewing made here.
    const profile = await admin.mutation(api.agentsAdmin.upsert, {
      name: AGENT_A,
      role: { sr: "Agent (e2e test)" },
      languages: ["sr"],
      areas: [],
      isPublic: false,
    });
    agentA = profile.id;

    const made = await admin.mutation(api.listingsAdmin.create, {
      transaction: "sale",
      propertyType: "apartment",
      cityId,
      agentId: profile.id,
      titleSr: TITLE,
    });
    listing = { id: made.id, ref: made.ref };

    // Two general inquiries through the public contact-form mutation.
    const visitor = new ConvexHttpClient(convexUrl());
    const general = await visitor.mutation(api.leads.createGeneral, {
      sessionKey: `e2e-mod-${RUN}-lead`,
      locale: "sr-Latn",
      contact: { name: LEAD_NAME, email: EMAIL.lead },
      marketing: false,
      privacy: true,
      message: "E2E: zanima me saradnja oko kupovine stana na Vračaru.",
    });
    leadId = general.leadId;
    const anon = await visitor.mutation(api.leads.createGeneral, {
      sessionKey: `e2e-mod-${RUN}-anon`,
      locale: "sr-Latn",
      contact: { name: ANON_NAME, email: EMAIL.anon, phone: "+381 64 000 1234" },
      marketing: true,
      privacy: true,
      message: "E2E: molim da obrišete moje podatke posle ovog testa.",
    });
    anonLeadId = anon.leadId;
    const anonLead = await admin.query(api.leadsAdmin.get, { id: anonLeadId });
    if (anonLead === null) throw new Error("the anonymization lead is not readable");
    anonContactId = anonLead.lead.contactId;

    const settings = await admin.query(api.settingsAdmin.get, {});
    if (settings === null) throw new Error("settings are not seeded");
    originalSettingsDemo = settings.settings.isDemo;
    originalHours = settings.settings.officeHours.map(({ weekday, from, to }) => ({ weekday, from, to }));

    context = await projectContext(browser, testInfo);
    page = await context.newPage();
    // Leave-page guards (editor, settings) would otherwise stall a navigation.
    page.on("dialog", (dialog) => void dialog.accept());
    const { email, password } = readAdminCreds();
    await loginViaUi(page, email, password);
  });

  // Each step is independent; order matters (see the header).
  test.afterAll(async () => {
    if (!active) return;
    await context?.close();
    const problems: string[] = [];
    const attempt = async (label: string, run: () => unknown) => {
      try {
        await run();
      } catch (error) {
        problems.push(`${label}: ${String(error).slice(0, 240)}`);
      }
    };

    const hours = originalHours;
    if (hours !== null) {
      await attempt("restore settings.officeHours", async () => {
        const now = await admin.query(api.settingsAdmin.get, {});
        if (now !== null && !sameHours(now.settings.officeHours, hours)) {
          await admin.mutation(api.settingsAdmin.update, { patch: { officeHours: hours } });
        }
      });
    }
    for (const email of [EMAIL.lead, EMAIL.anon, EMAIL.visitor]) {
      await attempt(`qa:purgeByEmail ${email}`, () => convexRun("qa:purgeByEmail", { email }));
    }
    // An anonymized contact cannot be purged (no address left): its lead is
    // closed instead, so it leaves every work queue (see the header).
    await attempt("close the anonymized lead", async () => {
      if ((anonLeadId as Id<"leads"> | undefined) === undefined) return;
      const left = await admin.query(api.leadsAdmin.get, { id: anonLeadId });
      if (left !== null && left.lead.contactAnonymized && left.lead.status !== "lost") {
        await admin.mutation(api.leadsAdmin.setStatus, { id: anonLeadId, status: "lost" });
      }
    });
    const ids = new Set<Id<"listings">>();
    for (const item of [listing, copy, viewingListing]) if (item !== null) ids.add(item.id);
    await attempt("find leftover [E2E-M] listings", async () => {
      const found = await admin.query(api.listingsAdmin.list, { q: RUN, paginationOpts: { cursor: null, numItems: 25 } });
      for (const row of found.page) if (row.title.sr.startsWith(PREFIX) && !row.isDemo) ids.add(row._id);
    });
    for (const id of ids) {
      await attempt(`listingsAdmin.remove ${id}`, async () => {
        try {
          await admin.mutation(api.listingsAdmin.remove, { id });
        } catch (error) {
          if (!isNotFound(error)) throw error;
        }
      });
    }
    for (const email of [EMAIL.agent, EMAIL.probe]) {
      await attempt(`qa:purgeE2EUser ${email}`, () => convexRun("qa:purgeE2EUser", { email }));
    }
    const profile = agentA;
    if (profile !== null) {
      await attempt("agentsAdmin.remove (agent A)", async () => {
        try {
          await admin.mutation(api.agentsAdmin.remove, { id: profile });
        } catch (error) {
          if (!isNotFound(error)) throw error;
        }
      });
    }
    const place = locationId;
    if (place !== null) {
      await attempt("locationsAdmin.remove", async () => {
        try {
          await admin.mutation(api.locationsAdmin.remove, { id: place });
        } catch (error) {
          if (!isNotFound(error)) throw error;
        }
      });
    }
    for (const post of probePosts) {
      await attempt("postsAdmin.remove (probe)", () => admin.mutation(api.postsAdmin.remove, { id: post }));
    }
    expect(problems, "e2e cleanup").toEqual([]);
  });

  /* ------------------------------------------------------------ B1 anon */

  test("B1: every admin module refuses an anonymous caller with UNAUTHENTICATED @admin", async () => {
    const anon = new ConvexHttpClient(convexUrl());
    const target = need(listing, "the e2e listing");
    const now = Date.now();
    const page25 = { cursor: null, numItems: 25 };

    // Mutations are chosen so that even a broken guard would change nothing
    // real: e2e records, no-op values, an empty bulk, a wrong purge phrase.
    const calls: [string, () => Promise<unknown>][] = [
      ["listingsAdmin.list", () => anon.query(api.listingsAdmin.list, { paginationOpts: page25 })],
      ["listingsAdmin.get", () => anon.query(api.listingsAdmin.get, { id: target.id, now })],
      ["listingsAdmin.todos", () => anon.query(api.listingsAdmin.todos, { now })],
      ["listingsAdmin.update", () => anon.mutation(api.listingsAdmin.update, { id: target.id, patch: { price: 1 } })],
      ["listingsAdmin.duplicate", () => anon.mutation(api.listingsAdmin.duplicate, { id: target.id })],
      ["listingsAdmin.bulk", () => anon.mutation(api.listingsAdmin.bulk, { ids: [], action: "archive" })],
      ["leadsAdmin.list", () => anon.query(api.leadsAdmin.list, { paginationOpts: page25 })],
      ["leadsAdmin.kanban", () => anon.query(api.leadsAdmin.kanban, {})],
      ["leadsAdmin.get", () => anon.query(api.leadsAdmin.get, { id: leadId })],
      ["leadsAdmin.addNote", () => anon.mutation(api.leadsAdmin.addNote, { id: leadId, body: "e2e anonymous probe" })],
      ["leadsAdmin.setStatus", () => anon.mutation(api.leadsAdmin.setStatus, { id: leadId, status: "qualified" })],
      ["viewingsAdmin.range", () => anon.query(api.viewingsAdmin.range, { from: now, to: now + DAY })],
      [
        "viewingsAdmin.list",
        () => anon.query(api.viewingsAdmin.list, { when: "upcoming", now, paginationOpts: page25 }),
      ],
      ["viewingsAdmin.get", () => anon.query(api.viewingsAdmin.get, { id: "probe" })],
      ["contacts.list", () => anon.query(api.contacts.list, { paginationOpts: page25 })],
      ["contacts.get", () => anon.query(api.contacts.get, { id: anonContactId })],
      ["contacts.exportCsv", () => anon.mutation(api.contacts.exportCsv, {})],
      ["contacts.anonymize", () => anon.mutation(api.contacts.anonymize, { id: anonContactId })],
      ["users.list", () => anon.query(api.users.list, {})],
      ["users.setRole", () => anon.mutation(api.users.setRole, { id: adminUserId, role: "admin" })],
      ["users.setStatus", () => anon.mutation(api.users.setStatus, { id: adminUserId, status: "active" })],
      ["invites.list", () => anon.query(api.invites.list, {})],
      ["invites.create", () => anon.mutation(api.invites.create, { email: EMAIL.probe, role: "editor" })],
      ["locationsAdmin.tree", () => anon.query(api.locationsAdmin.tree, {})],
      ["locationsAdmin.get", () => anon.query(api.locationsAdmin.get, { id: cityId })],
      ["locationsAdmin.reorder", () => anon.mutation(api.locationsAdmin.reorder, { ids: [] })],
      ["postsAdmin.list", () => anon.query(api.postsAdmin.list, { paginationOpts: page25 })],
      ["postsAdmin.get", () => anon.query(api.postsAdmin.get, { id: "probe" })],
      [
        "postsAdmin.create",
        async () => {
          const id = await anon.mutation(api.postsAdmin.create, {});
          probePosts.push(id);
          return id;
        },
      ],
      ["pagesAdmin.get", () => anon.query(api.pagesAdmin.get, { key: "home" })],
      ["pagesAdmin.listKeys", () => anon.query(api.pagesAdmin.listKeys, {})],
      ["settingsAdmin.get", () => anon.query(api.settingsAdmin.get, {})],
      ["settingsAdmin.update", () => anon.mutation(api.settingsAdmin.update, { patch: {} })],
      ["analytics.dashboard", () => anon.query(api.analytics.dashboard, { now })],
      ["analytics.topListings", () => anon.query(api.analytics.topListings, {})],
      ["analytics.leadsOverTime", () => anon.query(api.analytics.leadsOverTime, { now })],
      ["analytics.responseTimes", () => anon.query(api.analytics.responseTimes, { now })],
      ["analytics.listingFunnel", () => anon.query(api.analytics.listingFunnel, { listingId: target.id })],
      ["activity.list", () => anon.query(api.activity.list, { paginationOpts: page25 })],
      ["activity.staff", () => anon.query(api.activity.staff, {})],
      ["demo.counts", () => anon.query(api.demo.counts, {})],
      ["demo.purge (wrong phrase)", () => anon.mutation(api.demo.purge, { confirm: "e2e: ne brisati" })],
      ["uploads.generateUploadUrl", () => anon.mutation(api.uploads.generateUploadUrl, {})],
      ["media.generateUploadUrl", () => anon.mutation(api.media.generateUploadUrl, {})],
      ["agentsAdmin.list", () => anon.query(api.agentsAdmin.list, {})],
      ["testimonialsAdmin.listAll", () => anon.query(api.testimonialsAdmin.listAll, {})],
      ["toursAdmin.scenes", () => anon.query(api.toursAdmin.scenes, { listingId: target.id })],
    ];

    const wrong: string[] = [];
    for (const [name, call] of calls) {
      try {
        const data = await refusal(call());
        if (data.code !== "UNAUTHENTICATED") wrong.push(`${name}: refused with ${data.code ?? "no code"}`);
      } catch (error) {
        wrong.push(`${name}: ${String(error).slice(0, 160)}`);
      }
    }
    expect(wrong, "admin functions that did not refuse an anonymous caller").toEqual([]);

    // Nothing moved.
    const after = await admin.query(api.listingsAdmin.get, { id: target.id, now: Date.now() });
    expect(after?.listing.price).toBe(0);
    const lead = await admin.query(api.leadsAdmin.get, { id: leadId });
    expect(lead?.lead.status).toBe("new");
    expect(lead?.notes).toEqual([]);
  });

  /* ---------------------------------------------------------- B2 dashboard */

  test("B2: the dashboard shows KPI cards, the 30-day chart, the to-do lists and recent activity with a clean console @admin", async () => {
    const consoleWatch = watchConsole(page);
    try {
      await page.goto("/admin");
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

      const kpis = page.getByTestId("kpi-cards");
      await expect(kpis).toHaveAttribute("aria-busy", "false", { timeout: 20_000 });
      const labels = ["Aktivne nekretnine", "Novi upiti (7 dana)", "Razgledanja danas", "Prosečno vreme odgovora"];
      const cards = kpis.getByRole("listitem");
      await expect(cards).toHaveCount(4);
      for (const [index, label] of labels.entries()) {
        await expect(cards.nth(index)).toContainText(label);
        // A count ("12", "1.204", "500+"), a duration ("do 1 min", "2 h 5 min") or "—".
        await expect(cards.nth(index).locator("[data-numeric]")).toHaveText(index < 3 ? /^\d[\d.]*\+?$/ : /^(.*\d.*|—)$/);
      }
      // The active-listings figure is the server's (reactive, so poll against a fresh read).
      const activeValue = cards.nth(0).locator("[data-numeric]");
      await expect
        .poll(
          async () => {
            const stats = await admin.query(api.analytics.dashboard, { now: Date.now() });
            return (await activeValue.textContent())?.trim() === countFmt.format(stats.activeListings);
          },
          { timeout: 15_000, message: "the KPI shows the server's active-listing count" },
        )
        .toBe(true);

      // To-do lists: the three work queues, all loaded.
      const todos = page.getByTestId("todo-lists");
      for (const name of ["Upiti bez odgovora duže od 1 h", "Nekretnine za doradu", "Ugovori ističu u 14 dana"]) {
        await expect(todos.getByRole("heading", { level: 2, name, exact: true })).toBeVisible();
      }
      await expect(todos.locator('[aria-busy="true"]')).toHaveCount(0, { timeout: 20_000 });

      // The 30-day chart (or, before the nightly stats have two days, its stated empty state).
      const chart = page.getByTestId("views-leads-chart");
      await expect(chart.getByRole("heading", { level: 2, name: "Pregledi i upiti" })).toBeVisible();
      await expect(chart.locator('[aria-busy="true"]')).toHaveCount(0, { timeout: 20_000 });
      const svg = chart.getByRole("img", { name: /Pregledi i upiti po danu/ });
      await expect(svg.or(chart.getByText(/Grafikon se puni svake noći/))).toBeVisible();
      test.info().annotations.push({
        type: "B2 chart",
        description: (await svg.count()) > 0 ? "30-day SVG chart rendered" : "empty state (fewer than 2 recorded days)",
      });

      // Recent activity: loaded, with at least one line (this spec has written several).
      const feed = page.getByTestId("recent-activity");
      await expect(feed.getByRole("heading", { level: 2, name: "Nedavna aktivnost" })).toBeVisible();
      await expect(feed.locator("ol > li").first()).toBeVisible({ timeout: 20_000 });

      expect(consoleWatch.errors, "console errors on /admin").toEqual([]);
    } finally {
      consoleWatch.stop();
    }
  });

  /* --------------------------------------------------------- B1 the shell */

  test("B1: the admin shell has breadcrumbs, a collapsible sidebar, quick search (Ctrl+K) and a link to the site @admin", async () => {
    const target = need(listing, "the e2e listing");
    await page.goto("/admin/nekretnine");
    await expect(page.getByTestId("listings-table")).toBeVisible({ timeout: 30_000 });

    const crumbs = page.getByRole("navigation", { name: "Putanja" });
    await expect(crumbs.getByRole("link", { name: "Kontrolna tabla" })).toHaveAttribute("href", "/admin");
    await expect(crumbs.locator('[aria-current="page"]')).toHaveText("Nekretnine");

    const site = page.getByRole("link", { name: /^Pogledaj sajt/ });
    await expect(site).toHaveAttribute("href", "/sr");
    await expect(site).toHaveAttribute("target", "_blank");

    // Collapse to icons and back; the links keep their names while collapsed.
    const panel = page.locator('[data-slot="sidebar"][data-state]');
    const toggle = page.getByRole("button", { name: "Prikaži ili sakrij meni" });
    await expect(panel).toHaveAttribute("data-state", "expanded");
    await toggle.click();
    await expect(panel).toHaveAttribute("data-state", "collapsed");
    await expect(panel).toHaveAttribute("data-collapsible", "icon");
    await expect(sidebar(page).getByRole("link", { name: "Upiti", exact: true })).toBeVisible();
    await toggle.click();
    await expect(panel).toHaveAttribute("data-state", "expanded");

    // Quick search by ref opens the editor; the breadcrumb names the listing.
    await page.keyboard.press("Control+k");
    const palette = page.getByRole("dialog", { name: "Brza pretraga" });
    await expect(palette).toBeVisible();
    await palette.getByRole("combobox").fill(target.ref);
    await palette.getByRole("option").filter({ hasText: target.ref }).click();
    await expect(page).toHaveURL(new RegExp(`/admin/nekretnine/${target.id}$`), { timeout: 20_000 });
    await expect(page.getByTestId("listing-editor")).toBeVisible({ timeout: 30_000 });
    await expect(crumbs.locator('[aria-current="page"]')).toHaveText(target.ref);
    await expect(crumbs.getByRole("link", { name: "Nekretnine" })).toHaveAttribute("href", "/admin/nekretnine");
  });

  /* ----------------------------------------------------------- B3 listings */

  test("B3: a status change asks for confirmation and is logged; Dupliraj makes a draft copy @admin", async () => {
    const target = need(listing, "the e2e listing");
    await page.goto(`/admin/nekretnine/${target.id}`);
    await expect(page.getByTestId("listing-editor")).toBeVisible({ timeout: 30_000 });
    const status = page.getByTestId("editor-status");
    await expect(status).toHaveAttribute("data-status", "draft");

    // Cancelling the confirmation changes nothing.
    await page.getByTestId("action-review").click();
    const dialog = page.getByRole("alertdialog");
    await expect(dialog.getByRole("heading")).toHaveText("Poslati na pregled?");
    await dialog.getByRole("button", { name: "Otkaži" }).click();
    await expect(dialog).toBeHidden();
    await expect(status).toHaveAttribute("data-status", "draft");
    expect((await admin.query(api.listingsAdmin.get, { id: target.id, now: Date.now() }))?.listing.status).toBe("draft");

    // Confirming does.
    await page.getByTestId("action-review").click();
    await confirmDialog(page, "Poslati na pregled?");
    await expect(status).toHaveAttribute("data-status", "review", { timeout: 20_000 });
    expect((await admin.query(api.listingsAdmin.get, { id: target.id, now: Date.now() }))?.listing.status).toBe("review");
    await expect.poll(() => activityOf(target.id)).toContain("listing.status.review");

    // Dupliraj: confirmed, then the editor opens the copy (a private draft).
    await page.getByTestId("action-duplicate").click();
    await confirmDialog(page, "Duplirati nekretninu?");
    await expect(page).not.toHaveURL(new RegExp(`/admin/nekretnine/${target.id}$`), { timeout: 20_000 });
    const editor = page.getByTestId("listing-editor");
    await expect(editor).toHaveAttribute("data-listing-id", /\S/);
    const copyId = (await editor.getAttribute("data-listing-id")) as Id<"listings">;
    expect(copyId).not.toBe(target.id);
    const stored = await admin.query(api.listingsAdmin.get, { id: copyId, now: Date.now() });
    if (stored === null) throw new Error("the copy is not readable");
    copy = { id: copyId, ref: stored.listing.ref };
    expect(stored.listing.title.sr).toBe(`${TITLE} (kopija)`);
    expect(stored.listing.status).toBe("draft");
    expect(stored.listing.visibility).toBe("private");
    expect(stored.listing.ref).not.toBe(target.ref);
    expect(stored.listing.mandate, "a copy carries no brokerage contract").toBeUndefined();
    await expect(page.getByTestId("editor-status")).toHaveAttribute("data-status", "draft");
    await expect.poll(() => activityOf(copyId)).toContain("listing.duplicated");
  });

  test("B3: a bulk action archives the selected e2e listings after confirmation @admin", async () => {
    const target = need(listing, "the e2e listing");
    const duplicate = need(copy, "the copy");
    await page.goto("/admin/nekretnine");
    await expect(page.getByTestId("listings-table")).toBeVisible({ timeout: 30_000 });
    // Enter commits the search at once; a filter change clears the selection,
    // so the rows are picked only once the filtered page has settled.
    await page.getByTestId("listings-search").fill(RUN);
    await page.getByTestId("listings-search").press("Enter");
    const rowOf = (ref: string) => page.locator(`[data-testid="listing-row"][data-ref="${ref}"]`);
    await expect(page.getByTestId("listing-row")).toHaveCount(2, { timeout: 20_000 });
    await expect(page.getByTestId("listings-table")).toHaveAttribute("aria-busy", "false");
    await expect(rowOf(target.ref)).toBeVisible();
    await expect(rowOf(duplicate.ref)).toBeVisible();

    await page.getByRole("checkbox", { name: `Izaberi ${target.ref}`, exact: true }).check();
    await page.getByRole("checkbox", { name: `Izaberi ${duplicate.ref}`, exact: true }).check();
    const bar = page.getByRole("region", { name: "Grupne radnje" });
    await expect(bar).toContainText("Izabrano: 2");
    // "Obriši demo" stays off for real listings.
    await expect(bar.getByRole("button", { name: "Obriši demo" })).toBeDisabled();

    await bar.getByRole("button", { name: "Arhiviraj", exact: true }).click();
    const dialog = page.getByRole("alertdialog");
    await expect(dialog).toContainText("Izabrano: 2.");
    await confirmDialog(page, "Arhivirati izabrane nekretnine?");

    await expect
      .poll(async () => {
        const rows = await Promise.all(
          [target.id, duplicate.id].map((id) => admin.query(api.listingsAdmin.get, { id, now: Date.now() })),
        );
        return rows.map((row) => row?.listing.status);
      })
      .toEqual(["archived", "archived"]);
    await expect.poll(() => activityOf(target.id)).toContain("listing.status.archived");
    await expect.poll(() => activityOf(duplicate.id)).toContain("listing.status.archived");

    // The "Arhivirano" status tab lists both, the "Nacrt" tab neither.
    await page.getByTestId("status-tab-archived").click();
    await expect(page).toHaveURL(/[?&]status=archived\b/);
    await expect(page.getByTestId("status-tab-archived")).toHaveAttribute("aria-current", "page");
    await expect(rowOf(target.ref)).toHaveAttribute("data-status", "archived", { timeout: 20_000 });
    await expect(rowOf(duplicate.ref)).toHaveAttribute("data-status", "archived");
    await page.getByTestId("status-tab-draft").click();
    await expect(page).toHaveURL(/[?&]status=draft\b/);
    await expect(page.getByTestId("listings-table")).toHaveAttribute("aria-busy", "false", { timeout: 20_000 });
    await expect(rowOf(target.ref)).toHaveCount(0);
    await expect(rowOf(duplicate.ref)).toHaveCount(0);
  });

  /* -------------------------------------------------------------- B4 leads */

  test("B4: in the lead detail a note, an agent and a next-action date are saved and the stage change is logged @admin @forms", async () => {
    const note = `E2E beleška ${RUN}: klijent traži dvosoban stan do 180.000 €.`;
    const nextDate = belgradeDate(3);
    await page.goto(`/admin/upiti?id=${leadId}`);
    const sheet = page.getByTestId("lead-sheet");
    await expect(sheet).toBeVisible({ timeout: 20_000 });
    await expect(sheet.getByRole("heading", { name: LEAD_NAME })).toBeVisible({ timeout: 20_000 });
    // The response timer runs from creation until the first response.
    await expect(sheet).toContainText("Bez odgovora već");

    // A note (it also counts as the first response: "Novi" → "Kontaktiran").
    await sheet.getByLabel("Nova beleška").fill(note);
    await sheet.getByRole("button", { name: "Dodaj belešku" }).click();
    await expect(sheet.getByText(note)).toBeVisible({ timeout: 20_000 });
    await expect(sheet).toContainText(/Odgovoreno (u prvom minutu|za )/);
    await expect(sheet).not.toContainText("Bez odgovora već");

    // Assign the e2e agent.
    await pick(page, sheet.getByLabel("Agent", { exact: true }), AGENT_A);
    await expect(sheet.getByLabel("Agent", { exact: true })).toHaveText(AGENT_A, { timeout: 20_000 });

    // Next action date.
    await sheet.getByLabel("Sledeći korak").fill(nextDate);

    // Stage: "Kvalifikovan".
    await pick(page, sheet.getByLabel("Faza"), "Kvalifikovan");
    await expect(sheet.getByLabel("Faza")).toHaveText("Kvalifikovan");

    await expect
      .poll(
        async () => {
          const detail = await admin.query(api.leadsAdmin.get, { id: leadId });
          return {
            status: detail?.lead.status,
            agentId: detail?.lead.agentId,
            next:
              detail?.lead.nextActionAt !== undefined ? new Date(detail.lead.nextActionAt).toISOString().slice(0, 10) : null,
            notes: detail?.notes.map((item) => item.body),
          };
        },
        { timeout: 20_000, message: "the sheet's changes reach Convex" },
      )
      .toEqual({ status: "qualified", agentId: agentA, next: nextDate, notes: [note] });

    const actions = await activityOf(leadId);
    for (const action of ["lead.note", "lead.status.contacted", "lead.assigned", "lead.nextAction", "lead.status.qualified"]) {
      expect(actions, `activity has ${action}`).toContain(action);
    }

    // The timeline shows them to the user.
    const timeline = sheet.getByTestId("lead-timeline");
    for (const action of ["lead.status.qualified", "lead.assigned", "lead.nextAction", "lead.note"]) {
      await expect(timeline.locator(`li[data-action="${action}"]`).first(), `timeline row ${action}`).toBeVisible();
    }
    await expect(timeline.locator('li[data-action="lead.assigned"]').first()).toContainText(AGENT_A);

    // The inbox filters (agent + stage + type, kept in the URL) find exactly this lead.
    const profile = need(agentA, "agent A");
    await page.goto(`/admin/upiti?agent=${profile}&status=qualified&type=general`);
    const rows = page.getByTestId("lead-row");
    await expect(rows).toHaveCount(1, { timeout: 20_000 });
    await expect(rows.first()).toHaveAttribute("data-lead-id", leadId);
    await expect(rows.first()).toContainText(LEAD_NAME);
    await page.goto(`/admin/upiti?agent=${profile}&status=new`);
    await expect(page.getByTestId("leads-table")).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId("leads-table")).toHaveAttribute("aria-busy", "false", { timeout: 20_000 });
    await expect(rows).toHaveCount(0);
  });

  /* ----------------------------------------------------------- B5 viewings */

  test("B5: a requested viewing is confirmed, a held viewing is marked done with feedback, every change logged @admin", async () => {
    const profile = need(agentA, "agent A");
    const visitor = new ConvexHttpClient(convexUrl());

    // A public agent with a free web slot in the next two weeks; the LAST one,
    // so the slot other specs book first stays free.
    const now = Date.now();
    let chosen: { agentId: Id<"agents">; start: number; end: number } | null = null;
    for (const agent of await visitor.query(api.agents.list, {})) {
      const free = (await visitor.query(api.agents.slots, { agentId: agent._id, fromDay: now, days: 14 })).filter(
        (slot) => !slot.taken && slot.start > now + 4 * HOUR,
      );
      const last = free.at(-1);
      if (last !== undefined) {
        chosen = { agentId: agent._id, start: last.start, end: last.end };
        break;
      }
    }
    if (chosen === null) throw new Error("no public agent has a free viewing slot in the next 14 days");

    // An e2e listing that is on the market just long enough to take the request.
    const made = await admin.mutation(api.listingsAdmin.create, {
      transaction: "sale",
      propertyType: "apartment",
      cityId,
      agentId: chosen.agentId,
      titleSr: VIEWING_TITLE,
    });
    viewingListing = { id: made.id, ref: made.ref };
    await admin.mutation(api.media.attach, {
      listingId: made.id,
      target: "gallery",
      items: PHOTO_URLS.map((url, index) => ({ image: { kind: "url" as const, url }, alt: { sr: `E2E fotografija ${index + 1}` } })),
    });
    await admin.mutation(api.listingsAdmin.update, {
      id: made.id,
      patch: {
        price: 150_000,
        areaM2: 60,
        rooms: 2,
        description: { sr: DESCRIPTION },
        mandate: { number: `E2E-M-${RUN}`, type: "open", start: now - DAY, end: now + 90 * DAY },
      },
    });
    await admin.mutation(api.listingsAdmin.publish, { id: made.id });
    try {
      await visitor.mutation(api.viewings.request, {
        sessionKey: `e2e-mod-${RUN}-viewing`,
        locale: "sr-Latn",
        listingId: made.id,
        start: chosen.start,
        end: chosen.end,
        mode: "video",
        contact: { name: VISITOR_NAME, email: EMAIL.visitor },
        marketing: false,
        privacy: true,
      });
      // The public answer carries no ids (review 14, SEC-5): read them back.
      const stored = convexRun<{ leadId: Id<"leads">; listingId?: Id<"listings">; viewing: { viewingId: Id<"viewings"> } | null }[]>(
        "qa:leadsByEmail",
        { email: EMAIL.visitor },
      ).find((lead) => lead.listingId === made.id && lead.viewing !== null);
      if (stored === undefined || stored.viewing === null) throw new Error("the public viewing request was not stored");
      requested = { leadId: stored.leadId, viewingId: stored.viewing.viewingId };
      // The office records a viewing held two days ago (on the same lead, so the
      // e-mail purge removes it), with the e2e agent.
      const start = Math.floor((now - 2 * DAY) / HOUR) * HOUR;
      const created = await admin.mutation(api.viewingsAdmin.create, {
        listingId: made.id,
        agentId: profile,
        leadId: requested.leadId,
        start,
        end: start + HOUR,
        mode: "in_person",
      });
      held = created.id;
    } finally {
      await admin.mutation(api.listingsAdmin.unpublish, { id: made.id });
    }
    const request = need(requested, "the viewing request");
    const past = need(held, "the held viewing");

    // requested → confirmed.
    await page.goto(`/admin/razgledanja?id=${request.viewingId}`);
    const sheet = page.getByTestId("viewing-sheet");
    await expect(sheet).toBeVisible({ timeout: 20_000 });
    const statusSelect = sheet.getByLabel("Promenite status");
    await expect(statusSelect).toHaveText("Zatraženo", { timeout: 20_000 });
    await pick(page, statusSelect, "Potvrđeno");
    await expect(statusSelect).toHaveText("Potvrđeno", { timeout: 20_000 });
    // A future viewing cannot be marked held yet.
    await expect(sheet).toContainText("„Održano” i „Nije se pojavio” mogu se izabrati kada termin počne.");
    await statusSelect.click();
    await expect(page.getByRole("option", { name: "Održano", exact: true })).toBeDisabled();
    await page.keyboard.press("Escape");

    // confirmed → done, then the feedback.
    const feedback = `E2E utisak ${RUN}: klijentu se dopao raspored, traži bolju cenu.`;
    await page.goto(`/admin/razgledanja?id=${past}`);
    await expect(sheet).toBeVisible({ timeout: 20_000 });
    await expect(statusSelect).toHaveText("Potvrđeno", { timeout: 20_000 });
    await pick(page, statusSelect, "Održano");
    await expect(statusSelect).toHaveText("Održano", { timeout: 20_000 });
    await sheet.getByLabel("Utisak posle razgledanja").fill(feedback);
    await sheet.getByRole("button", { name: "Sačuvaj utisak" }).click();
    await expect(sheet.getByTestId("viewing-feedback-save")).toBeDisabled({ timeout: 20_000 });

    await expect
      .poll(async () => {
        const [first, second] = await Promise.all([
          admin.query(api.viewingsAdmin.get, { id: request.viewingId }),
          admin.query(api.viewingsAdmin.get, { id: past }),
        ]);
        return [first?.status, second?.status, second?.feedback];
      })
      .toEqual(["confirmed", "done", feedback]);

    const requestLog = await activityOf(request.viewingId);
    expect(requestLog).toEqual(expect.arrayContaining(["viewing.requested", "viewing.status.confirmed"]));
    const heldLog = await activityOf(past);
    expect(heldLog).toEqual(expect.arrayContaining(["viewing.created", "viewing.status.done", "viewing.feedback"]));
    // The text itself stays out of the log (it is personal data).
    const rows = await admin.query(api.activity.list, { entityId: past, paginationOpts: { numItems: 20, cursor: null } });
    expect(JSON.stringify(rows.page)).not.toContain(feedback);
  });

  /* ----------------------------------------------------------- B6 contacts */

  test("B6: anonymizing an e2e contact asks first, then erases its personal data @admin", async () => {
    await page.goto(`/admin/kontakti?id=${anonContactId}`);
    const sheet = page.getByTestId("contact-sheet");
    await expect(sheet).toBeVisible({ timeout: 20_000 });
    await expect(sheet.getByRole("heading", { name: ANON_NAME })).toBeVisible({ timeout: 20_000 });
    await expect(sheet).toContainText(EMAIL.anon);
    const before = await admin.query(api.contacts.get, { id: anonContactId });
    expect(before?.contact.isDemo, "never a demo contact").toBe(false);

    // The consent record of the web form: version, channel, marketing opt-in.
    const consent = before?.consents[0];
    if (consent === undefined) throw new Error("the contact has no consent record");
    const consents = sheet.getByRole("heading", { name: "Saglasnosti" }).locator("xpath=ancestor::section[1]");
    const record = consents.getByRole("listitem").filter({ hasText: consent.textVersion }).first();
    await expect(record).toContainText("Kanal: web");
    await expect(record).toContainText(/Marketing:\s*Da/);

    // Cancel first: nothing happens.
    await sheet.getByTestId("contact-anonymize").click();
    const dialog = page.getByRole("alertdialog");
    await expect(dialog.getByRole("heading")).toHaveText("Anonimizovati kontakt?");
    await dialog.getByRole("button", { name: "Otkaži" }).click();
    await expect(dialog).toBeHidden();
    expect((await admin.query(api.contacts.get, { id: anonContactId }))?.contact.anonymizedAt).toBeUndefined();

    await sheet.getByTestId("contact-anonymize").click();
    await confirmDialog(page, "Anonimizovati kontakt?");
    await expect(sheet.getByRole("status")).toContainText("Anonimizovano", { timeout: 20_000 });
    await expect(sheet).not.toContainText(EMAIL.anon);
    await expect(sheet.getByTestId("contact-anonymize")).toHaveCount(0);

    const after = await admin.query(api.contacts.get, { id: anonContactId });
    expect(after?.contact.anonymizedAt).toBeDefined();
    expect(after?.contact.name).not.toContain(ANON_NAME);
    expect(after?.contact.email).toBeUndefined();
    expect(after?.contact.phone).toBeUndefined();
    const lead = await admin.query(api.leadsAdmin.get, { id: anonLeadId });
    expect(lead?.lead.contactAnonymized).toBe(true);
    expect(lead?.lead.message, "the form message is erased").toBeUndefined();
    // Search (relevance, so other contacts may match the words) no longer finds it.
    const searched = await admin.query(api.contacts.list, { q: EMAIL.anon, paginationOpts: { cursor: null, numItems: 50 } });
    expect(searched.page.map((row) => row._id)).not.toContain(anonContactId);
    expect(searched.page.some((row) => row.email === EMAIL.anon || row.name === ANON_NAME)).toBe(false);
    await expect.poll(() => activityOf(anonContactId)).toContain("contact.anonymized");
  });

  /* ---------------------------------------------------------- B8 locations */

  test("B8: a neighborhood is created under a city with slug and localized names, edited and deleted @admin @forms", async () => {
    const nameSr = `E2E Naselje ${RUN}`;
    const nameEn = `E2E Neighbourhood ${RUN}`;
    const renamed = `E2E Naselje izmenjeno ${RUN}`;
    const slug = `e2e-naselje-${RUN}`;

    await page.goto("/admin/lokacije");
    const node = page.locator(`[data-testid="location-node"][data-location-id="${cityId}"]`);
    await expect(node).toBeVisible({ timeout: 20_000 });
    await node.getByRole("button", { name: `Dodaj lokaciju u „${cityName}”` }).click();
    await page.getByRole("menuitem", { name: "Dodaj naselje" }).click();

    const sheet = page.getByTestId("location-sheet");
    await expect(sheet).toBeVisible();
    await expect(sheet.getByLabel("Pripada (opština ili grad)")).toContainText(cityName);
    await sheet.getByLabel("Naziv (srpski)").fill(nameSr);
    const slugField = sheet.getByLabel("Adresa stranice (slug)");
    await expect(slugField).toHaveValue(slug);
    await slugField.fill(slug);
    await sheet.getByRole("group", { name: "Naziv", exact: true }).getByRole("tab", { name: /^Engleski/ }).click();
    await sheet.getByLabel("Naziv (engleski)").fill(nameEn);
    await sheet.getByRole("button", { name: "Dodaj lokaciju" }).click();

    await expect(page).toHaveURL(/\/admin\/lokacije\?id=[a-z0-9]+$/, { timeout: 20_000 });
    locationId = new URL(page.url()).searchParams.get("id") as Id<"locations">;
    const created = await admin.query(api.locationsAdmin.get, { id: locationId });
    expect(created).not.toBeNull();
    expect({
      kind: created?.kind,
      parentId: created?.parentId,
      slug: created?.slug,
      sr: created?.name.sr,
      en: created?.name.en,
      isDemo: created?.isDemo,
    }).toEqual({ kind: "neighborhood", parentId: cityId, slug, sr: nameSr, en: nameEn, isDemo: false });
    await expect(page.locator(`[data-testid="location-node"][data-location-id="${locationId}"]`)).toContainText(nameSr);

    // Edit: rename in Serbian.
    await sheet.getByRole("group", { name: "Naziv", exact: true }).getByRole("tab", { name: /^Srpski/ }).click();
    await sheet.getByLabel("Naziv (srpski)").fill(renamed);
    await sheet.getByRole("button", { name: "Sačuvaj", exact: true }).click();
    await expect
      .poll(async () => (await admin.query(api.locationsAdmin.get, { id: locationId as Id<"locations"> }))?.name.sr, {
        timeout: 20_000,
      })
      .toBe(renamed);
    expect((await admin.query(api.locationsAdmin.get, { id: locationId }))?.slug, "the slug is kept").toBe(slug);

    // Delete, with confirmation.
    await sheet.getByRole("button", { name: "Obriši lokaciju" }).click();
    await confirmDialog(page, `Obrisati „${renamed}”?`);
    await expect(sheet).toBeHidden({ timeout: 20_000 });
    const tree = await admin.query(api.locationsAdmin.tree, {});
    expect(tree.some((row) => row._id === locationId)).toBe(false);
    const log = await activityOf(locationId);
    expect(log).toEqual(expect.arrayContaining(["location.created", "location.updated", "location.deleted"]));
    locationId = null;
  });

  /* ----------------------------------------------------------- B11 settings */

  test("B11: an office-hours change in Podešavanja shows on /sr/kontakt and is restored exactly @admin @public @forms", async ({
    browser,
  }, testInfo) => {
    const original = need(originalHours, "the settings snapshot");
    const saturday = original.find((slot) => slot.weekday === 6);
    const from = saturday?.from ?? "10:00";
    const to = saturday?.to === "13:45" ? "13:30" : "13:45";
    const expected = `${from}–${to}`;
    saturdayChange = `Sub ${expected}`;

    try {
      await page.goto("/admin/podesavanja");
      const form = page.getByTestId("settings-form");
      await expect(form).toBeVisible({ timeout: 20_000 });
      const day = form.getByRole("group", { name: "Subota", exact: true });
      if (saturday === undefined) {
        await day.getByRole("button", { name: "Dodajte termin (Subota)" }).click();
        await day.getByLabel("Subota, termin 1: od").fill(from);
      }
      await day.getByLabel("Subota, termin 1: do").fill(to);
      await expect(page.getByTestId("save-bar")).toContainText("Imate nesačuvane izmene.");
      await page.getByTestId("save-button").click();
      await expect(page.getByTestId("save-bar")).not.toContainText("Imate nesačuvane izmene.", { timeout: 20_000 });

      const changed = original.filter((slot) => slot.weekday !== 6).concat([{ weekday: 6, from, to }]);
      await expect
        .poll(async () => {
          const now = await admin.query(api.settingsAdmin.get, {});
          const hours = now?.settings.officeHours ?? [];
          const order = (slot: OfficeSlot) => ((slot.weekday + 6) % 7) * 10_000 + Number(slot.from.replace(":", ""));
          return sameHours([...hours].sort((a, b) => order(a) - order(b)), [...changed].sort((a, b) => order(a) - order(b)));
        }, { timeout: 20_000, message: "only Saturday's hours changed on the server" })
        .toBe(true);
      // An hours-only edit does not touch the demo state of the legal data.
      const settingsNow = await admin.query(api.settingsAdmin.get, {});
      expect(settingsNow?.settings.isDemo).toBe(originalSettingsDemo);

      // The public contact page shows the new hours.
      const visitor = await projectContext(browser, testInfo);
      try {
        const site = await visitor.newPage();
        await quietPublicPage(site);
        await site.goto("/sr/kontakt");
        const row = site.locator("dl > div").filter({ has: site.locator("dt", { hasText: /^Subota$/ }) });
        await expect(row.locator("dd")).toHaveText(expected);
      } finally {
        await visitor.close();
      }

      await expect.poll(async () => {
        const rows = await admin.query(api.activity.list, { entity: "settings", paginationOpts: { numItems: 10, cursor: null } });
        return rows.page.some((item) => item.action === "settings.updated" && (item.summary ?? "").includes("radno vreme"));
      }).toBe(true);
    } finally {
      // Restore exactly what was there (afterAll checks again).
      await admin.mutation(api.settingsAdmin.update, { patch: { officeHours: original } });
      const restored = await admin.query(api.settingsAdmin.get, {});
      expect(sameHours(restored?.settings.officeHours ?? [], original), "office hours restored").toBe(true);
    }
  });

  /* ---------------------------------------------------------- B12 analytics */

  test("B12: the analytics page renders its funnel, rankings, lead trend and response-time cards with a clean console @admin", async () => {
    const consoleWatch = watchConsole(page);
    try {
      await page.goto("/admin/analitika");
      await expect(page.getByRole("heading", { level: 1, name: "Analitika" })).toBeVisible({ timeout: 20_000 });
      const cards: [string, string][] = [
        ["analytics-funnel", "Put do upita"],
        ["analytics-top-listings", "Najuspešniji oglasi"],
        ["analytics-leads-chart", "Upiti po nedeljama"],
        ["analytics-response-times", "Brzina odgovora na upite"],
      ];
      for (const [testId, title] of cards) {
        const card = page.getByTestId(testId);
        await expect(card.getByRole("heading", { level: 2, name: title })).toBeVisible();
        await expect(card.locator('[aria-busy="true"]'), `${title} finished loading`).toHaveCount(0, { timeout: 20_000 });
      }

      // This spec created leads today, so the 30-day trend is a chart, not the empty state.
      const trend = page.getByTestId("analytics-leads-chart");
      await expect(trend.locator("figure figcaption")).toContainText(/\d+ upit/);
      await expect(trend.locator("figure svg").first()).toBeVisible();
      await expect(trend.getByRole("table")).toHaveCount(1);

      // The funnel picked a listing and shows its stages.
      const funnel = page.getByTestId("analytics-funnel");
      await expect(funnel.getByTestId("analytics-listing-picker")).toBeVisible();
      await expect(funnel.getByRole("table")).toContainText("Pregledi");

      // The period switch is in the URL and the cards follow it.
      await page.getByRole("radio", { name: "90 dana" }).click();
      await expect(page).toHaveURL(/[?&]period=90\b/);
      await expect(trend.locator('[aria-busy="true"]')).toHaveCount(0, { timeout: 20_000 });
      await expect(trend.locator("figure figcaption")).toContainText(/\d+ upit/);

      expect(consoleWatch.errors, "console errors on /admin/analitika").toEqual([]);
    } finally {
      consoleWatch.stop();
    }
  });

  /* ----------------------------------------------------------- B13 activity */

  test("B13: the activity log filter shows this spec's listing, lead and settings changes @admin", async () => {
    const target = need(listing, "the e2e listing");
    await page.goto("/admin/aktivnost");
    const rows = page.getByTestId("activity-row");
    await expect(rows.first()).toBeVisible({ timeout: 20_000 });

    const filter = page.getByTestId("activity-filter-entity");
    await pick(page, filter, "Nekretnina");
    await expect(page).toHaveURL(/[?&]entity=listing\b/);
    await expect(rows.first()).toHaveAttribute("data-entity", "listing", { timeout: 20_000 });
    const entities = await rows.evaluateAll((items) => items.map((item) => item.getAttribute("data-entity")));
    expect(new Set(entities)).toEqual(new Set(["listing"]));
    await expect(rows.filter({ hasText: target.ref }).filter({ hasText: "Status nekretnine: Arhivirano" }).first()).toBeVisible();

    await pick(page, filter, "Upit");
    await expect(page).toHaveURL(/[?&]entity=lead\b/);
    await expect(rows.filter({ hasText: "Upit dodeljen agentu" }).filter({ hasText: AGENT_A }).first()).toBeVisible({
      timeout: 20_000,
    });

    await pick(page, filter, "Podešavanja");
    await expect(page).toHaveURL(/[?&]entity=settings\b/);
    const settingsRow = rows.filter({ hasText: "Izmenjena podešavanja" }).filter({ hasText: "radno vreme" }).first();
    await expect(settingsRow).toBeVisible({ timeout: 20_000 });
    // Field level: the row opens a before/after table naming the field and both values.
    await settingsRow.getByRole("button", { name: /^Izmene \(\d+\)/ }).click();
    const diff = page.getByRole("table", { name: "Izmenjena polja" }).first();
    await expect(diff).toContainText("Radno vreme");
    if (saturdayChange !== null) await expect(diff).toContainText(saturdayChange);

    await page.getByRole("button", { name: "Poništi filtere" }).click();
    await expect(page).toHaveURL(/\/admin\/aktivnost$/);
  });

  /* ---------------------------------------------------------------- B14 demo */

  test("B14: the demo panel shows per-table counts and keeps the purge behind a typed confirmation @admin", async () => {
    await page.goto("/admin/demo");
    const table = page.getByTestId("demo-counts");
    await expect(table).toBeVisible({ timeout: 20_000 });
    const server = await admin.query(api.demo.counts, {});
    const labels: Record<string, string> = {
      listings: "Nekretnine",
      locations: "Lokacije",
      agents: "Agenti",
      posts: "Magazin",
      pages: "Stranice",
      testimonials: "Utisci",
      leads: "Upiti",
      viewings: "Razgledanja",
      contacts: "Kontakti",
    };
    expect(server.rows.map((row) => row.table).sort()).toEqual(Object.keys(labels).sort());
    for (const row of server.rows) {
      const line = table.locator(`tr[data-table="${row.table}"]`);
      await expect(line.locator("td").first()).toHaveText(labels[row.table] ?? row.table);
      await expect(line.locator("td").nth(1)).toHaveText(countFmt.format(row.count));
    }
    await expect(page.getByTestId("demo-total")).toHaveText(countFmt.format(server.total));

    // The purge dialog: the destructive button stays disabled for a wrong phrase.
    // (It is never pressed; Escape closes the dialog.)
    const purge = page.getByTestId("demo-purge");
    if (server.total > 0 && (await purge.isEnabled())) {
      await purge.click();
      const dialog = page.getByRole("alertdialog");
      await expect(dialog.getByRole("heading")).toHaveText("Obrisati sav demo sadržaj?");
      const confirmButton = dialog.getByRole("button", { name: "Obriši demo sadržaj" });
      await expect(confirmButton).toBeDisabled();
      await dialog.getByLabel(/Za potvrdu upišite/).fill("OBRISI DEMO");
      await expect(confirmButton).toBeDisabled();
      await dialog.getByRole("button", { name: "Otkaži" }).click();
      await expect(dialog).toBeHidden();
    }
    expect((await admin.query(api.demo.counts, {})).total, "the demo data is untouched").toBe(server.total);
  });

  /* ------------------------------------------- invited agent: B1 scope, B7 */

  test.describe("an invited agent", () => {
    const password = `E2e-${randomBytes(12).toString("base64url")}`;
    let token = "";
    let userId: Id<"users"> | null = null;
    let agentContext: BrowserContext | undefined;
    let agentPage: Page;

    test.beforeAll(async ({ browser }, testInfo) => {
      const invite = await admin.mutation(api.invites.create, { email: EMAIL.agent, role: "agent", agentName: AGENT_B });
      token = invite.token;
      agentContext = await projectContext(browser, testInfo);
      agentPage = await agentContext.newPage();
    });

    test.afterAll(async () => {
      await agentContext?.close();
    });

    test("accepts the invite and lands in the agent's panel @admin @forms", async () => {
      await agentPage.goto(`/admin/pozivnica/${encodeURIComponent(token)}`);
      await expect(agentPage.getByLabel("E-pošta", { exact: true })).toHaveValue(EMAIL.agent);
      await agentPage.getByLabel("Ime i prezime").fill(AGENT_B);
      await agentPage.getByLabel("Nova lozinka").fill(password);
      await agentPage.getByLabel("Ponovite lozinku").fill(password);
      await agentPage.getByRole("button", { name: "Aktivirajte nalog" }).click();
      await expect(agentPage).toHaveURL(/\/admin\/?$/, { timeout: 20_000 });
      await expect(sidebar(agentPage)).toContainText(AGENT_B);

      const users = await admin.query(api.users.list, {});
      const user = users.find((item) => item.email === EMAIL.agent);
      expect(user?.role).toBe("agent");
      expect(user?.status).toBe("active");
      userId = user?._id ?? null;
    });

    test("B1: cannot read or change another agent's lead or viewing by id @admin", async () => {
      const request = need(requested, "the viewing request");
      const past = need(held, "the held viewing");
      const agent = await signedInClient({ email: EMAIL.agent, password });
      expect((await agent.query(api.users.getMe, {}))?.role).toBe("agent");

      // Reads by id answer "not found" (null), never the record.
      expect(await agent.query(api.leadsAdmin.get, { id: leadId })).toBeNull();
      expect(await agent.query(api.leadsAdmin.get, { id: request.leadId })).toBeNull();
      expect(await agent.query(api.viewingsAdmin.get, { id: past })).toBeNull();
      expect(await agent.query(api.viewingsAdmin.get, { id: request.viewingId })).toBeNull();
      expect(await agent.query(api.viewingsAdmin.leadForBooking, { id: leadId })).toBeNull();

      // Writes are refused.
      const refusedCalls: [string, () => Promise<unknown>][] = [
        ["leadsAdmin.addNote", () => agent.mutation(api.leadsAdmin.addNote, { id: leadId, body: "e2e: tuđi upit" })],
        ["leadsAdmin.setStatus", () => agent.mutation(api.leadsAdmin.setStatus, { id: leadId, status: "offer" })],
        ["leadsAdmin.setNextAction", () => agent.mutation(api.leadsAdmin.setNextAction, { id: leadId })],
        ["leadsAdmin.markResponded", () => agent.mutation(api.leadsAdmin.markResponded, { id: request.leadId })],
        ["leadsAdmin.assign", () => agent.mutation(api.leadsAdmin.assign, { id: leadId })],
        ["viewingsAdmin.setStatus", () => agent.mutation(api.viewingsAdmin.setStatus, { id: past, status: "no_show" })],
        ["viewingsAdmin.setFeedback", () => agent.mutation(api.viewingsAdmin.setFeedback, { id: past, feedback: "e2e" })],
      ];
      const wrong: string[] = [];
      for (const [name, call] of refusedCalls) {
        try {
          const data = await refusal(call());
          if (data.code !== "FORBIDDEN") wrong.push(`${name}: refused with ${data.code ?? "no code"}`);
        } catch (error) {
          wrong.push(`${name}: ${String(error).slice(0, 160)}`);
        }
      }
      expect(wrong, "calls the agent was not refused").toEqual([]);

      // Lists hold neither.
      const leads = await agent.query(api.leadsAdmin.list, { paginationOpts: { cursor: null, numItems: 100 } });
      expect(leads.page.map((row) => row._id)).not.toContain(leadId);
      expect(leads.page.map((row) => row._id)).not.toContain(request.leadId);
      const heldDetail = await admin.query(api.viewingsAdmin.get, { id: past });
      if (heldDetail === null) throw new Error("the held viewing is gone");
      const range = await agent.query(api.viewingsAdmin.range, { from: heldDetail.start - DAY, to: heldDetail.start + DAY });
      expect(range.map((row) => row._id)).not.toContain(past);

      // Nothing moved.
      const lead = await admin.query(api.leadsAdmin.get, { id: leadId });
      expect(lead?.lead.status).toBe("qualified");
      expect(heldDetail.status).toBe("done");

      // And the screens say so.
      await agentPage.goto(`/admin/upiti?id=${leadId}`);
      await expect(agentPage.getByTestId("lead-sheet")).toContainText("Upit ne postoji ili nije dodeljen Vama.", {
        timeout: 20_000,
      });
      await expect(agentPage.getByTestId("lead-sheet")).not.toContainText(LEAD_NAME);
      await agentPage.goto(`/admin/razgledanja?id=${past}`);
      await expect(agentPage.getByTestId("viewing-sheet")).toContainText("Razgledanje nije pronađeno ili nemate pristup.", {
        timeout: 20_000,
      });
    });

    test("B7: the admin changes the account's role and deactivates it; the server then refuses it @admin", async () => {
      const id = need(userId, "the invited user");
      await page.goto(`/admin/tim?tab=users&id=${id}`);
      const sheet = page.getByTestId("user-sheet");
      await expect(sheet).toBeVisible({ timeout: 20_000 });
      await expect(sheet).toContainText(EMAIL.agent);

      const roleOf = async () => (await admin.query(api.users.list, {})).find((user) => user._id === id)?.role;
      const page1 = { cursor: null, numItems: 1 };
      /** Which calls of a role matrix the server got wrong (allowed must pass, refused must be FORBIDDEN). */
      const matrix = async (
        allowed: [string, () => Promise<unknown>][],
        refused: [string, () => Promise<unknown>][],
      ): Promise<string[]> => {
        const wrong: string[] = [];
        for (const [name, call] of allowed) {
          try {
            await call();
          } catch (error) {
            wrong.push(`${name} should be allowed: ${String(error).slice(0, 120)}`);
          }
        }
        for (const [name, call] of refused) {
          try {
            const data = await refusal(call());
            if (data.code !== "FORBIDDEN") wrong.push(`${name}: refused with ${data.code ?? "no code"}`);
          } catch (error) {
            wrong.push(`${name} should be refused: ${String(error).slice(0, 120)}`);
          }
        }
        return wrong;
      };

      // Role: Agent → Menadžer, confirmed. A manager runs everything but accounts and settings.
      await sheet.getByLabel("Uloga u panelu").selectOption("manager");
      await sheet.getByTestId("user-role-save").click();
      await confirmDialog(page, "Promeniti ulogu u „Menadžer”?");
      await expect.poll(roleOf).toBe("manager");
      const asManager = await signedInClient({ email: EMAIL.agent, password });
      expect(
        await matrix(
          [
            ["listingsAdmin.list", () => asManager.query(api.listingsAdmin.list, { paginationOpts: page1 })],
            ["leadsAdmin.get (any lead)", () => asManager.query(api.leadsAdmin.get, { id: leadId }).then((row) => row ?? Promise.reject(new Error("null")))],
            ["contacts.list", () => asManager.query(api.contacts.list, { paginationOpts: page1 })],
            ["analytics.dashboard", () => asManager.query(api.analytics.dashboard, { now: Date.now() })],
            ["activity.list", () => asManager.query(api.activity.list, { paginationOpts: page1 })],
            ["postsAdmin.list", () => asManager.query(api.postsAdmin.list, { paginationOpts: page1 })],
          ],
          [
            ["users.list", () => asManager.query(api.users.list, {})],
            ["invites.list", () => asManager.query(api.invites.list, {})],
            ["settingsAdmin.get", () => asManager.query(api.settingsAdmin.get, {})],
            ["demo.counts", () => asManager.query(api.demo.counts, {})],
            ["users.setRole", () => asManager.mutation(api.users.setRole, { id, role: "admin" })],
          ],
        ),
        "manager role matrix",
      ).toEqual([]);
      await agentPage.goto("/admin");
      const managerNav = sidebar(agentPage);
      for (const label of ["Kontakti", "Analitika", "Aktivnost", "Magazin"]) {
        await expect(managerNav.getByRole("link", { name: label, exact: true })).toBeVisible({ timeout: 20_000 });
      }
      for (const label of ["Podešavanja", "Demo sadržaj"]) {
        await expect(managerNav.getByRole("link", { name: label, exact: true })).toHaveCount(0);
      }

      // Menadžer → Urednik: journal, pages and locations only.
      await sheet.getByLabel("Uloga u panelu").selectOption("editor");
      await sheet.getByTestId("user-role-save").click();
      await confirmDialog(page, "Promeniti ulogu u „Urednik”?");
      await expect.poll(roleOf).toBe("editor");
      expect(
        await matrix(
          [
            ["postsAdmin.list", () => asManager.query(api.postsAdmin.list, { paginationOpts: page1 })],
            ["pagesAdmin.listKeys", () => asManager.query(api.pagesAdmin.listKeys, {})],
            ["locationsAdmin.tree", () => asManager.query(api.locationsAdmin.tree, {})],
            ["testimonialsAdmin.listAll", () => asManager.query(api.testimonialsAdmin.listAll, {})],
          ],
          [
            ["listingsAdmin.list", () => asManager.query(api.listingsAdmin.list, { paginationOpts: page1 })],
            ["leadsAdmin.list", () => asManager.query(api.leadsAdmin.list, { paginationOpts: page1 })],
            [
              "viewingsAdmin.list",
              () => asManager.query(api.viewingsAdmin.list, { when: "upcoming", now: Date.now(), paginationOpts: page1 }),
            ],
            ["contacts.list", () => asManager.query(api.contacts.list, { paginationOpts: page1 })],
            ["analytics.dashboard", () => asManager.query(api.analytics.dashboard, { now: Date.now() })],
            ["activity.list", () => asManager.query(api.activity.list, { paginationOpts: page1 })],
            ["users.list", () => asManager.query(api.users.list, {})],
            ["settingsAdmin.get", () => asManager.query(api.settingsAdmin.get, {})],
          ],
        ),
        "editor role matrix",
      ).toEqual([]);
      await agentPage.goto("/admin");
      const editorNav = sidebar(agentPage);
      for (const label of ["Lokacije", "Magazin", "Sadržaj sajta"]) {
        await expect(editorNav.getByRole("link", { name: label, exact: true })).toBeVisible({ timeout: 20_000 });
      }
      for (const label of ["Nekretnine", "Upiti", "Razgledanja", "Kontakti", "Tim", "Analitika", "Aktivnost"]) {
        await expect(editorNav.getByRole("link", { name: label, exact: true })).toHaveCount(0);
      }

      // Deactivate, confirmed.
      await sheet.getByTestId("user-deactivate").click();
      await confirmDialog(page, `Deaktivirati nalog ${AGENT_B}?`);
      await expect
        .poll(async () => (await admin.query(api.users.list, {})).find((user) => user._id === id)?.status)
        .toBe("disabled");
      await expect(sheet.getByTestId("user-reactivate")).toBeVisible();

      const after = await refusal(asManager.query(api.activity.list, { paginationOpts: { cursor: null, numItems: 1 } }));
      expect(["FORBIDDEN", "UNAUTHENTICATED"]).toContain(after.code);
      await expect(signedInClient({ email: EMAIL.agent, password }), "a deactivated account cannot sign in").rejects.toThrow();

      const log = await admin.query(api.activity.list, { entity: "user", paginationOpts: { cursor: null, numItems: 20 } });
      const mine = log.page.filter((row) => row.entityId === id);
      expect(mine.map((row) => row.action)).toEqual(expect.arrayContaining(["user.role", "user.status"]));
      expect(mine.filter((row) => row.action === "user.role").map((row) => row.diff?.[0]?.to)).toEqual(
        expect.arrayContaining(["Menadžer", "Urednik"]),
      );
    });
  });
});
