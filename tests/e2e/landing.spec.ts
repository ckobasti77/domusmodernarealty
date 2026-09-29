import { expect, test, type Locator, type Page } from "@playwright/test";

/**
 * Landing page (night-run step 05; PRD A2, DESIGN §6).
 *
 * What is asserted here and nowhere else:
 *  1. every section is server-rendered from Convex with the demo data's
 *     counts, the page has one h1, the testimonials section does not exist
 *     (no testimonial is verified) and the console stays clean while the whole
 *     page is scrolled through;
 *  2. the hero search (bar from 768px, bottom sheet on phones) and the
 *     valuation mini-form route to their localized pages with the chosen
 *     filters. Those pages are built in later steps, so only the URL is
 *     asserted;
 *  3. under `prefers-reduced-motion: reduce` nothing pins, Lenis is absent and
 *     every animated element paints its final state;
 *  4. with motion on a desktop, the featured rail and the tours stage pin, and
 *     the rail's "01 / 06" counter follows the scroll.
 */

/** Every titled section, in page order. The intro statement has no heading. */
const SECTION_IDS = [
  "hero-title",
  "featured-title",
  "neighborhoods-title",
  "services-title",
  "tours-title",
  "process-title",
  "numbers-title",
  "valuation-title",
  "journal-title",
  "final-title",
] as const;

const LISTING_HREF = /^\/sr\/nekretnine\/[a-z0-9-]+$/;
const AREA_ERROR = "Unesite kvadraturu između 10 i 5.000 m².";
/** A computed `clip-path` that hides nothing: `none`, or an inset with every edge at zero. */
const OPEN_CLIP = /^(none|inset\(0(px|%)?( 0(px|%)?){0,3}\))$/;

/* ------------------------------------------------------------------ helpers */

/**
 * Starts as a repeat visitor (the first-visit preloader holds the scroll for
 * ~1.8s by design and is not what these tests are about), then answers the
 * cookie banner the way a visitor does.
 */
async function visit(page: Page) {
  await page.addInitScript(() => window.sessionStorage.setItem("me.preloaded.v1", "1"));
  const response = await page.goto("/sr");
  expect(response?.status()).toBe(200);
  await dismissConsent(page);
}

/**
 * The banner mounts only after hydration, so waiting for it (instead of a
 * one-shot `isVisible()`) is also the hydration barrier every post-hydration
 * assertion below relies on.
 */
async function dismissConsent(page: Page) {
  const banner = page.getByRole("dialog").filter({ hasText: "Kolačići" });
  await banner.getByRole("button", { name: "Samo neophodni" }).click();
  await expect(banner).toBeHidden();
}

/** Console errors and uncaught page errors, from the moment it is called. */
function watchConsole(page: Page): string[] {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(`console.error: ${message.text()}`);
  });
  page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
  return errors;
}

function section(page: Page, id: string): Locator {
  return page.locator(`section[aria-labelledby="${id}"]`);
}

/** Opacity as painted: the element's own multiplied by every ancestor's. */
function paintedOpacity(locator: Locator): Promise<number> {
  return locator.evaluate((element) => {
    let value = 1;
    for (let node: Element | null = element; node !== null; node = node.parentElement) {
      value *= Number(getComputedStyle(node).opacity);
    }
    return value;
  });
}

/** Scale factors of the computed `transform` (`none` is 1 × 1). */
function computedScale(locator: Locator): Promise<{ x: number; y: number }> {
  return locator.evaluate((element) => {
    const m = new DOMMatrixReadOnly(getComputedStyle(element).transform);
    return { x: Math.hypot(m.a, m.b), y: Math.hypot(m.c, m.d) };
  });
}

function viewportTop(locator: Locator): Promise<number> {
  return locator.evaluate((element) => element.getBoundingClientRect().top);
}

/**
 * The scroll range over which `pinned` is held, read from the `.pin-spacer`
 * ScrollTrigger wrapped it in: from the spacer's top to its top plus the
 * padding the pin added.
 */
function pinRange(pinned: Locator): Promise<{ start: number; end: number }> {
  return pinned.evaluate((element: HTMLElement) => {
    const spacer = element.parentElement ?? element;
    const start = spacer.getBoundingClientRect().top + window.scrollY;
    return { start, end: start + spacer.offsetHeight - element.offsetHeight };
  });
}

/**
 * The featured rail's native horizontal scroller: the whole track on a wide
 * screen, the card list below 1024px. `null` when neither overflows.
 */
async function featuredScroller(page: Page): Promise<Locator | null> {
  for (const selector of ["[data-featured-viewport]", "[data-featured-list]"]) {
    const candidate = page.locator(selector);
    if (await candidate.evaluate((element) => element.scrollWidth > element.clientWidth + 1)) return candidate;
  }
  return null;
}

/** A native jump; Lenis adopts a native scroll position when it is not mid-glide. */
async function scrollToY(page: Page, y: number) {
  const target = Math.round(y);
  await page.evaluate((top) => window.scrollTo(0, top), target);
  await expect
    .poll(() => page.evaluate((top) => Math.abs(window.scrollY - top), target), {
      message: `window.scrollY should settle at ${target}`,
    })
    .toBeLessThan(2);
}

/* -------------------------------------------------------------- the content */

test.describe("landing content", () => {
  test("renders every section from Convex data, one h1, no testimonials and a clean console @public", async ({
    page,
  }, testInfo) => {
    const errors = watchConsole(page);
    await visit(page);

    // One h1: the hero headline.
    await expect(page.locator("h1")).toHaveCount(1);
    await expect(page.locator("h1")).toHaveId("hero-title");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Dom koji se pamti.");

    for (const id of SECTION_IDS) {
      await expect(section(page, id), `section[aria-labelledby="${id}"]`).toHaveCount(1);
      await expect(page.locator(`#${id}`), `#${id}`).toHaveAccessibleName(/\S/);
    }

    // No verified testimonial exists in the demo data, so there is no section at all.
    await expect(page.locator("#testimonials-title")).toHaveCount(0);
    await expect(section(page, "testimonials-title")).toHaveCount(0);

    // The intro statement follows the hero: a statement, not a titled section.
    const intro = page.locator('section[aria-labelledby="hero-title"] + section');
    await expect(intro).toHaveCount(1);
    await expect(intro).not.toHaveAttribute("aria-labelledby");
    await expect(intro.locator("h1, h2, h3, h4, h5, h6")).toHaveCount(0);
    await expect(intro).toContainText("Verujemo da se prava nekretnina ne bira");
    await expect(intro).toContainText("Mihajlo Estate, Beograd");

    // Featured: the six demo listings, each one link to its page, with price, €/m² and area.
    const featured = section(page, "featured-title");
    const cards = featured.locator("[data-featured-card]");
    await expect(cards).toHaveCount(6);
    for (let i = 0; i < 6; i += 1) {
      const card = cards.nth(i);
      await expect(card.getByRole("link")).toHaveAttribute("href", LISTING_HREF);
      await expect(card).toContainText("€/m²");
      await expect(card).toContainText(/\d m²/);
    }
    await expect(featured.locator("[data-featured-index]").locator("..")).toHaveText("01 / 06");

    // Neighborhoods: featured locations with their listing counts, each linking to its page.
    const rows = section(page, "neighborhoods-title").locator("[data-hood-row]");
    await expect(rows.first()).toBeAttached();
    const rowCount = await rows.count();
    expect(rowCount).toBeGreaterThan(0);
    expect(rowCount).toBeLessThanOrEqual(8);
    for (let i = 0; i < rowCount; i += 1) {
      // `locator("a")`, not the link role: below 1024px places 7+ are hidden
      // by design (a phone shows six), which removes them from the a11y tree.
      await expect(rows.nth(i).locator("a")).toHaveAttribute("href", /^\/sr\/lokacije\/[a-z0-9-]+$/);
      await expect(rows.nth(i)).toContainText(/\d+ nekretnin[ae]/);
    }
    if (testInfo.project.name === "mobile") {
      await expect(rows.filter({ visible: true })).toHaveCount(Math.min(rowCount, 6));
    }

    // Services: the six numbered services.
    await expect(section(page, "services-title").locator("ol > li")).toHaveCount(6);

    // Tours: the primary CTA opens one of the featured listings, the one carrying a tour.
    const tourCta = section(page, "tours-title").getByRole("link", { name: "Pogledajte 3D turu" });
    await expect(tourCta).toHaveAttribute("href", LISTING_HREF);
    const tourHref = await tourCta.getAttribute("href");
    const tourCard = cards.filter({ has: page.locator(`a[href="${tourHref}"]`) });
    await expect(tourCard).toHaveCount(1);
    await expect(tourCard).toContainText("3D tura");

    // Process: five steps along one rail.
    const process = section(page, "process-title");
    await expect(process.locator("[data-process-step]")).toHaveCount(5);
    await expect(process.locator("[data-process-line]")).toHaveCount(1);

    // Numbers: the four settings stats, labelled as demo values while they are seeded.
    const numbers = section(page, "numbers-title");
    await expect(numbers.locator("dl > div")).toHaveCount(4);
    await expect(numbers.getByText(/^Demo vrednosti/)).toBeVisible();

    // Valuation: the mini-form.
    const valuation = section(page, "valuation-title");
    await expect(valuation.getByLabel("Lokacija")).toBeVisible();
    await expect(valuation.getByLabel("Kvadratura")).toBeVisible();
    await expect(valuation.getByRole("button", { name: "Započnite procenu" })).toBeVisible();

    // Journal: the three newest posts, each one link to the post.
    const posts = section(page, "journal-title").locator("article");
    await expect(posts).toHaveCount(3);
    for (let i = 0; i < 3; i += 1) {
      await expect(posts.nth(i).getByRole("link")).toHaveAttribute("href", /^\/sr\/magazin\/[a-z0-9-]+$/);
    }

    // Final CTA: every channel the agency publishes in settings, each a named link.
    const final = section(page, "final-title");
    for (const prefix of ["tel:", "viber://", "https://wa.me/", "mailto:"]) {
      const channel = final.locator(`a[href^="${prefix}"]`);
      await expect(channel, `a[href^="${prefix}"]`).toHaveCount(1);
      await expect(channel).toHaveAccessibleName(/\S/);
    }

    // Scroll the whole page so every lazy image, film and scroll trigger runs.
    for (const id of SECTION_IDS) await section(page, id).scrollIntoViewIfNeeded();
    const footer = page.locator("footer").last();
    await footer.scrollIntoViewIfNeeded();
    await expect(footer).toBeInViewport();

    expect(errors, `console errors on /sr:\n${errors.join("\n")}`).toEqual([]);
  });
});

/* ------------------------------------------------------------- hero search */

test.describe("hero search", () => {
  test("desktop bar: Zakup, a location with rentals and a budget route to the search @public @forms", async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "the bar is shown from 768px; phones get the sheet");
    await visit(page);

    const form = page.getByRole("form", { name: "Pretraga nekretnina" });
    await expect(form).toBeVisible();
    await expect(page.getByRole("button", { name: "Pretražite nekretnine" })).toBeHidden();

    const sale = form.getByRole("button", { name: "Kupovina" });
    const rent = form.getByRole("button", { name: "Zakup" });
    await expect(sale).toHaveAttribute("aria-pressed", "true");
    await expect(rent).toHaveAttribute("aria-pressed", "false");

    await rent.click();
    await expect(rent).toHaveAttribute("aria-pressed", "true");
    await expect(sale).toHaveAttribute("aria-pressed", "false");

    // A rent budget is a monthly figure: the ladder is swapped with the transaction.
    const budget = form.getByLabel("Budžet");
    await expect(budget.locator("option")).toHaveText([
      "Bez ograničenja",
      "Do 500 €",
      "Do 800 €",
      "Do 1.200 €",
      "Do 2.000 €",
      "Do 3.500 €",
    ]);

    // Only locations with at least one rental are offered now; take one of them.
    const location = form.getByLabel("Lokacija");
    const slugs = (
      await location.locator("option").evaluateAll((options: HTMLOptionElement[]) => options.map((option) => option.value))
    ).filter((value) => value.length > 0);
    expect(slugs.length, "locations offered for rent").toBeGreaterThan(0);
    for (const slug of slugs) expect(slug).toMatch(/^[a-z0-9-]+$/);
    const slug = slugs[slugs.length - 1];

    await location.selectOption(slug);
    await budget.selectOption("1200");
    await form.getByRole("button", { name: "Pretražite", exact: true }).click();

    await expect(page).toHaveURL(`/sr/nekretnine?transaction=rent&location=${slug}&priceMax=1200`);
  });

  test("phone sheet: Kupovina and a location route to the search @public @forms", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "mobile", "the sheet replaces the bar below 768px");
    await visit(page);

    await expect(page.getByRole("form", { name: "Pretraga nekretnina" })).toBeHidden();
    await page.getByRole("button", { name: "Pretražite nekretnine" }).click();

    const sheet = page.getByRole("dialog", { name: "Pretraga nekretnina" });
    await expect(sheet).toBeVisible();

    const sale = sheet.getByRole("button", { name: "Kupovina" });
    await sale.click();
    await expect(sale).toHaveAttribute("aria-pressed", "true");
    await expect(sheet.getByRole("button", { name: "Zakup" })).toHaveAttribute("aria-pressed", "false");

    const location = sheet.getByLabel("Lokacija");
    const slugs = await location
      .locator("option")
      .evaluateAll((options: HTMLOptionElement[]) => options.map((option) => option.value));
    const slug = slugs.includes("vracar") ? "vracar" : slugs.find((value) => value.length > 0);
    expect(slug, "a location offered for sale").toBeDefined();

    await location.selectOption(slug ?? "");
    await sheet.getByRole("button", { name: "Pretražite", exact: true }).click();

    await expect(page).toHaveURL(`/sr/nekretnine?transaction=sale&location=${slug}`);
  });
});

/* ------------------------------------------------------ valuation mini-form */

test.describe("valuation mini-form", () => {
  test("an implausible area is stopped inline, a valid one opens the prefilled valuation @public @forms", async ({
    page,
  }) => {
    await visit(page);

    // Scoped: "Lokacija" also labels the hero search.
    const valuation = section(page, "valuation-title");
    const area = valuation.getByLabel("Kvadratura");
    const submit = valuation.getByRole("button", { name: "Započnite procenu" });

    await area.fill("5");
    await submit.click();

    const alert = valuation.getByRole("alert");
    await expect(alert).toHaveText(AREA_ERROR);
    await expect(area).toHaveAttribute("aria-invalid", "true");
    await expect(area).toHaveAccessibleDescription(AREA_ERROR);
    await expect(page).toHaveURL("/sr");

    // Editing the value withdraws the message.
    await area.fill("68");
    await expect(alert).toHaveCount(0);
    await expect(area).toHaveAttribute("aria-invalid", "false");

    await valuation.getByLabel("Lokacija").selectOption("vracar");
    await submit.click();

    await expect(page).toHaveURL("/sr/procena?location=vracar&area=68");
  });

  test("reads the Serbian decimal comma: 68,5 m² opens the valuation with 69 @public @forms @i18n", async ({
    page,
  }) => {
    await visit(page);

    const valuation = section(page, "valuation-title");
    await valuation.getByLabel("Lokacija").selectOption("vracar");
    await valuation.getByLabel("Kvadratura").fill("68,5");
    await valuation.getByRole("button", { name: "Započnite procenu" }).click();

    await expect(page).toHaveURL("/sr/procena?location=vracar&area=69");
  });
});

/* ---------------------------------------------------------- reduced motion */

test.describe("reduced motion", () => {
  test.use({ reducedMotion: "reduce" });

  test("nothing pins or smooth-scrolls, and every section paints its final state @public", async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "pinning and the wide rail only exist from 1024px up");
    await visit(page);

    // Hydration barrier for the motion islands: the hero's reduced branch writes an inline opacity.
    await expect(page.locator('[data-hero-reveal="title"]')).toHaveAttribute("style", /opacity: 1/);

    // No preloader, no Lenis, no pinning.
    await expect(page.locator("html")).toHaveAttribute("data-intro", "skip");
    await expect(page.locator("[data-preloader]")).toBeHidden();
    await expect(page.locator("html")).not.toHaveClass(/\blenis\b/);
    await expect(page.locator(".pin-spacer")).toHaveCount(0);

    // First the final state, read before anything has been scrolled to. With
    // motion allowed, every one of these waits for a scroll trigger instead.

    // The hero copy is opaque from the first paint.
    const reveals = page.locator("[data-hero-reveal]");
    const revealCount = await reveals.count();
    expect(revealCount).toBeGreaterThan(0);
    for (let i = 0; i < revealCount; i += 1) await expect(reveals.nth(i)).toHaveCSS("opacity", "1");

    // Staggered rows, cards and steps are all painted.
    const staggered = await page
      .locator("[data-hood-label], [data-featured-card], [data-process-body], section[aria-labelledby='services-title'] ol > li")
      .evaluateAll((elements) =>
        elements
          .map((element) => {
            let value = 1;
            for (let node: Element | null = element; node !== null; node = node.parentElement) {
              value *= Number(getComputedStyle(node).opacity);
            }
            return value;
          })
          .filter((value) => value !== 1),
      );
    expect(staggered, "elements painted below full opacity").toEqual([]);

    // Image frames are open: `none`, or an inset with every edge at zero.
    const frames = page.locator("[data-clip-reveal]");
    const clips = await frames.evaluateAll((elements) => elements.map((element) => getComputedStyle(element).clipPath));
    expect(clips.length).toBeGreaterThan(0);
    for (const clip of clips) expect(clip, "[data-clip-reveal] clip-path").toMatch(OPEN_CLIP);

    // The process rail is drawn in full and the tours window is simply open.
    expect((await computedScale(page.locator("[data-process-line]"))).y, "[data-process-line] scaleY").toBeCloseTo(1, 3);
    expect((await computedScale(page.locator("[data-tours-window]"))).x, "[data-tours-window] scale").toBeCloseTo(1, 3);

    // Counters already show their final figures (the motion branch resets them to 0
    // until they scroll in). The expected figure is the accessible twin minus the
    // decorative prefix/suffix.
    const numbers = section(page, "numbers-title");
    const counters = numbers.locator("[data-counter-value]");
    await expect(counters).toHaveCount(4);
    const expected = await counters.evaluateAll((values) =>
      values.map((value) => {
        const root = value.parentElement;
        const twin = root?.querySelector(".sr-only")?.textContent ?? "";
        const first = root?.firstElementChild;
        const prefix = first !== null && first !== undefined && !first.classList.contains("sr-only") ? (first.textContent ?? "") : "";
        const suffix = value.nextElementSibling?.textContent ?? "";
        return twin.slice(prefix.length, twin.length - suffix.length);
      }),
    );
    for (const figure of expected) expect(figure, "sr-Latn integer").toMatch(/^\d{1,3}(\.\d{3})*$/);
    expect(await counters.allTextContents(), "counters before scrolling").toEqual(expected);

    // Then the page is walked top to bottom, the way a reader would.

    // Every section can be reached and its title read.
    for (const id of SECTION_IDS) {
      const heading = page.locator(`#${id}`);
      await heading.scrollIntoViewIfNeeded();
      await expect(heading, `#${id}`).toBeInViewport();
      // SplitReveal paints an aria-hidden copy that starts at opacity 0.
      const painted = heading.locator("[data-split]");
      const target = (await painted.count()) > 0 ? painted.first() : heading;
      expect(await paintedOpacity(target), `#${id} painted opacity`).toBe(1);
    }
    const intro = page.locator('section[aria-labelledby="hero-title"] + section p').first();
    await intro.scrollIntoViewIfNeeded();
    expect(await paintedOpacity(intro), "intro statement painted opacity").toBe(1);

    // Nothing closes a frame as it enters the view.
    for (let i = 0; i < clips.length; i += 1) {
      await frames.nth(i).scrollIntoViewIfNeeded();
      expect(await frames.nth(i).evaluate((element) => getComputedStyle(element).clipPath)).toMatch(OPEN_CLIP);
    }

    // The counters hold their figures for ~20 frames (a third of a second) from
    // the moment they enter the view: nothing counts up.
    const samples = await numbers.evaluate(async (root) => {
      root.scrollIntoView({ block: "center" });
      const values = Array.from(root.querySelectorAll("[data-counter-value]"));
      const seen: string[][] = [];
      for (let frame = 0; frame < 20; frame += 1) {
        await new Promise((resolve) => requestAnimationFrame(resolve));
        seen.push(values.map((value) => value.textContent ?? ""));
      }
      return seen;
    });
    for (const sample of samples) expect(sample).toEqual(expected);

    // Featured: a native horizontal scroller instead of the pinned rail.
    const found = await featuredScroller(page);
    expect(found, "[data-featured-viewport] or [data-featured-list] overflows horizontally").not.toBeNull();
    if (found === null) return;
    const scroller = found;

    await scroller.scrollIntoViewIfNeeded();
    const before = await scroller.evaluate((element) => element.scrollLeft);
    await scroller.evaluate((element) => {
      element.scrollLeft += 400;
    });
    await expect.poll(() => scroller.evaluate((element) => element.scrollLeft)).toBeGreaterThan(before);

    // The counter follows a native scroll too: at the far end it names the last card.
    const cardCount = await page.locator("[data-featured-card]").count();
    await scroller.evaluate((element) => {
      element.scrollLeft = element.scrollWidth;
    });
    await expect(page.locator("[data-featured-index]")).toHaveText(String(cardCount).padStart(2, "0"));
  });
});

/* ----------------------------------------------------- desktop choreography */

test.describe("desktop choreography", () => {
  test("the featured rail and the tours stage pin, and the rail counter follows the scroll @public", async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "pinning only exists from 1024px up");
    await visit(page);

    const rail = page.locator("[data-featured-pin]");
    const stage = page.locator("[data-tours-window]").locator("..");
    // ScrollTrigger wraps every pinned element in a `.pin-spacer`.
    await expect(rail.locator("..")).toHaveClass(/\bpin-spacer\b/);
    await expect(stage.locator("..")).toHaveClass(/\bpin-spacer\b/);

    const index = page.locator("[data-featured-index]");
    await expect(index).toHaveText("01");

    // 40% into the rail's range: the rail holds at the top and the counter has moved on.
    const railRange = await pinRange(rail);
    await scrollToY(page, railRange.start + (railRange.end - railRange.start) * 0.4);
    await expect(index).not.toHaveText("01");
    await expect.poll(async () => Math.abs(await viewportTop(rail)), { message: "rail held at the top" }).toBeLessThan(1);

    // The tours stage holds too, while its window opens from 58% towards full bleed.
    const stageRange = await pinRange(stage);
    await scrollToY(page, stageRange.start + (stageRange.end - stageRange.start) * 0.25);
    await expect.poll(async () => Math.abs(await viewportTop(stage)), { message: "stage held at the top" }).toBeLessThan(1);
    const early = (await computedScale(page.locator("[data-tours-window]"))).x;
    expect(early).toBeGreaterThan(0.58);
    expect(early).toBeLessThan(1);

    await scrollToY(page, stageRange.start + (stageRange.end - stageRange.start) * 0.75);
    await expect.poll(async () => Math.abs(await viewportTop(stage)), { message: "stage held at the top" }).toBeLessThan(1);
    await expect.poll(async () => (await computedScale(page.locator("[data-tours-window]"))).x).toBeGreaterThan(early);

    // And through Lenis, the way a visitor scrolls: back into the rail, then the wheel.
    // Past the stage the counter reads the last card; the rail being held at the top
    // again is the sign the jump back has been processed (same ScrollTrigger update).
    await scrollToY(page, railRange.start + (railRange.end - railRange.start) * 0.2);
    await expect.poll(async () => Math.abs(await viewportTop(rail)), { message: "rail held at the top" }).toBeLessThan(1);
    const from = Number(await index.textContent());
    expect(from, "counter 20% into the rail").toBeLessThan(await page.locator("[data-featured-card]").count());
    await page.mouse.move(720, 450);
    await page.mouse.wheel(0, 700);
    await expect.poll(async () => Number(await index.textContent())).toBeGreaterThan(from);
  });

  test("after the cookie banner closes, the featured rail pins at the section top without a jump @public", async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "pinning only exists from 1024px up");
    // `visit` answers the banner, which clears `--consent-h` and shortens the hero above the rail.
    await visit(page);

    const rail = page.locator("[data-featured-pin]");
    await expect(rail.locator("..")).toHaveClass(/\bpin-spacer\b/);
    const { start } = await pinRange(rail);

    // Ten pixels past the point where the rail reaches the top it must already be held
    // there. A pin that engages late lets the rail scroll off the top first and then
    // snap back down when it catches up.
    await scrollToY(page, start + 10);
    await expect
      .poll(() => viewportTop(rail), {
        message: "top of [data-featured-pin] 10px into its pin range (0 = pinned; negative = scrolled off, the pin engages late)",
      })
      .toBeCloseTo(0, 0);
  });
});

/* ------------------------------------------------- the first-visit banner */

/**
 * On a first visit the cookie banner is up, and the hero reserves its height
 * from the first paint (`html[data-consent="pending"]`). The hero's search must
 * sit fully above the banner in every locale, including the long German and
 * Russian headlines on short screens.
 */
test.describe("first visit: the cookie banner never covers the hero", () => {
  const VIEWPORTS = [
    [360, 740],
    [390, 844],
    [1024, 768],
    [1280, 800],
    [1440, 900],
  ] as const;

  for (const [width, height] of VIEWPORTS) {
    for (const locale of ["sr", "en", "ru", "de"] as const) {
      test(`/${locale} at ${width}x${height} @public`, async ({ browser }, testInfo) => {
        test.skip(testInfo.project.name !== "desktop", "sets its own viewport; one project is enough");
        const context = await browser.newContext({
          baseURL: testInfo.project.use.baseURL,
          viewport: { width, height },
          isMobile: width < 500,
          hasTouch: width < 1024,
        });
        try {
          await context.addInitScript(() => window.sessionStorage.setItem("me.preloaded.v1", "1"));
          const page = await context.newPage();
          await page.goto(`/${locale}`);

          await expect(page.locator("html")).toHaveAttribute("data-consent", "pending");
          const banner = page.getByRole("dialog").first();
          await expect(banner).toBeVisible();

          const search = page.locator('section[aria-labelledby="hero-title"] [data-hero-reveal="search"]');
          const bannerBox = await banner.boundingBox();
          const searchBox = await search.boundingBox();
          expect(bannerBox).not.toBeNull();
          expect(searchBox).not.toBeNull();
          if (bannerBox === null || searchBox === null) return;
          expect(searchBox.y + searchBox.height, "the hero search ends above the banner").toBeLessThanOrEqual(bannerBox.y);
        } finally {
          await context.close();
        }
      });
    }
  }
});
