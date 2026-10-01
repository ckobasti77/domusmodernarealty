import { type Infer, v } from "convex/values";
import type { QueryCtx } from "./_generated/server";
import { query } from "./_generated/server";
import { type PageBlock, pageBlockV, pageKeyV, seoV } from "./lib/validators";

/**
 * A `media` block stored with an uploaded file is handed to the site as a
 * plain URL, so a public renderer never needs storage access. A blob that has
 * gone missing drops the block rather than rendering a broken image.
 */
async function publicBlocks(ctx: QueryCtx, blocks: PageBlock[]): Promise<PageBlock[]> {
  const out: PageBlock[] = [];
  for (const block of blocks) {
    if (block.type !== "media" || block.image.kind === "url") {
      out.push(block);
      continue;
    }
    const url = await ctx.storage.getUrl(block.image.storageId);
    if (url !== null) out.push({ ...block, image: { kind: "url", url } });
  }
  return out;
}

type Seo = Infer<typeof seoV>;

/** The SEO fields with an uploaded share image turned into its URL (or dropped if the blob is gone). */
async function publicSeo(ctx: QueryCtx, seo: Seo): Promise<Seo> {
  const { ogImage, ...rest } = seo;
  if (ogImage === undefined || ogImage.kind === "url") return seo;
  const url = await ctx.storage.getUrl(ogImage.storageId);
  return url !== null ? { ...rest, ogImage: { kind: "url", url } } : rest;
}

/**
 * Editable site content (PRD B10) for the public pages. Everything in a page
 * is public copy, so the whole document is returned; the landing and the
 * legal/info pages read their blocks by `key` and fall back to the built-in
 * texts for anything missing (`lib/content/pages.ts`).
 */
export const get = query({
  args: { key: pageKeyV },
  returns: v.union(
    v.object({
      key: pageKeyV,
      blocks: v.array(pageBlockV),
      seo: v.optional(seoV),
      updatedAt: v.number(),
      isDemo: v.boolean(),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const doc = await ctx.db
      .query("pages")
      .withIndex("by_key", (q) => q.eq("key", args.key))
      .unique();
    if (doc === null) return null;
    return {
      key: doc.key,
      blocks: await publicBlocks(ctx, doc.blocks),
      ...(doc.seo !== undefined ? { seo: await publicSeo(ctx, doc.seo) } : {}),
      updatedAt: doc.updatedAt,
      isDemo: doc.isDemo,
    };
  },
});
