import { expect, test, type Page, type TestInfo } from "@playwright/test";
import { convexRun } from "./helpers/admin";
import { ORDINARY_LISTING, presetVisitor } from "./helpers/routes";

/**
 * Review 14, public site: regressions for the verified findings.
 *
 *  1. A gallery left open when the visitor goes Back must not leave Lenis
 *     stopped: the previous page has to scroll (desktop, wheel).
 *  2. With site storage blocked (reading `window.localStorage` throws a
 *     SecurityError) the site renders instead of the global error page, and
 *     the cookie banner still closes for the visit.
 *  4. Switching between the inquiry and booking tabs keeps what was typed.
 *  5. A sent inquiry puts focus on its confirmation, and "send another" puts
 *     it back in the form, never on <body>. This one writes a lead
 *     (`e2e+…@mihajlo-estate.local`), purged with `qa:purgeByEmail`.
 */

function e2eEmail(testInfo: TestInfo, flow: string): string {
  const stamp = `${Date.now().toString(36)}-${Math.floor(Math.random() * 1e6).toString(36)}`;
  return `e2e+${flow}-${testInfo.project.name}-${stamp}@mihajlo-estate.local`;
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

test.describe("review 14: Lenis after a gallery closed by Back", () => {
  test("the search page scrolls again after Back from a listing with the gallery open @public", async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "wheel scrolling through Lenis is the desktop case");
    await presetVisitor(page);
    await page.goto("/sr/nekretnine");
    await expect(page.locator('[data-search-bar][data-ready="true"]')).toBeVisible({ timeout: 30_000 });

    // Client-side navigation into a listing, then the lightbox.
    await page.getByTestId("results-list").locator("article h3 a").first().click();
    await expect(page).toHaveURL(/\/sr\/nekretnine\/[a-z0-9-]+$/);
    await page.getByRole("button", { name: /Otvorite fotografiju 1 od/ }).click();
    await expect(page.locator(".yarl__container")).toBeVisible();
    await expect(page.locator("html"), "the open gallery holds the page still").toHaveClass(/\blenis-stopped\b/);

    // Back unmounts the listing page with the gallery still open.
    await page.goBack();
    await expect(page).toHaveURL(/\/sr\/nekretnine(\?.*)?$/);
    await expect(page.locator(".yarl__container")).toHaveCount(0);
    await expect(page.locator("html")).not.toHaveClass(/\blenis-stopped\b/);

    // A stopped Lenis swallows the wheel, so this proves it is running: the
    // pointer sits over the result list (the left column, the map is right).
    await expect(page.getByTestId("results-list")).toBeVisible();
    const viewport = page.viewportSize();
    if (viewport === null) throw new Error("the desktop project has a viewport");
    const before = await page.evaluate(() => window.scrollY);
    await page.mouse.move(Math.round(viewport.width * 0.25), Math.round(viewport.height * 0.6));
    await page.mouse.wheel(0, 700);
    await expect
      .poll(() => page.evaluate(() => window.scrollY), { message: "the wheel scrolls the search page" })
      .toBeGreaterThan(before + 100);
  });
});

test.describe("review 14: site storage blocked", () => {
  test("the home page renders and the cookie banner closes for the visit @public", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.addInitScript(() => {
      // Intro curtain already seen, so the banner is not waiting behind it.
      window.sessionStorage.setItem("me.preloaded.v1", "1");
      // What Chrome and Safari do when the visitor blocks site data.
      Object.defineProperty(window, "localStorage", {
        configurable: true,
        get() {
          throw new DOMException("Access is denied for this document.", "SecurityError");
        },
      });
    });
    await page.goto("/sr");

    // The banner only appears once the client is up, and the global error
    // page (whose h1 is "Nešto nije u redu") has no banner. Nothing is
    // stored, so the visitor counts as undecided.
    const banner = page.getByRole("dialog", { name: "Kolačići" });
    await expect(banner).toBeVisible({ timeout: 15_000 });
    const heading = page.getByRole("heading", { level: 1 });
    await expect(heading).toBeVisible();
    await expect(heading).not.toHaveText("Nešto nije u redu");

    // The choice cannot be stored, but it holds in memory for the visit.
    await banner.getByRole("button", { name: "Samo neophodni" }).click();
    await expect(banner).toHaveCount(0);

    expect(errors, "no uncaught page errors").toEqual([]);
  });
});

test.describe("review 14: listing contact forms", () => {
  test("switching between Upit and Razgledanje keeps what the visitor typed @public @forms", async ({ page }) => {
    await presetVisitor(page);
    await page.goto(`/sr/nekretnine/${ORDINARY_LISTING}`);
    await shellHydrated(page);

    const tabs = page.getByRole("tablist", { name: "Način kontakta" });
    const inquiryTab = tabs.getByRole("tab", { name: "Upit", exact: true });
    const viewingTab = tabs.getByRole("tab", { name: "Razgledanje", exact: true });
    const inquiry = page.getByTestId("inquiry-form");
    const viewing = page.getByTestId("viewing-form");

    await inquiry.scrollIntoViewIfNeeded();
    await inquiry.getByLabel("Ime i prezime").fill("E2E Test Upit");

    await viewingTab.click();
    await expect(viewingTab).toHaveAttribute("aria-selected", "true");
    await expect(viewing).toBeVisible();
    // The inactive form stays mounted but hidden: out of sight and out of the tab order.
    await expect(inquiry).toBeHidden();
    await viewing.getByLabel("Ime i prezime").fill("E2E Test Razgledanje");

    await inquiryTab.click();
    await expect(inquiry.getByLabel("Ime i prezime")).toHaveValue("E2E Test Upit");
    await expect(viewing).toBeHidden();

    await viewingTab.click();
    await expect(viewing.getByLabel("Ime i prezime")).toHaveValue("E2E Test Razgledanje");
  });

  test("a sent inquiry focuses its confirmation; \"send another\" focuses the form again @public @forms", async ({
    page,
  }, testInfo) => {
    const email = e2eEmail(testInfo, "focus");
    try {
      await presetVisitor(page);
      await page.goto(`/sr/nekretnine/${ORDINARY_LISTING}`);
      await shellHydrated(page);

      const form = page.getByTestId("inquiry-form");
      await form.scrollIntoViewIfNeeded();
      await form.getByLabel("Ime i prezime").fill("E2E Test Fokus");
      await form.getByLabel("E-pošta").fill(email);
      await form.getByLabel(/Saglasan\/na sam/).check();
      await form.getByRole("button", { name: "Pošaljite" }).click();

      const success = page.getByTestId("form-success");
      await expect(success).toContainText("Upit je poslat");
      // The panel's wrapper (tabIndex -1) holds focus, not <body>.
      await expect(success.locator("..")).toBeFocused();

      await success.getByRole("button", { name: "Pošaljite novi upit" }).click();
      await expect(page.getByTestId("inquiry-form").getByLabel("Ime i prezime")).toBeFocused();
    } finally {
      convexRun("qa:purgeByEmail", { email });
    }
  });
});
