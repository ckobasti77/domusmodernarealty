/**
 * Every database write the seed performs. Each exported mutation is one
 * transaction; `convex/seed.ts` (a Node action) calls them in order.
 */
import { v } from "convex/values";
import { internalMutation, internalQuery } from "./_generated/server";
import type { MutationCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { DEMO_TABLES, purgeDemoTable } from "./demo";
import { applyDerived } from "./lib/derive";
import { FIRST_REF_NUMBER, formatRef, listingSlug } from "./lib/slug";
import { l10nValues } from "./lib/derive";
import { roleV } from "./lib/validators";
import type {
  L10n,
  L10nList,
  LeadStatus,
  LeadType,
  Locale,
  MediaItem,
  RoomTag,
} from "./lib/validators";
import { SEED_AGENTS } from "./seed/agents";
import { SEED_LOCATIONS } from "./seed/locations";
import { SEED_LISTINGS } from "./seed/spec";
import { DEMO_PANORAMAS, DEMO_SPLATS } from "./seed/media.generated";
import { pickPhotos, photoUrl, toMediaItems } from "./seed/media";
import { LISTING_COPY_1 } from "./seed/content/listings1";
import { LISTING_COPY_2 } from "./seed/content/listings2";
import { LISTING_COPY_3 } from "./seed/content/listings3";
import type { SeedListingCopy } from "./seed/content/listings1";
import { POST_COPY, TESTIMONIAL_COPY } from "./seed/content/posts";
import { PAGE_CONTENT, SETTINGS_COPY } from "./seed/content/pages";

const LISTING_COPY: SeedListingCopy[] = [
  ...LISTING_COPY_1,
  ...LISTING_COPY_2,
  ...LISTING_COPY_3,
];

/** Stable "now" for the seed so mandates and publish dates look natural. */
const DAY = 86_400_000;

function l10n(text: { sr: string; en?: string; ru?: string; de?: string }): L10n {
  return {
    sr: text.sr,
    ...(text.en !== undefined ? { en: text.en } : {}),
    ...(text.ru !== undefined ? { ru: text.ru } : {}),
    ...(text.de !== undefined ? { de: text.de } : {}),
  };
}

function l10nList(list: {
  sr: string[];
  en?: string[];
  ru?: string[];
  de?: string[];
}): L10nList {
  return {
    sr: list.sr,
    ...(list.en !== undefined ? { en: list.en } : {}),
    ...(list.ru !== undefined ? { ru: list.ru } : {}),
    ...(list.de !== undefined ? { de: list.de } : {}),
  };
}

/* ------------------------------------------------------------------- status */

export const status = internalQuery({
  args: {},
  returns: v.object({
    hasDemoListings: v.boolean(),
    hasSettings: v.boolean(),
    demoListings: v.number(),
  }),
  handler: async (ctx) => {
    const demo = await ctx.db
      .query("listings")
      .withIndex("by_isDemo", (q) => q.eq("isDemo", true))
      .take(100);
    const settings = await ctx.db
      .query("settings")
      .withIndex("by_key", (q) => q.eq("key", "global"))
      .unique();
    return {
      hasDemoListings: demo.length > 0,
      hasSettings: settings !== null,
      demoListings: demo.length,
    };
  },
});

export const userByEmail = internalQuery({
  args: { email: v.string() },
  returns: v.union(v.id("users"), v.null()),
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .first();
    return user?._id ?? null;
  },
});

/** The bootstrap invite `auth.ts::createOrUpdateUser` consumes. */
export const bootstrapInvite = internalMutation({
  args: { email: v.string(), role: roleV },
  returns: v.id("invites"),
  handler: async (ctx, args) => {
    const now = Date.now();
    return await ctx.db.insert("invites", {
      email: args.email,
      name: "Administrator",
      role: args.role,
      tokenHash: `bootstrap:${args.email}`,
      expiresAt: now + DAY,
      acceptedAt: undefined,
    });
  },
});

/** One table's worth of demo rows per call; `all` loops until 0 remain. */
export const purgeDemo = internalMutation({
  args: {},
  returns: v.object({ removed: v.number(), remaining: v.number() }),
  handler: async (ctx) => {
    let removed = 0;
    for (const table of DEMO_TABLES) {
      removed = await purgeDemoTable(ctx, table, 40);
      if (removed > 0) return { removed, remaining: removed };
    }
    return { removed: 0, remaining: 0 };
  },
});

/* ----------------------------------------------------------------- settings */

export const seedSettings = internalMutation({
  args: {},
  returns: v.object({ created: v.boolean() }),
  handler: async (ctx) => {
    const existing = await ctx.db
      .query("settings")
      .withIndex("by_key", (q) => q.eq("key", "global"))
      .unique();
    if (existing !== null) return { created: false };

    await ctx.db.insert("settings", {
      key: "global",
      companyName: "Mihajlo Estate",
      legalName: "Mihajlo Estate d.o.o. Beograd",
      address: "Njegoševa 1, 11000 Beograd",
      // Placeholders, clearly marked: the footer shows a demo warning until the
      // owner enters the real numbers (PRD B11).
      pib: "000000000",
      mb: "00000000",
      registryNo: "000",
      insurance: "Polisa profesionalne odgovornosti — broj se unosi u Podešavanjima",
      phones: ["+381 11 000 0010"],
      email: "office@mihajlo-estate.local",
      viber: "+381 11 000 0010",
      whatsapp: "+381 11 000 0010",
      socials: {},
      officeHours: [
        { weekday: 1, from: "09:00", to: "18:00" },
        { weekday: 2, from: "09:00", to: "18:00" },
        { weekday: 3, from: "09:00", to: "18:00" },
        { weekday: 4, from: "09:00", to: "18:00" },
        { weekday: 5, from: "09:00", to: "17:00" },
        { weekday: 6, from: "10:00", to: "14:00" },
      ],
      officeLat: 44.7996,
      officeLng: 20.4712,
      commissionText: l10n(SETTINGS_COPY.commissionText),
      mortgage: { rate: 5.4, years: 25, downPct: 20 },
      eurRsd: 117.2,
      stats: SETTINGS_COPY.stats.map((item) => ({
        value: item.value,
        label: l10n(item.label),
        isDemo: item.isDemo,
      })),
      seo: {
        defaultTitle: l10n(SETTINGS_COPY.seoDefaultTitle),
        defaultDescription: l10n(SETTINGS_COPY.seoDefaultDescription),
      },
      analytics: {},
      isDemo: true,
      updatedAt: Date.now(),
    });
    return { created: true };
  },
});

/* ---------------------------------------------------------------- locations */

export const seedLocations = internalMutation({
  args: {},
  returns: v.object({ created: v.number(), total: v.number() }),
  handler: async (ctx) => {
    const bySlug = new Map<string, Id<"locations">>();
    let created = 0;
    let order = 0;

    for (const item of SEED_LOCATIONS) {
      const existing = await ctx.db
        .query("locations")
        .withIndex("by_slug", (q) => q.eq("slug", item.slug))
        .unique();
      if (existing !== null) {
        bySlug.set(item.slug, existing._id);
        continue;
      }

      const parentId = item.parent !== undefined ? bySlug.get(item.parent) : undefined;
      const id = await ctx.db.insert("locations", {
        kind: item.kind,
        ...(parentId !== undefined ? { parentId } : {}),
        slug: item.slug,
        name: l10n(item.name),
        ...(item.intro !== undefined ? { intro: l10n(item.intro) } : {}),
        lat: item.lat,
        lng: item.lng,
        ...(item.sale !== undefined ? { avgPricePerM2Sale: item.sale } : {}),
        ...(item.rent !== undefined ? { avgPricePerM2Rent: item.rent } : {}),
        featured: item.featured === true,
        order,
        isDemo: true,
      });
      bySlug.set(item.slug, id);
      created += 1;
      order += 1;
    }

    return { created, total: SEED_LOCATIONS.length };
  },
});

/* ------------------------------------------------------------------- agents */

export const seedAgents = internalMutation({
  args: {},
  returns: v.object({ created: v.number() }),
  handler: async (ctx) => {
    let created = 0;
    let order = 0;
    for (const item of SEED_AGENTS) {
      const existing = await ctx.db
        .query("agents")
        .withIndex("by_slug", (q) => q.eq("slug", item.slug))
        .unique();
      if (existing !== null) {
        order += 1;
        continue;
      }

      const areas: Id<"locations">[] = [];
      for (const slug of item.areas) {
        const location = await ctx.db
          .query("locations")
          .withIndex("by_slug", (q) => q.eq("slug", slug))
          .unique();
        if (location !== null) areas.push(location._id);
      }

      await ctx.db.insert("agents", {
        slug: item.slug,
        name: item.name,
        role: l10n(item.role),
        bio: l10n(item.bio),
        // No photo on purpose: the UI renders a monogram, never a stock face.
        languages: item.languages,
        phone: item.phone,
        ...(item.viber !== undefined ? { viber: item.viber } : {}),
        ...(item.whatsapp !== undefined ? { whatsapp: item.whatsapp } : {}),
        email: item.email,
        areas,
        ...(item.licenseId !== undefined ? { licenseId: item.licenseId } : {}),
        isPublic: true,
        order,
        availability: item.availability,
        isDemo: true,
      });
      created += 1;
      order += 1;
    }
    return { created };
  },
});

/* ------------------------------------------------- pages, posts, testimonials */

export const seedContent = internalMutation({
  args: {},
  returns: v.object({
    pages: v.number(),
    posts: v.number(),
    testimonials: v.number(),
  }),
  handler: async (ctx) => {
    const now = Date.now();
    let pages = 0;
    for (const page of PAGE_CONTENT) {
      const existing = await ctx.db
        .query("pages")
        .withIndex("by_key", (q) => q.eq("key", page.key))
        .unique();
      if (existing !== null) continue;
      await ctx.db.insert("pages", {
        key: page.key,
        blocks: page.blocks,
        updatedAt: now,
        isDemo: true,
      });
      pages += 1;
    }

    const author = await ctx.db
      .query("agents")
      .withIndex("by_slug", (q) => q.eq("slug", "milica-jovanovic"))
      .unique();

    let posts = 0;
    for (const [index, post] of POST_COPY.entries()) {
      const existing = await ctx.db
        .query("posts")
        .withIndex("by_slug", (q) => q.eq("slug", post.slug))
        .unique();
      if (existing !== null) continue;

      const cover = pickPhotos([post.coverCategory], index * 3)[0];
      await ctx.db.insert("posts", {
        slug: post.slug,
        title: l10n(post.title),
        excerpt: l10n(post.excerpt),
        body: l10n(post.body),
        ...(cover !== undefined
          ? { cover: { kind: "url" as const, url: photoUrl(cover.url, 1920) } }
          : {}),
        category: post.category,
        tags: post.tags,
        ...(author !== null ? { authorAgentId: author._id } : {}),
        status: "published",
        publishedAt: now - (index + 1) * 9 * DAY,
        featured: post.featured,
        readingMinutes: post.readingMinutes,
        isDemo: true,
      });
      posts += 1;
    }

    let testimonials = 0;
    for (const [index, item] of TESTIMONIAL_COPY.entries()) {
      const clash = await ctx.db.query("testimonials").take(100);
      if (clash.some((doc) => doc.author === item.author)) continue;
      await ctx.db.insert("testimonials", {
        quote: l10n(item.quote),
        author: item.author,
        context: l10n(item.context),
        // Demo testimonials NEVER render publicly (docs/04-CONTENT.md).
        verified: false,
        order: index,
        isDemo: true,
      });
      testimonials += 1;
    }

    return { pages, posts, testimonials };
  },
});

/* ----------------------------------------------------------------- listings */

async function locationIdBySlug(
  ctx: MutationCtx,
  slug: string,
): Promise<Doc<"locations"> | null> {
  return await ctx.db
    .query("locations")
    .withIndex("by_slug", (q) => q.eq("slug", slug))
    .unique();
}

export const seedListings = internalMutation({
  args: { from: v.number(), count: v.number() },
  returns: v.object({ listings: v.number(), scenes: v.number() }),
  handler: async (ctx, args) => {
    const now = Date.now();
    const slice = SEED_LISTINGS.slice(args.from, args.from + args.count);
    let listings = 0;
    let scenes = 0;

    for (const [offset, spec] of slice.entries()) {
      const index = args.from + offset;
      const copy = LISTING_COPY.find((item) => item.key === spec.key);
      if (copy === undefined) {
        console.warn(`seed: no copy for ${spec.key}`);
        continue;
      }

      const ref = formatRef(FIRST_REF_NUMBER + index);
      const existing = await ctx.db
        .query("listings")
        .withIndex("by_ref", (q) => q.eq("ref", ref))
        .unique();
      if (existing !== null) continue;

      const city = await locationIdBySlug(ctx, spec.city);
      if (city === null) {
        console.warn(`seed: missing city ${spec.city}`);
        continue;
      }
      const municipality =
        spec.municipality !== undefined
          ? await locationIdBySlug(ctx, spec.municipality)
          : null;
      const neighborhood =
        spec.neighborhood !== undefined
          ? await locationIdBySlug(ctx, spec.neighborhood)
          : null;
      const agent = await ctx.db
        .query("agents")
        .withIndex("by_slug", (q) => q.eq("slug", spec.agent))
        .unique();
      if (agent === null) {
        console.warn(`seed: missing agent ${spec.agent}`);
        continue;
      }

      const title = l10n(copy.title);
      const photos = pickPhotos(spec.photos, index * 2 + 1);
      const media: MediaItem[] = toMediaItems(
        photos,
        spec.roomTags as readonly RoomTag[],
        title,
        `p${index}`,
      );

      const publishedAt =
        spec.status === "draft" || spec.status === "review"
          ? undefined
          : now - (index + 2) * 2 * DAY;

      const base = {
        ref,
        slug: listingSlug(copy.title.sr, ref),
        status: spec.status,
        visibility: "public" as const,
        transaction: spec.transaction,
        propertyType: spec.propertyType,
        ...(spec.subtype !== undefined ? { subtype: spec.subtype } : {}),
        isExclusive: spec.isExclusive,
        isFeatured: spec.isFeatured,
        isDemo: true,
        agentId: agent._id,
        mandate: {
          number: `UP-${ref.replace("ME-", "")}/2026`,
          type: spec.isExclusive ? ("exclusive" as const) : ("open" as const),
          start: now - 30 * DAY,
          end: now + spec.mandateMonths * 30 * DAY,
        },
        title,
        description: l10n(copy.description),
        highlights: l10nList(copy.highlights),
        price: spec.price,
        ...(spec.previousPrice !== undefined
          ? { previousPrice: spec.previousPrice }
          : {}),
        ...(spec.vatIncluded !== undefined ? { vatIncluded: spec.vatIncluded } : {}),
        ...(spec.vatRefundEligible !== undefined
          ? { vatRefundEligible: spec.vatRefundEligible }
          : {}),
        ...(spec.mortgageEligible !== undefined
          ? { mortgageEligible: spec.mortgageEligible }
          : {}),
        ...(spec.developerInstallments !== undefined
          ? { developerInstallments: spec.developerInstallments }
          : {}),
        ...(spec.urgent !== undefined ? { urgent: spec.urgent } : {}),
        ...(spec.costs !== undefined ? { costs: spec.costs } : {}),
        ...(spec.rentMonthly !== undefined
          ? {
              rent: {
                monthly: spec.rentMonthly,
                ...(spec.deposit !== undefined ? { deposit: spec.deposit } : {}),
                minLeaseMonths: 12,
                petsAllowed: false,
                utilitiesIncluded: false,
              },
            }
          : {}),
        cityId: city._id,
        ...(municipality !== null ? { municipalityId: municipality._id } : {}),
        ...(neighborhood !== null ? { neighborhoodId: neighborhood._id } : {}),
        location: {
          street: copy.street,
          streetNo: copy.streetNo,
          lat: spec.lat,
          lng: spec.lng,
          addressVisibility: spec.addressVisibility,
        },
        areaM2: spec.areaM2,
        ...(spec.plotAreaM2 !== undefined ? { plotAreaM2: spec.plotAreaM2 } : {}),
        rooms: spec.rooms,
        ...(spec.bedrooms !== undefined ? { bedrooms: spec.bedrooms } : {}),
        ...(spec.bathrooms !== undefined ? { bathrooms: spec.bathrooms } : {}),
        floor: spec.floor,
        ...(spec.totalFloors !== undefined ? { totalFloors: spec.totalFloors } : {}),
        ...(spec.isDuplex !== undefined ? { isDuplex: spec.isDuplex } : {}),
        ...(spec.isPenthouse !== undefined ? { isPenthouse: spec.isPenthouse } : {}),
        constructionType: spec.constructionType,
        ...(spec.yearBuilt !== undefined ? { yearBuilt: spec.yearBuilt } : {}),
        ...(spec.completionYear !== undefined
          ? { completionDate: Date.UTC(spec.completionYear, 8, 1) }
          : {}),
        ...(spec.renovatedYear !== undefined
          ? { renovatedYear: spec.renovatedYear }
          : {}),
        condition: spec.condition,
        heating: spec.heating,
        features: {
          elevator: spec.features.elevator === true,
          terrace: spec.features.terrace === true,
          loggia: spec.features.loggia === true,
          balcony: spec.features.balcony === true,
          frenchBalcony: spec.features.frenchBalcony === true,
          garden: spec.features.garden === true,
          basement: spec.features.basement === true,
          storage: spec.features.storage === true,
          ac: spec.features.ac === true,
          intercom: spec.features.intercom === true,
          videoSurveillance: spec.features.videoSurveillance === true,
          alarm: spec.features.alarm === true,
          ...(spec.features.pool !== undefined ? { pool: spec.features.pool } : {}),
          ...(spec.features.fireplace !== undefined
            ? { fireplace: spec.features.fireplace }
            : {}),
        },
        ...(spec.outdoorAreaM2 !== undefined
          ? { outdoorAreaM2: spec.outdoorAreaM2 }
          : {}),
        ...(spec.orientation !== undefined ? { orientation: spec.orientation } : {}),
        ...(spec.view !== undefined ? { view: spec.view } : {}),
        parking: spec.parking,
        furnishing: spec.furnishing,
        ...(spec.energyClass !== undefined ? { energyClass: spec.energyClass } : {}),
        legal: {
          registration: spec.registration,
          legalization: spec.legalization,
          ...(spec.occupancyPermit !== undefined
            ? { occupancyPermit: spec.occupancyPermit }
            : {}),
          ...(spec.encumbrance !== undefined ? { encumbrance: spec.encumbrance } : {}),
          ...(spec.ownershipShare !== undefined
            ? { ownershipShare: spec.ownershipShare }
            : {}),
          ...(spec.docsVerified === true ? { docsVerifiedAt: now - 20 * DAY } : {}),
        },
        ...(spec.swapPossible !== undefined ? { swapPossible: spec.swapPossible } : {}),
        media,
        floorPlans: [],
        ...(spec.hasTourScenes === true
          ? { tour360: { provider: "self" as const, published: true } }
          : {}),
        ...(spec.has3dWalk === true && DEMO_SPLATS.length > 0
          ? {
              walk3d: {
                desktop: {
                  source: { kind: "url" as const, url: DEMO_SPLATS[0].url },
                  format: "sog" as const,
                },
                credits: DEMO_SPLATS[0].desc.slice(0, 300),
                aiGenerated: false,
                eyeHeight: 1.6,
                published: true,
              },
            }
          : {}),
        poi: spec.poi,
        ...(publishedAt !== undefined ? { publishedAt } : {}),
        updatedAt: now - index * DAY,
      };

      const names = [
        ...l10nValues(city.name),
        ...(municipality !== null ? l10nValues(municipality.name) : []),
        ...(neighborhood !== null ? l10nValues(neighborhood.name) : []),
      ];
      const derived = applyDerived(base, names, spec.hasTourScenes === true);
      const listingId = await ctx.db.insert("listings", { ...base, ...derived });
      listings += 1;

      if (spec.previousPrice !== undefined) {
        await ctx.db.insert("priceChanges", {
          listingId,
          from: spec.previousPrice,
          to: spec.price,
          at: now - 12 * DAY,
        });
      }

      await ctx.db.insert("listingStats", {
        listingId,
        views: 40 + ((index * 37) % 260),
        favorites: (index * 5) % 19,
        leads: index % 4,
        viewings: index % 3,
        lastViewedAt: now - (index % 7) * DAY,
      });

      if (spec.hasTourScenes === true && DEMO_PANORAMAS.length >= 3) {
        const sceneIds: Id<"tourScenes">[] = [];
        const titles: L10n[] = [
          { sr: "Dnevna soba", en: "Living room", ru: "Гостиная", de: "Wohnzimmer" },
          { sr: "Kuhinja", en: "Kitchen", ru: "Кухня", de: "Küche" },
          { sr: "Terasa", en: "Terrace", ru: "Терраса", de: "Terrasse" },
        ];
        for (let sceneIndex = 0; sceneIndex < 3; sceneIndex += 1) {
          const pano = DEMO_PANORAMAS[(index + sceneIndex) % DEMO_PANORAMAS.length];
          const id = await ctx.db.insert("tourScenes", {
            listingId,
            order: sceneIndex,
            title: titles[sceneIndex],
            pano: { kind: "url", url: pano.url },
            links: [],
          });
          sceneIds.push(id);
          scenes += 1;
        }
        // Link the scenes into a ring so the virtual tour can be walked.
        for (let sceneIndex = 0; sceneIndex < sceneIds.length; sceneIndex += 1) {
          const next = sceneIds[(sceneIndex + 1) % sceneIds.length];
          await ctx.db.patch("tourScenes", sceneIds[sceneIndex], {
            links: [{ toSceneId: next, yaw: 0, pitch: 0 }],
          });
        }
      }
    }

    return { listings, scenes };
  },
});

/* ---------------------------------------------------------------------- CRM */

type DemoLead = {
  name: string;
  email: string;
  phone: string;
  type: LeadType;
  status: LeadStatus;
  locale: Locale;
  listingIndex?: number;
  message: string;
};

const DEMO_LEADS: DemoLead[] = [
  {
    name: "Marko Simić",
    email: "marko.simic@primer.local",
    phone: "+381 60 000 0101",
    type: "inquiry" as const,
    status: "new" as const,
    locale: "sr-Latn" as const,
    listingIndex: 0,
    message:
      "Dobar dan, zanima me da li je stan slobodan i da li se termin razgledanja može zakazati u toku nedelje posle 17h.",
  },
  {
    name: "Familie Weber",
    email: "weber@primer.local",
    phone: "+49 30 0000 0102",
    type: "inquiry" as const,
    status: "contacted" as const,
    locale: "de" as const,
    listingIndex: 5,
    message:
      "Guten Tag, wir interessieren uns für das Haus und würden gern wissen, ob eine Besichtigung per Video möglich ist.",
  },
  {
    name: "Анна Соколова",
    email: "sokolova@primer.local",
    phone: "+7 495 000 0103",
    type: "inquiry" as const,
    status: "qualified" as const,
    locale: "ru" as const,
    listingIndex: 7,
    message:
      "Здравствуйте! Интересует пентхаус. Возможна ли покупка на юридическое лицо и какие документы потребуются?",
  },
  {
    name: "Jelena Nikolić",
    email: "jelena.nikolic@primer.local",
    phone: "+381 63 000 0104",
    type: "valuation" as const,
    status: "new" as const,
    locale: "sr-Latn" as const,
    message: "Razmišljam o prodaji stana na Vračaru i zanima me realna cena.",
  },
  {
    name: "Ivan Todorović",
    email: "ivan.todorovic@primer.local",
    phone: "+381 64 000 0105",
    type: "seller" as const,
    status: "viewing" as const,
    locale: "sr-Latn" as const,
    message:
      "Prodajem trosoban stan na Novom Beogradu, uknjižen, useljiv od marta. Molim za poziv.",
  },
  {
    name: "Sarah Collins",
    email: "s.collins@primer.local",
    phone: "+44 20 0000 0106",
    type: "general" as const,
    status: "contacted" as const,
    locale: "en" as const,
    message:
      "Hello, I am relocating to Belgrade in the spring and would like to understand the rental process for a one-year lease.",
  },
];

export const seedCrm = internalMutation({
  args: {},
  returns: v.object({ leads: v.number(), viewings: v.number() }),
  handler: async (ctx) => {
    const now = Date.now();
    const listings = await ctx.db
      .query("listings")
      .withIndex("by_isDemo", (q) => q.eq("isDemo", true))
      .take(40);
    listings.sort((a, b) => a.ref.localeCompare(b.ref));
    if (listings.length === 0) return { leads: 0, viewings: 0 };

    let leads = 0;
    let viewings = 0;

    for (const [index, item] of DEMO_LEADS.entries()) {
      const existing = await ctx.db
        .query("contacts")
        .withIndex("by_email", (q) => q.eq("email", item.email))
        .first();
      if (existing !== null) continue;

      const consent = {
        privacy: true,
        marketing: index % 2 === 0,
        textVersion: "privacy-2026-09",
        at: now - (index + 1) * 2 * DAY,
        channel: "web",
      };

      const contactId = await ctx.db.insert("contacts", {
        name: item.name,
        email: item.email,
        phone: item.phone,
        locale: item.locale,
        tags: ["demo", "web"],
        consents: [consent],
        isDemo: true,
      });

      const listing =
        item.listingIndex !== undefined
          ? listings[item.listingIndex % listings.length]
          : undefined;

      const leadId = await ctx.db.insert("leads", {
        type: item.type,
        status: item.status,
        ...(listing !== undefined ? { listingId: listing._id } : {}),
        ...(listing !== undefined ? { agentId: listing.agentId } : {}),
        contactId,
        message: item.message,
        source: "web",
        locale: item.locale,
        consent,
        ...(item.status !== "new"
          ? { firstResponseAt: now - (index + 1) * 2 * DAY + 40 * 60_000 }
          : {}),
        isDemo: true,
      });
      leads += 1;

      if (item.status !== "new") {
        await ctx.db.insert("leadNotes", {
          leadId,
          body:
            item.type === "valuation"
              ? "Poslata indikativna procena, zakazan izlazak na adresu."
              : "Prvi kontakt telefonom. Klijent traži termin razgledanja.",
          at: now - (index + 1) * 2 * DAY + 45 * 60_000,
        });
      }

      // Two viewings, on the next working days, inside the agent's hours.
      if (listing !== undefined && viewings < 3) {
        const day = new Date(now + (viewings + 2) * DAY);
        const start = Date.UTC(
          day.getUTCFullYear(),
          day.getUTCMonth(),
          day.getUTCDate(),
          10 + viewings * 2,
          0,
        );
        await ctx.db.insert("viewings", {
          listingId: listing._id,
          leadId,
          agentId: listing.agentId,
          start,
          end: start + 3_600_000,
          mode: viewings === 1 ? "video" : "in_person",
          status: viewings === 0 ? "confirmed" : "requested",
          isDemo: true,
        });
        viewings += 1;
      }
    }

    return { leads, viewings };
  },
});

