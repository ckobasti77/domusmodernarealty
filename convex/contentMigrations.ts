import { v } from "convex/values";
import { internalMutation } from "./_generated/server";
import { logActivity } from "./lib/activity";
import { PAGE_CONTENT } from "./seed/content/pages";

/**
 * One-off content migrations, run from the CLI against the dev deployment:
 *
 *   npx convex run contentMigrations:refreshSeededPages '{}'
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
