import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import { diffFields, logActivity } from "./lib/activity";
import { requireRole } from "./lib/auth";
import { appError, forbidden, invalidInput, notFound } from "./lib/errors";
import { requireEmail } from "./lib/rateLimit";
import { slugify } from "./lib/slug";
import { assertImageRef, releaseReplacedImage, deleteBlobIfPresent } from "./lib/storage";
import {
  availabilitySlotV,
  imageV,
  l10nV,
  type ImageRef,
  type L10n,
} from "./lib/validators";

const MANAGERS = ["admin", "manager"] as const;
const READERS = ["admin", "manager", "agent", "editor"] as const;

const agentAdminRowV = v.object({
  _id: v.id("agents"),
  slug: v.string(),
  name: v.string(),
  role: l10nV,
  bio: v.optional(l10nV),
  /** The stored reference, so an editor can keep or replace it. */
  photo: v.optional(imageV),
  photoUrl: v.optional(v.string()),
  languages: v.array(v.string()),
  phone: v.optional(v.string()),
  viber: v.optional(v.string()),
  whatsapp: v.optional(v.string()),
  email: v.optional(v.string()),
  areas: v.array(v.id("locations")),
  licenseId: v.optional(v.string()),
  isPublic: v.boolean(),
  order: v.number(),
  availability: v.array(availabilitySlotV),
  userId: v.optional(v.id("users")),
  listingCount: v.number(),
  listingCountCapped: v.boolean(),
  isDemo: v.boolean(),
});

/** The Team page shows "50+" rather than reading every listing per agent. */
const LISTING_COUNT_CAP = 50;
/** A small agency: the whole team fits in one read. */
const TEAM_CAP = 200;
const MAX_LANGUAGES = 8;
const MAX_AREAS = 20;
/** Weekly viewing ranges per agent (the Viewings editor allows five a day). */
const MAX_SLOTS = 40;
/** Availability times: zero-padded 24-hour `HH:MM`, on a 15-minute grid. */
const HM_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;
const SLOT_STEP_MIN = 15;
/** ISO 639-1/-2 language codes (`sr`, `en`, `hu`, `ita`), what `Intl.DisplayNames` reads. */
const LANGUAGE_RE = /^[a-z]{2,3}$/;
/** Digits, spaces and the usual phone punctuation; at least 6 characters. */
const PHONE_RE = /^\+?[0-9 ()/.-]{6,24}$/;

export const list = query({
  args: {},
  returns: v.array(agentAdminRowV),
  handler: async (ctx) => {
    const viewer = await requireRole(ctx, READERS);
    // Only the profile editors (admin, manager) get the raw photo reference;
    // anyone else could otherwise attach and later delete a colleague's blob.
    const showPhotoRef = viewer.role === "admin" || viewer.role === "manager";
    const docs = await ctx.db.query("agents").take(TEAM_CAP);
    docs.sort((a, b) => a.order - b.order || a._creationTime - b._creationTime);

    const out = [];
    for (const doc of docs) {
      const photoUrl =
        doc.photo === undefined
          ? null
          : doc.photo.kind === "url"
            ? doc.photo.url
            : await ctx.storage.getUrl(doc.photo.storageId);
      // Deliberately capped: this is a "has work assigned" badge, not a metric.
      // Reading 300 listings per agent turned the Team page into an 11 MB query.
      const listings = await ctx.db
        .query("listings")
        .withIndex("by_agentId", (q) => q.eq("agentId", doc._id))
        .take(LISTING_COUNT_CAP + 1);
      out.push({
        _id: doc._id,
        slug: doc.slug,
        name: doc.name,
        role: doc.role,
        ...(doc.bio !== undefined ? { bio: doc.bio } : {}),
        ...(doc.photo !== undefined && showPhotoRef ? { photo: doc.photo } : {}),
        ...(photoUrl !== null ? { photoUrl } : {}),
        languages: doc.languages,
        ...(doc.phone !== undefined ? { phone: doc.phone } : {}),
        ...(doc.viber !== undefined ? { viber: doc.viber } : {}),
        ...(doc.whatsapp !== undefined ? { whatsapp: doc.whatsapp } : {}),
        ...(doc.email !== undefined ? { email: doc.email } : {}),
        areas: doc.areas,
        ...(doc.licenseId !== undefined ? { licenseId: doc.licenseId } : {}),
        isPublic: doc.isPublic,
        order: doc.order,
        availability: doc.availability,
        ...(doc.userId !== undefined ? { userId: doc.userId } : {}),
        listingCount: Math.min(listings.length, LISTING_COUNT_CAP),
        listingCountCapped: listings.length > LISTING_COUNT_CAP,
        isDemo: doc.isDemo,
      });
    }
    return out;
  },
});

/* ------------------------------------------------------------------ helpers */

/** Trimmed text, capped; `undefined` when empty. */
function cleanText(value: string | undefined, max: number): string | undefined {
  if (value === undefined) return undefined;
  const text = value.trim().replace(/\s+/g, " ").slice(0, max);
  return text.length > 0 ? text : undefined;
}

function cleanPhone(value: string | undefined, label: string): string | undefined {
  const text = cleanText(value, 24);
  if (text !== undefined && !PHONE_RE.test(text)) {
    invalidInput(`${label}: unesite broj sa pozivnim brojem, npr. +381 64 123 4567.`);
  }
  return text;
}

/**
 * Localized text with every locale trimmed and empty translations dropped.
 * Serbian is the source language: a translation without it is refused.
 */
function cleanL10n(
  value: L10n | undefined,
  max: number,
  label: string,
  required: boolean,
): L10n | undefined {
  const sr = (value?.sr ?? "").trim().slice(0, max);
  const out: L10n = { sr };
  let translated = false;
  for (const key of ["en", "ru", "de"] as const) {
    const text = value?.[key]?.trim().slice(0, max);
    if (text !== undefined && text.length > 0) {
      out[key] = text;
      translated = true;
    }
  }
  if (sr.length === 0) {
    if (required) invalidInput(`${label} na srpskom je obavezno.`);
    if (translated) invalidInput(`${label}: prvo unesite srpski tekst, pa prevode.`);
    return undefined;
  }
  return out;
}

function cleanLanguages(values: readonly string[]): string[] {
  const out: string[] = [];
  for (const raw of values) {
    const code = raw.trim().toLowerCase();
    if (code.length === 0 || out.includes(code)) continue;
    if (!LANGUAGE_RE.test(code)) {
      invalidInput(`„${raw.trim().slice(0, 20)}” nije kod jezika. Koristite dvoslovne kodove, npr. it, fr, hu.`);
    }
    out.push(code);
  }
  if (out.length > MAX_LANGUAGES) invalidInput(`Najviše ${MAX_LANGUAGES} jezika.`);
  return out;
}

/** Distinct, existing locations; a location deleted meanwhile is dropped. */
async function cleanAreas(
  ctx: MutationCtx,
  ids: readonly Id<"locations">[],
): Promise<Id<"locations">[]> {
  const unique = [...new Set(ids)];
  if (unique.length > MAX_AREAS) invalidInput(`Najviše ${MAX_AREAS} lokacija po agentu.`);
  const out: Id<"locations">[] = [];
  for (const id of unique) {
    if ((await ctx.db.get("locations", id)) !== null) out.push(id);
  }
  return out;
}

async function slugTaken(
  ctx: QueryCtx,
  slug: string,
  self: Id<"agents"> | undefined,
): Promise<boolean> {
  const clash = await ctx.db
    .query("agents")
    .withIndex("by_slug", (q) => q.eq("slug", slug))
    .first();
  return clash !== null && clash._id !== self;
}

/** `base`, else `base-2`, `base-3`… (the public profile lives at /agenti/<slug>). */
async function freeSlug(ctx: QueryCtx, base: string): Promise<string> {
  if (!(await slugTaken(ctx, base, undefined))) return base;
  for (let suffix = 2; suffix <= 30; suffix += 1) {
    const candidate = `${base}-${suffix}`;
    if (!(await slugTaken(ctx, candidate, undefined))) return candidate;
  }
  return `${base}-${Date.now().toString(36)}`;
}

const DEFAULT_AVAILABILITY = [
  { weekday: 1, from: "09:00", to: "17:00" },
  { weekday: 2, from: "09:00", to: "17:00" },
  { weekday: 3, from: "09:00", to: "17:00" },
  { weekday: 4, from: "09:00", to: "17:00" },
  { weekday: 5, from: "09:00", to: "16:00" },
];

/** Title of a profile created from an invite, until someone edits it. */
export const DEFAULT_AGENT_ROLE: L10n = { sr: "Agent", en: "Agent", ru: "Агент", de: "Makler" };

type ProfileFields = Omit<
  Doc<"agents">,
  "_id" | "_creationTime" | "slug" | "order" | "availability" | "isDemo" | "userId"
>;

/**
 * Inserts a new agent profile at the end of the team order. Shared by
 * `upsert` and `invites.create` (which makes a hidden profile for a new
 * agent in the same transaction as the invite). The caller logs activity.
 */
export async function insertAgentProfile(
  ctx: MutationCtx,
  fields: ProfileFields,
  slugBase?: string,
): Promise<{ id: Id<"agents">; slug: string }> {
  const slug = await freeSlug(ctx, slugify(slugBase ?? fields.name));
  const team = await ctx.db.query("agents").take(TEAM_CAP);
  const order = team.reduce((max, doc) => Math.max(max, doc.order + 1), 0);
  const id = await ctx.db.insert("agents", {
    ...fields,
    slug,
    order,
    availability: DEFAULT_AVAILABILITY,
    isDemo: false,
  });
  return { id, slug };
}

/**
 * Invites for this profile that can still be accepted at `now`. Accepting one
 * links the profile to the new account (`auth.ts`), so linking the profile to
 * someone else meanwhile would be silently undone.
 */
export async function openInvitesForAgent(
  ctx: QueryCtx,
  agentId: Id<"agents">,
  now: number,
): Promise<Doc<"invites">[]> {
  const invites = await ctx.db
    .query("invites")
    .withIndex("by_agentId", (q) => q.eq("agentId", agentId))
    .order("desc")
    .take(20);
  return invites.filter(
    (invite) =>
      invite.acceptedAt === undefined &&
      invite.revokedAt === undefined &&
      invite.expiresAt > now,
  );
}

/** The fields the change log compares. */
function profileSnapshot(doc: Partial<Doc<"agents">>): Record<string, unknown> {
  return {
    name: doc.name,
    slug: doc.slug,
    role: doc.role,
    bio: doc.bio,
    // The storage id itself, so replacing one upload with another is a change.
    photo: doc.photo === undefined ? undefined : doc.photo.kind === "url" ? doc.photo.url : `slika:${doc.photo.storageId}`,
    languages: doc.languages?.join(", "),
    phone: doc.phone,
    viber: doc.viber,
    whatsapp: doc.whatsapp,
    email: doc.email,
    areas: doc.areas?.join(","),
    licenseId: doc.licenseId,
    isPublic: doc.isPublic,
  };
}

function sameImage(a: ImageRef | undefined, b: ImageRef | undefined): boolean {
  if (a === undefined || b === undefined) return a === b;
  if (a.kind === "storage" && b.kind === "storage") return a.storageId === b.storageId;
  if (a.kind === "url" && b.kind === "url") return a.url === b.url;
  return false;
}

/* ---------------------------------------------------------------- mutations */

export const upsert = mutation({
  args: {
    id: v.optional(v.id("agents")),
    name: v.string(),
    /** Omitted on update: the public URL stays as it is. */
    slug: v.optional(v.string()),
    role: l10nV,
    bio: v.optional(l10nV),
    photo: v.optional(imageV),
    languages: v.array(v.string()),
    phone: v.optional(v.string()),
    viber: v.optional(v.string()),
    whatsapp: v.optional(v.string()),
    email: v.optional(v.string()),
    areas: v.array(v.id("locations")),
    licenseId: v.optional(v.string()),
    isPublic: v.boolean(),
  },
  returns: v.object({ id: v.id("agents"), slug: v.string() }),
  handler: async (ctx, args) => {
    const viewer = await requireRole(ctx, MANAGERS);
    const name = cleanText(args.name, 80);
    if (name === undefined || name.length < 2) invalidInput("Ime agenta je obavezno.");

    const existing = args.id !== undefined ? await ctx.db.get("agents", args.id) : null;
    if (args.id !== undefined && existing === null) notFound("Agent");

    const emailText = cleanText(args.email, 254);
    const role = cleanL10n(args.role, 80, "Zvanje", true);
    if (role === undefined) invalidInput("Zvanje na srpskom je obavezno.");
    const fields: ProfileFields = {
      name,
      role,
      bio: cleanL10n(args.bio, 2000, "Biografija", false),
      photo: args.photo,
      languages: cleanLanguages(args.languages),
      phone: cleanPhone(args.phone, "Telefon"),
      viber: cleanPhone(args.viber, "Viber"),
      whatsapp: cleanPhone(args.whatsapp, "WhatsApp"),
      email: emailText !== undefined ? requireEmail(emailText) : undefined,
      areas: await cleanAreas(ctx, args.areas),
      licenseId: cleanText(args.licenseId, 40),
      isPublic: args.isPublic,
    };
    // Only a NEW or changed photo is checked: an untouched stored one was
    // validated when it was saved.
    if (fields.photo !== undefined && !sameImage(fields.photo, existing?.photo)) {
      await assertImageRef(ctx, fields.photo);
    }

    const requestedSlug = args.slug !== undefined ? slugify(args.slug) : undefined;
    if (requestedSlug !== undefined && (requestedSlug.length < 2 || requestedSlug === "x")) {
      invalidInput("Adresa profila (slug) mora imati bar dva slova ili broja latinicom.");
    }

    if (existing !== null) {
      const slug = requestedSlug ?? existing.slug;
      if (slug !== existing.slug && (await slugTaken(ctx, slug, existing._id))) {
        invalidInput(`Adresa /agenti/${slug} je zauzeta. Izaberite drugu.`);
      }
      const diff = diffFields(profileSnapshot(existing), profileSnapshot({ ...fields, slug }));
      if (diff.length === 0) return { id: existing._id, slug };

      // Editing a seeded profile makes it the agency's own (demo purge keeps it).
      await ctx.db.patch("agents", existing._id, { ...fields, slug, isDemo: false });
      await releaseReplacedImage(ctx, existing.photo, fields.photo);
      await logActivity(ctx, {
        entity: "agent",
        entityId: existing._id,
        action: "agent.updated",
        summary: name,
        diff,
        by: viewer._id,
      });
      return { id: existing._id, slug };
    }

    if (requestedSlug !== undefined && (await slugTaken(ctx, requestedSlug, undefined))) {
      invalidInput(`Adresa /agenti/${requestedSlug} je zauzeta. Izaberite drugu.`);
    }
    const created = await insertAgentProfile(ctx, fields, requestedSlug);
    await logActivity(ctx, {
      entity: "agent",
      entityId: created.id,
      action: "agent.created",
      summary: name,
      by: viewer._id,
    });
    return created;
  },
});

/** The "Javni profil" switch of the team list: shows or hides /agenti/<slug>. */
export const setPublic = mutation({
  args: { id: v.id("agents"), isPublic: v.boolean() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const viewer = await requireRole(ctx, MANAGERS);
    const agent = await ctx.db.get("agents", args.id);
    if (agent === null) notFound("Agent");
    if (agent.isPublic === args.isPublic) return null;
    await ctx.db.patch("agents", args.id, { isPublic: args.isPublic, isDemo: false });
    await logActivity(ctx, {
      entity: "agent",
      entityId: args.id,
      action: args.isPublic ? "agent.published" : "agent.hidden",
      summary: agent.name,
      diff: diffFields({ isPublic: agent.isPublic }, { isPublic: args.isPublic }),
      by: viewer._id,
    });
    return null;
  },
});

/** `09:30` → 570 (minutes after midnight); `null` unless strict `HH:MM`. */
function minutesOf(value: string): number | null {
  const match = HM_RE.exec(value);
  if (match === null) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

/**
 * Weekly viewing ranges (Belgrade wall-clock time) that feed the public
 * booking widget. Strict on input so every reader may compare the stored
 * strings: zero-padded `HH:MM`, 15-minute steps, weekday 0–6 (0 = Sunday),
 * start before end, no overlapping ranges on one day. Stored sorted.
 */
export const setAvailability = mutation({
  args: { id: v.id("agents"), availability: v.array(availabilitySlotV) },
  returns: v.null(),
  handler: async (ctx, args) => {
    const viewer = await requireRole(ctx, ["admin", "manager", "agent"]);
    const agent = await ctx.db.get("agents", args.id);
    if (agent === null) notFound("Agent");
    if (viewer.role === "agent" && viewer.agentId !== args.id) {
      forbidden("izmenu tuđeg radnog vremena (možete menjati samo svoje radno vreme)");
    }
    if (args.availability.length > MAX_SLOTS) {
      invalidInput(`Najviše ${MAX_SLOTS} termina nedeljno.`);
    }

    const slots: { weekday: number; from: number; to: number }[] = [];
    for (const slot of args.availability) {
      if (!Number.isInteger(slot.weekday) || slot.weekday < 0 || slot.weekday > 6) {
        invalidInput("Dan u nedelji mora biti 0–6.");
      }
      const from = minutesOf(slot.from);
      const to = minutesOf(slot.to);
      if (from === null || to === null) {
        invalidInput("Vreme se unosi kao HH:MM sa dve cifre, npr. 09:00.");
      }
      if (from % SLOT_STEP_MIN !== 0 || to % SLOT_STEP_MIN !== 0) {
        invalidInput("Vreme se unosi u koracima od 15 minuta.");
      }
      if (to <= from) invalidInput("Kraj mora biti posle početka.");
      slots.push({ weekday: slot.weekday, from, to });
    }
    slots.sort((a, b) => a.weekday - b.weekday || a.from - b.from);
    for (let index = 1; index < slots.length; index += 1) {
      const previous = slots[index - 1];
      const current = slots[index];
      if (current.weekday === previous.weekday && current.from < previous.to) {
        invalidInput("Termini istog dana se preklapaju. Spojite ih ili skratite.");
      }
    }

    // The input strings were already canonical; only the order is normalized.
    const availability = slots.map((slot) => ({
      weekday: slot.weekday,
      from: `${String(Math.floor(slot.from / 60)).padStart(2, "0")}:${String(slot.from % 60).padStart(2, "0")}`,
      to: `${String(Math.floor(slot.to / 60)).padStart(2, "0")}:${String(slot.to % 60).padStart(2, "0")}`,
    }));
    const diff = diffFields(
      { availability: agent.availability },
      { availability },
    );
    if (diff.length === 0) return null;

    await ctx.db.patch("agents", args.id, { availability, isDemo: false });
    await logActivity(ctx, {
      entity: "agent",
      entityId: args.id,
      action: "agent.availability",
      summary: agent.name,
      diff,
      by: viewer._id,
    });
    return null;
  },
});

/** The team order on the site (`/agenti`): `ids` is the full new order. */
export const reorder = mutation({
  args: { ids: v.array(v.id("agents")) },
  returns: v.null(),
  handler: async (ctx, args) => {
    const viewer = await requireRole(ctx, MANAGERS);
    if (args.ids.length > TEAM_CAP) invalidInput("Previše profila u jednom redosledu.");
    if (new Set(args.ids).size !== args.ids.length) {
      invalidInput("Redosled sadrži isti profil dva puta.");
    }
    const team = await ctx.db.query("agents").take(TEAM_CAP + 1);
    const listed = new Set<string>(args.ids);
    if (team.length !== args.ids.length || team.some((doc) => !listed.has(doc._id))) {
      appError("CONFLICT", "Spisak profila se promenio u međuvremenu. Osvežite stranicu i pokušajte ponovo.");
    }
    let order = 0;
    let moved = 0;
    for (const id of args.ids) {
      const doc = await ctx.db.get("agents", id);
      if (doc === null) continue;
      if (doc.order !== order) {
        await ctx.db.patch("agents", id, { order });
        moved += 1;
      }
      order += 1;
    }
    if (moved > 0) {
      await logActivity(ctx, {
        entity: "agent",
        action: "agent.reordered",
        summary: `Promenjen redosled (${moved})`,
        by: viewer._id,
      });
    }
    return null;
  },
});

/**
 * Deletes a profile that has no history. One with listings, leads or
 * viewings, or linked to an active staff account, is refused: hide it from
 * the site instead (`isPublic: false`), so past records keep their agent.
 */
export const remove = mutation({
  args: { id: v.id("agents") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const viewer = await requireRole(ctx, MANAGERS);
    const agent = await ctx.db.get("agents", args.id);
    if (agent === null) notFound("Agent");

    const listings = await ctx.db
      .query("listings")
      .withIndex("by_agentId", (q) => q.eq("agentId", args.id))
      .take(1);
    if (listings.length > 0) {
      invalidInput(
        "Agent ima dodeljene nekretnine. Prvo ih prebacite na drugog agenta.",
      );
    }
    const leads = await ctx.db
      .query("leads")
      .withIndex("by_agentId_and_status", (q) => q.eq("agentId", args.id))
      .take(1);
    const viewings = await ctx.db
      .query("viewings")
      .withIndex("by_agentId_and_start", (q) => q.eq("agentId", args.id))
      .take(1);
    if (leads.length > 0 || viewings.length > 0) {
      invalidInput(
        "Agent ima upite ili razgledanja u istoriji. Umesto brisanja isključite javni profil.",
      );
    }
    const posts = await ctx.db
      .query("posts")
      .withIndex("by_authorAgentId", (q) => q.eq("authorAgentId", args.id))
      .take(1);
    if (posts.length > 0) {
      invalidInput("Agent je autor tekstova u Magazinu. Prvo im promenite autora ili isključite javni profil.");
    }

    const user = agent.userId !== undefined ? await ctx.db.get("users", agent.userId) : null;
    if (user !== null && user.status === "active" && user.agentId === agent._id) {
      invalidInput(
        "Profil je povezan sa aktivnim nalogom. Prvo deaktivirajte nalog ili ga povežite sa drugim profilom.",
      );
    }

    // An invite that would link this profile on acceptance can no longer work.
    const now = Date.now();
    for (const invite of await openInvitesForAgent(ctx, agent._id, now)) {
      await ctx.db.patch("invites", invite._id, { revokedAt: now });
    }
    if (user !== null && user.agentId === agent._id) {
      await ctx.db.patch("users", user._id, { agentId: undefined });
    }
    if (agent.photo?.kind === "storage") {
      await deleteBlobIfPresent(ctx, agent.photo.storageId);
    }
    await ctx.db.delete("agents", args.id);
    await logActivity(ctx, {
      entity: "agent",
      entityId: args.id,
      action: "agent.deleted",
      summary: agent.name,
      by: viewer._id,
    });
    return null;
  },
});
