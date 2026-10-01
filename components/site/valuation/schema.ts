import type { FunctionArgs } from "convex/server";
import { z } from "zod";
import { contactFields } from "@/components/forms/shared";
import type { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import type { Condition, Floor, OnsiteWindow, PropertyType } from "@/convex/lib/validators";
import type { Locale } from "@/i18n/routing";
import { formatCount, parseLocaleNumber } from "@/lib/format";
import { AREA_LIMITS } from "./types";

/**
 * The funnel's answers, their client-side validation and their conversion to
 * the `leads.createValuation` arguments. Each step is its own form (its own
 * schema), so a step that failed once re-validates as the visitor corrects it.
 * Every control is a string (native selects and text inputs); the schemas
 * validate strings and `toValuationArgs` turns them into the server's types.
 * The server repeats the checks that matter (bounds, lengths, consent).
 */

/** `propertyTypeV`, in the order a seller thinks of them. */
export const PROPERTY_TYPES = [
  "apartment",
  "house",
  "cottage",
  "commercial",
  "office",
  "land",
  "garage",
] as const satisfies readonly PropertyType[];

/** `conditionV`, best to worst. */
export const CONDITIONS = ["lux", "renovated", "original", "needs_renovation"] as const satisfies readonly Condition[];

/** `onsiteWindowV`, in the order of the day. */
export const ONSITE_WINDOWS = ["morning", "midday", "afternoon"] as const satisfies readonly OnsiteWindow[];

/** Named storeys below the first floor, lowest first; PK (attic) sits above the numbers. */
const LOW_FLOORS = ["SUT", "PSUT", "PR", "VPR"] as const;
const ATTIC = "PK";
/** Same ceiling as the search filters (`MAX_FLOOR` in lib/search-params.ts). */
const MAX_FLOOR = 30;

/** Every `floorV` value the floor select offers, as option values. */
export const FLOOR_CHOICES: readonly string[] = [
  ...LOW_FLOORS,
  ...Array.from({ length: MAX_FLOOR }, (_, index) => String(index + 1)),
  ATTIC,
];

/**
 * The building's top floor, numbered like the floor itself ("0" is a
 * ground-floor-only building). Asking for the top floor rather than a storey
 * count avoids the en/ru habit of counting the ground floor as a storey.
 */
export const TOP_FLOOR_CHOICES: readonly string[] = Array.from({ length: MAX_FLOOR + 1 }, (_, index) => String(index));

/**
 * Halves up to five ("garsonjera" 0.5, "jednoiposoban" 1.5 …, as on the
 * listing pages), then whole rooms for houses. The server accepts 0–20.
 */
export const ROOM_CHOICES = [0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5, 6, 7, 8, 9, 10] as const;

const YEAR_MIN = 1800;
/** Buildings still under construction have a completion year a few years out. */
const YEAR_AHEAD = 5;
const ADDRESS_MAX = 300;
const MESSAGE_MAX = 2000;
const NOTE_MAX = 600;

/**
 * A plot and a garage have no rooms and no storey. The mutation still needs
 * both, so they are sent as 0 rooms at ground level ("PR"), which is literally
 * true for both, and the two questions are not asked.
 */
export function hasLayout(type: PropertyType): boolean {
  return type !== "land" && type !== "garage";
}

function isCondition(value: string): value is Condition {
  return (CONDITIONS as readonly string[]).includes(value);
}

function isOnsiteWindow(value: string): value is OnsiteWindow {
  return (ONSITE_WINDOWS as readonly string[]).includes(value);
}

/** An option value back to `floorV`: digits are a numbered floor, the rest are the named codes. */
export function floorFromChoice(value: string): Floor | undefined {
  if (/^\d+$/.test(value)) return Number(value);
  if ((LOW_FLOORS as readonly string[]).includes(value) || value === ATTIC) return value as Floor;
  return undefined;
}

type Translate = (key: string, values?: Record<string, string | number>) => string;

/* ------------------------------------------------------- step 1: property */

export function propertySchema({
  tForms,
  t,
  locale,
  currentYear,
}: {
  tForms: Translate;
  t: Translate;
  locale: Locale;
  currentYear: number;
}) {
  const required = tForms("requiredField");
  const yearMax = currentYear + YEAR_AHEAD;
  return z
    .object({
      locationId: z.string().min(1, required),
      propertyType: z.enum(PROPERTY_TYPES),
      area: z
        .string()
        .trim()
        .min(1, required)
        .refine(
          (value) => {
            const area = parseLocaleNumber(value, locale);
            return area !== null && area >= AREA_LIMITS.min && area <= AREA_LIMITS.max;
          },
          t("areaInvalid", {
            min: formatCount(AREA_LIMITS.min, locale),
            max: formatCount(AREA_LIMITS.max, locale),
          }),
        ),
      rooms: z.string(),
      floor: z.string(),
      totalFloors: z.string(),
      elevator: z.enum(["", "yes", "no"]),
      condition: z.string().refine(isCondition, required),
      yearBuilt: z
        .string()
        .trim()
        .refine(
          (value) => value.length === 0 || (/^\d{4}$/.test(value) && Number(value) >= YEAR_MIN && Number(value) <= yearMax),
          t("yearInvalid", { min: YEAR_MIN, max: yearMax }),
        ),
      addressNote: z.string().trim().max(ADDRESS_MAX, tForms("tooLong", { max: ADDRESS_MAX })),
    })
    .superRefine((values, ctx) => {
      // Rooms and floor are required only where they mean something.
      if (!hasLayout(values.propertyType)) return;
      if (values.rooms.length === 0) ctx.addIssue({ code: "custom", path: ["rooms"], message: required });
      if (values.floor.length === 0) ctx.addIssue({ code: "custom", path: ["floor"], message: required });
      const floor = floorFromChoice(values.floor);
      if (typeof floor === "number" && values.totalFloors.length > 0 && floor > Number(values.totalFloors)) {
        ctx.addIssue({ code: "custom", path: ["totalFloors"], message: t("floorAboveTotal") });
      }
    });
}

/** What the controls hold (strings) and what a valid step hands on (narrowed). */
export type PropertyInput = z.input<ReturnType<typeof propertySchema>>;
export type PropertyValues = z.output<ReturnType<typeof propertySchema>>;

/* -------------------------------------------------------- step 2: contact */

export function contactSchema(tForms: Translate) {
  return z.object({
    ...contactFields(tForms),
    message: z.string().trim().max(MESSAGE_MAX, tForms("tooLong", { max: MESSAGE_MAX })),
  });
}

export type ContactValues = z.infer<ReturnType<typeof contactSchema>>;

type ValuationArgs = FunctionArgs<typeof api.leads.createValuation>;

/** The validated area, to one decimal — as precise as a floor area is ever stated. */
function parsedArea(value: string, locale: Locale): number {
  return Math.round((parseLocaleNumber(value, locale) ?? 0) * 10) / 10;
}

/**
 * Every answer the visitor gave, in the mutation's types. Optional answers
 * left empty are omitted rather than sent blank, so the lead in the admin
 * shows exactly what was filled in.
 */
export function toValuationArgs(
  property: PropertyValues,
  contact: ContactValues,
  { locale, sessionKey }: { locale: Locale; sessionKey: string },
): ValuationArgs {
  const layout = hasLayout(property.propertyType);
  const optional = (value: string) => (value.trim().length > 0 ? value.trim() : undefined);
  const phone = optional(contact.phone);
  const message = optional(contact.message);
  const addressNote = optional(property.addressNote);

  return {
    sessionKey,
    locale,
    contact: { name: contact.name.trim(), email: contact.email.trim(), ...(phone !== undefined ? { phone } : {}) },
    marketing: contact.marketing,
    privacy: contact.privacy,
    hp: contact.hp,
    locationId: property.locationId as Id<"locations">,
    propertyType: property.propertyType,
    areaM2: parsedArea(property.area, locale),
    rooms: layout ? Number(property.rooms) : 0,
    floor: (layout ? floorFromChoice(property.floor) : undefined) ?? "PR",
    ...(layout && property.totalFloors.length > 0 ? { totalFloors: Number(property.totalFloors) } : {}),
    ...(layout && property.elevator !== "" ? { hasElevator: property.elevator === "yes" } : {}),
    condition: property.condition,
    ...(property.yearBuilt.length > 0 ? { yearBuilt: Number(property.yearBuilt) } : {}),
    ...(addressNote !== undefined ? { addressNote } : {}),
    ...(message !== undefined ? { message } : {}),
  };
}

/* ------------------------------------------------- result: on-site request */

export function onsiteSchema({ tForms, t }: { tForms: Translate; t: Translate }) {
  return z.object({
    day: z.string().min(1, t("onsite.dayRequired")),
    window: z.string().refine(isOnsiteWindow, t("onsite.windowRequired")),
    note: z.string().trim().max(NOTE_MAX, tForms("tooLong", { max: NOTE_MAX })),
    hp: z.string(),
  });
}

export type OnsiteInput = z.input<ReturnType<typeof onsiteSchema>>;
export type OnsiteValues = z.output<ReturnType<typeof onsiteSchema>>;
