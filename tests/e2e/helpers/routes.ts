import { expect, type Page } from "@playwright/test";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../convex/_generated/api";
import { pathnames, type Locale } from "../../../i18n/routing";
import { convexUrl } from "./admin";

/**
 * Route + page-settling helpers shared by the step-12 crawl and a11y specs.
 * `localizedPath` and `realSlugs` follow pages-routes.spec.ts exactly: the
 * localized segment comes from the router's own table and the dynamic slugs
 * are read from the public Convex queries, so nothing here can drift from the
 * app or the deployment.
 */

export type Route = keyof typeof pathnames;

/** Seeded demo listings (the same constants tours.spec.ts / listing-detail.spec.ts use). */
export const SHOWCASE_LISTING = "penthaus-na-24-spratu-u-beogradu-na-vodi-pogled-na-savu-me-1049";
export const ORDINARY_LISTING = "trosoban-stan-u-neimaru-renoviran-2023-me-1042";

/** `/sr/lokacije/dorcol` from the router's own table. */
export function localizedPath(route: Route, locale: Locale, slug?: string): string {
  const entry = pathnames[route];
  const segment = typeof entry === "string" ? entry : entry[locale];
  const prefix = locale === "sr-Latn" ? "/sr" : `/${locale}`;
  const path = slug === undefined ? segment : segment.replace("[slug]", slug);
  return `${prefix}${path === "/" ? "" : path}`;
}

export type Slugs = { location: string; agent: string; post: string; listingIds: string[] };

/**
 * One neighborhood with listings, one public agent, one published post that no
 * other spec created for itself (it may be deleted mid-run), and two listing ids
 * to seed the favorites / compare stores with.
 */
export async function realSlugs(): Promise<Slugs> {
  const client = new ConvexHttpClient(convexUrl());
  const [tree, agents, posts, listings] = await Promise.all([
    client.query(api.locations.tree, {}),
    client.query(api.agents.list, {}),
    client.query(api.posts.list, { paginationOpts: { numItems: 20, cursor: null } }),
    client.query(api.listings.search, {
      filters: { transaction: "sale" },
      sort: "newest",
      paginationOpts: { numItems: 4, cursor: null },
    }),
  ]);
  const neighborhood = tree.find((node) => node.kind === "neighborhood" && node.saleCount + node.rentCount > 0);
  const agent = agents[0];
  const post = posts.page.find((entry) => !entry.slug.startsWith("e2e-"));
  const listingIds = listings.page.slice(0, 2).map((card) => card._id as string);
  if (neighborhood === undefined || agent === undefined || post === undefined || listingIds.length < 2) {
    throw new Error("the deployment needs a neighborhood with listings, a public agent, a published post and two listings");
  }
  return { location: neighborhood.slug, agent: agent.slug, post: post.slug, listingIds };
}

/**
 * Consent decided and the intro curtain seen before any page script runs, so
 * neither overlay intercepts input (same keys as helpers/admin.ts
 * `quietPublicPage`). `categories` lets the crawl accept everything, which is
 * the stricter case for a CSP check: anything consent-gated would load.
 */
export async function presetVisitor(
  page: Page,
  options: { acceptAll?: boolean; favorites?: string[]; compare?: string[] } = {},
): Promise<void> {
  await page.addInitScript((opts) => {
    const all = opts.acceptAll === true;
    window.localStorage.setItem(
      "me.consent.v1",
      JSON.stringify({ v: 1, decidedAt: Date.now(), categories: { necessary: true, analytics: all, marketing: all } }),
    );
    window.sessionStorage.setItem("me.preloaded.v1", "1");
    if (opts.favorites !== undefined) {
      window.localStorage.setItem("me.favorites.v1", JSON.stringify({ v: 1, ids: opts.favorites }));
    }
    if (opts.compare !== undefined) {
      window.localStorage.setItem("me.compare.v1", JSON.stringify({ v: 1, ids: opts.compare }));
    }
  }, options);
}

/** A native jump; Lenis adopts a native scroll position when it is not mid-glide (landing.spec.ts). */
export async function scrollToY(page: Page, y: number): Promise<void> {
  const target = Math.round(y);
  await page.evaluate((top) => window.scrollTo(0, top), target);
  await expect
    .poll(
      () =>
        page.evaluate((top) => {
          // A page shorter than the target settles at its own maximum.
          const max = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
          return Math.abs(window.scrollY - Math.min(top, max));
        }, target),
      { message: `window.scrollY should settle at ${target}` },
    )
    .toBeLessThan(3);
}

/**
 * Walks the page top to bottom in viewport-sized steps, re-reading the height
 * each step (lazy sections and pin spacers grow it), so every lazy image, map
 * and scroll trigger mounts.
 */
export async function scrollThrough(page: Page, step = 700): Promise<void> {
  let y = 0;
  for (let guard = 0; guard < 80; guard += 1) {
    const max = await page.evaluate(() => Math.max(0, document.documentElement.scrollHeight - window.innerHeight));
    if (y >= max) break;
    y = Math.min(y + step, max);
    await scrollToY(page, y);
  }
}

/**
 * Settled = no finite CSS/Web animation is running and no element's inline
 * style (where GSAP writes) changed across one 250 ms sample. Replaces a fixed
 * "wait for the slowest reveal" sleep: axe reads a half-faded line as low
 * contrast, so it must only run on the final paint.
 */
export async function waitForVisualSettle(page: Page, timeout = 15_000): Promise<void> {
  await expect
    .poll(
      () =>
        page.evaluate(async () => {
          const signature = () =>
            Array.from(document.querySelectorAll("body [style]"))
              .map((element) => element.getAttribute("style") ?? "")
              .join("|");
          const running = () =>
            document.getAnimations().filter((animation) => {
              if (animation.playState !== "running") return false;
              const end = animation.effect?.getComputedTiming().endTime;
              return typeof end === "number" && Number.isFinite(end);
            }).length;
          const before = signature();
          await new Promise((resolve) => setTimeout(resolve, 250));
          return running() === 0 && signature() === before;
        }),
      { message: "the page should stop animating", timeout, intervals: [0] },
    )
    .toBe(true);
}
