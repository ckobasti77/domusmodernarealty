import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import schema from "./schema";
import { diffFields, logActivity } from "./lib/activity";
import { requireRole } from "./lib/auth";
import { invalidInput } from "./lib/errors";
import { availabilitySlotV, imageV, l10nV } from "./lib/validators";
import { loadSettings } from "./settings";

const ADMINS = ["admin"] as const;

export const get = query({
  args: {},
  returns: v.union(schema.doc("settings"), v.null()),
  handler: async (ctx) => {
    await requireRole(ctx, ADMINS);
    return await loadSettings(ctx);
  },
});

export const generateUploadUrl = mutation({
  args: {},
  returns: v.string(),
  handler: async (ctx) => {
    await requireRole(ctx, ADMINS);
    return await ctx.storage.generateUploadUrl();
  },
});

export const update = mutation({
  args: {
    patch: v.object({
      companyName: v.optional(v.string()),
      legalName: v.optional(v.string()),
      address: v.optional(v.string()),
      pib: v.optional(v.string()),
      mb: v.optional(v.string()),
      registryNo: v.optional(v.string()),
      insurance: v.optional(v.string()),
      phones: v.optional(v.array(v.string())),
      email: v.optional(v.string()),
      viber: v.optional(v.string()),
      whatsapp: v.optional(v.string()),
      socials: v.optional(
        v.object({
          instagram: v.optional(v.string()),
          facebook: v.optional(v.string()),
          linkedin: v.optional(v.string()),
          youtube: v.optional(v.string()),
        }),
      ),
      officeHours: v.optional(v.array(availabilitySlotV)),
      officeLat: v.optional(v.number()),
      officeLng: v.optional(v.number()),
      commissionText: v.optional(l10nV),
      termsPdf: v.optional(v.id("_storage")),
      mortgage: v.optional(
        v.object({ rate: v.number(), years: v.number(), downPct: v.number() }),
      ),
      eurRsd: v.optional(v.number()),
      stats: v.optional(
        v.array(v.object({ value: v.string(), label: l10nV, isDemo: v.boolean() })),
      ),
      seo: v.optional(
        v.object({
          defaultTitle: l10nV,
          defaultDescription: l10nV,
          ogImage: v.optional(imageV),
        }),
      ),
      analytics: v.optional(
        v.object({
          plausibleDomain: v.optional(v.string()),
          ga4Id: v.optional(v.string()),
          metaPixelId: v.optional(v.string()),
        }),
      ),
    }),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const viewer = await requireRole(ctx, ADMINS);
    const existing = await loadSettings(ctx);
    if (existing === null) {
      invalidInput("Podešavanja još nisu inicijalizovana. Pokrenite seed.");
    }

    const { patch } = args;
    if (patch.pib !== undefined && !/^\d{9}$/.test(patch.pib)) {
      invalidInput("PIB mora imati 9 cifara.");
    }
    if (patch.mb !== undefined && !/^\d{8}$/.test(patch.mb)) {
      invalidInput("Matični broj mora imati 8 cifara.");
    }
    if (patch.registryNo !== undefined && patch.registryNo.trim().length === 0) {
      invalidInput("Broj u Registru posrednika je obavezan (Zakon, čl. 18).");
    }
    if (patch.mortgage !== undefined) {
      const { rate, years, downPct } = patch.mortgage;
      if (rate < 0 || rate > 30) invalidInput("Kamatna stopa mora biti 0–30 %.");
      if (years < 1 || years > 40) invalidInput("Rok mora biti 1–40 godina.");
      if (downPct < 0 || downPct > 100) {
        invalidInput("Učešće mora biti 0–100 %.");
      }
    }
    if (patch.eurRsd !== undefined && (patch.eurRsd < 50 || patch.eurRsd > 500)) {
      invalidInput("Kurs EUR/RSD nije realan.");
    }

    // Any real edit clears the demo flag so the footer stops warning.
    const stillDemo =
      patch.pib === undefined && patch.registryNo === undefined
        ? existing.isDemo
        : (patch.pib ?? existing.pib) === "000000000" ||
          (patch.registryNo ?? existing.registryNo) === "000";

    await ctx.db.patch("settings", existing._id, {
      ...patch,
      isDemo: stillDemo,
      updatedAt: Date.now(),
    });

    await logActivity(ctx, {
      entity: "settings",
      entityId: existing._id,
      action: "settings.updated",
      diff: diffFields(
        existing as unknown as Record<string, unknown>,
        { ...existing, ...patch } as unknown as Record<string, unknown>,
      ),
      by: viewer._id,
    });
    return null;
  },
});
