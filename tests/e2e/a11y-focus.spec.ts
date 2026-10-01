import { expect, test, type Locator, type Page } from "@playwright/test";
import { ORDINARY_LISTING, presetVisitor, SHOWCASE_LISTING } from "./helpers/routes";

/**
 * Night-run step 13: focus management (PRD C "full keyboard support").
 *
 *  - The phone search filter sheet (Radix Dialog): opened from the keyboard,
 *    focus moves in and stays in, Escape closes it and focus returns to the
 *    trigger. Mobile project only (the sheet is the < 1024px filter UI).
 *  - The 360° tour and the 3D walk on ME-1049 (native modal `<dialog>`):
 *    focus moves inside, Escape closes, focus returns to the launcher. The 3D
 *    model is never waited for: the dialog is opened and closed at once.
 *  - The cookie banner on a first visit: reachable with Tab, NOT a focus trap
 *    (it is a non-modal dialog), and a decision made from the keyboard hands
 *    focus to `#main` rather than dropping it on `<body>`.
 *  - The valuation funnel: every step change puts focus on the new step's
 *    heading or its first field (never `<body>`); an empty step focuses its
 *    first invalid field. Step 2 is never submitted valid (no lead is created).
 *  - The listing inquiry form: an empty submit focuses the first invalid field
 *    and announces its error. Client validation stops it, so nothing is sent.
 *
 * Everything runs on both projects unless a case says otherwise.
 */

/* ------------------------------------------------------------------ helpers */

/** The Header publishes `--header-h` from an effect: proof the public shell has hydrated. */
async function shellHydrated(page: Page): Promise<void> {
  await expect
    .poll(() => page.evaluate(() => document.documentElement.style.getPropertyValue("--header-h")), {
      message: "the public shell should hydrate (Header writes --header-h)",
      timeout: 20_000,
    })
    .not.toBe("");
}

/** A short description of whatever has focus, for failure messages. */
function describeFocus(page: Page): Promise<string> {
  return page.evaluate(() => {
    const el = document.activeElement;
    if (el === null || el === document.body) return "<body>";
    const name = el.getAttribute("aria-label") ?? (el as HTMLElement).innerText?.trim().slice(0, 40) ?? "";
    return `<${el.tagName.toLowerCase()}${el.id ? `#${el.id}` : ""}> "${name}"`;
  });
}

/** True when nothing (or `<body>`) has focus: focus was lost. */
function focusOnBody(page: Page): Promise<boolean> {
  return page.evaluate(() => document.activeElement === null || document.activeElement === document.body);
}

/** Presses Tab until `target` has focus; fails if it is not reached within `max` presses. */
async function tabTo(page: Page, target: Locator, what: string, max = 60): Promise<number> {
  for (let presses = 1; presses <= max; presses += 1) {
    await page.keyboard.press("Tab");
    if (await target.evaluate((element) => element === document.activeElement).catch(() => false)) return presses;
  }
  throw new Error(`${what} was not reached within ${max} Tab presses (focus is on ${await describeFocus(page)})`);
}

/** True when `container` holds the focused element (or is it). */
function holdsFocus(container: Locator): Promise<boolean> {
  return container.evaluate((element) => element.contains(document.activeElement)).catch(() => false);
}

/** Picks a `<select>` option by its visible text (values are Convex ids). */
async function selectByOptionText(select: Locator, text: string): Promise<void> {
  const value = await select.evaluate((node, wanted) => {
    const options = Array.from((node as HTMLSelectElement).options);
    return options.find((option) => !option.disabled && option.textContent?.trim() === wanted)?.value ?? null;
  }, text);
  if (value === null) throw new Error(`No enabled option "${text}"`);
  await select.selectOption(value);
}

/** Focuses a control the way a keyboard user lands on it, then activates it with Enter. */
async function pressWithKeyboard(page: Page, control: Locator): Promise<void> {
  await control.scrollIntoViewIfNeeded();
  await control.focus();
  await expect(control).toBeFocused();
  await page.keyboard.press("Enter");
}

/**
 * A native modal `<dialog>` makes the page behind it inert. Tab cycles through
 * the dialog's controls and, past the last one, out to the browser's own UI
 * (the document then reports `<body>`), never to page content behind it.
 * Walks one full cycle and asserts exactly that, and that focus comes back in.
 */
async function expectModalTabCycle(page: Page, dialog: Locator, what: string): Promise<void> {
  const stops = await dialog.evaluate(
    (element) =>
      Array.from(
        element.querySelectorAll('a[href], button:not([disabled]), input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])'),
      ).filter((node) => node.checkVisibility()).length,
  );
  let returned = false;
  for (let i = 1; i <= stops + 2; i += 1) {
    await page.keyboard.press("Tab");
    const where = await dialog.evaluate((element) => {
      const active = document.activeElement;
      if (active === null || active === document.body) return "outside-document";
      return element.contains(active) ? "inside" : "behind";
    });
    expect(where, `Tab ${i} in ${what} never reaches the page behind it (focus is on ${await describeFocus(page)})`).not.toBe(
      "behind",
    );
    if (where === "inside" && i > 1) returned = true;
  }
  expect(returned, `Tab keeps cycling through ${what}`).toBe(true);
}

/**
 * Every keyboard stop inside `container` that is NOT a native control must
 * carry an interactive ARIA role and a name; native ones must have a name.
 * Returns the offenders as "tag.class (title=…): problem".
 */
function unnamedOrRolelessStops(container: Locator): Promise<string[]> {
  return container.evaluate((root) => {
    const INTERACTIVE = new Set([
      "button",
      "link",
      "checkbox",
      "radio",
      "tab",
      "menuitem",
      "menuitemcheckbox",
      "menuitemradio",
      "option",
      "slider",
      "spinbutton",
      "switch",
      "textbox",
      "combobox",
      "searchbox",
      "application",
      "gridcell",
      "treeitem",
    ]);
    const NATIVE = new Set(["A", "BUTTON", "INPUT", "SELECT", "TEXTAREA", "SUMMARY"]);
    const out: string[] = [];
    const candidates = root.querySelectorAll('a[href], button, input, select, textarea, summary, [tabindex]:not([tabindex="-1"])');
    for (const node of Array.from(candidates)) {
      const el = node as HTMLElement;
      if (el.tabIndex < 0 || (el as HTMLButtonElement).disabled === true || !el.checkVisibility()) continue;
      if (el.closest("[aria-hidden='true'], [inert]") !== null) continue;
      const role = el.getAttribute("role");
      const labelledBy = (el.getAttribute("aria-labelledby") ?? "")
        .split(/\s+/)
        .map((id) => document.getElementById(id)?.textContent?.trim() ?? "")
        .join(" ")
        .trim();
      const name = (el.getAttribute("aria-label") ?? "").trim() || labelledBy || (el.innerText ?? "").trim();
      const what = `<${el.tagName.toLowerCase()}${el.className && typeof el.className === "string" ? `.${el.className.split(" ")[0]}` : ""}${
        el.title ? ` title="${el.title}"` : ""
      }>`;
      if (!NATIVE.has(el.tagName) && (role === null || !INTERACTIVE.has(role))) {
        out.push(`${what}: focusable but has no interactive role (role=${role ?? "none"})`);
      } else if (name === "" && el.title.trim() === "" && el.tagName !== "INPUT" && el.tagName !== "SELECT" && el.tagName !== "TEXTAREA") {
        out.push(`${what}: no accessible name`);
      }
    }
    return out;
  });
}

/** Selects one of the listing's media tabs ("Fotografije, planovi i ture") from the keyboard. */
async function openMediaTab(page: Page, name: RegExp): Promise<Locator> {
  const tabs = page.getByRole("tablist", { name: "Fotografije, planovi i ture" });
  const tab = tabs.getByRole("tab", { name });
  await tab.scrollIntoViewIfNeeded();
  await tab.focus();
  // Radix tabs activate on focus (automatic mode); Enter is harmless and explicit.
  await page.keyboard.press("Enter");
  await expect(tab).toHaveAttribute("aria-selected", "true");
  return tab;
}

/* ------------------------------------------------------- phone filter sheet */

test.describe("focus: phone search filter sheet", () => {
  test("the sheet opens from the keyboard, holds focus, and Escape returns focus to the trigger @public @a11y", async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== "mobile", "the filter sheet is the phone layout (mobile project)");
    await presetVisitor(page);
    await page.goto("/sr/nekretnine");
    await expect(page.locator('[data-search-bar][data-ready="true"]')).toBeVisible({ timeout: 30_000 });

    const trigger = page.getByRole("button", { name: /^Filteri/ });
    await expect(trigger).toBeVisible();
    await tabTo(page, trigger, 'the phone "Filteri" trigger', 60);
    await page.keyboard.press("Enter");

    const sheet = page.getByRole("dialog", { name: "Filteri" });
    await expect(sheet).toBeVisible();
    // While the modal is open Radix hides the rest of the page from the
    // accessibility tree (aria-hidden), so the trigger is read by its test id.
    await expect(page.getByTestId("open-filter-sheet")).toHaveAttribute("aria-expanded", "true");
    await expect
      .poll(() => holdsFocus(sheet), { message: `focus moves into the sheet (focus is on ${await describeFocus(page)})` })
      .toBe(true);

    // Modal: Tab and Shift+Tab cycle inside the sheet.
    for (let i = 1; i <= 6; i += 1) {
      await page.keyboard.press("Tab");
      expect(await holdsFocus(sheet), `Tab ${i} keeps focus in the sheet (focus is on ${await describeFocus(page)})`).toBe(true);
    }
    for (let i = 1; i <= 3; i += 1) {
      await page.keyboard.press("Shift+Tab");
      expect(await holdsFocus(sheet), `Shift+Tab ${i} keeps focus in the sheet`).toBe(true);
    }

    await page.keyboard.press("Escape");
    await expect(sheet).toBeHidden();
    await expect(trigger, `Escape returns focus to the trigger (focus is on ${await describeFocus(page)})`).toBeFocused();
    await expect(trigger).toHaveAttribute("aria-expanded", "false");
  });
});

/* ----------------------------------------------------------- tour dialogs */

test.describe("focus: immersive viewers on ME-1049", () => {
  test.beforeEach(async ({ page }) => {
    await presetVisitor(page);
    await page.goto(`/sr/nekretnine/${SHOWCASE_LISTING}`);
    await shellHydrated(page);
  });

  test("the 360° tour dialog takes focus, Escape closes it and focus returns to the launcher @public @a11y", async ({
    page,
  }) => {
    test.setTimeout(90_000);
    await openMediaTab(page, /360° tura/);
    const launcher = page.getByRole("button", { name: "Pokrenite 360° turu" });
    await tabTo(page, launcher, "the 360° launcher", 10);
    await page.keyboard.press("Enter");

    const dialog = page.getByRole("dialog", { name: /360° tura/ });
    await expect(dialog).toBeVisible();
    await expect
      .poll(() => holdsFocus(dialog), { message: `focus moves into the 360° dialog (focus is on ${await describeFocus(page)})` })
      .toBe(true);
    await expectModalTabCycle(page, dialog, "the 360° dialog");

    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
    await expect(launcher, `Escape returns focus to the launcher (focus is on ${await describeFocus(page)})`).toBeFocused();
  });

  test("every keyboard stop in the loaded 360° viewer is a control with a role and a name @public @a11y", async ({ page }) => {
    test.setTimeout(90_000);
    await openMediaTab(page, /360° tura/);
    const launcher = page.getByRole("button", { name: "Pokrenite 360° turu" });
    await tabTo(page, launcher, "the 360° launcher", 10);
    await page.keyboard.press("Enter");

    const dialog = page.getByRole("dialog", { name: /360° tura/ });
    await expect(dialog).toBeVisible();
    // The viewer and its navbar are mounted once the panorama has painted.
    await expect(dialog.locator("[data-tour360] canvas").first()).toBeVisible({ timeout: 30_000 });
    await expect(dialog.getByRole("navigation", { name: "Prostorije" }).getByRole("button")).toHaveCount(4);

    const offenders = await unnamedOrRolelessStops(dialog);
    for (const line of offenders) console.log(`[focus] ${test.info().project.name} 360° viewer | ${line}`);
    expect(offenders, "keyboard stops in the 360° viewer without a role or a name (WCAG 4.1.2)").toEqual([]);
  });

  test("the 3D walk dialog takes focus, Escape closes it and focus returns to the launcher @public @a11y", async ({
    page,
  }) => {
    test.setTimeout(90_000);
    await openMediaTab(page, /3D šetnja/);
    const panel = page.locator('[data-tour-slot="walk3d"]');
    // The full model, or "load anyway" on a light device; without WebGL2 the 360° tour is offered instead.
    const launcher = panel.getByRole("button", { name: /Pokrenite 3D šetnju|Ipak učitajte/ });
    const instead = panel.getByRole("button", { name: "Otvorite 360° turu" });
    await expect(launcher.or(instead).first()).toBeVisible();
    const walk = await launcher.isVisible();
    const target = walk ? launcher : instead;
    test.info().annotations.push({ type: "walk3d", description: walk ? "3D launcher" : "no WebGL2: the 360° fallback" });

    await tabTo(page, target, walk ? "the 3D walk launcher" : "the 360° fallback button", 12);
    await page.keyboard.press("Enter");

    const dialog = page.getByRole("dialog", { name: walk ? /3D šetnja/ : /360° tura/ });
    await expect(dialog).toBeVisible();
    await expect
      .poll(() => holdsFocus(dialog), { message: `focus moves into the walk dialog (focus is on ${await describeFocus(page)})` })
      .toBe(true);

    // Not waiting for the 43 MB model: Escape mid-download.
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
    await expect(target, `Escape returns focus to the launcher (focus is on ${await describeFocus(page)})`).toBeFocused();
  });
});

/* ----------------------------------------------------------- cookie banner */

test.describe("focus: cookie banner (first visit)", () => {
  for (const path of ["/sr", "/sr/kontakt"]) {
    test(`${path}: the banner is reachable with Tab, does not trap focus, and a keyboard decision hands focus to #main @public @a11y`, async ({
      page,
    }) => {
      test.setTimeout(120_000);
      // Intro curtain already seen, consent NOT decided: the banner shows.
      await page.addInitScript(() => {
        window.sessionStorage.setItem("me.preloaded.v1", "1");
        window.localStorage.removeItem("me.consent.v1");
      });
      await page.goto(path);
      await shellHydrated(page);

      const banner = page.getByRole("dialog", { name: "Kolačići" });
      await expect(banner).toBeVisible({ timeout: 15_000 });
      // Non-modal by design (component doc): the page stays usable.
      expect(await banner.getAttribute("aria-modal"), "the banner is not modal").not.toBe("true");

      // Forward Tab from the top of the page reaches the banner.
      let reached = 0;
      for (let presses = 1; presses <= 250; presses += 1) {
        await page.keyboard.press("Tab");
        if (await holdsFocus(banner)) {
          reached = presses;
          break;
        }
      }
      expect(reached, "Tab reaches the cookie banner within 250 presses").toBeGreaterThan(0);
      console.log(`[focus] cookie banner reached after ${reached} Tab presses (${test.info().project.name})`);

      // It does not trap: tabbing on leaves it within (its own stops + 1) presses.
      const stops = await banner.evaluate(
        (element) =>
          element.querySelectorAll('a[href], button:not([disabled]), input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])')
            .length,
      );
      let left = false;
      for (let i = 0; i <= stops + 1 && !left; i += 1) {
        await page.keyboard.press("Tab");
        left = !(await holdsFocus(banner));
      }
      expect(left, `Tab moves focus out of the banner (it has ${stops} stops; focus is on ${await describeFocus(page)})`).toBe(true);

      // Backwards too: Shift+Tab re-enters, then leaves towards the page.
      let back = false;
      for (let i = 0; i <= stops + 3 && !back; i += 1) {
        await page.keyboard.press("Shift+Tab");
        back = await holdsFocus(banner);
      }
      expect(back, "Shift+Tab returns into the banner").toBe(true);
      let out = false;
      for (let i = 0; i <= stops + 1 && !out; i += 1) {
        await page.keyboard.press("Shift+Tab");
        out = !(await holdsFocus(banner));
      }
      expect(out, `Shift+Tab leaves the banner (focus is on ${await describeFocus(page)})`).toBe(true);

      // A decision made from the keyboard does not drop focus on <body>.
      const necessaryOnly = banner.getByRole("button", { name: "Samo neophodni" });
      await pressWithKeyboard(page, necessaryOnly);
      await expect(banner).toHaveCount(0);
      expect(await focusOnBody(page), "after the decision focus is not lost to <body>").toBe(false);
      await expect(page.locator("#main"), "the decision hands focus to #main").toBeFocused();
    });
  }
});

/* --------------------------------------------------------- valuation funnel */

test.describe("focus: valuation funnel", () => {
  test.beforeEach(async ({ page }) => {
    await presetVisitor(page);
    await page.goto("/sr/procena");
    await shellHydrated(page);
    await expect(page.getByTestId("valuation-step-1")).toBeVisible();
  });

  test("an empty step focuses its first invalid field, and every step change focuses the new step, never <body> @public @forms @a11y", async ({
    page,
  }) => {
    const funnel = page.getByTestId("valuation-funnel");
    const step1 = funnel.getByTestId("valuation-step-1");
    const next = step1.getByRole("button", { name: "Nastavite" });

    // 1. Empty step 1: the first invalid field takes focus.
    await pressWithKeyboard(page, next);
    const location = step1.getByLabel("Lokacija", { exact: true });
    await expect(location, `the first invalid field is focused (focus is on ${await describeFocus(page)})`).toBeFocused();
    await expect(location).toHaveAttribute("aria-invalid", "true");
    await expect(location).toHaveAccessibleDescription(/\S/);

    // 2. Step 1 → step 2: focus on the step-2 heading (or its first field).
    await selectByOptionText(location, "Neimar");
    await step1.getByLabel("Tip nekretnine").selectOption("apartment");
    await step1.getByLabel("Kvadratura (m²)").fill("64");
    await step1.getByLabel("Struktura").selectOption("2");
    await step1.getByLabel("Sprat", { exact: true }).selectOption("3");
    await step1.getByLabel("Poslednji sprat zgrade").selectOption("5");
    await step1.getByLabel("Lift", { exact: true }).selectOption("yes");
    await step1.getByLabel("Stanje", { exact: true }).selectOption("renovated");
    await pressWithKeyboard(page, next);

    const step2 = funnel.getByTestId("valuation-step-2");
    await expect(step2).toBeVisible();
    const heading2 = funnel.getByRole("heading", { level: 2, name: /Vaši kontakt podaci/ });
    const name = step2.getByLabel("Ime i prezime");
    await expect
      .poll(async () => (await heading2.evaluate((el) => el === document.activeElement)) || (await name.evaluate((el) => el === document.activeElement)), {
        message: `step 2 focuses its heading or first field (focus is on ${await describeFocus(page)})`,
      })
      .toBe(true);
    expect(await focusOnBody(page)).toBe(false);
    // The heading is announced with the step position.
    await expect(heading2).toHaveAccessibleName(/Korak 2 od 3/);

    // 3. An empty step 2 (never valid, so no lead is created) focuses the first invalid field.
    const submit = step2.getByRole("button", { name: "Prikažite procenu" });
    await pressWithKeyboard(page, submit);
    await expect(name, `the first invalid contact field is focused (focus is on ${await describeFocus(page)})`).toBeFocused();
    await expect(name).toHaveAttribute("aria-invalid", "true");

    // 4. Back to step 1: focus on the step-1 heading (or its first field), not <body>.
    await pressWithKeyboard(page, step2.getByRole("button", { name: "Nazad" }));
    await expect(step1).toBeVisible();
    const heading1 = funnel.getByRole("heading", { level: 2, name: /Opišite nekretninu/ });
    await expect
      .poll(
        async () =>
          (await heading1.evaluate((el) => el === document.activeElement)) ||
          (await step1.getByLabel("Lokacija", { exact: true }).evaluate((el) => el === document.activeElement)),
        { message: `back on step 1, focus is on its heading or first field (focus is on ${await describeFocus(page)})` },
      )
      .toBe(true);
    expect(await focusOnBody(page)).toBe(false);
    // The answers survived the round trip.
    await expect(step1.getByLabel("Kvadratura (m²)")).toHaveValue("64");
  });
});

/* ----------------------------------------------------------- inquiry form */

test.describe("focus: listing inquiry form", () => {
  test("an empty submit focuses the first invalid field and announces every error @public @forms @a11y", async ({ page }) => {
    await presetVisitor(page);
    await page.goto(`/sr/nekretnine/${ORDINARY_LISTING}`);
    await shellHydrated(page);

    const form = page.getByTestId("inquiry-form");
    await expect(form).toBeVisible();
    const name = form.getByLabel("Ime i prezime");
    const email = form.getByLabel("E-pošta");
    const privacy = form.getByRole("checkbox", { name: /Saglasan\/na sam/ });
    const submit = form.getByRole("button", { name: "Pošaljite" });

    // Reach the submit button from the name field with Tab, as a keyboard user would.
    await name.scrollIntoViewIfNeeded();
    await name.focus();
    await tabTo(page, submit, "the inquiry submit button", 12);
    await page.keyboard.press("Enter");

    await expect(name, `focus moves to the first invalid field (focus is on ${await describeFocus(page)})`).toBeFocused();
    for (const [key, field] of [
      ["name", name],
      ["email", email],
      ["privacy", privacy],
    ] as const) {
      await expect(field, `${key} is marked invalid`).toHaveAttribute("aria-invalid", "true");
      await expect(field, `${key} is described by its error`).toHaveAccessibleDescription(/\S/);
      const describedBy = (await field.getAttribute("aria-describedby")) ?? "";
      expect(describedBy, `${key} has aria-describedby`).not.toBe("");
      const message = page.locator(`[id="${describedBy.split(/\s+/)[0]}"]`);
      await expect(message, `${key}'s error is announced`).toHaveRole("alert");
      await expect(message).toHaveText(/\S/);
    }
    // Nothing was sent.
    await expect(page.getByTestId("form-success")).toHaveCount(0);
  });
});
