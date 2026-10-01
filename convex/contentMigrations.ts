import { v } from "convex/values";
import { internalMutation } from "./_generated/server";
import { logActivity } from "./lib/activity";
import { applyDerived, locationNamesFor } from "./lib/derive";
import { FIRST_REF_NUMBER, formatRef } from "./lib/slug";
import type { L10n, L10nList } from "./lib/validators";
import { SEED_AGENTS } from "./seed/agents";
import { LISTING_COPY_1 } from "./seed/content/listings1";
import type { SeedListingCopy } from "./seed/content/listings1";
import { LISTING_COPY_2 } from "./seed/content/listings2";
import { LISTING_COPY_3 } from "./seed/content/listings3";
import { PAGE_CONTENT, SETTINGS_COPY } from "./seed/content/pages";
import { POST_COPY } from "./seed/content/posts";
import { SEED_LOCATIONS } from "./seed/locations";
import { SEED_LISTINGS } from "./seed/spec";

/**
 * One-off content migrations, run from the CLI against the dev deployment:
 *
 *   npx convex run contentMigrations:refreshSeededPages '{}'
 *   npx convex run contentMigrations:refreshSeededCopy '{}'
 */

/** Deep equality for stored JSON values, independent of object key order. */
function sameValue(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (Array.isArray(a) || Array.isArray(b)) {
    return Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((item, i) => sameValue(item, b[i]));
  }
  if (typeof a !== "object" || typeof b !== "object" || a === null || b === null) return false;
  const left = Object.entries(a).filter(([, value]) => value !== undefined);
  const right = new Map(Object.entries(b).filter(([, value]) => value !== undefined));
  return left.length === right.size && left.every(([key, value]) => right.has(key) && sameValue(value, right.get(key)));
}

/**
 * Rewrites the blocks of every page that is still untouched seeded demo
 * content from the current `PAGE_CONTENT`, so copy fixes in the seed reach a
 * database that was seeded before them.
 *
 * Never touched: a page an editor has saved (`isDemo: false`, or any
 * `updatedBy` — belt and braces, the admin sets both), a page whose blocks
 * already equal the seed (no write, no new `updatedAt`), and a page that does
 * not exist (e.g. removed with the demo content; it is not recreated).
 */
export const refreshSeededPages = internalMutation({
  args: {},
  returns: v.object({
    refreshed: v.array(v.string()),
    unchanged: v.array(v.string()),
    keptEdited: v.array(v.string()),
    missing: v.array(v.string()),
  }),
  handler: async (ctx) => {
    const refreshed: string[] = [];
    const unchanged: string[] = [];
    const keptEdited: string[] = [];
    const missing: string[] = [];
    const now = Date.now();

    for (const page of PAGE_CONTENT) {
      const doc = await ctx.db
        .query("pages")
        .withIndex("by_key", (q) => q.eq("key", page.key))
        .unique();
      if (doc === null) {
        missing.push(page.key);
        continue;
      }
      if (!doc.isDemo || doc.updatedBy !== undefined) {
        keptEdited.push(page.key);
        continue;
      }
      if (sameValue(doc.blocks, page.blocks)) {
        unchanged.push(page.key);
        continue;
      }
      await ctx.db.patch("pages", doc._id, { blocks: page.blocks, updatedAt: now });
      refreshed.push(page.key);
    }

    if (refreshed.length > 0) {
      await logActivity(ctx, {
        entity: "page",
        action: "page.seedRefreshed",
        summary: `Osvežen početni sadržaj: ${refreshed.join(", ")}`,
      });
    }
    return { refreshed, unchanged, keptEdited, missing };
  },
});

const LISTING_COPY: SeedListingCopy[] = [...LISTING_COPY_1, ...LISTING_COPY_2, ...LISTING_COPY_3];

function l10n(text: { sr: string; en?: string; ru?: string; de?: string }): L10n {
  return {
    sr: text.sr,
    ...(text.en !== undefined ? { en: text.en } : {}),
    ...(text.ru !== undefined ? { ru: text.ru } : {}),
    ...(text.de !== undefined ? { de: text.de } : {}),
  };
}

function l10nList(list: { sr: string[]; en?: string[]; ru?: string[]; de?: string[] }): L10nList {
  return {
    sr: list.sr,
    ...(list.en !== undefined ? { en: list.en } : {}),
    ...(list.ru !== undefined ? { ru: list.ru } : {}),
    ...(list.de !== undefined ? { de: list.de } : {}),
  };
}

/**
 * Brings the demo copy in the database in line with the seed files after a
 * translation pass (step 12): listing titles/descriptions/highlights, post
 * texts, place names and introductions, agent roles and bios, and the demo
 * settings texts. Pages are refreshed by `refreshSeededPages`, tour scenes by
 * `seedStages:applyDemoTours`.
 *
 * Only `isDemo` records are touched — demo content is placeholder by
 * definition and is removed from the admin in one click — and only fields
 * that differ are written. A listing whose title or place names change gets
 * its derived search haystack recomputed through `applyDerived`, exactly as an
 * admin save would.
 *
 *   npx convex run contentMigrations:refreshSeededCopy '{}'
 */
export const refreshSeededCopy = internalMutation({
  args: {},
  returns: v.object({
    listings: v.number(),
    posts: v.number(),
    locations: v.number(),
    agents: v.number(),
    settings: v.boolean(),
  }),
  handler: async (ctx) => {
    const now = Date.now();
    let locations = 0;
    for (const item of SEED_LOCATIONS) {
      const doc = await ctx.db
        .query("locations")
        .withIndex("by_slug", (q) => q.eq("slug", item.slug))
        .unique();
      if (doc === null || !doc.isDemo) continue;
      const next = {
        name: l10n(item.name),
        ...(item.intro !== undefined ? { intro: l10n(item.intro) } : {}),
      };
      if (sameValue(doc.name, next.name) && sameValue(doc.intro, next.intro)) continue;
      await ctx.db.patch("locations", doc._id, next);
      locations += 1;
    }

    let agents = 0;
    for (const item of SEED_AGENTS) {
      const doc = await ctx.db
        .query("agents")
        .withIndex("by_slug", (q) => q.eq("slug", item.slug))
        .unique();
      if (doc === null || !doc.isDemo) continue;
      const next = { role: l10n(item.role), bio: l10n(item.bio) };
      if (sameValue(doc.role, next.role) && sameValue(doc.bio, next.bio)) continue;
      await ctx.db.patch("agents", doc._id, next);
      agents += 1;
    }

    let posts = 0;
    for (const item of POST_COPY) {
      const doc = await ctx.db
        .query("posts")
        .withIndex("by_slug", (q) => q.eq("slug", item.slug))
        .unique();
      if (doc === null || !doc.isDemo) continue;
      const next = { title: l10n(item.title), excerpt: l10n(item.excerpt), body: l10n(item.body) };
      if (sameValue(doc.title, next.title) && sameValue(doc.excerpt, next.excerpt) && sameValue(doc.body, next.body)) {
        continue;
      }
      await ctx.db.patch("posts", doc._id, { ...next, updatedAt: now });
      posts += 1;
    }

    // Listings are matched the way the seed created them: spec index → ref.
    let listings = 0;
    for (const [index, spec] of SEED_LISTINGS.entries()) {
      const copy = LISTING_COPY.find((item) => item.key === spec.key);
      if (copy === undefined) continue;
      const doc = await ctx.db
        .query("listings")
        .withIndex("by_ref", (q) => q.eq("ref", formatRef(FIRST_REF_NUMBER + index)))
        .unique();
      if (doc === null || !doc.isDemo) continue;
      const text = { title: l10n(copy.title), description: l10n(copy.description), highlights: l10nList(copy.highlights) };
      const names = await locationNamesFor(ctx, doc);
      const scenes = await ctx.db
        .query("tourScenes")
        .withIndex("by_listingId_and_order", (q) => q.eq("listingId", doc._id))
        .take(1);
      const derived = applyDerived({ ...doc, ...text }, names, scenes.length > 0);
      if (
        sameValue(doc.title, text.title) &&
        sameValue(doc.description, text.description) &&
        sameValue(doc.highlights, text.highlights) &&
        doc.searchText === derived.searchText
      ) {
        continue;
      }
      // Copy only: the slug, price and dates stay as they are, so no URL moves.
      await ctx.db.patch("listings", doc._id, { ...text, searchText: derived.searchText });
      listings += 1;
    }

    let settings = false;
    const doc = await ctx.db
      .query("settings")
      .withIndex("by_key", (q) => q.eq("key", "global"))
      .unique();
    if (doc !== null && doc.isDemo) {
      const next = {
        commissionText: l10n(SETTINGS_COPY.commissionText),
        seo: {
          ...doc.seo,
          defaultTitle: l10n(SETTINGS_COPY.seoDefaultTitle),
          defaultDescription: l10n(SETTINGS_COPY.seoDefaultDescription),
        },
        stats: doc.stats.map((stat, i) => {
          const seeded = SETTINGS_COPY.stats[i];
          return seeded !== undefined && seeded.value === stat.value ? { ...stat, label: l10n(seeded.label) } : stat;
        }),
      };
      if (
        !sameValue(doc.commissionText, next.commissionText) ||
        !sameValue(doc.seo, next.seo) ||
        !sameValue(doc.stats, next.stats)
      ) {
        await ctx.db.patch("settings", doc._id, { ...next, updatedAt: now });
        settings = true;
      }
    }

    const total = listings + posts + locations + agents + (settings ? 1 : 0);
    if (total > 0) {
      await logActivity(ctx, {
        entity: "demo",
        action: "demo.copyRefreshed",
        summary: `Osveženi prevodi demo sadržaja: ${listings} nekretnina, ${posts} tekstova, ${locations} lokacija, ${agents} agenata${settings ? ", podešavanja" : ""}`,
      });
    }
    return { listings, posts, locations, agents, settings };
  },
});
