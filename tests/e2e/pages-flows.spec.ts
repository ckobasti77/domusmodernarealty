import { expect, test, type Locator, type Page, type TestInfo } from "@playwright/test";
import { ConvexHttpClient } from "convex/browser";
import type { FunctionReturnType } from "convex/server";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { adminHttpClient, convexRun, convexUrl, quietPublicPage } from "./helpers/admin";

/**
 * Night-run step 10: the flows behind the content pages, END TO END against
 * the dev deployment (PRD A6 valuation, A7 sell, A10 contact, A11 journal,
 * A12 compare).
 *
 * - Every form is submitted in a real browser; the spec then reads what landed
 *   in Convex: the lead list through the internal `qa:leadsByEmail` (never
 *   reachable from a browser), and the lead's `answers` / `valuation` through
 *   the admin's own `leadsAdmin.get`, with the bootstrap admin signed in
 *   (credentials from night-run/state/admin.json, read at runtime).
 * - Addresses are `e2e+…@mihajlo-estate.local` and are purged with
 *   `qa:purgeByEmail` after each test; the journal post is titled `[E2E] …`
 *   and removed in `afterAll`.
 * - Public forms rate-limit per browser session (`getSessionKey()`, in
 *   sessionStorage), so each test runs in its own context and submits at most
 *   twice.
 *
 * The desktop project only: these prove data flows, not layout, and each run
 * writes leads.
 */

type QaLead = {
  leadId: string;
  type: string;
  status: string;
  message?: string;
  marketing: boolean;
};

type LeadDetail = NonNullable<FunctionReturnType<typeof api.leadsAdmin.get>>;
type ListingCard = FunctionReturnType<typeof api.listings.search>["page"][number];

/* ------------------------------------------------------------------ helpers */

/** Addresses this worker created, purged after every test. */
const createdEmails = new Set<string>();

function e2eEmail(testInfo: TestInfo, flow: string): string {
  const stamp = `${Date.now().toString(36)}-${Math.floor(Math.random() * 1e6).toString(36)}`;
  const email = `e2e+${flow}-${testInfo.project.name}-${stamp}@mihajlo-estate.local`;
  createdEmails.add(email);
  return email;
}

/** The only lead an address holds, after asserting there is exactly one. */
function singleLead(email: string): QaLead {
  const leads = convexRun<QaLead[]>("qa:leadsByEmail", { email });
  expect(leads, `leads for ${email}`).toHaveLength(1);
  return leads[0];
}

/** The admin's lead sheet: everything `qa:leadsByEmail` leaves out (answers, valuation). */
async function leadDetail(leadId: string): Promise<LeadDetail> {
  const admin = await adminHttpClient();
  const detail = await admin.query(api.leadsAdmin.get, { id: leadId });
  if (detail === null) throw new Error(`leadsAdmin.get returned null for ${leadId}`);
  return detail;
}

/** "307.200 €" → 307200 (sr-Latn groups with dots; any currency spacing). */
function euros(text: string | null): number {
  const digits = (text ?? "").replace(/\D/g, "");
  if (digits.length === 0) throw new Error(`No amount in "${text}"`);
  return Number(digits);
}

/**
 * Picks the first enabled `<option>` whose text, trimmed, is `text`. The
 * location selects indent neighborhoods with em spaces, so
 * `selectOption({ label })` (an exact match) cannot address them.
 */
async function selectByOptionText(select: Locator, text: string): Promise<string> {
  const value = await select.evaluate((node, wanted) => {
    const options = Array.from((node as HTMLSelectElement).options);
    return options.find((option) => !option.disabled && option.textContent?.trim() === wanted)?.value ?? null;
  }, text);
  if (value === null) throw new Error(`No enabled option "${text}"`);
  await select.selectOption(value);
  return value;
}

/** The `<label>` tile wrapping a visually hidden radio. */
function tileOf(radio: Locator): Locator {
  return radio.locator("xpath=ancestor::label[1]");
}

async function visit(page: Page, url: string): Promise<void> {
  await quietPublicPage(page);
  await page.goto(url);
}

function publicClient(): ConvexHttpClient {
  return new ConvexHttpClient(convexUrl());
}

async function locationId(slug: string): Promise<Id<"locations">> {
  const tree = await publicClient().query(api.locations.tree, {});
  const node = tree.find((entry) => entry.slug === slug);
  if (node === undefined) throw new Error(`No location ${slug}`);
  return node._id;
}

/* -------------------------------------------------------------------- setup */

test.beforeEach(async ({}, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "Data flows are proven once, on the desktop project.");
});

test.afterEach(async () => {
  for (const email of createdEmails) convexRun("qa:purgeByEmail", { email });
  createdEmails.clear();
});

/* ---------------------------------------------------------------- valuation */

test.describe("valuation funnel (PRD A6) @public @forms", () => {
  test("prefills the location and the area from the landing's query, and drops values it cannot use @public @forms", async ({
    page,
  }) => {
    const vracar = await locationId("vracar");
    await visit(page, "/sr/procena?location=vracar&area=68.5");
    const step1 = page.getByTestId("valuation-step-1");
    // In the visitor's own notation: a decimal comma in sr-Latn.
    await expect(step1.getByLabel("Kvadratura (m²)")).toHaveValue("68,5");
    await expect(step1.getByLabel("Lokacija", { exact: true })).toHaveValue(vracar);
    await expect(step1.getByLabel("Lokacija", { exact: true }).locator("option:checked")).toHaveText(/^\s*Vračar\s*$/);

    // An unknown place and an area below the 8 m² floor are not errors, just ignored.
    await page.goto("/sr/procena?location=ne-postoji&area=5");
    await expect(step1.getByLabel("Kvadratura (m²)")).toHaveValue("");
    await expect(step1.getByLabel("Lokacija", { exact: true })).toHaveValue("");
  });

  test("property → contact → indicative range; the lead holds every answer and the on-site request annotates it @public @forms", async ({
    page,
  }, testInfo) => {
    const email = e2eEmail(testInfo, "valuation");
    await visit(page, "/sr/procena");
    const funnel = page.getByTestId("valuation-funnel");

    // Step 1: required questions are enforced on the client first.
    const step1 = funnel.getByTestId("valuation-step-1");
    await step1.getByRole("button", { name: "Nastavite" }).click();
    await expect(step1.getByRole("alert").filter({ hasText: "Ovo polje je obavezno" }).first()).toBeVisible();

    await selectByOptionText(step1.getByLabel("Lokacija", { exact: true }), "Neimar");
    await step1.getByLabel("Tip nekretnine").selectOption("apartment");
    await step1.getByLabel("Kvadratura (m²)").fill("64");
    await step1.getByLabel("Struktura").selectOption("2");
    await step1.getByLabel("Sprat", { exact: true }).selectOption("3");
    await step1.getByLabel("Poslednji sprat zgrade").selectOption("5");
    await step1.getByLabel("Lift", { exact: true }).selectOption("yes");
    await step1.getByLabel("Stanje", { exact: true }).selectOption("renovated");
    await step1.getByLabel(/^Godina izgradnje/).fill("1978");
    await step1.getByLabel(/^Ulica i broj/).fill("Njegoševa 10");
    await step1.getByRole("button", { name: "Nastavite" }).click();

    // Step 2, and the answers survive a trip back to step 1.
    const step2 = funnel.getByTestId("valuation-step-2");
    await expect(funnel.getByRole("heading", { level: 2, name: /Vaši kontakt podaci/ })).toBeFocused();
    await step2.getByRole("button", { name: "Nazad" }).click();
    await expect(step1.getByLabel("Kvadratura (m²)")).toHaveValue("64");
    await expect(step1.getByLabel("Stanje", { exact: true })).toHaveValue("renovated");
    await step1.getByRole("button", { name: "Nastavite" }).click();

    await step2.getByLabel("Ime i prezime").fill("E2E Test Vlasnik");
    await step2.getByLabel("E-pošta").fill(email);
    await step2.getByRole("button", { name: "Prikažite procenu" }).click();
    await expect(step2.getByText("Bez Vaše saglasnosti ne možemo da odgovorimo na upit.")).toBeVisible();
    await step2.getByLabel(/Saglasan\/na sam/).check();
    await step2.getByRole("button", { name: "Prikažite procenu" }).click();

    // Step 3: the range, low below high, laid out as "min – max".
    const result = funnel.getByTestId("valuation-result");
    await expect(result).toBeVisible({ timeout: 20_000 });
    await expect(result.getByText(/^\d{1,3}(\.\d{3})+\s€\s–\s\d{1,3}(\.\d{3})+\s€$/)).toBeVisible();
    const low = euros(await result.getByTestId("valuation-range-low").textContent());
    const high = euros(await result.getByTestId("valuation-range-high").textContent());
    expect(low).toBeGreaterThan(0);
    expect(low).toBeLessThan(high);
    await expect(result).toContainText("Neimar");
    await expect(result).toContainText("64 m²");

    // ONE valuation lead, holding every answer and the figures shown.
    const lead = singleLead(email);
    expect(lead.type).toBe("valuation");
    expect(lead.status).toBe("new");
    expect(lead.marketing).toBe(false);
    const detail = await leadDetail(lead.leadId);
    expect(detail.answers).toMatchObject({
      locationSlug: "neimar",
      propertyType: "apartment",
      areaM2: 64,
      rooms: 2,
      floor: "3",
      totalFloors: 5,
      hasElevator: true,
      condition: "renovated",
      yearBuilt: 1978,
      addressNote: "Njegoševa 10",
    });
    expect(detail.valuation).toBeDefined();
    expect(Math.round(detail.valuation?.low ?? 0)).toBe(low);
    expect(Math.round(detail.valuation?.high ?? 0)).toBe(high);

    // The on-site request on the result annotates the SAME lead.
    const onsite = result.getByTestId("onsite-form");
    await onsite.getByRole("button", { name: "Zatražite procenu na terenu" }).click();
    await expect(onsite.getByText("Izaberite dan.")).toBeVisible();
    await expect(onsite.getByText("Izaberite deo dana.")).toBeVisible();

    // The radios are visually hidden inside their tiles: pick them the way a
    // visitor does, by the tile (the label), then assert the radio itself.
    const day = onsite.getByRole("group", { name: "Željeni dan" }).getByRole("radio").first();
    const dayKey = await day.getAttribute("value");
    expect(dayKey).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    await tileOf(day).click();
    await expect(day).toBeChecked();
    const afternoon = onsite.getByRole("group", { name: "Deo dana" }).getByRole("radio", { name: /Popodne/ });
    await tileOf(afternoon).click();
    await expect(afternoon).toBeChecked();
    await onsite.getByLabel(/^Napomena za agenta/).fill("E2E: interfon ne radi, pozvati pre dolaska.");
    await onsite.getByRole("button", { name: "Zatražite procenu na terenu" }).click();
    await expect(result.getByTestId("onsite-success")).toContainText("Zahtev je primljen");

    const annotated = await leadDetail(lead.leadId);
    expect(annotated.answers).toMatchObject({
      onsiteRequested: true,
      onsiteDate: dayKey ?? "",
      onsiteWindow: "afternoon",
      onsiteNote: "E2E: interfon ne radi, pozvati pre dolaska.",
      // The property answers are kept, not replaced.
      areaM2: 64,
    });
    expect(convexRun<QaLead[]>("qa:leadsByEmail", { email })).toHaveLength(1);
  });
});

/* ------------------------------------------------------------------ contact */

test.describe("contact form (PRD A10) @public @forms", () => {
  test("a message creates a general lead with the subject and the marketing opt-in @public @forms", async ({
    page,
  }, testInfo) => {
    const email = e2eEmail(testInfo, "contact");
    const message = "E2E poruka: zanima me saradnja oko prodaje stana na Vračaru.";
    await visit(page, "/sr/kontakt");
    const form = page.getByTestId("contact-form");

    await form.getByLabel("Ime i prezime").fill("E2E Test Kontakt");
    await form.getByLabel("E-pošta").fill(email);
    await form.getByLabel(/^Tema/).fill("Saradnja");
    // The client checks the server's 10-character minimum first.
    await form.getByLabel("Poruka", { exact: true }).fill("Kratko");
    await form.getByLabel(/Saglasan\/na sam/).check();
    await form.getByRole("button", { name: "Pošaljite" }).click();
    await expect(form.getByText("Unesite najmanje 10 znakova")).toBeVisible();

    await form.getByLabel("Poruka", { exact: true }).fill(message);
    await form.getByLabel("Želim da povremeno primam izbor novih nekretnina.").check();
    await form.getByRole("button", { name: "Pošaljite" }).click();
    const success = page.getByTestId("form-success");
    await expect(success).toContainText("Poruka je poslata");
    await expect(success.locator("..")).toBeFocused();

    const lead = singleLead(email);
    expect(lead.type).toBe("general");
    expect(lead.status).toBe("new");
    expect(lead.message).toBe(message);
    expect(lead.marketing).toBe(true);
    const detail = await leadDetail(lead.leadId);
    expect(detail.answers).toEqual({ subject: "Saradnja" });
  });
});

/* --------------------------------------------------------------------- sell */

test.describe("sell form (PRD A7) @public @forms", () => {
  test("a property submission creates a seller lead with the property answers @public @forms", async ({ page }, testInfo) => {
    const email = e2eEmail(testInfo, "seller");
    const note = "E2E: treći sprat, centralno grejanje, prodaja do proleća.";
    await visit(page, "/sr/prodajte");
    const form = page.getByTestId("sell-form");
    await expect(form).toBeVisible();

    await form.getByLabel("Vrsta nekretnine").selectOption({ label: "Stan" });
    await selectByOptionText(form.getByLabel("Lokacija", { exact: true }), "Vračar");
    await form.getByLabel(/^Ulica ili bliža lokacija/).fill("Kursulina 12");
    await form.getByLabel(/^Kvadratura \(m²\)/).fill("72");
    await form.getByLabel(/^Broj soba/).selectOption("2");
    await form.getByLabel(/^Očekivana cena u evrima/).fill("180000");
    await form.getByLabel(/^Napomena/).fill(note);
    await form.getByLabel("Ime i prezime").fill("E2E Test Prodavac");
    await form.getByLabel("E-pošta").fill(email);
    await form.getByLabel(/Saglasan\/na sam/).check();
    await form.getByRole("button", { name: "Pošaljite prijavu" }).click();
    await expect(page.getByRole("heading", { name: "Prijava je poslata" })).toBeVisible();

    const lead = singleLead(email);
    expect(lead.type).toBe("seller");
    expect(lead.status).toBe("new");
    expect(lead.message).toBe(note);
    const detail = await leadDetail(lead.leadId);
    expect(detail.answers).toMatchObject({
      propertyType: "apartment",
      areaM2: 72,
      rooms: 2,
      expectedPrice: 180000,
      locationSlug: "vracar",
      addressNote: "Kursulina 12",
    });
  });
});

/* ------------------------------------------------------------------ compare */

/**
 * Three published apartments for sale whose price, area and €/m² all differ,
 * so the price, €/m² and area rows each have exactly one best value.
 */
async function threeComparableListings(): Promise<ListingCard[]> {
  const result = await publicClient().query(api.listings.search, {
    filters: { transaction: "sale", propertyType: ["apartment"] },
    sort: "newest",
    paginationOpts: { numItems: 24, cursor: null },
  });
  const picked: ListingCard[] = [];
  for (const card of result.page) {
    if (card.priceOnRequest === true || card.pricePerM2 <= 0) continue;
    const clash = picked.some(
      (other) => other.price === card.price || other.areaM2 === card.areaM2 || other.pricePerM2 === card.pricePerM2,
    );
    if (clash) continue;
    picked.push(card);
    if (picked.length === 3) return picked;
  }
  throw new Error("The deployment needs three published apartments for sale with distinct price, area and €/m²");
}

function indexOfExtreme(values: number[], rule: "min" | "max"): number {
  const target = rule === "min" ? Math.min(...values) : Math.max(...values);
  return values.indexOf(target);
}

/** The table row whose row header is `label`. */
function compareRow(table: Locator, label: string): Locator {
  return table.getByRole("row").filter({ has: table.page().getByRole("rowheader", { name: label, exact: true }) });
}

/** Three columns in link order, and each comparable row marking exactly the expected column. */
async function expectThreeColumnsWithBestValues(page: Page, listings: ListingCard[]): Promise<void> {
  const table = page.getByTestId("compare-table");
  await expect(table.getByRole("columnheader")).toHaveCount(3);
  await expect(page.getByRole("heading", { level: 2, name: "Upoređujete 3 nekretnine" })).toBeVisible();
  for (const [index, listing] of listings.entries()) {
    await expect(table.getByRole("columnheader").nth(index)).toContainText(listing.title.sr.slice(0, 20));
  }

  // A best value is marked in words as well as style ("Najbolja vrednost").
  const expectations: { label: string; values: number[]; rule: "min" | "max" }[] = [
    { label: "Cena", values: listings.map((listing) => listing.price), rule: "min" },
    { label: "€/m²", values: listings.map((listing) => listing.pricePerM2), rule: "min" },
    { label: "Kvadratura", values: listings.map((listing) => listing.areaM2), rule: "max" },
  ];
  for (const { label, values, rule } of expectations) {
    const row = compareRow(table, label);
    await expect(row, `row ${label}`).toHaveCount(1);
    const best = row.getByTestId("compare-best");
    await expect(best, `best value in ${label}`).toHaveCount(1);
    await expect(best).toContainText("Najbolja vrednost");
    await expect(row.getByRole("cell").nth(indexOfExtreme(values, rule))).toHaveAttribute("data-testid", "compare-best");
  }
}

/**
 * Waits until the compare island has hydrated (`ready` shows) or the route's
 * error boundary took over, and fails with a clear message in the second case.
 */
async function expectIslandAlive(page: Page, ready: Locator): Promise<void> {
  const crashed = page.getByRole("heading", { level: 1, name: "Nešto nije u redu" });
  await expect(ready.or(crashed).first()).toBeVisible({ timeout: 15_000 });
  await expect(crashed, "the compare island crashed after hydration (route error boundary shown)").toHaveCount(0);
}

test.describe("compare (PRD A12) @public", () => {
  test.describe("server HTML", () => {
    test.use({ javaScriptEnabled: false });

    test("a shared link is server-rendered with three columns and the best value of each comparable row marked @public", async ({
      page,
    }) => {
      const listings = await threeComparableListings();
      await page.goto(`/sr/uporedi?ids=${listings.map((listing) => listing._id).join(",")}`);
      await expectThreeColumnsWithBestValues(page, listings);
    });
  });

  test("a shared link stays interactive: removing a listing rewrites the URL, the share link and the saved selection @public", async ({
    page,
    context,
  }) => {
    const listings = await threeComparableListings();
    const ids = listings.map((listing) => listing._id);
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await visit(page, `/sr/uporedi?ids=${ids.join(",")}`);

    // "Save this comparison" only renders once hydrated (it needs this device's selection).
    await expectIslandAlive(page, page.getByTestId("compare-save"));
    await expectThreeColumnsWithBestValues(page, listings);
    const table = page.getByTestId("compare-table");

    // Remove the middle listing: two columns remain, the URL follows in place.
    const [first, middle, last] = listings;
    await page.getByRole("button", { name: `Ukloni iz poređenja: ${middle.title.sr}` }).click();
    await expect(table.getByRole("columnheader")).toHaveCount(2);
    await expect(page.getByRole("heading", { level: 2, name: "Upoređujete 2 nekretnine" })).toBeVisible();
    await expect(page).toHaveURL(new RegExp(`/sr/uporedi\\?ids=${first._id},${last._id}$`));
    await expect(page.getByRole("status").filter({ hasText: `Uklonjeno iz poređenja: ${middle.title.sr}` })).toBeAttached();
    // Focus moves to the next column's remove control, not to the top of the page.
    await expect(page.getByRole("button", { name: `Ukloni iz poređenja: ${last.title.sr}` })).toBeFocused();

    // The share link carries the remaining two.
    await page.getByTestId("compare-share").click();
    await expect(page.getByTestId("compare-share")).toHaveText("Link je kopiran");
    const copied = await page.evaluate(() => navigator.clipboard.readText());
    expect(copied).toMatch(new RegExp(`/sr/uporedi\\?ids=${first._id},${last._id}$`));

    // "Save this comparison" makes the link's listings this device's selection, in link order.
    await page.getByTestId("compare-save").click();
    await expect(page.getByTestId("compare-save")).toHaveCount(0);
    const stored = await page.evaluate(() => window.localStorage.getItem("me.compare.v1"));
    expect(JSON.parse(stored ?? "null")).toEqual({ v: 1, ids: [first._id, last._id] });
  });

  test("without ?ids= the page compares this device's stored selection, and a removal updates it @public", async ({
    page,
  }) => {
    const listings = await threeComparableListings();
    const ids = listings.map((listing) => listing._id);
    await page.addInitScript((stored) => {
      window.localStorage.setItem("me.compare.v1", JSON.stringify({ v: 1, ids: stored }));
    }, ids);
    await visit(page, "/sr/uporedi");

    // The server can only render a loading shell here; the table is client-made.
    const table = page.getByTestId("compare-table");
    await expectIslandAlive(page, table);
    await expect(table.getByRole("columnheader")).toHaveCount(3);
    // Already this device's own selection: nothing to save.
    await expect(page.getByTestId("compare-save")).toHaveCount(0);

    await page.getByRole("button", { name: `Ukloni iz poređenja: ${listings[0].title.sr}` }).click();
    await expect(table.getByRole("columnheader")).toHaveCount(2);
    await expect(page).toHaveURL(/\/sr\/uporedi$/);
    const stored = await page.evaluate(() => window.localStorage.getItem("me.compare.v1"));
    expect(JSON.parse(stored ?? "null")).toEqual({ v: 1, ids: ids.slice(1) });
  });
});

/* ------------------------------------------------------------------ journal */

test.describe("journal (PRD A11) @public @admin", () => {
  let createdPost: Id<"posts"> | undefined;

  test.afterAll(async () => {
    if (createdPost === undefined) return;
    // Removing exactly this post does not race admin-crm.spec.ts, which also
    // writes `[E2E]` posts; the global purge is only the fallback.
    try {
      const admin = await adminHttpClient();
      await admin.mutation(api.postsAdmin.remove, { id: createdPost });
    } catch {
      convexRun("qa:purgeE2EPosts", {});
    }
    createdPost = undefined;
  });

  test("a post published through the admin mutations is listed on /sr/magazin and served with Article JSON-LD @public @admin", async ({
    page,
    request,
  }) => {
    const stamp = `${Date.now().toString(36)}${Math.floor(Math.random() * 1e4).toString(36)}`;
    const title = `[E2E] Kako se kupuje stan u Beogradu ${stamp}`;
    const admin = await adminHttpClient();
    const saved = await admin.mutation(api.postsAdmin.upsert, {
      title: { sr: title },
      excerpt: { sr: "Kratak vodič kroz korake kupovine stana, od prvog razgledanja do predaje ključeva." },
      body: {
        sr:
          "<h2>Prvi koraci</h2>" +
          "<p>Pre razgledanja proverite list nepokretnosti i da li je stan uknjižen. Zatražite i potvrde o izmirenim računima.</p>" +
          "<p>Kada se dogovorite o ceni, advokat priprema ugovor, a overa se zakazuje kod javnog beležnika u roku koji odgovara obema stranama.</p>",
      },
      category: "guide",
      tags: ["e2e"],
      featured: false,
    });
    createdPost = saved.id;
    expect(saved.slug).toMatch(/^e2e-kako-se-kupuje-stan-u-beogradu-/);
    await admin.mutation(api.postsAdmin.publish, { id: saved.id });

    // The index lists it, linking to its localized article URL.
    await visit(page, "/sr/magazin");
    const link = page.getByRole("link", { name: title });
    await expect(link.first()).toBeVisible();
    await expect(link.first()).toHaveAttribute("href", new RegExp(`/sr/magazin/${saved.slug}$`));

    // The article: 200, the title as the single h1, Article structured data.
    const path = `/sr/magazin/${saved.slug}`;
    const response = await request.get(path, { maxRedirects: 0 });
    expect(response.status(), path).toBe(200);
    expect((await response.text()).match(/<h1[\s>]/g)?.length ?? 0).toBe(1);

    await visit(page, path);
    // By accessible name: SplitReveal renders the title twice (a visually
    // hidden twin plus the aria-hidden animated copy), so textContent doubles.
    await expect(page.getByRole("heading", { level: 1 })).toHaveAccessibleName(title);
    const blocks = await page.locator('script[type="application/ld+json"]').allTextContents();
    type Node = { "@type"?: string; headline?: string; inLanguage?: string; mainEntityOfPage?: { "@id"?: string } };
    const nodes = blocks.flatMap((text) => {
      const parsed = JSON.parse(text) as Node | Node[];
      return Array.isArray(parsed) ? parsed : [parsed];
    });
    const article = nodes.find((node) => node["@type"] === "Article");
    expect(article, "Article JSON-LD").toBeDefined();
    expect(article?.headline).toBe(title);
    expect(article?.inLanguage).toBe("sr-Latn");
    expect(article?.mainEntityOfPage?.["@id"]).toMatch(new RegExp(`/sr/magazin/${saved.slug}$`));
  });
});
