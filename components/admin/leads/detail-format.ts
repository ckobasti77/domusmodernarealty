/**
 * Serbian wording for what a lead carries: the public form's answers and the
 * timeline's action keys. Unknown keys fall back to the raw key, so a new form
 * field never disappears from the sheet.
 */
import type { OnsiteWindow, ViewingMode, ViewingStatus } from "@/convex/lib/validators";
import { formatDate, formatDateTime, formatEur, formatM2 } from "@/lib/admin/format";
import {
  CONDITION_LABEL,
  FLOOR_LABEL,
  LEAD_STATUS_LABEL,
  PROPERTY_TYPE_LABEL,
  VIEWING_MODE_LABEL,
  VIEWING_STATUS_LABEL,
} from "@/lib/admin/labels";

type AnswerValue = string | number | boolean;

function label<K extends string>(map: Record<K, string>, value: AnswerValue): string | undefined {
  return typeof value === "string" && Object.hasOwn(map, value) ? map[value as K] : undefined;
}

const ANSWER_LABEL: Record<string, string> = {
  subject: "Tema",
  propertyType: "Vrsta nekretnine",
  locationSlug: "Lokacija",
  addressNote: "Adresa",
  areaM2: "Površina",
  rooms: "Broj soba",
  floor: "Sprat",
  totalFloors: "Spratnost zgrade",
  hasElevator: "Lift",
  condition: "Stanje",
  yearBuilt: "Godina izgradnje",
  expectedPrice: "Očekivana cena",
  start: "Željeni termin",
  mode: "Način razgledanja",
  onsiteRequested: "Procena na terenu",
  onsiteDate: "Željeni dan obilaska",
  onsiteWindow: "Doba dana",
  onsiteNote: "Napomena za obilazak",
};

const ONSITE_WINDOW_LABEL: Record<OnsiteWindow, string> = {
  morning: "Pre podne (9–12 h)",
  midday: "Oko podneva (12–15 h)",
  afternoon: "Popodne (15–18 h)",
};

/** Internal ids and the viewing's end time (shown with its start) stay out. */
const HIDDEN = new Set(["basisLocationId", "end"]);

function answerValue(key: string, value: AnswerValue): string {
  if (typeof value === "boolean") return value ? "Da" : "Ne";
  switch (key) {
    case "propertyType":
      return label(PROPERTY_TYPE_LABEL, value) ?? String(value);
    case "condition":
      return label(CONDITION_LABEL, value) ?? String(value);
    case "mode":
      return label(VIEWING_MODE_LABEL, value) ?? String(value);
    case "areaM2":
      return typeof value === "number" ? formatM2(value) : String(value);
    case "expectedPrice":
      return typeof value === "number" ? formatEur(value) : String(value);
    case "start":
      return typeof value === "number" ? formatDateTime(value) : String(value);
    case "onsiteWindow":
      return label(ONSITE_WINDOW_LABEL, value) ?? String(value);
    case "onsiteDate": {
      const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value));
      return match === null
        ? String(value)
        : formatDate(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 10));
    }
    case "floor": {
      const named = label(FLOOR_LABEL, value);
      if (named !== undefined) return named;
      return /^\d+$/.test(String(value)) ? `${value}. sprat` : String(value);
    }
    default:
      return String(value);
  }
}

/** The form answers as label/value rows, in a stable, readable order. */
export function answerRows(answers: Record<string, AnswerValue>): { label: string; value: string }[] {
  const order = Object.keys(ANSWER_LABEL);
  return Object.entries(answers)
    .filter(([key]) => !HIDDEN.has(key))
    .sort(([a], [b]) => {
      const ia = order.indexOf(a);
      const ib = order.indexOf(b);
      return (ia === -1 ? order.length : ia) - (ib === -1 ? order.length : ib);
    })
    .map(([key, value]) => ({ label: ANSWER_LABEL[key] ?? key, value: answerValue(key, value) }));
}

const ACTION_LABEL: Record<string, string> = {
  "lead.created": "Upit primljen",
  "lead.assigned": "Dodela agentu",
  "lead.note": "Beleška",
  "lead.nextAction": "Sledeći korak",
  "lead.responded": "Označeno kao odgovoreno",
  "lead.onsiteRequested": "Zatražena procena na terenu",
};

export function timelineLabel(action: string): string {
  const exact = ACTION_LABEL[action];
  if (exact !== undefined) return exact;
  if (action.startsWith("lead.status.")) {
    const status = action.slice("lead.status.".length);
    return `Faza: ${Object.hasOwn(LEAD_STATUS_LABEL, status) ? LEAD_STATUS_LABEL[status as keyof typeof LEAD_STATUS_LABEL] : status}`;
  }
  if (action.startsWith("viewing.")) {
    const status = action.slice("viewing.".length);
    return Object.hasOwn(VIEWING_STATUS_LABEL, status)
      ? `Razgledanje: ${VIEWING_STATUS_LABEL[status as ViewingStatus].toLowerCase()}`
      : "Razgledanje";
  }
  return action;
}

/** `Sledeći korak: 2026-10-03` → `Sledeći korak: 3. 10. 2026.` */
export function timelineSummary(action: string, summary: string | undefined, start?: number): string | undefined {
  if (start !== undefined) return `Termin ${formatDateTime(start)}`;
  if (summary === undefined) return undefined;
  if (action === "lead.nextAction") {
    return summary.replace(/(\d{4})-(\d{2})-(\d{2})/, (_match, y: string, m: string, d: string) =>
      formatDate(Date.UTC(Number(y), Number(m) - 1, Number(d), 10)),
    );
  }
  return summary;
}

export function viewingLine(viewing: { start: number; mode: ViewingMode }): string {
  return `${formatDateTime(viewing.start)} · ${VIEWING_MODE_LABEL[viewing.mode]}`;
}
