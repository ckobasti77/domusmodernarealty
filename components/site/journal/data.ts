import "server-only";

import { fetchQuery } from "convex/nextjs";
import { unstable_rethrow } from "next/navigation";
import { cache } from "react";
import { api } from "@/convex/_generated/api";
import type { PostCategory } from "@/convex/lib/validators";
import { htmlToText } from "@/lib/content/pages";
import { JOURNAL_PAGE_SIZE, POST_CATEGORIES } from "./shared";

/**
 * Server reads for the journal (PRD A11). `cache()` lets `generateMetadata`
 * and the page share one Convex round trip. The list and the article itself
 * fail loudly (the route's error page); the extras around an article —
 * related posts, listings, the category filter — degrade to nothing, so a
 * slow side query never takes the article down with it.
 */

function settled<T, F>(result: PromiseSettledResult<T>, fallback: F, label: string): T | F {
  if (result.status === "fulfilled") return result.value;
  // Next's own dynamic-rendering signal must reach Next, not the log.
  unstable_rethrow(result.reason);
  console.error(`[journal] ${label} failed:`, result.reason);
  return fallback;
}

/** The first page of published posts, newest first, optionally in one category. */
export const getJournalPage = cache(async (category: PostCategory | undefined) => {
  return await fetchQuery(api.posts.list, {
    ...(category !== undefined ? { category } : {}),
    paginationOpts: { numItems: JOURNAL_PAGE_SIZE, cursor: null },
  });
});

/**
 * The categories that hold at least one published post, in the filter's
 * order: the filter never offers a topic that leads to an empty page. A
 * failed probe keeps its category (an extra link beats a missing one).
 */
export const getPopulatedCategories = cache(async (): Promise<PostCategory[]> => {
  const probes = await Promise.allSettled(
    POST_CATEGORIES.map((category) =>
      fetchQuery(api.posts.list, { category, paginationOpts: { numItems: 1, cursor: null } }),
    ),
  );
  return POST_CATEGORIES.filter((category, index) => {
    const probe = probes[index];
    if (probe === undefined) return false;
    const first = settled(probe, null, `posts.list(${category})`);
    return first === null || first.page.length > 0;
  });
});

/** One published post by slug, or `null` (unknown, draft or scheduled). */
export const getPost = cache(async (slug: string) => {
  return await fetchQuery(api.posts.bySlug, { slug });
});

export async function getArticleExtras(slug: string) {
  const [related, listings] = await Promise.allSettled([
    fetchQuery(api.posts.related, { slug, limit: 3 }),
    fetchQuery(api.listings.featured, { limit: 3 }),
  ]);
  return {
    related: settled(related, [], "posts.related"),
    listings: settled(listings, [], "listings.featured"),
    // The server's clock for the "Novo" badge on the listing cards.
    now: Date.now(),
  };
}

/** Reading time at ~200 words a minute, for a post saved without one. */
export function readingMinutes(html: string): number {
  const words = htmlToText(html).split(" ").filter((word) => word.length > 0).length;
  return Math.max(1, Math.round(words / 200));
}
