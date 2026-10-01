/**
 * The settings form: values as the inputs hold them (numbers as text, empty
 * strings for missing optionals), the zod schema that checks them in the
 * browser, and the conversions to and from `settingsAdmin`. The server
 * re-checks everything (`convex/settingsAdmin.ts`); these rules mirror it so
 * mistakes show next to the field instead of in a toast.
 */
import type { FunctionArgs, FunctionReturnType } from "convex/server";
import { z } from "zod";
import { fromL10nValue, toL10nValue } from "@/components/admin/common/L10nInput";
import type { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import type { ImageRef } from "@/convex/lib/validators";

export type SettingsData = NonNullable<FunctionReturnType<typeof api.settingsAdmin.get>>;
export type SettingsPatch = FunctionArgs<typeof api.settingsAdmin.update>["patch"];

export const SEO_TITLE_SOFT = 60;
export const SEO_TITLE_MAX = 70;
export const SEO_DESCRIPTION_SOFT = 155;
export const SEO_DESCRIPTION_MAX = 170;
export const COMMISSION_MAX = 1500;
export const MAX_PHONES = 5;

const PIB_RE = /^\d{9}$/;
const MB_RE = /^\d{8}$/;
const PHONE_RE = /^\+?[\d\s()./-]{6,24}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const DOMAIN_RE = /^(?=.{3,100}$)([a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}$/;
const GA4_RE = /^G-[A-Z0-9]{4,12}$/;
const PIXEL_RE = /^\d{8,20}$/;

export const SOCIALS = [
  { key: "instagram", label: "Instagram", hosts: ["instagram.com"], example: "https://www.instagram.com/…" },
  { key: "facebook", label: "Facebook", hosts: ["facebook.com", "fb.com"], example: "https://www.facebook.com/…" },
  { key: "linkedin", label: "LinkedIn", hosts: ["linkedin.com"], example: "https://www.linkedin.com/company/…" },
  { key: "youtube", label: "YouTube", hosts: ["youtube.com", "youtu.be"], example: "https://www.youtube.com/@…" },
] as const;
export type SocialKey = (typeof SOCIALS)[number]["key"];

/** `5,4` or `5.4` → 5.4; anything else → NaN. */
export function parseDecimal(text: string): number {
  const clean = text.trim().replace(",", ".");
  return /^-?\d+(\.\d+)?$/.test(clean) ? Number(clean) : Number.NaN;
}

function phoneOk(text: string): boolean {
  const value = text.trim();
  const digits = value.replace(/\D/g, "").length;
  return PHONE_RE.test(value) && digits >= 6 && digits <= 15;
}

function socialOk(text: string, hosts: readonly string[]): boolean {
  if (text.trim() === "") return true;
  try {
    const url = new URL(text.trim());
    const host = url.hostname.toLowerCase();
    return url.protocol === "https:" && hosts.some((domain) => host === domain || host.endsWith(`.${domain}`));
  } catch {
    return false;
  }
}

function minutesOf(time: string): number {
  const [hours, minutes] = time.split(":");
  return Number(hours) * 60 + Number(minutes);
}

/**
 * Serbian PIB check digit (ISO 7064, MOD 11,10). Only a hint: the screen warns
 * about a probable typo but never blocks, the format rule is what the server
 * enforces.
 */
export function pibChecksumOk(pib: string): boolean {
  if (!PIB_RE.test(pib)) return false;
  let product = 10;
  for (const char of pib.slice(0, 8)) {
    let sum = (product + Number(char)) % 10;
    if (sum === 0) sum = 10;
    product = (2 * sum) % 11;
  }
  return (11 - product) % 10 === Number(pib[8]);
}

/** The seeded placeholder: only zeros. */
export function isPlaceholder(value: string): boolean {
  return /^0*$/.test(value.trim());
}

const text = (label: string, max: number) =>
  z
    .string()
    .refine((value) => value.trim().length > 0, `Polje „${label}” je obavezno.`)
    .refine((value) => value.trim().length <= max, `Najviše ${max} znakova.`);

const optionalText = (max: number) => z.string().refine((value) => value.trim().length <= max, `Najviše ${max} znakova.`);

const optionalPhone = z.string().refine((value) => value.trim() === "" || phoneOk(value), "Unesite broj u obliku +381 11 123 4567.");

const l10n = (label: string, max: number) =>
  z
    .object({ sr: z.string(), en: z.string(), ru: z.string(), de: z.string() })
    .refine((value) => value.sr.trim().length > 0, { message: `${label} na srpskom je obavezan.`, path: ["sr"] })
    .refine((value) => Object.values(value).every((item) => item.trim().length <= max), {
      message: `Najviše ${max} znakova po jeziku.`,
      path: ["sr"],
    });

const slotSchema = z
  .object({ weekday: z.number().int().min(0).max(6), from: z.string(), to: z.string() })
  .refine((slot) => TIME_RE.test(slot.from) && TIME_RE.test(slot.to), { message: "Vreme unesite kao SS:MM.", path: ["from"] })
  .refine((slot) => !TIME_RE.test(slot.from) || !TIME_RE.test(slot.to) || minutesOf(slot.from) < minutesOf(slot.to), {
    message: "Početak mora biti pre kraja.",
    path: ["to"],
  });

export const settingsSchema = z
  .object({
    companyName: text("Naziv agencije", 120),
    legalName: text("Poslovno ime", 200),
    address: text("Adresa sedišta", 200),
    pib: z.string().refine((value) => PIB_RE.test(value.replace(/\s/g, "")), "PIB ima tačno 9 cifara."),
    mb: z.string().refine((value) => MB_RE.test(value.replace(/\s/g, "")), "Matični broj ima tačno 8 cifara."),
    registryNo: z
      .string()
      .refine((value) => value.trim().length > 0, "Broj upisa u Registar posrednika je obavezan (čl. 18 Zakona).")
      .refine((value) => value.trim().length <= 40, "Najviše 40 znakova."),
    insurance: optionalText(300),
    phones: z
      .array(z.object({ value: z.string().refine(phoneOk, "Unesite broj u obliku +381 11 123 4567.") }))
      .min(1, "Unesite bar jedan broj telefona.")
      .max(MAX_PHONES, `Najviše ${MAX_PHONES} brojeva.`),
    email: z
      .string()
      .refine((value) => EMAIL_RE.test(value.trim()), "E-pošta nije ispravna.")
      .refine((value) => value.trim().length <= 120, "Najviše 120 znakova."),
    viber: optionalPhone,
    whatsapp: optionalPhone,
    officeHours: z.array(slotSchema).max(21, "Najviše 21 termin."),
    officeLat: z.string(),
    officeLng: z.string(),
    socials: z.object({
      instagram: z.string().refine((value) => socialOk(value, SOCIALS[0].hosts), "Adresa mora biti https://…instagram.com/…"),
      facebook: z.string().refine((value) => socialOk(value, SOCIALS[1].hosts), "Adresa mora biti https://…facebook.com/…"),
      linkedin: z.string().refine((value) => socialOk(value, SOCIALS[2].hosts), "Adresa mora biti https://…linkedin.com/…"),
      youtube: z.string().refine((value) => socialOk(value, SOCIALS[3].hosts), "Adresa mora biti https://…youtube.com/…"),
    }),
    commissionText: l10n("Tekst o proviziji", COMMISSION_MAX),
    termsPdf: z.custom<Id<"_storage">>((value) => typeof value === "string").nullable(),
    mortgage: z.object({
      rate: z.string().refine((value) => {
        const rate = parseDecimal(value);
        return rate >= 0 && rate <= 30;
      }, "Stopa između 0 i 30 %."),
      years: z.string().refine((value) => {
        const years = parseDecimal(value);
        return Number.isInteger(years) && years >= 1 && years <= 40;
      }, "Ceo broj godina, 1–40."),
      downPct: z.string().refine((value) => {
        const pct = parseDecimal(value);
        return pct >= 0 && pct <= 100;
      }, "Između 0 i 100 %."),
    }),
    eurRsd: z.string().refine((value) => {
      const rate = parseDecimal(value);
      return rate >= 50 && rate <= 500;
    }, "Unesite kurs, npr. 117,2."),
    seo: z.object({
      defaultTitle: l10n("Naslov", SEO_TITLE_MAX),
      defaultDescription: l10n("Opis", SEO_DESCRIPTION_MAX),
      ogImage: z.custom<ImageRef>((value) => typeof value === "object" && value !== null).nullable(),
    }),
    analytics: z.object({
      plausibleDomain: z
        .string()
        .refine((value) => value.trim() === "" || DOMAIN_RE.test(value.trim().toLowerCase()), "Domen bez https://, npr. mihajlo-estate.rs."),
      ga4Id: z.string().refine((value) => value.trim() === "" || GA4_RE.test(value.trim().toUpperCase()), "Oblik G-XXXXXXX."),
      metaPixelId: z.string().refine((value) => value.trim() === "" || PIXEL_RE.test(value.trim()), "Samo cifre (8–20)."),
    }),
  })
  .superRefine((values, ctx) => {
    const lat = values.officeLat.trim();
    const lng = values.officeLng.trim();
    if (lat === "" && lng === "") return;
    const latNum = parseDecimal(lat);
    const lngNum = parseDecimal(lng);
    if (!(latNum >= 41.8 && latNum <= 46.3)) {
      ctx.addIssue({ code: "custom", path: ["officeLat"], message: "Geografska širina u Srbiji je 41,8–46,3." });
    }
    if (!(lngNum >= 18.8 && lngNum <= 23.1)) {
      ctx.addIssue({ code: "custom", path: ["officeLng"], message: "Geografska dužina u Srbiji je 18,8–23,1." });
    }
  })
  .superRefine((values, ctx) => {
    // Slots of one day must not overlap (the server refuses them).
    const order = (weekday: number) => (weekday + 6) % 7;
    const indexed = values.officeHours
      .map((slot, index) => ({ ...slot, index }))
      .filter((slot) => TIME_RE.test(slot.from) && TIME_RE.test(slot.to))
      .sort((a, b) => order(a.weekday) - order(b.weekday) || minutesOf(a.from) - minutesOf(b.from));
    for (let i = 1; i < indexed.length; i += 1) {
      const previous = indexed[i - 1];
      const slot = indexed[i];
      if (previous === undefined || slot === undefined) continue;
      if (previous.weekday === slot.weekday && minutesOf(slot.from) < minutesOf(previous.to)) {
        ctx.addIssue({ code: "custom", path: ["officeHours", slot.index, "from"], message: "Preklapa se sa drugim terminom." });
      }
    }
  });

export type SettingsForm = z.infer<typeof settingsSchema>;

function numberText(value: number | undefined): string {
  return value === undefined ? "" : String(value).replace(".", ",");
}

export function toForm(data: SettingsData): SettingsForm {
  const s = data.settings;
  return {
    companyName: s.companyName,
    legalName: s.legalName,
    address: s.address,
    pib: s.pib,
    mb: s.mb,
    registryNo: s.registryNo,
    insurance: s.insurance ?? "",
    phones: (s.phones.length > 0 ? s.phones : [""]).map((value) => ({ value })),
    email: s.email,
    viber: s.viber ?? "",
    whatsapp: s.whatsapp ?? "",
    officeHours: s.officeHours.map((slot) => ({ weekday: slot.weekday, from: slot.from, to: slot.to })),
    officeLat: numberText(s.officeLat),
    officeLng: numberText(s.officeLng),
    socials: {
      instagram: s.socials.instagram ?? "",
      facebook: s.socials.facebook ?? "",
      linkedin: s.socials.linkedin ?? "",
      youtube: s.socials.youtube ?? "",
    },
    commissionText: toL10nValue(s.commissionText),
    termsPdf: s.termsPdf ?? null,
    mortgage: {
      rate: numberText(s.mortgage.rate),
      years: String(s.mortgage.years),
      downPct: numberText(s.mortgage.downPct),
    },
    eurRsd: numberText(s.eurRsd),
    seo: {
      defaultTitle: toL10nValue(s.seo.defaultTitle),
      defaultDescription: toL10nValue(s.seo.defaultDescription),
      ogImage: s.seo.ogImage ?? null,
    },
    analytics: {
      plausibleDomain: s.analytics.plausibleDomain ?? "",
      ga4Id: s.analytics.ga4Id ?? "",
      metaPixelId: s.analytics.metaPixelId ?? "",
    },
  };
}

export function deepEqual(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((item, index) => deepEqual(item, b[index]));
  }
  if (typeof a === "object" && typeof b === "object" && a !== null && b !== null && !Array.isArray(a) && !Array.isArray(b)) {
    const left = a as Record<string, unknown>;
    const right = b as Record<string, unknown>;
    const keys = new Set([...Object.keys(left), ...Object.keys(right)]);
    for (const key of keys) {
      if (!deepEqual(left[key], right[key])) return false;
    }
    return true;
  }
  return false;
}

type FormKey = keyof SettingsForm;

/**
 * Only the top-level fields that differ from what was loaded, so a save never
 * overwrites a section another admin changed meanwhile. Coordinates travel as
 * a pair.
 */
export function toPatch(values: SettingsForm, baseline: SettingsForm): SettingsPatch {
  const changed = new Set((Object.keys(values) as FormKey[]).filter((key) => !deepEqual(values[key], baseline[key])));
  const patch: SettingsPatch = {};
  const has = (key: FormKey) => changed.has(key);

  if (has("companyName")) patch.companyName = values.companyName.trim();
  if (has("legalName")) patch.legalName = values.legalName.trim();
  if (has("address")) patch.address = values.address.trim();
  if (has("pib")) patch.pib = values.pib.replace(/\s/g, "");
  if (has("mb")) patch.mb = values.mb.replace(/\s/g, "");
  if (has("registryNo")) patch.registryNo = values.registryNo.trim();
  if (has("insurance")) patch.insurance = values.insurance.trim();
  if (has("phones")) patch.phones = values.phones.map((item) => item.value.trim()).filter((item) => item !== "");
  if (has("email")) patch.email = values.email.trim();
  if (has("viber")) patch.viber = values.viber.trim();
  if (has("whatsapp")) patch.whatsapp = values.whatsapp.trim();
  if (has("officeHours")) {
    patch.officeHours = values.officeHours.map(({ weekday, from, to }) => ({ weekday, from, to }));
  }
  if (has("officeLat") || has("officeLng")) {
    const lat = values.officeLat.trim();
    const lng = values.officeLng.trim();
    patch.officeLat = lat === "" ? null : parseDecimal(lat);
    patch.officeLng = lng === "" ? null : parseDecimal(lng);
  }
  if (has("socials")) {
    patch.socials = {};
    for (const { key } of SOCIALS) {
      const url = values.socials[key].trim();
      if (url !== "") patch.socials[key] = url;
    }
  }
  if (has("commissionText")) patch.commissionText = fromL10nValue(values.commissionText);
  if (has("termsPdf")) patch.termsPdf = values.termsPdf;
  if (has("mortgage")) {
    patch.mortgage = {
      rate: parseDecimal(values.mortgage.rate),
      years: parseDecimal(values.mortgage.years),
      downPct: parseDecimal(values.mortgage.downPct),
    };
  }
  if (has("eurRsd")) patch.eurRsd = parseDecimal(values.eurRsd);
  if (has("seo")) {
    patch.seo = {
      defaultTitle: fromL10nValue(values.seo.defaultTitle),
      defaultDescription: fromL10nValue(values.seo.defaultDescription),
      ...(values.seo.ogImage !== null ? { ogImage: values.seo.ogImage } : {}),
    };
  }
  if (has("analytics")) {
    patch.analytics = {
      plausibleDomain: values.analytics.plausibleDomain.trim(),
      ga4Id: values.analytics.ga4Id.trim(),
      metaPixelId: values.analytics.metaPixelId.trim(),
    };
  }
  return patch;
}
