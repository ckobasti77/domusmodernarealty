import { v } from "convex/values";
import type { Infer } from "convex/values";
import type { Doc } from "./_generated/dataModel";
import { mutation, query } from "./_generated/server";
import schema from "./schema";
import { logActivity } from "./lib/activity";
import { requireRole } from "./lib/auth";
import { isPlaceholderRegistry } from "./lib/checklist";
import { imageUrl } from "./lib/dto";
import { invalidInput } from "./lib/errors";
import { assertImageRef, assertPdfUpload, releaseReplacedImage, deleteBlobIfPresent } from "./lib/storage";
import { availabilitySlotV, imageV, l10nV } from "./lib/validators";
import type { ImageRef, L10n } from "./lib/validators";
import { loadSettings } from "./settings";

/**
 * Agency settings (PRD B11). Admin only — managers run the agency but do not
 * change its legal identity. The browser validates the same rules with zod
 * (`components/admin/settings/schema.ts`); only these checks count.
 */

const ADMINS = ["admin"] as const;

type Settings = Doc<"settings">;

export const get = query({
  args: {},
  returns: v.union(
    v.object({
      settings: schema.doc("settings"),
      termsPdfUrl: v.optional(v.string()),
      termsPdfBytes: v.optional(v.number()),
      ogImageUrl: v.optional(v.string()),
    }),
    v.null(),
  ),
  handler: async (ctx) => {
    await requireRole(ctx, ADMINS);
    const settings = await loadSettings(ctx);
    if (settings === null) return null;

    const pdf =
      settings.termsPdf !== undefined ? await ctx.db.system.get("_storage", settings.termsPdf) : null;
    const termsPdfUrl =
      settings.termsPdf !== undefined ? await ctx.storage.getUrl(settings.termsPdf) : null;
    const ogImageUrl =
      settings.seo.ogImage !== undefined ? await imageUrl(ctx, settings.seo.ogImage) : null;

    return {
      settings,
      ...(termsPdfUrl !== null ? { termsPdfUrl } : {}),
      ...(pdf !== null ? { termsPdfBytes: pdf.size } : {}),
      ...(ogImageUrl !== null ? { ogImageUrl } : {}),
    };
  },
});

/* ------------------------------------------------------------------ rules */

const PIB_RE = /^\d{9}$/;
const MB_RE = /^\d{8}$/;
const PHONE_RE = /^\+?[\d\s()./-]{6,24}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const DOMAIN_RE = /^(?=.{3,100}$)([a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}$/;
const GA4_RE = /^G-[A-Z0-9]{4,12}$/;
const PIXEL_RE = /^\d{8,20}$/;

/** Serbia's bounding box with a small margin. */
const LAT_RANGE = [41.8, 46.3] as const;
const LNG_RANGE = [18.8, 23.1] as const;

/** Same limits as a listing's meta title / description. */
const SEO_TITLE_MAX = 70;
const SEO_DESCRIPTION_MAX = 170;
const COMMISSION_MAX = 1500;
const MAX_PHONES = 5;
const MAX_SLOTS = 21;

const SOCIAL_HOSTS = {
  instagram: ["instagram.com"],
  facebook: ["facebook.com", "fb.com"],
  linkedin: ["linkedin.com"],
  youtube: ["youtube.com", "youtu.be"],
} as const;
type SocialKey = keyof typeof SOCIAL_HOSTS;

const SOCIAL_LABEL: Record<SocialKey, string> = {
  instagram: "Instagram",
  facebook: "Facebook",
  linkedin: "LinkedIn",
  youtube: "YouTube",
};

const WEEKDAY_SHORT = ["Ned", "Pon", "Uto", "Sre", "Čet", "Pet", "Sub"] as const;

function requiredText(value: string, label: string, max: number): string {
  const text = value.trim();
  if (text.length === 0) invalidInput(`Polje „${label}” je obavezno.`);
  if (text.length > max) invalidInput(`Polje „${label}” može imati najviše ${max} znakova.`);
  return text;
}

/** Trimmed text, or `undefined` (the field is removed) when empty. */
function optionalText(value: string, label: string, max: number): string | undefined {
  const text = value.trim();
  if (text.length === 0) return undefined;
  if (text.length > max) invalidInput(`Polje „${label}” može imati najviše ${max} znakova.`);
  return text;
}

function phone(value: string, label: string): string {
  const text = value.trim().replace(/\s+/g, " ");
  const digits = text.replace(/\D/g, "").length;
  if (!PHONE_RE.test(text) || digits < 6 || digits > 15) {
    invalidInput(`${label}: unesite broj u obliku +381 11 123 4567.`);
  }
  return text;
}

function optionalPhone(value: string, label: string): string | undefined {
  return value.trim().length === 0 ? undefined : phone(value, label);
}

function localized(value: L10n, label: string, max: number): L10n {
  const out: L10n = { sr: requiredText(value.sr, `${label} (srpski)`, max) };
  for (const key of ["en", "ru", "de"] as const) {
    const text = value[key];
    if (text === undefined) continue;
    const clean = optionalText(text, `${label} (${key.toUpperCase()})`, max);
    if (clean !== undefined) out[key] = clean;
  }
  return out;
}

function socialUrl(key: SocialKey, value: string | undefined): string | undefined {
  if (value === undefined) return undefined;
  const text = value.trim();
  if (text.length === 0) return undefined;
  const label = SOCIAL_LABEL[key];
  if (text.length > 200) invalidInput(`${label}: adresa je predugačka.`);
  let url: URL;
  try {
    url = new URL(text);
  } catch {
    invalidInput(`${label}: unesite punu adresu, npr. https://www.${SOCIAL_HOSTS[key][0]}/…`);
  }
  if (url.protocol !== "https:") invalidInput(`${label}: adresa mora počinjati sa https://.`);
  const host = url.hostname.toLowerCase();
  const allowed = SOCIAL_HOSTS[key].some((domain) => host === domain || host.endsWith(`.${domain}`));
  if (!allowed) invalidInput(`${label}: adresa mora biti na domenu ${SOCIAL_HOSTS[key].join(" ili ")}.`);
  return url.toString();
}

function minutesOf(time: string): number {
  const [hours, minutes] = time.split(":");
  return Number(hours) * 60 + Number(minutes);
}

/** Valid, non-overlapping slots, sorted Monday first. */
function officeHours(slots: readonly Settings["officeHours"][number][]): Settings["officeHours"] {
  if (slots.length > MAX_SLOTS) invalidInput(`Radno vreme može imati najviše ${MAX_SLOTS} termina.`);
  const order = (weekday: number) => (weekday + 6) % 7;
  const sorted = slots
    .map((slot) => ({ weekday: slot.weekday, from: slot.from.trim(), to: slot.to.trim() }))
    .sort((a, b) => order(a.weekday) - order(b.weekday) || minutesOf(a.from) - minutesOf(b.from));
  for (const [index, slot] of sorted.entries()) {
    if (!Number.isInteger(slot.weekday) || slot.weekday < 0 || slot.weekday > 6) {
      invalidInput("Radno vreme: nepoznat dan u nedelji.");
    }
    const day = WEEKDAY_SHORT[slot.weekday];
    if (!TIME_RE.test(slot.from) || !TIME_RE.test(slot.to)) {
      invalidInput(`Radno vreme (${day}): vreme unesite kao SS:MM.`);
    }
    if (minutesOf(slot.from) >= minutesOf(slot.to)) {
      invalidInput(`Radno vreme (${day}): početak mora biti pre kraja.`);
    }
    const previous = sorted[index - 1];
    if (
      previous !== undefined &&
      previous.weekday === slot.weekday &&
      minutesOf(slot.from) < minutesOf(previous.to)
    ) {
      invalidInput(`Radno vreme (${day}): termini se preklapaju.`);
    }
  }
  return sorted;
}

function sameImage(a: ImageRef | undefined, b: ImageRef | undefined): boolean {
  if (a === undefined || b === undefined) return a === b;
  if (a.kind === "storage" && b.kind === "storage") return a.storageId === b.storageId;
  if (a.kind === "url" && b.kind === "url") return a.url === b.url;
  return false;
}

/** The seeded placeholders: PIB, MB or registry number made of zeros only. */
function hasPlaceholderLegalData(doc: Pick<Settings, "pib" | "mb" | "registryNo">): boolean {
  return /^0*$/.test(doc.pib) || /^0*$/.test(doc.mb) || isPlaceholderRegistry(doc.registryNo);
}

/* ------------------------------------------------------------------- diff */

function storageMark(id: string): string {
  return `…${id.slice(-8)}`;
}

function deepEqual(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((item, index) => deepEqual(item, b[index]));
  }
  if (typeof a === "object" && typeof b === "object" && a !== null && b !== null && !Array.isArray(a) && !Array.isArray(b)) {
    const left = a as Record<string, unknown>;
    const right = b as Record<string, unknown>;
    // A key set to `undefined` equals a missing key (that is how a field is cleared).
    return [...new Set([...Object.keys(left), ...Object.keys(right)])].every((key) => deepEqual(left[key], right[key]));
  }
  return false;
}

/** Characters of each value kept in the log (the activity table stores strings). */
const LOG_VALUE_MAX = 200;

/**
 * Clips a long before/after pair for the log around the first difference, so
 * a change at character 900 of a long text is still visible in the diff.
 */
function clipPair(from: string | undefined, to: string | undefined): { from?: string; to?: string } {
  let start = 0;
  if (from !== undefined && to !== undefined && Math.max(from.length, to.length) > LOG_VALUE_MAX) {
    let index = 0;
    while (index < from.length && index < to.length && from[index] === to[index]) index += 1;
    start = Math.max(0, index - 40);
  }
  const clip = (value: string | undefined) =>
    value === undefined
      ? undefined
      : `${start > 0 ? "…" : ""}${value.slice(start, start + LOG_VALUE_MAX)}${value.length > start + LOG_VALUE_MAX ? "…" : ""}`;
  const out: { from?: string; to?: string } = {};
  const clippedFrom = clip(from);
  const clippedTo = clip(to);
  if (clippedFrom !== undefined) out.from = clippedFrom;
  if (clippedTo !== undefined) out.to = clippedTo;
  return out;
}

/**
 * The field-level log of a change. Values are compared in full (never the
 * clipped display text), and every top-level field that changed gets at
 * least one entry, even when its display text happens to read the same.
 */
function logDiff(
  before: Editable,
  after: Editable,
  changedKeys: readonly string[],
): { field: string; from?: string; to?: string }[] {
  const left = snapshot(before);
  const right = snapshot(after);
  const entries: { field: string; from?: string; to?: string }[] = [];
  for (const field of new Set([...Object.keys(left), ...Object.keys(right)])) {
    if (left[field] !== right[field]) entries.push({ field, ...clipPair(left[field], right[field]) });
  }
  for (const key of changedKeys) {
    const covered = entries.some((entry) => entry.field === key || entry.field.startsWith(`${key}.`));
    if (!covered) entries.push({ field: key, from: "(prethodna vrednost)", to: "(nova vrednost)" });
  }
  return entries;
}

function imageMark(image: ImageRef | undefined): string | undefined {
  if (image === undefined) return undefined;
  return image.kind === "url" ? image.url : `otpremljena slika ${storageMark(image.storageId)}`;
}

function hoursText(slots: Settings["officeHours"]): string {
  if (slots.length === 0) return "zatvoreno";
  return slots.map((slot) => `${WEEKDAY_SHORT[slot.weekday]} ${slot.from}–${slot.to}`).join(", ");
}

type Editable = Omit<Settings, "_id" | "_creationTime" | "key" | "updatedAt">;

/**
 * Flat, human-readable snapshot for the change log: nested objects become
 * dotted keys (`socials.instagram`, `seo.defaultTitle.en`) and storage ids are
 * shortened, so the activity diff reads field by field. Values are full
 * strings; `logDiff` clips them only for display.
 */
function snapshot(doc: Editable): Record<string, string | undefined> {
  const text = (value: number | undefined) => (value === undefined ? undefined : String(value));
  const out: Record<string, string | undefined> = {
    companyName: doc.companyName,
    legalName: doc.legalName,
    address: doc.address,
    pib: doc.pib,
    mb: doc.mb,
    registryNo: doc.registryNo,
    insurance: doc.insurance,
    phones: doc.phones.join(", "),
    email: doc.email,
    viber: doc.viber,
    whatsapp: doc.whatsapp,
    officeHours: hoursText(doc.officeHours),
    officeLat: text(doc.officeLat),
    officeLng: text(doc.officeLng),
    termsPdf: doc.termsPdf !== undefined ? `PDF ${storageMark(doc.termsPdf)}` : undefined,
    "mortgage.rate": text(doc.mortgage.rate),
    "mortgage.years": text(doc.mortgage.years),
    "mortgage.downPct": text(doc.mortgage.downPct),
    eurRsd: text(doc.eurRsd),
    "seo.ogImage": imageMark(doc.seo.ogImage),
    "analytics.plausibleDomain": doc.analytics.plausibleDomain,
    "analytics.ga4Id": doc.analytics.ga4Id,
    "analytics.metaPixelId": doc.analytics.metaPixelId,
    isDemo: doc.isDemo ? "da" : "ne",
  };
  for (const key of Object.keys(SOCIAL_HOSTS) as SocialKey[]) {
    out[`socials.${key}`] = doc.socials[key];
  }
  for (const locale of ["sr", "en", "ru", "de"] as const) {
    out[`commissionText.${locale}`] = doc.commissionText[locale];
    out[`seo.defaultTitle.${locale}`] = doc.seo.defaultTitle[locale];
    out[`seo.defaultDescription.${locale}`] = doc.seo.defaultDescription[locale];
  }
  return out;
}

/** Section names for the one-line summary of a change. */
const SECTION_OF: readonly (readonly [string, string])[] = [
  ["companyName", "naziv"],
  ["legalName", "pravni podaci"],
  ["address", "pravni podaci"],
  ["pib", "PIB"],
  ["mb", "matični broj"],
  ["registryNo", "Registar posrednika"],
  ["insurance", "osiguranje"],
  ["phones", "kontakt"],
  ["email", "kontakt"],
  ["viber", "kontakt"],
  ["whatsapp", "kontakt"],
  ["officeHours", "radno vreme"],
  ["officeLat", "lokacija kancelarije"],
  ["officeLng", "lokacija kancelarije"],
  ["socials.", "društvene mreže"],
  ["commissionText.", "provizija"],
  ["termsPdf", "opšti uslovi (PDF)"],
  ["mortgage.", "kredit"],
  ["eurRsd", "kurs"],
  ["seo.", "SEO"],
  ["analytics.", "analitika"],
  ["isDemo", "demo status"],
];

function summaryOf(fields: readonly string[]): string {
  const sections: string[] = [];
  for (const field of fields) {
    const section =
      SECTION_OF.find(([key]) => (key.endsWith(".") ? field.startsWith(key) : field === key))?.[1] ?? field;
    if (!sections.includes(section)) sections.push(section);
  }
  return `Izmenjeno: ${sections.join(", ")}`;
}

/* ----------------------------------------------------------------- update */

const socialsV = v.object({
  instagram: v.optional(v.string()),
  facebook: v.optional(v.string()),
  linkedin: v.optional(v.string()),
  youtube: v.optional(v.string()),
});

/**
 * Every field is optional: the form sends only the sections that changed, so
 * two admins editing different sections do not overwrite each other. Empty
 * strings clear optional text fields; `null` clears the PDF and coordinates.
 */
export const settingsPatchV = v.object({
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
  socials: v.optional(socialsV),
  officeHours: v.optional(v.array(availabilitySlotV)),
  officeLat: v.optional(v.union(v.number(), v.null())),
  officeLng: v.optional(v.union(v.number(), v.null())),
  commissionText: v.optional(l10nV),
  termsPdf: v.optional(v.union(v.id("_storage"), v.null())),
  mortgage: v.optional(v.object({ rate: v.number(), years: v.number(), downPct: v.number() })),
  eurRsd: v.optional(v.number()),
  seo: v.optional(
    v.object({ defaultTitle: l10nV, defaultDescription: l10nV, ogImage: v.optional(imageV) }),
  ),
  analytics: v.optional(
    v.object({
      plausibleDomain: v.optional(v.string()),
      ga4Id: v.optional(v.string()),
      metaPixelId: v.optional(v.string()),
    }),
  ),
});
type SettingsPatch = Infer<typeof settingsPatchV>;
/**
 * `stats` is not editable here: the landing's figures live in the "numbers"
 * block of Sadržaj sajta → Početna, and `settings.stats` is only the seeded
 * fallback the landing reads when that block is empty.
 */
type Changes = Partial<Omit<Editable, "isDemo" | "stats">>;

const LEGAL_FIELDS = ["companyName", "legalName", "address", "pib", "mb", "registryNo", "insurance"] as const;

/** Validates and normalizes the sent fields. Untouched fields are not re-checked. */
function normalize(patch: SettingsPatch, existing: Settings): Changes {
  const changes: Changes = {};

  if (patch.companyName !== undefined) changes.companyName = requiredText(patch.companyName, "Naziv agencije", 120);
  if (patch.legalName !== undefined) changes.legalName = requiredText(patch.legalName, "Poslovno ime", 200);
  if (patch.address !== undefined) changes.address = requiredText(patch.address, "Adresa sedišta", 200);
  if (patch.pib !== undefined) {
    const pib = patch.pib.replace(/\s/g, "");
    if (!PIB_RE.test(pib)) invalidInput("PIB mora imati tačno 9 cifara.");
    changes.pib = pib;
  }
  if (patch.mb !== undefined) {
    const mb = patch.mb.replace(/\s/g, "");
    if (!MB_RE.test(mb)) invalidInput("Matični broj mora imati tačno 8 cifara.");
    changes.mb = mb;
  }
  if (patch.registryNo !== undefined) {
    if (patch.registryNo.trim().length === 0) {
      invalidInput("Broj upisa u Registar posrednika je obavezan (Zakon o posredovanju, čl. 18).");
    }
    changes.registryNo = requiredText(patch.registryNo, "Broj u Registru posrednika", 40);
  }
  if (patch.insurance !== undefined) changes.insurance = optionalText(patch.insurance, "Osiguranje od odgovornosti", 300);

  if (patch.phones !== undefined) {
    const phones = [...new Set(patch.phones.map((item) => item.trim()).filter((item) => item.length > 0))];
    if (phones.length === 0) invalidInput("Unesite bar jedan broj telefona.");
    if (phones.length > MAX_PHONES) invalidInput(`Najviše ${MAX_PHONES} brojeva telefona.`);
    changes.phones = phones.map((item, index) => phone(item, `Telefon ${index + 1}`));
  }
  if (patch.email !== undefined) {
    const email = requiredText(patch.email, "E-pošta", 120).toLowerCase();
    if (!EMAIL_RE.test(email)) invalidInput("E-pošta nije ispravna.");
    changes.email = email;
  }
  if (patch.viber !== undefined) changes.viber = optionalPhone(patch.viber, "Viber");
  if (patch.whatsapp !== undefined) changes.whatsapp = optionalPhone(patch.whatsapp, "WhatsApp");

  if (patch.socials !== undefined) {
    const socials: Settings["socials"] = {};
    for (const key of Object.keys(SOCIAL_HOSTS) as SocialKey[]) {
      const url = socialUrl(key, patch.socials[key]);
      if (url !== undefined) socials[key] = url;
    }
    changes.socials = socials;
  }
  if (patch.officeHours !== undefined) changes.officeHours = officeHours(patch.officeHours);

  if (patch.officeLat !== undefined || patch.officeLng !== undefined) {
    const lat = patch.officeLat === undefined ? existing.officeLat : (patch.officeLat ?? undefined);
    const lng = patch.officeLng === undefined ? existing.officeLng : (patch.officeLng ?? undefined);
    if ((lat === undefined) !== (lng === undefined)) {
      invalidInput("Unesite obe koordinate kancelarije ili nijednu.");
    }
    if (lat !== undefined && lng !== undefined) {
      if (
        !Number.isFinite(lat) ||
        !Number.isFinite(lng) ||
        lat < LAT_RANGE[0] ||
        lat > LAT_RANGE[1] ||
        lng < LNG_RANGE[0] ||
        lng > LNG_RANGE[1]
      ) {
        invalidInput("Koordinate kancelarije moraju biti u Srbiji (npr. 44.8125, 20.4612).");
      }
    }
    changes.officeLat = lat;
    changes.officeLng = lng;
  }

  if (patch.commissionText !== undefined) {
    changes.commissionText = localized(patch.commissionText, "Tekst o proviziji", COMMISSION_MAX);
  }
  if (patch.termsPdf !== undefined) changes.termsPdf = patch.termsPdf ?? undefined;

  if (patch.mortgage !== undefined) {
    const { rate, years, downPct } = patch.mortgage;
    if (!Number.isFinite(rate) || rate < 0 || rate > 30) invalidInput("Kamatna stopa mora biti između 0 i 30 %.");
    if (!Number.isInteger(years) || years < 1 || years > 40) invalidInput("Rok otplate mora biti ceo broj godina, 1–40.");
    if (!Number.isFinite(downPct) || downPct < 0 || downPct > 100) invalidInput("Učešće mora biti između 0 i 100 %.");
    changes.mortgage = { rate, years, downPct };
  }
  if (patch.eurRsd !== undefined) {
    if (!Number.isFinite(patch.eurRsd) || patch.eurRsd < 50 || patch.eurRsd > 500) {
      invalidInput("Kurs EUR → RSD nije realan (očekuje se vrednost između 50 i 500).");
    }
    changes.eurRsd = patch.eurRsd;
  }

  if (patch.seo !== undefined) {
    changes.seo = {
      defaultTitle: localized(patch.seo.defaultTitle, "Podrazumevani naslov", SEO_TITLE_MAX),
      defaultDescription: localized(patch.seo.defaultDescription, "Podrazumevani opis", SEO_DESCRIPTION_MAX),
      ...(patch.seo.ogImage !== undefined ? { ogImage: patch.seo.ogImage } : {}),
    };
  }

  if (patch.analytics !== undefined) {
    const plausible = optionalText(patch.analytics.plausibleDomain ?? "", "Plausible domen", 100)
      ?.toLowerCase()
      .replace(/^https?:\/\//, "")
      .replace(/\/.*$/, "");
    if (plausible !== undefined && !DOMAIN_RE.test(plausible)) {
      invalidInput("Plausible domen unesite bez https://, npr. mihajlo-estate.rs.");
    }
    const ga4 = optionalText(patch.analytics.ga4Id ?? "", "GA4 ID", 20)?.toUpperCase();
    if (ga4 !== undefined && !GA4_RE.test(ga4)) invalidInput("GA4 ID ima oblik G-XXXXXXX.");
    const pixel = optionalText(patch.analytics.metaPixelId ?? "", "Meta Pixel ID", 20);
    if (pixel !== undefined && !PIXEL_RE.test(pixel)) invalidInput("Meta Pixel ID sadrži samo cifre (8–20).");
    changes.analytics = {
      ...(plausible !== undefined ? { plausibleDomain: plausible } : {}),
      ...(ga4 !== undefined ? { ga4Id: ga4 } : {}),
      ...(pixel !== undefined ? { metaPixelId: pixel } : {}),
    };
  }

  return changes;
}

export const update = mutation({
  args: { patch: settingsPatchV },
  returns: v.object({ changed: v.number(), isDemo: v.boolean() }),
  handler: async (ctx, args) => {
    const viewer = await requireRole(ctx, ADMINS);
    const existing = await loadSettings(ctx);
    if (existing === null) {
      invalidInput("Podešavanja još nisu inicijalizovana. Pokrenite seed.");
    }

    const changes = normalize(args.patch, existing);

    // New blobs are checked before anything is written.
    if ("termsPdf" in changes && changes.termsPdf !== undefined && changes.termsPdf !== existing.termsPdf) {
      await assertPdfUpload(ctx, changes.termsPdf);
    }
    const nextOg = changes.seo !== undefined ? changes.seo.ogImage : existing.seo.ogImage;
    if (nextOg !== undefined && !sameImage(nextOg, existing.seo.ogImage)) {
      await assertImageRef(ctx, nextOg);
    }

    const merged: Editable = { ...existing, ...changes };
    // Real legal data ends the demo state: from then on the publish checklist
    // treats a missing registry number as a blocker (lib/checklist.ts). Only an
    // edit of the legal section re-evaluates it.
    const legalTouched = LEGAL_FIELDS.some((field) => field in changes);
    const isDemo = legalTouched ? hasPlaceholderLegalData(merged) : existing.isDemo;
    merged.isDemo = isDemo;

    // "Changed" is decided on the full normalized values, field by field.
    const changedKeys = (Object.keys(changes) as (keyof Changes)[]).filter(
      (key) => !deepEqual(changes[key], existing[key]),
    );
    if (changedKeys.length === 0 && isDemo === existing.isDemo) {
      return { changed: 0, isDemo: existing.isDemo };
    }
    const diff = logDiff(existing, merged, changedKeys);

    await ctx.db.patch("settings", existing._id, { ...changes, isDemo, updatedAt: Date.now() });

    if ("termsPdf" in changes && existing.termsPdf !== undefined && existing.termsPdf !== changes.termsPdf) {
      await deleteBlobIfPresent(ctx, existing.termsPdf);
    }
    await releaseReplacedImage(ctx, existing.seo.ogImage, nextOg);

    await logActivity(ctx, {
      entity: "settings",
      entityId: existing._id,
      action: existing.isDemo && !isDemo ? "settings.legal.real" : "settings.updated",
      summary: summaryOf(diff.map((entry) => entry.field)),
      diff,
      by: viewer._id,
    });
    return { changed: diff.length, isDemo };
  },
});
