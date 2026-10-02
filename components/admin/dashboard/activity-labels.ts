/**
 * Dashboard feed wording on top of the activity log's own vocabulary
 * (`components/admin/activity/labels.ts` owns the action labels and links):
 * summaries with raw enum keys get Serbian words, repeated labels are dropped,
 * and what the public site wrote is credited to the site.
 */
import { actionLabel, type ActivityRow } from "@/components/admin/activity/labels";
import type { ListingStatus, PageKey } from "@/convex/lib/validators";
import { PAGE_KEY_LABEL, STATUS_LABEL } from "@/lib/admin/labels";
import { pluralSr } from "./format";

function isListingStatus(value: string): value is ListingStatus {
  return Object.hasOwn(STATUS_LABEL, value);
}

function isPageKey(value: string): value is PageKey {
  return Object.hasOwn(PAGE_KEY_LABEL, value);
}

/** `convex/contentMigrations.ts` logs the page keys it refreshed: `Osvežen početni sadržaj: about, home`. */
const SEED_REFRESH_SUMMARY = /^Osvežen početni sadržaj:\s*(.+)$/;

const STATUS_WORD = /\b(draft|review|published|reserved|sold|rented|withdrawn|archived)\b/g;
const MEDIA_TARGET: Record<string, string> = { gallery: "galerija", floorPlans: "osnove" };

/** Wording of `convex/leads.ts` (LEAD_TYPE_SUMMARY) for `lead.created` rows. */
const LEAD_SUMMARY: Record<string, string> = {
  inquiry: "upit o nekretnini",
  viewing: "zahtev za razgledanje",
  valuation: "zahtev za procenu",
  seller: "ponuda nekretnine za prodaju",
  general: "opšti upit",
};
/** Rows logged before that wording: `Novi upit (inquiry) sa sajta`. */
const LEGACY_LEAD_SUMMARY = /^Novi upit \((\w+)\) sa sajta$/;

/** Wording of `convex/toursAdmin.ts` (TOUR_SOURCE_SR) for `tour.360.set` rows. */
const TOUR_SOURCE: Record<string, string> = {
  none: "bez ture",
  self: "sopstvene panorame",
  matterport: "Matterport",
  kuula: "Kuula",
};
/** Rows logged before that wording, with the provider key: `ME-1048: matterport (objavljeno)`. */
const LEGACY_TOUR_SUMMARY = /^(.+): (none|self|matterport|kuula) \((objavljeno|skriveno)\)$/;

/**
 * Summaries that restate their label in other words before the record they
 * name ("Zatraženo razgledanje · Zahtev za razgledanje ME-1042"): only the
 * record is kept.
 */
const RESTATED_LABEL: Record<string, RegExp> = {
  "viewing.requested": /^Zahtev za razgledanje\s+/i,
};

/** What the public site writes (forms and bookings): rows with no staff member behind them. */
const SITE_ACTIONS = new Set(["lead.created", "lead.onsiteRequested", "viewing.requested"]);
/** Their summaries open with this; the byline already names the site. */
const SITE_PREFIX = /^Sa sajta:\s*/i;

function fromSite(row: Pick<ActivityRow, "action" | "byId">): boolean {
  return row.byId === undefined && SITE_ACTIONS.has(row.action);
}

/** The byline: the staff member, "Sajt" for the public site, "Sistem" for crons and migrations. */
export function activityActor(row: Pick<ActivityRow, "action" | "byId" | "byName">): string {
  if (fromSite(row)) return "Sajt";
  return row.byId === undefined ? "Sistem" : (row.byName ?? "Član tima");
}

/**
 * A summary that opens with the row's own label says it twice in the feed
 * ("Zatražena procena na terenu · zatražena procena na terenu"); keep the
 * rest, or nothing when that was all it said.
 */
function withoutLabel(summary: string, label: string): string | undefined {
  const rest = summary.toLocaleLowerCase("sr-Latn").startsWith(label.toLocaleLowerCase("sr-Latn"))
    ? summary.slice(label.length).replace(/^[\s:–—-]+/, "")
    : summary;
  return rest.length > 0 ? rest : undefined;
}

/**
 * The server writes summaries for staff but with raw enum keys
 * (`ME-1024: draft → published`, `ME-1024: +3 (gallery)`); this swaps in the
 * Serbian words, drops internal media item ids and label repeats, and reads
 * legacy `lead.created` and `tour.360.set` rows in the current wording.
 */
export function activitySummary(action: string, summary: string | undefined): string | undefined {
  return summarize(action, summary, false);
}

/**
 * A dashboard feed line's summary: `activitySummary`, without the "Sa sajta"
 * that the line's "Sajt" byline (`activityActor`) already says.
 */
export function feedSummary(row: Pick<ActivityRow, "action" | "summary" | "byId">): string | undefined {
  return summarize(row.action, row.summary, fromSite(row));
}

function summarize(action: string, summary: string | undefined, site: boolean): string | undefined {
  if (summary === undefined || summary.length === 0) return undefined;
  let text = rawSummary(action, summary);
  if (site) text = text.replace(SITE_PREFIX, "");
  const restated = RESTATED_LABEL[action];
  if (restated !== undefined) text = text.replace(restated, "");
  return withoutLabel(text, actionLabel(action));
}

function rawSummary(action: string, summary: string): string {
  if (action === "lead.created") {
    const type = LEGACY_LEAD_SUMMARY.exec(summary)?.[1];
    return type !== undefined ? `Sa sajta: ${LEAD_SUMMARY[type] ?? type}` : summary;
  }
  if (action === "tour.360.set") {
    return summary.replace(
      LEGACY_TOUR_SUMMARY,
      (_, listing: string, source: string, state: string) => `${listing}: ${TOUR_SOURCE[source] ?? source} (${state})`,
    );
  }
  if (action === "page.seedRefreshed") {
    const keys = SEED_REFRESH_SUMMARY.exec(summary)?.[1];
    if (keys === undefined) return summary;
    return keys
      .split(/,\s*/)
      .map((key) => (isPageKey(key) ? PAGE_KEY_LABEL[key] : key))
      .join(", ");
  }
  if (action.startsWith("listing.status.")) {
    return summary.replace(STATUS_WORD, (word) => (isListingStatus(word) ? STATUS_LABEL[word] : word));
  }
  if (action === "media.meta" || action === "media.cover" || action === "media.removed") {
    return summary.split(":")[0] ?? summary;
  }
  if (action.startsWith("media.")) {
    return summary.replace(/\((gallery|floorPlans)\)/g, (_, target: string) => `(${MEDIA_TARGET[target] ?? target})`);
  }
  return summary;
}

/** `3 polja` — how many fields a `listing.updated` row changed. */
export function diffCountLabel(count: number): string {
  return `${count} ${pluralSr(count, "polje", "polja")}`;
}
