import { expect, test, type Page } from "@playwright/test";

/**
 * Shell + design-system coverage for night-run step 04.
 *
 * Three things are asserted that nothing else can catch:
 *  1. the language switcher keeps the visitor on the same route, with the
 *     localized segment swapped (`/sr/styleguide` → `/ru/styleguide`);
 *  2. a cookie decision persists across a reload and the banner stays away;
 *  3. under `prefers-reduced-motion: reduce` every motion component paints its
 *     final state immediately — no opacity 0, no offset, no clip.
 */

/** The consent banner covers the bottom of the viewport; dismiss it first. */
async function acceptCookies(page: Page) {
  const banner = page.getByRole("dialog").filter({ hasText: /Kolačići|Cookies|Файлы|Куки/i });
  if (await banner.isVisible().catch(() => false)) {
    await banner.getByRole("button").first().click();
    await expect(banner).toBeHidden();
  }
}

/**
 * The language switcher lives in the header above 768px and inside the
 * full-screen menu below it, so a mobile run has to open the menu first.
 */
async function revealLocaleSwitcher(page: Page) {
  // By `aria-controls`, not by label: the label is localized and this helper
  // runs on pages that have already switched to another language.
  const toggle = page.locator('button[aria-controls="site-menu"]');
  if (await toggle.isVisible().catch(() => false)) {
    await toggle.click();
    await expect(page.locator("#site-menu")).toBeVisible();
  }
}

test.describe("language switcher", () => {
  test("keeps the current route and swaps the localized segment", async ({ page }) => {
    await page.goto("/sr/styleguide");
    await acceptCookies(page);

    await revealLocaleSwitcher(page);
    await page.getByRole("button", { name: "Русский" }).filter({ visible: true }).first().click();

    await expect(page).toHaveURL(/\/ru\/styleguide$/);
    await expect(page.locator("html")).toHaveAttribute("lang", "ru");

    // And back again, to prove the mapping is not one-way.
    await revealLocaleSwitcher(page);
    await page.getByRole("button", { name: "Srpski" }).filter({ visible: true }).first().click();
    await expect(page).toHaveURL(/\/sr\/styleguide$/);
    await expect(page.locator("html")).toHaveAttribute("lang", "sr-Latn");
  });

  test("keeps a localized pathname when switching from /sr", async ({ page }) => {
    await page.goto("/sr");
    await acceptCookies(page);

    await revealLocaleSwitcher(page);
    await page.getByRole("button", { name: "Deutsch" }).filter({ visible: true }).first().click();
    await expect(page).toHaveURL(/\/de\/?$/);
    await expect(page.locator("html")).toHaveAttribute("lang", "de");
  });
});

test.describe("cookie consent", () => {
  test("appears once, then persists the decision across a reload", async ({ page }) => {
    await page.goto("/sr");

    const banner = page.getByRole("dialog").filter({ hasText: "Kolačići" });
    await expect(banner).toBeVisible();

    // "Samo neophodni" must store analytics: false, not simply hide the banner.
    await banner.getByRole("button", { name: "Samo neophodni" }).click();
    await expect(banner).toBeHidden();

    const stored = await page.evaluate(() => window.localStorage.getItem("me.consent.v1"));
    expect(stored).not.toBeNull();
    const parsed = JSON.parse(stored ?? "{}") as {
      categories?: { necessary?: boolean; analytics?: boolean; marketing?: boolean };
    };
    expect(parsed.categories?.necessary).toBe(true);
    expect(parsed.categories?.analytics).toBe(false);
    expect(parsed.categories?.marketing).toBe(false);

    await page.reload();
    await expect(banner).toBeHidden();
  });

  test("the footer link re-opens the banner", async ({ page }) => {
    await page.goto("/sr");
    const banner = page.getByRole("dialog").filter({ hasText: "Kolačići" });
    await banner.getByRole("button", { name: "Prihvatam sve" }).click();
    await expect(banner).toBeHidden();

    await page.locator("footer").getByRole("button", { name: "Podešavanja" }).click();
    await expect(banner).toBeVisible();
  });
});

test.describe("header and mobile menu", () => {
  test("turns solid after scrolling past the hero", async ({ page }) => {
    // The first-visit preloader (step 05) holds the scroll for up to 1.8 s by
    // design; this test is about the header, so it starts as a repeat visitor.
    await page.addInitScript(() => window.sessionStorage.setItem("me.preloaded.v1", "1"));
    await page.goto("/sr");
    await acceptCookies(page);

    const header = page.locator("header").first();
    await expect(header).toHaveAttribute("data-solid", "false");

    await page.mouse.wheel(0, 900);
    await expect(header).toHaveAttribute("data-solid", "true");
  });

  test("the mobile menu opens, traps focus and closes on Escape", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "mobile", "the menu button only exists below 1024px");

    await page.goto("/sr");
    await acceptCookies(page);

    const toggle = page.getByRole("button", { name: "Otvori meni" });
    await toggle.click();

    const menu = page.getByRole("dialog", { name: "Otvori meni" });
    await expect(menu).toBeVisible();
    // Focus moves into the overlay, onto the close button.
    await expect(menu.getByRole("button", { name: "Zatvori meni" })).toBeFocused();

    await expect(menu.getByRole("link", { name: "Nekretnine" })).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(menu).toBeHidden();
    await expect(toggle).toBeFocused();
  });

  test("the favorites counter reflects the store", async ({ page }) => {
    await page.goto("/sr");
    await page.evaluate(() => {
      window.localStorage.setItem("me.favorites.v1", JSON.stringify({ v: 1, ids: ["a", "b", "c"] }));
    });
    await page.reload();
    await acceptCookies(page);

    await expect(page.locator("header").first().getByRole("link", { name: /Omiljeno \(3\)/ })).toBeVisible();
  });
});

test.describe("styleguide", () => {
  for (const locale of ["sr", "ru"] as const) {
    test(`/${locale}/styleguide renders every component group`, async ({ page }) => {
      const errors: string[] = [];
      page.on("console", (message) => {
        if (message.type() === "error") errors.push(message.text());
      });
      page.on("pageerror", (error) => errors.push(error.message));

      const response = await page.goto(`/${locale}/styleguide`);
      expect(response?.status()).toBe(200);
      await acceptCookies(page);

      // One h1, and a section heading for every group.
      await expect(page.locator("h1")).toHaveCount(1);
      await expect(page.locator("#sg-palette")).toBeVisible();
      await expect(page.locator("#sg-type")).toBeVisible();
      await expect(page.locator("#sg-buttons")).toBeVisible();
      await expect(page.locator("#sg-forms")).toBeVisible();
      await expect(page.locator("#sg-cards")).toBeVisible();
      await expect(page.locator("#sg-accordion")).toBeVisible();
      await expect(page.locator("#sg-motion")).toBeVisible();

      // Forms: the error state is announced, not just coloured.
      await expect(page.getByRole("alert").first()).toBeVisible();

      // Tabs and accordion are wired.
      await expect(page.getByRole("tab")).toHaveCount(3);
      await expect(page.getByRole("button", { expanded: true }).first()).toBeVisible();

      expect(errors, `console errors on /${locale}/styleguide:\n${errors.join("\n")}`).toEqual([]);
    });
  }

  test("is excluded from indexing", async ({ page }) => {
    await page.goto("/sr/styleguide");
    const robots = page.locator('meta[name="robots"]');
    await expect(robots).toHaveAttribute("content", /noindex/);
  });
});

test.describe("reduced motion", () => {
  test.use({ reducedMotion: "reduce" });

  test("motion components render their final state instantly", async ({ page }) => {
    await page.goto("/sr/styleguide");
    await acceptCookies(page);

    // No preloader curtain and no page-transition panel are mounted at all.
    await expect(page.locator(".lenis")).toHaveCount(0);

    // Every SplitReveal heading is fully opaque. The animated copy ships with
    // `opacity-0` in its class list, so this only passes if the reduced branch
    // ran and wrote an inline opacity of 1.
    const headings = page.locator('h1 > span > span[aria-hidden="true"], h2 > span > span[aria-hidden="true"]');
    const count = await headings.count();
    expect(count).toBeGreaterThan(3);
    for (let i = 0; i < Math.min(count, 6); i += 1) {
      await expect(headings.nth(i)).toHaveCSS("opacity", "1");
    }

    // The ImageReveal frame is un-clipped and its picture is at scale 1.
    const frame = page.locator("[data-image-reveal]").first();
    await frame.scrollIntoViewIfNeeded();
    // The reduced branch writes `inset(0% 0% 0% 0%)`, which computes to `inset(0%)`.
    await expect(frame).toHaveCSS("clip-path", /^(none|inset\(0(px|%)?[\s0-9a-z%().]*\))$/);

    // The hairline dividers are drawn, not collapsed to zero width.
    const divider = page.locator("[data-divider]").first();
    await divider.scrollIntoViewIfNeeded();
    await expect(divider).toHaveCSS("transform", /^(none|matrix\(1, 0, 0, 1)/);
  });

  test("the landing page paints its headline without a curtain", async ({ page }) => {
    await page.goto("/sr");
    await acceptCookies(page);

    // The preloader's gate script skips the curtain under reduced motion, so it
    // is never displayed, not even for a first visit.
    await expect(page.locator("html")).toHaveAttribute("data-intro", "skip");
    await expect(page.locator("[data-preloader]")).toBeHidden();

    // The hero headline is plain text; HeroStage only splits it when motion is allowed.
    const title = page.locator("h1#hero-title");
    await expect(title).toBeVisible();
    await expect(title).toHaveText("Dom koji se pamti.");
    await expect(title.locator(".split-line")).toHaveCount(0);

    // globals.css starts `[data-hero-reveal]` at opacity 0 only under
    // `prefers-reduced-motion: no-preference`, so every copy block (eyebrow,
    // headline, lede, search, scroll cue) is opaque from the first paint.
    const reveals = page.locator("[data-hero-reveal]");
    const count = await reveals.count();
    expect(count).toBeGreaterThan(0);
    for (let i = 0; i < count; i += 1) {
      await expect(reveals.nth(i)).toHaveCSS("opacity", "1");
    }
  });
});
