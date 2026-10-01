import { randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import { expect, test, type BrowserContext, type Locator, type Page } from "@playwright/test";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import {
  adminHttpClient,
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
 * Admin CRM and content modules (night-run step 09, PRD B4–B13).
 *
 * Proven end to end against the dev deployment:
 *   - a web inquiry moves through the lead pipeline (menu and drag), the loss
 *     reason is required, and every stage change lands in the lead's activity;
 *   - the contacts CSV export downloads a file holding that contact;
 *   - a journal post written and published in the editor is returned by the
 *     PUBLIC posts query in sr-Latn (the /sr/magazin page itself is step 10);
 *   - editing the home hero lede in "Sadržaj sajta" changes /sr (the lede,
 *     not the h1, which landing.spec / shell.spec assert in parallel runs);
 *   - an invite created in "Tim" is accepted in a fresh browser and the new
 *     agent sees only the agent's menu, while the server refuses manager-only
 *     calls.
 *
 * Everything created is marked (`[E2E]` titles, `e2e+…` addresses, `E2E `
 * agent names) and removed in `afterAll`; the home page is restored from a
 * snapshot, demo flag included.
 */

const RUN = `${Date.now().toString(36)}${randomBytes(2).toString("hex")}`;
const LEAD_EMAIL = `e2e+lead-${RUN}@mihajlo-estate.local`;
const LEAD_NAME = `E2E Lead ${RUN}`;
const AGENT_EMAIL = `e2e+team-${RUN}@mihajlo-estate.local`;
const AGENT_NAME = `E2E Tim ${RUN}`;
const POST_TITLE = `[E2E] Vodič za kupce ${RUN}`;

function column(page: Page, status: string): Locator {
  return page.getByTestId(`kanban-column-${status}`);
}

function leadCard(page: Page): Locator {
  return page.getByTestId("lead-card").filter({ hasText: LEAD_NAME });
}

/** Moves the e2e lead's card with its "Premesti u…" menu (the keyboard path). */
async function moveWithMenu(page: Page, target: string): Promise<void> {
  await leadCard(page).getByTestId("lead-card-move").click();
  await page.getByRole("menuitem", { name: target, exact: true }).click();
}

/** Drags the e2e lead's card onto a column with real pointer events (dnd-kit's PointerSensor). */
async function dragTo(page: Page, status: string): Promise<void> {
  const card = leadCard(page);
  await card.scrollIntoViewIfNeeded();
  const from = await card.boundingBox();
  const target = column(page, status);
  await target.scrollIntoViewIfNeeded();
  const to = await target.boundingBox();
  if (from === null || to === null) throw new Error("card or column not laid out");
  await page.mouse.move(from.x + from.width / 2, from.y + 20);
  await page.mouse.down();
  // A few small steps first: the sensor needs to see movement past its activation distance.
  await page.mouse.move(from.x + from.width / 2 + 12, from.y + 26, { steps: 4 });
  await page.mouse.move(to.x + to.width / 2, to.y + 80, { steps: 16 });
  await page.mouse.up();
}

test.describe("CRM and content modules @admin", () => {
  test.describe.configure({ mode: "serial", timeout: 180_000 });

  let admin: ConvexHttpClient;
  let adminContext: BrowserContext | undefined;
  let page: Page;
  let leadId: Id<"leads">;
  let homeSnapshot: { blocks: unknown[]; isDemo: boolean; updatedAt: number; updatedBy?: string } | null = null;

  test.beforeAll(async ({ browser }, testInfo) => {
    desktopOnly(testInfo);
    admin = await adminHttpClient();

    // A real web inquiry, through the public mutation the listing page uses.
    const [listing] = await new ConvexHttpClient(convexUrl()).query(api.listings.featured, { limit: 1 });
    if (listing === undefined) throw new Error("no featured listing to attach the inquiry to");
    const created = await new ConvexHttpClient(convexUrl()).mutation(api.leads.createInquiry, {
      sessionKey: `e2e-${RUN}`,
      locale: "sr-Latn",
      contact: { name: LEAD_NAME, email: LEAD_EMAIL },
      marketing: false,
      privacy: true,
      listingId: listing._id,
      message: `Zanima me nekretnina ${listing.ref}, molim Vas za termin razgledanja.`,
    });
    leadId = created.leadId;

    homeSnapshot = convexRun<{ blocks: unknown[]; isDemo: boolean; updatedAt: number; updatedBy?: string } | null>("qa:pageSnapshot", { key: "home" });

    const { email, password } = readAdminCreds();
    adminContext = await projectContext(browser, testInfo);
    page = await adminContext.newPage();
    await loginViaUi(page, email, password);
  });

  test.afterAll(async () => {
    await adminContext?.close();
    convexRun("qa:purgeByEmail", { email: LEAD_EMAIL });
    convexRun("qa:purgeE2EUser", { email: AGENT_EMAIL });
    convexRun("qa:purgeE2EPosts", {});
    if (homeSnapshot !== null) convexRun("qa:restorePage", { key: "home", ...homeSnapshot });
  });

  test("a lead moves through the pipeline and every stage change is logged @admin", async () => {
    await page.goto("/admin/upiti?view=kanban");
    await expect(leadCard(page)).toBeVisible({ timeout: 20_000 });
    await expect(column(page, "new").getByTestId("lead-card").filter({ hasText: LEAD_NAME })).toBeVisible();

    await moveWithMenu(page, "Kontaktiran");
    await expect(column(page, "contacted").getByTestId("lead-card").filter({ hasText: LEAD_NAME })).toBeVisible();

    await dragTo(page, "qualified");
    await expect(column(page, "qualified").getByTestId("lead-card").filter({ hasText: LEAD_NAME })).toBeVisible();

    // "Izgubljen" needs a reason: cancelling keeps the stage, submitting moves it.
    await moveWithMenu(page, "Izgubljen");
    const reason = page.getByTestId("loss-reason-input");
    await expect(reason).toBeVisible();
    await page.getByRole("button", { name: "Otkaži" }).click();
    await expect(column(page, "qualified").getByTestId("lead-card").filter({ hasText: LEAD_NAME })).toBeVisible();

    await moveWithMenu(page, "Izgubljen");
    await page.getByTestId("loss-reason-input").fill("Kupac je odustao od kupovine (e2e).");
    await page.getByTestId("loss-reason-submit").click();
    await expect(column(page, "lost").getByTestId("lead-card").filter({ hasText: LEAD_NAME })).toBeVisible();

    // The server's own record: status, reason and one activity row per move.
    const detail = await admin.query(api.leadsAdmin.get, { id: leadId });
    expect(detail?.lead.status).toBe("lost");
    const actions = (detail?.timeline ?? []).map((row) => row.action);
    for (const action of ["lead.status.contacted", "lead.status.qualified", "lead.status.lost"]) {
      expect(actions).toContain(action);
    }

    // And the sheet shows that history to the user.
    await page.goto(`/admin/upiti?view=kanban&id=${leadId}`);
    const sheet = page.getByTestId("lead-sheet");
    await expect(sheet).toBeVisible();
    await expect(sheet.getByTestId("lead-timeline")).toContainText("Kvalifikovan");
    await expect(sheet.getByTestId("lead-timeline")).toContainText("Izgubljen");
  });

  test("the contacts CSV export downloads a file with the new contact @admin", async () => {
    await page.goto("/admin/kontakti");
    await expect(page.getByTestId("contact-row").first()).toBeVisible({ timeout: 20_000 });
    const [download] = await Promise.all([page.waitForEvent("download"), page.getByTestId("contacts-export").click()]);
    expect(download.suggestedFilename()).toMatch(/^kontakti-\d{4}-\d{2}-\d{2}\.csv$/);
    const file = await download.path();
    const csv = readFileSync(file, "utf8");
    expect(csv).toContain(LEAD_EMAIL);
    expect(csv).toContain(LEAD_NAME);
  });

  test("a post written in the journal editor is returned by the public posts query in sr-Latn @admin", async () => {
    await page.goto("/admin/magazin");
    await page.getByTestId("posts-new").click();
    await expect(page).toHaveURL(/\/admin\/magazin\/[a-z0-9]+$/, { timeout: 20_000 });

    // The server's publish rules: title ≥ 5, excerpt ≥ 30 and body ≥ 150 characters (sr).
    await page.getByTestId("post-title-sr").fill(POST_TITLE);
    await page.getByTestId("post-excerpt-sr").fill("Kratak vodič kroz korake kupovine stana u Beogradu, od prvog razgledanja do ključeva.");
    const body = page.getByTestId("post-body-editor");
    await body.click();
    await page.keyboard.insertText(
      "Prvi korak je provera dokumentacije u katastru: list nepokretnosti, tereti i upisani vlasnici. " +
        "Zatim sledi predugovor kod notara, uplata kapare i, na kraju, glavni ugovor i primopredaja ključeva.",
    );
    await page.getByTestId("save-button").click();
    await expect(page.getByTestId("save-button")).toBeDisabled({ timeout: 20_000 });

    await page.getByTestId("post-publish-now").click();
    await page.getByTestId("confirm-dialog-action").click();
    await expect(page.getByTestId("post-status")).toHaveAttribute("data-status", "published", { timeout: 20_000 });

    const publicClient = new ConvexHttpClient(convexUrl());
    await expect
      .poll(
        async () => {
          const result = await publicClient.query(api.posts.list, { paginationOpts: { numItems: 20, cursor: null } });
          return JSON.stringify(result.page);
        },
        { timeout: 15_000 },
      )
      .toContain(POST_TITLE);
  });

  // The hero LEDE, not the headline: landing.spec and shell.spec assert the
  // seeded h1 ("Dom koji se pamti."), so editing it raced them in a parallel
  // run. No spec asserts the lede's text. The page is restored as soon as the
  // public check is done (afterAll restores again as a safety net).
  test("editing the home hero lede changes the public landing @admin @public", async ({ browser }, testInfo) => {
    const lede = `E2E uvod ${RUN}`;
    try {
      await page.goto("/admin/sadrzaj");
      await page.getByTestId("content-page-home").click();
      const field = page.getByTestId("block-hero-body-sr");
      await expect(field).toBeVisible({ timeout: 20_000 });
      await field.fill(lede);
      await page.getByTestId("save-button").click();
      const publicClient = new ConvexHttpClient(convexUrl());
      await expect
        .poll(async () => JSON.stringify(await publicClient.query(api.pages.get, { key: "home" })), { timeout: 20_000 })
        .toContain(lede);

      const visitor = await projectContext(browser, testInfo);
      try {
        const site = await visitor.newPage();
        await quietPublicPage(site);
        await site.goto("/sr");
        await expect(site.locator('section[aria-labelledby="hero-title"] [data-hero-reveal="lede"]')).toContainText(lede);
        // The headline is untouched by this edit.
        await expect(site.getByTestId("hero-headline")).not.toContainText(RUN);
      } finally {
        await visitor.close();
      }
    } finally {
      if (homeSnapshot !== null) convexRun("qa:restorePage", { key: "home", ...homeSnapshot });
    }
  });

  test.describe("an invite created in Tim", () => {
    const password = `E2e-${randomBytes(12).toString("base64url")}`;
    let link: string;
    let agentContext: BrowserContext | undefined;
    let agentPage: Page;

    test.afterAll(async () => {
      await agentContext?.close();
    });

    test("the admin invites an agent and gets a copyable link @admin @forms", async () => {
      await page.goto("/admin/tim");
      await page.getByTestId("invite-open").click();
      await page.getByTestId("invite-email").fill(AGENT_EMAIL);
      await page.getByTestId("invite-name").fill(AGENT_NAME);
      await page.getByTestId("invite-role").selectOption({ label: "Agent" });
      await page.getByTestId("invite-agent-name").fill(AGENT_NAME);
      await page.getByTestId("invite-submit").click();

      const input = page.getByTestId("invite-link");
      await expect(input).toHaveValue(/\/admin\/pozivnica\/[A-Za-z0-9_-]{20,}$/, { timeout: 20_000 });
      link = await input.inputValue();
    });

    test("the new agent accepts it and sees only the agent's menu @admin", async ({ browser }, testInfo) => {
      agentContext = await projectContext(browser, testInfo);
      agentPage = await agentContext.newPage();
      await agentPage.goto(new URL(link).pathname);
      await expect(agentPage.getByLabel("E-pošta", { exact: true })).toHaveValue(AGENT_EMAIL);
      await agentPage.getByLabel("Ime i prezime").fill(AGENT_NAME);
      await agentPage.getByLabel("Nova lozinka").fill(password);
      await agentPage.getByLabel("Ponovite lozinku").fill(password);
      await agentPage.getByRole("button", { name: "Aktivirajte nalog" }).click();
      await expect(agentPage).toHaveURL(/\/admin\/?$/, { timeout: 20_000 });

      const nav = sidebar(agentPage);
      for (const label of ["Kontrolna tabla", "Nekretnine", "Upiti", "Razgledanja"]) {
        await expect(nav.getByRole("link", { name: label, exact: true })).toBeVisible();
      }
      for (const label of ["Kontakti", "Lokacije", "Magazin", "Sadržaj sajta", "Tim", "Analitika", "Aktivnost", "Podešavanja", "Demo sadržaj"]) {
        await expect(nav.getByRole("link", { name: label, exact: true })).toHaveCount(0);
      }

      await agentPage.goto("/admin/tim");
      await expect(agentPage.getByTestId("admin-forbidden")).toBeVisible();
    });

    test("the server refuses the agent's manager-only calls @admin", async () => {
      const agent = await signedInClient({ email: AGENT_EMAIL, password });
      expect((await refusal(agent.mutation(api.contacts.exportCsv, {}))).code).toBe("FORBIDDEN");
      expect((await refusal(agent.query(api.activity.list, { paginationOpts: { numItems: 5, cursor: null } }))).code).toBe(
        "FORBIDDEN",
      );
      expect((await refusal(agent.query(api.settingsAdmin.get, {}))).code).toBe("FORBIDDEN");
      // The agent's lead list holds no lead of another agent (the e2e lead is unassigned or someone else's).
      const leads = await agent.query(api.leadsAdmin.list, { paginationOpts: { numItems: 50, cursor: null } });
      expect(leads.page.some((row) => row._id === leadId)).toBe(false);
    });
  });
});
