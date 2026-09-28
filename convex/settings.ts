import { v } from "convex/values";
import { query } from "./_generated/server";
import type { QueryCtx } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";
import { imageUrl } from "./lib/dto";
import { availabilitySlotV, l10nV } from "./lib/validators";

/**
 * Public settings. Everything here is legally required on every page
 * (brokerage law Art. 18 + e-commerce law Art. 6), so nothing is stripped
 * except the storage ids, which are resolved to URLs.
 */
export const publicSettingsV = v.object({
  companyName: v.string(),
  legalName: v.string(),
  address: v.string(),
  pib: v.string(),
  mb: v.string(),
  registryNo: v.string(),
  insurance: v.optional(v.string()),
  phones: v.array(v.string()),
  email: v.string(),
  viber: v.optional(v.string()),
  whatsapp: v.optional(v.string()),
  socials: v.object({
    instagram: v.optional(v.string()),
    facebook: v.optional(v.string()),
    linkedin: v.optional(v.string()),
    youtube: v.optional(v.string()),
  }),
  officeHours: v.array(availabilitySlotV),
  officeLat: v.optional(v.number()),
  officeLng: v.optional(v.number()),
  commissionText: l10nV,
  termsPdfUrl: v.optional(v.string()),
  mortgage: v.object({
    rate: v.number(),
    years: v.number(),
    downPct: v.number(),
  }),
  eurRsd: v.optional(v.number()),
  stats: v.array(
    v.object({ value: v.string(), label: l10nV, isDemo: v.boolean() }),
  ),
  seo: v.object({
    defaultTitle: l10nV,
    defaultDescription: l10nV,
    ogImageUrl: v.optional(v.string()),
  }),
  analytics: v.object({
    plausibleDomain: v.optional(v.string()),
    ga4Id: v.optional(v.string()),
    metaPixelId: v.optional(v.string()),
  }),
  isDemo: v.boolean(),
});

export async function loadSettings(
  ctx: QueryCtx,
): Promise<Doc<"settings"> | null> {
  return await ctx.db
    .query("settings")
    .withIndex("by_key", (q) => q.eq("key", "global"))
    .unique();
}

export const publicSettings = query({
  args: {},
  returns: v.union(publicSettingsV, v.null()),
  handler: async (ctx) => {
    const doc = await loadSettings(ctx);
    if (doc === null) return null;

    const termsPdfUrl =
      doc.termsPdf !== undefined ? await ctx.storage.getUrl(doc.termsPdf) : null;
    const ogImageUrl =
      doc.seo.ogImage !== undefined ? await imageUrl(ctx, doc.seo.ogImage) : null;

    return {
      companyName: doc.companyName,
      legalName: doc.legalName,
      address: doc.address,
      pib: doc.pib,
      mb: doc.mb,
      registryNo: doc.registryNo,
      ...(doc.insurance !== undefined ? { insurance: doc.insurance } : {}),
      phones: doc.phones,
      email: doc.email,
      ...(doc.viber !== undefined ? { viber: doc.viber } : {}),
      ...(doc.whatsapp !== undefined ? { whatsapp: doc.whatsapp } : {}),
      socials: doc.socials,
      officeHours: doc.officeHours,
      ...(doc.officeLat !== undefined ? { officeLat: doc.officeLat } : {}),
      ...(doc.officeLng !== undefined ? { officeLng: doc.officeLng } : {}),
      commissionText: doc.commissionText,
      ...(termsPdfUrl !== null ? { termsPdfUrl } : {}),
      mortgage: doc.mortgage,
      ...(doc.eurRsd !== undefined ? { eurRsd: doc.eurRsd } : {}),
      stats: doc.stats,
      seo: {
        defaultTitle: doc.seo.defaultTitle,
        defaultDescription: doc.seo.defaultDescription,
        ...(ogImageUrl !== null ? { ogImageUrl } : {}),
      },
      analytics: doc.analytics,
      isDemo: doc.isDemo,
    };
  },
});
