import type { FunctionReturnType } from "convex/server";
import type { DotTone } from "@/components/admin/common/StatusBadge";
import { pluralSr } from "@/components/admin/dashboard/format";
import type { api } from "@/convex/_generated/api";
import type { LeadStatus, Locale } from "@/convex/lib/validators";

/** One lead as the list, the board and the sheet header receive it. */
export type LeadRow = FunctionReturnType<typeof api.leadsAdmin.list>["page"][number];
export type LeadDetail = NonNullable<FunctionReturnType<typeof api.leadsAdmin.get>>;
export type KanbanColumn = FunctionReturnType<typeof api.leadsAdmin.kanban>[number];

export const LEADS_PATH = "/admin/upiti";

/** Pipeline order (PRD B4): Novi → … → Dobijen / Izgubljen. */
export const PIPELINE: readonly LeadStatus[] = [
  "new",
  "contacted",
  "qualified",
  "viewing",
  "offer",
  "won",
  "lost",
];

/**
 * Stage tones: the open stage that needs a first move is bronze, the working
 * stages ink, a hot offer amber, won green and lost stone. The word always
 * carries the meaning; the dot only speeds up scanning.
 */
export const STATUS_TONE: Record<LeadStatus, DotTone> = {
  new: "accent",
  contacted: "strong",
  qualified: "strong",
  viewing: "strong",
  offer: "warning",
  won: "success",
  lost: "muted",
};

export const LOCALE_LABEL: Record<Locale, string> = {
  "sr-Latn": "Srpski",
  en: "Engleski",
  ru: "Ruski",
  de: "Nemački",
};

/** A first answer is due within this long (PRD B2: "not contacted > 1 h"). */
export const RESPONSE_DUE_MS = 3_600_000;

/** `12 min`, `3 h`, `2 dana` — how long a lead has waited, in one unit. */
export function formatWait(ms: number): string {
  const minutes = Math.max(0, Math.floor(ms / 60_000));
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} h`;
  const days = Math.floor(hours / 24);
  return `${days} ${pluralSr(days, "dan", "dana")}`;
}

/** `+381 64 123 4567` → `tel:+381641234567`. */
export function telHref(phone: string): string {
  return `tel:${phone.replace(/[^\d+]/g, "")}`;
}

/* ------------------------------------------------------------ date filter */

const TZ = "Europe/Belgrade";
const hourFmt = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", hourCycle: "h23", timeZone: TZ });

/** Belgrade's UTC offset (ms) at an instant: +1 h in winter, +2 h in summer. */
function belgradeOffset(utcMs: number): number {
  const local = Number(hourFmt.format(utcMs));
  const hours = (((local - new Date(utcMs).getUTCHours()) % 24) + 24) % 24;
  return hours * 3_600_000;
}

function parseDay(value: string): [number, number, number] | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (match === null) return null;
  return [Number(match[1]), Number(match[2]) - 1, Number(match[3])];
}

/** Belgrade midnight at the start of `yyyy-mm-dd`, as epoch ms. */
export function dayStart(value: string): number | undefined {
  const day = parseDay(value);
  if (day === null) return undefined;
  const utcMidnight = Date.UTC(day[0], day[1], day[2]);
  return utcMidnight - belgradeOffset(utcMidnight);
}

/** The last millisecond of `yyyy-mm-dd` in Belgrade. */
export function dayEnd(value: string): number | undefined {
  const day = parseDay(value);
  if (day === null) return undefined;
  const nextMidnight = Date.UTC(day[0], day[1], day[2] + 1);
  return nextMidnight - belgradeOffset(nextMidnight) - 1;
}
