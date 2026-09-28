import { execFileSync } from "node:child_process";
import path from "node:path";
import { expect, test, type Page, type TestInfo } from "@playwright/test";

/**
 * Listing detail (night-run step 07, PRD A5).
 *
 * The two lead flows are proven END TO END: the browser submits the real form,
 * then the spec reads the dev deployment through the internal `qa:leadsByEmail`
 * query (`npx convex run`, never reachable from a browser) and finally deletes
 * what it created with `qa:purgeByEmail`. Both helpers refuse any address that
 * is not `e2e+…@mihajlo-estate.local`.
 */

const LISTING = "trosoban-stan-u-neimaru-renoviran-2023-me-1042";
const SOLD = "dvoiposoban-stan-na-julinom-brdu-osmi-sprat-sa-lodjom-me-1063";
const CONVEX_CLI = path.join(process.cwd(), "node_modules", "convex", "bin", "main.js");

type QaLead = {
  leadId: string;
  type: string;
  status: string;
  listingId?: string;
  message?: string;
  marketing: boolean;
  viewing: null | { viewingId: string; status: string; mode: string; start: number; end: number };
};

/** Runs an internal Convex function against the dev deployment, without a shell (no quoting issues on Windows). */
function convexRun<T>(fn: string, args: Record<string, unknown>): T {
  const out = execFileSync(process.execPath, [CONVEX_CLI, "run", fn, JSON.stringify(args)], {
    cwd: process.cwd(),
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  // `convex run` prints nothing at all for a `null` return value.
  return (out.trim().length === 0 ? null : JSON.parse(out)) as T;
}

function e2eEmail(testInfo: TestInfo, flow: string): string {
  const stamp = `${Date.now().toString(36)}-${Math.floor(Math.random() * 1e6).toString(36)}`;
  return `e2e+${flow}-${testInfo.project.name}-${stamp}@mihajlo-estate.local`;
}

/** A decided consent and a seen preloader, so neither overlay intercepts clicks. */
async function quietVisit(page: Page, url: string) {
  await page.addInitScript(() => {
    window.localStorage.setItem(
      "me.consent.v1",
      JSON.stringify({ v: 1, decidedAt: Date.now(), categories: { necessary: true, analytics: false, marketing: false } }),
    );
    window.sessionStorage.setItem("me.preloaded.v1", "1");
  });
  await page.goto(url);
}

test.describe("listing detail — content, SEO, compliance", () => {
  test("server-renders the core content with the Art. 18 line and valid JSON-LD", async ({ page }) => {
    await quietVisit(page, `/sr/nekretnine/${LISTING}`);

    await expect(page.getByRole("heading", { level: 1 })).toContainText("Trosoban stan u Neimaru");
    await expect(page.getByTestId("listing-price")).toHaveText("430.000 €");
    await expect(page.getByTestId("listing-compliance")).toContainText("Registar posrednika br.");
    await expect(page.getByRole("heading", { name: "Osnovni podaci" })).toBeVisible();

    const blocks = await page.locator('script[type="application/ld+json"]').allTextContents();
    const graph = blocks.flatMap((text) => JSON.parse(text) as Record<string, unknown>[]);
    const listing = graph.find((node) => node["@type"] === "RealEstateListing") as Record<string, any>;
    const crumbs = graph.find((node) => node["@type"] === "BreadcrumbList") as Record<string, any>;
    expect(listing).toBeDefined();
    expect(listing.offers.price).toBe(430000);
    expect(listing.offers.priceCurrency).toBe("EUR");
    expect(listing.about["@type"]).toBe("Apartment");
    expect(listing.about.floorSize).toEqual({ "@type": "QuantitativeValue", value: 86, unitCode: "MTK" });
    // The address is only street-level public, so no geo coordinates may leak.
    expect(listing.about.geo).toBeUndefined();
    expect(crumbs.itemListElement).toHaveLength(3);

    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", new RegExp(`/sr/nekretnine/${LISTING}$`));
    await expect(page.locator('link[rel="alternate"][hreflang="ru"]')).toHaveAttribute(
      "href",
      new RegExp(`/ru/nedvizhimost/${LISTING}$`),
    );
  });

  test("the share image renders at its localized public URL", async ({ request }) => {
    const response = await request.get(`/sr/nekretnine/${LISTING}/opengraph-image`);
    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"]).toBe("image/png");
    expect((await response.body()).byteLength).toBeGreaterThan(50_000);
  });

  test("an old slug from the slug history redirects permanently", async ({ request }, testInfo) => {
    const from = `e2e-old-${testInfo.project.name}-${Date.now().toString(36)}`;
    convexRun("qa:addSlugRedirect", { from, toSlug: LISTING });
    try {
      const response = await request.get(`/sr/nekretnine/${from}`, { maxRedirects: 0 });
      expect([301, 308]).toContain(response.status());
      expect(response.headers().location).toMatch(new RegExp(`/sr/nekretnine/${LISTING}$`));
    } finally {
      convexRun("qa:removeSlugRedirect", { from });
    }
  });

  test("an unknown slug is a 404", async ({ request }) => {
    const response = await request.get("/sr/nekretnine/ne-postoji-me-9999");
    expect(response.status()).toBe(404);
  });
});

test.describe("gallery lightbox", () => {
  test("opens from the grid, follows the arrow keys and closes on Escape", async ({ page }) => {
    await quietVisit(page, `/sr/nekretnine/${LISTING}`);

    await page.getByRole("button", { name: /Otvorite fotografiju 1 od/ }).click();
    // By `src`, not `alt`: two photos of the same room share an alt text.
    const current = page.locator(".yarl__slide_current img").first();
    await expect(current).toBeVisible();
    await expect(current).toHaveAttribute("alt", /Trosoban stan u Neimaru/);
    const firstSrc = (await current.getAttribute("src")) ?? "";

    await page.keyboard.press("ArrowRight");
    await expect(page.locator(".yarl__slide_current img").first()).not.toHaveAttribute("src", firstSrc);
    await page.keyboard.press("ArrowLeft");
    await expect(page.locator(".yarl__slide_current img").first()).toHaveAttribute("src", firstSrc);

    await page.keyboard.press("Escape");
    await expect(page.locator(".yarl__container")).toHaveCount(0);
  });

  test("room chips narrow the gallery", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "chips are exercised once");
    await quietVisit(page, `/sr/nekretnine/${LISTING}`);
    const all = page.getByRole("button", { name: /Sve fotografije \((\d+)\)/ }).last();
    const before = await all.textContent();
    await page.getByRole("group", { name: "Prikaz po prostoriji" }).getByRole("button", { name: "Kuhinja" }).click();
    await expect(all).not.toHaveText(before ?? "");
  });
});

test.describe("lead flows (end to end)", () => {
  test("an inquiry creates a lead in Convex", async ({ page }, testInfo) => {
    const email = e2eEmail(testInfo, "inquiry");
    try {
      await quietVisit(page, `/sr/nekretnine/${LISTING}`);
      const form = page.getByTestId("inquiry-form");
      await form.scrollIntoViewIfNeeded();

      // Client-side validation first: consent is required.
      await form.getByRole("button", { name: "Pošaljite" }).click();
      await expect(form.getByText("Bez Vaše saglasnosti ne možemo da odgovorimo na upit.")).toBeVisible();

      await form.getByLabel("Ime i prezime").fill("E2E Test Kupac");
      await form.getByLabel("E-pošta").fill(email);
      await form.getByLabel(/Saglasan\/na sam/).check();
      await form.getByRole("button", { name: "Pošaljite" }).click();
      await expect(page.getByTestId("form-success")).toContainText("Upit je poslat");

      const leads = convexRun<QaLead[]>("qa:leadsByEmail", { email });
      expect(leads).toHaveLength(1);
      expect(leads[0].type).toBe("inquiry");
      expect(leads[0].status).toBe("new");
      expect(leads[0].message).toContain("ME-1042");
      expect(leads[0].marketing).toBe(false);
    } finally {
      convexRun("qa:purgeByEmail", { email });
    }
  });

  test("a viewing booking creates a requested viewing", async ({ page }, testInfo) => {
    const email = e2eEmail(testInfo, "viewing");
    try {
      await quietVisit(page, `/sr/nekretnine/${LISTING}#razgledanje`);
      const form = page.getByTestId("viewing-form");
      await expect(form).toBeVisible();

      // The two projects run in parallel against the same agent calendar, so
      // each books from a different end of the first free day.
      const day = form.locator("button[data-day]:not([disabled])").first();
      await day.click();
      const slots = form.locator("button[data-slot]:not([disabled])");
      await expect(slots.first()).toBeVisible();
      const slot = testInfo.project.name === "desktop" ? slots.first() : slots.last();
      const start = Number(await slot.getAttribute("data-slot"));
      await slot.click();
      await expect(form.getByText(/Izabrali ste/)).toBeVisible();

      await form.getByLabel("Video poziv").check();
      await form.getByLabel("Ime i prezime").fill("E2E Test Posetilac");
      await form.getByLabel("E-pošta").fill(email);
      await form.getByLabel(/Saglasan\/na sam/).check();
      await form.getByRole("button", { name: "Pošaljite" }).click();
      await expect(page.getByTestId("form-success")).toContainText("Zahtev za razgledanje je poslat");

      const leads = convexRun<QaLead[]>("qa:leadsByEmail", { email });
      expect(leads).toHaveLength(1);
      expect(leads[0].type).toBe("viewing");
      expect(leads[0].viewing).not.toBeNull();
      expect(leads[0].viewing?.status).toBe("requested");
      expect(leads[0].viewing?.mode).toBe("video");
      expect(leads[0].viewing?.start).toBe(start);
      expect((leads[0].viewing?.end ?? 0) - start).toBe(60 * 60_000);
    } finally {
      convexRun("qa:purgeByEmail", { email });
    }
  });
});

test.describe("closed listings", () => {
  test("a sold listing shows the ribbon and similar listings, and no form", async ({ page }) => {
    await quietVisit(page, `/sr/nekretnine/${SOLD}`);
    await expect(page.getByText("Prodato", { exact: true }).first()).toBeVisible();
    await expect(page.getByTestId("listing-closed")).toContainText("prodata");
    await expect(page.getByTestId("inquiry-form")).toHaveCount(0);
    await expect(page.getByTestId("viewing-form")).toHaveCount(0);
    await expect(page.locator("#kontakt")).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "Slične nekretnine" })).toBeVisible();
  });
});

test.describe("mobile action bar", () => {
  test("offers call, Viber, WhatsApp and booking, and Zakaži opens the booking tab", async ({ page }, testInfo) => {
    await quietVisit(page, `/sr/nekretnine/${LISTING}`);
    const bar = page.getByTestId("mobile-action-bar");
    if (testInfo.project.name === "desktop") {
      await expect(bar).toBeHidden();
      return;
    }
    await expect(bar).toBeVisible();
    await expect(bar.getByRole("link", { name: "Pozovi" })).toHaveAttribute("href", /^tel:\+381/);
    await expect(bar.getByRole("link", { name: "Viber" })).toHaveAttribute("href", /^viber:\/\/chat\?number=%2B381/);
    await expect(bar.getByRole("link", { name: "WhatsApp" })).toHaveAttribute("href", /^https:\/\/wa\.me\/381/);

    await bar.getByRole("link", { name: "Zakaži" }).click();
    await expect(page.getByRole("tab", { name: "Razgledanje" })).toHaveAttribute("aria-selected", "true");
    await expect(page.getByTestId("viewing-form")).toBeInViewport();
  });

  test("a sold listing drops the booking action", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "mobile", "phone-only bar");
    await quietVisit(page, `/sr/nekretnine/${SOLD}`);
    const bar = page.getByTestId("mobile-action-bar");
    await expect(bar).toBeVisible();
    await expect(bar.getByRole("link", { name: "Zakaži" })).toHaveCount(0);
  });
});
