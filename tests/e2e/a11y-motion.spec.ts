import { expect, test, type Page } from "@playwright/test";
import { presetVisitor, scrollToY, SHOWCASE_LISTING } from "./helpers/routes";

/**
 * Night-run step 13: reduced motion (PRD C, CLAUDE.md "Respect
 * prefers-reduced-motion everywhere").
 *
 * With `prefers-reduced-motion: reduce`, on home, search, listing ME-1049 and
 * about:
 *  - Lenis never mounts (no `html.lenis`),
 *  - nothing is pinned (no ScrollTrigger `.pin-spacer`),
 *  - every heading below the fold is already painted (effective opacity 1,
 *    `visibility: visible`) right after it is scrolled into view: the page is
 *    walked in viewport steps and each newly visible heading is read two
 *    animation frames after the jump, with no settle wait in between.
 *
 * Runs on both projects (pins only exist from 1024px up; the desktop project
 * is the one that would show them).
 */

test.use({ reducedMotion: "reduce" });

/** The Header publishes `--header-h` from an effect: proof the public shell has hydrated. */
async function shellHydrated(page: Page): Promise<void> {
  await expect
    .poll(() => page.evaluate(() => document.documentElement.style.getPropertyValue("--header-h")), {
      message: "the public shell should hydrate (Header writes --header-h)",
      timeout: 20_000,
    })
    .not.toBe("");
}

type HeadingRead = { text: string; tag: string; top: number; opacity: number; visibility: string };

/**
 * Two frames after a scroll jump, reads every heading that has just entered
 * the viewport and lies below the initial fold. Each heading is read once.
 */
function readNewHeadings(page: Page, fold: number): Promise<HeadingRead[]> {
  return page.evaluate(async (foldY) => {
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    const w = window as unknown as { __a11ySeen?: WeakSet<Element> };
    w.__a11ySeen ??= new WeakSet();
    const seen = w.__a11ySeen;
    const out: HeadingRead[] = [];
    for (const heading of Array.from(document.querySelectorAll("h1, h2, h3, h4, [role='heading']"))) {
      if (seen.has(heading)) continue;
      // display:none / closed dialogs / inactive tab panels are not "on the page".
      if (!heading.checkVisibility()) continue;
      const rect = heading.getBoundingClientRect();
      if (rect.width === 0 && rect.height === 0) continue;
      const top = rect.top + window.scrollY;
      if (top < foldY) {
        seen.add(heading);
        continue;
      }
      if (rect.bottom <= 0 || rect.top >= window.innerHeight) continue;
      seen.add(heading);
      let opacity = 1;
      for (let node: Element | null = heading; node !== null; node = node.parentElement) {
        opacity *= Number(getComputedStyle(node).opacity);
      }
      out.push({
        text: (heading.textContent ?? "").trim().replace(/\s+/g, " ").slice(0, 60),
        tag: heading.tagName.toLowerCase(),
        top: Math.round(top),
        opacity: Math.round(opacity * 1000) / 1000,
        visibility: getComputedStyle(heading).visibility,
      });
    }
    return out;
  }, fold);
}

type Target = { label: string; path: string; ready?: string };

const PAGES: Target[] = [
  { label: "home", path: "/sr" },
  { label: "search", path: "/sr/nekretnine", ready: '[data-search-bar][data-ready="true"]' },
  { label: "listing ME-1049", path: `/sr/nekretnine/${SHOWCASE_LISTING}` },
  { label: "about", path: "/sr/o-nama" },
];

test.describe("reduced motion: no Lenis, no pins, headings painted on arrival", () => {
  for (const target of PAGES) {
    test(`${target.label}: no Lenis, no pinned sections, below-the-fold headings visible at once @public @a11y`, async ({
      page,
    }, testInfo) => {
      test.setTimeout(120_000);
      await presetVisitor(page);
      const response = await page.goto(target.path);
      expect(response?.status()).toBe(200);
      await shellHydrated(page);
      if (target.ready !== undefined) await expect(page.locator(target.ready)).toBeVisible({ timeout: 30_000 });
      expect(await page.evaluate(() => matchMedia("(prefers-reduced-motion: reduce)").matches)).toBe(true);

      await expect(page.locator("html"), "Lenis must not mount under reduced motion").not.toHaveClass(/\blenis\b/);
      await expect(page.locator(".pin-spacer"), "nothing is pinned under reduced motion").toHaveCount(0);

      const fold = await page.evaluate(() => window.innerHeight);
      const reads: HeadingRead[] = [];
      let y = 0;
      for (let guard = 0; guard < 80; guard += 1) {
        const max = await page.evaluate(() => Math.max(0, document.documentElement.scrollHeight - window.innerHeight));
        if (y >= max) break;
        y = Math.min(y + Math.round(fold * 0.8), max);
        await scrollToY(page, y);
        reads.push(...(await readNewHeadings(page, fold)));
      }

      for (const read of reads) {
        console.log(
          `[motion] ${testInfo.project.name} ${target.path} | ${read.tag} @${read.top} | opacity ${read.opacity} | ${read.visibility} | "${read.text}"`,
        );
      }
      expect(reads.length, "the page has headings below the fold to judge").toBeGreaterThan(0);

      // Still no Lenis and no pins once everything below has mounted.
      await expect(page.locator("html")).not.toHaveClass(/\blenis\b/);
      await expect(page.locator(".pin-spacer")).toHaveCount(0);

      const hidden = reads
        .filter((read) => read.opacity < 1 || read.visibility !== "visible")
        .map((read) => `${read.tag} "${read.text}" @${read.top}px: opacity ${read.opacity}, visibility ${read.visibility}`);
      expect(hidden, `headings not painted right after scrolling to them on ${target.path}`).toEqual([]);
    });
  }
});
