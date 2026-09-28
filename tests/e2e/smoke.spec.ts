import { expect, test, type ConsoleMessage, type Page } from "@playwright/test";

/**
 * Step 04 added the cookie banner, which covers the bottom of the viewport, and
 * moved the language switcher into the header (where it is hidden below 768px
 * and lives in the mobile menu instead). Both helpers below exist so these
 * smoke tests keep asserting the same things through the real shell.
 */
async function dismissConsent(page: Page) {
  const banner = page.getByRole("dialog").filter({ hasText: /kolačić|cookie|файл|Cookies/i });
  if (await banner.isVisible().catch(() => false)) {
    await banner.getByRole("button").first().click();
    await expect(banner).toBeHidden();
  }
}

/** Reveals the language switcher, opening the mobile menu when necessary. */
async function openLocaleSwitcher(page: Page) {
  const menuToggle = page.getByRole("button", { name: /otvori meni|open menu|Menü|меню/i });
  if (await menuToggle.isVisible().catch(() => false)) {
    await menuToggle.click();
    await expect(page.getByRole("dialog", { name: /meni|menu|Menü|меню/i })).toBeVisible();
  }
}

const LOCALES = [
  { prefix: "/sr", lang: "sr-Latn" },
  { prefix: "/en", lang: "en" },
  { prefix: "/ru", lang: "ru" },
  { prefix: "/de", lang: "de" },
] as const;

/** Collects console errors and page errors so tests can assert a clean console. */
function watchConsole(page: Page) {
  const errors: string[] = [];

  page.on("console", (message: ConsoleMessage) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("pageerror", (error) => errors.push(error.message));

  return errors;
}

test("/ redirects to the default locale", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/sr\/?$/);
});

for (const { prefix, lang } of LOCALES) {
  test(`${prefix} renders with lang="${lang}" and no console errors`, async ({ page }) => {
    const errors = watchConsole(page);

    const response = await page.goto(prefix);
    expect(response?.status()).toBe(200);

    await expect(page.locator("html")).toHaveAttribute("lang", lang);
    await expect(page.locator("h1")).toBeVisible();
    await dismissConsent(page);

    expect(errors, `console errors on ${prefix}:\n${errors.join("\n")}`).toEqual([]);
  });
}

test("the locale switcher keeps the visitor on the same route", async ({ page }) => {
  await page.goto("/sr");
  await dismissConsent(page);
  await openLocaleSwitcher(page);
  await page.getByRole("button", { name: "Русский" }).filter({ visible: true }).first().click();
  await expect(page).toHaveURL(/\/ru\/?$/);
  await expect(page.locator("html")).toHaveAttribute("lang", "ru");
});

test("both font families expose their CSS variables", async ({ page }) => {
  await page.goto("/sr");
  await dismissConsent(page);

  const fonts = await page.evaluate(() => {
    const style = getComputedStyle(document.documentElement);
    const h1 = document.querySelector("h1");
    return {
      display: style.getPropertyValue("--font-display-family").trim(),
      sans: style.getPropertyValue("--font-sans-family").trim(),
      mono: style.getPropertyValue("--font-mono-family").trim(),
      h1Family: h1 ? getComputedStyle(h1).fontFamily : "",
    };
  });

  expect(fonts.display).not.toBe("");
  expect(fonts.sans).not.toBe("");
  expect(fonts.mono).not.toBe("");
  expect(fonts.h1Family).toContain("Cormorant");
});

test("/admin/login renders inside the admin root layout", async ({ page }) => {
  const errors = watchConsole(page);

  const response = await page.goto("/admin/login");
  expect(response?.status()).toBe(200);

  await expect(page.locator("html")).toHaveAttribute("lang", "sr-Latn");
  await expect(page.locator("body")).toHaveClass(/admin/);
  await expect(page.getByRole("heading", { level: 1, name: "Administracija" })).toBeVisible();
  await expect(page.getByLabel("E-pošta")).toBeVisible();
  await expect(page.getByLabel("Lozinka")).toBeVisible();

  // No public chrome and no Lenis in the admin tree.
  await expect(page.locator("[data-lenis-stopped], .lenis")).toHaveCount(0);
  await expect(page.locator("nav[aria-label='Srpski']")).toHaveCount(0);

  expect(errors, `console errors on /admin/login:\n${errors.join("\n")}`).toEqual([]);
});

test("the admin section is excluded from the locale proxy", async ({ page }) => {
  const response = await page.goto("/admin/login");
  expect(response?.url()).toContain("/admin/login");
  expect(response?.url()).not.toMatch(/\/(sr|en|ru|de)\/admin/);
});

test("public pages are served with the project CSP", async ({ page }) => {
  const response = await page.goto("/sr");
  const csp = response?.headers()["content-security-policy"] ?? "";

  expect(csp).toContain("default-src 'self'");
  expect(csp).toContain("frame-ancestors 'none'");
  expect(response?.headers()["x-content-type-options"]).toBe("nosniff");
});
