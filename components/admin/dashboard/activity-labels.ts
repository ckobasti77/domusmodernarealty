/**
 * Dashboard feed wording on top of the activity log's own vocabulary
 * (`components/admin/activity/labels.ts` owns the action labels and links):
 * summaries with raw enum keys get Serbian words, repeated labels are dropped.
 */
import { actionLabel } from "@/components/admin/activity/labels";
import type { ListingStatus } from "@/convex/lib/validators";
import { STATUS_LABEL } from "@/lib/admin/labels";
import { pluralSr } from "./format";

function isListingStatus(value: string): value is ListingStatus {
  return Object.hasOwn(STATUS_LABEL, value);
}

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

/**
 * A summary that opens with the row's own label says it twice in the feed
 * ("Zahtev za razgledanje · Zahtev za razgledanje ME-1042"); keep the rest.
 */
function withoutLabel(summary: string, label: string): string {
  if (!summary.toLocaleLowerCase("sr-Latn").startsWith(label.toLocaleLowerCase("sr-Latn"))) return summary;
  const rest = summary.slice(label.length).replace(/^[\s:–—-]+/, "");
  return rest.length > 0 ? rest : summary;
}

/**
 * The server writes summaries for staff but with raw enum keys
 * (`ME-1024: draft → published`, `ME-1024: +3 (gallery)`); this swaps in the
 * Serbian words, drops internal media item ids and label repeats, and reads
 * legacy `lead.created` rows in the current wording.
 */
export function activitySummary(action: string, summary: string | undefined): string | undefined {
  if (summary === undefined || summary.length === 0) return undefined;
  return withoutLabel(rawSummary(action, summary), actionLabel(action));
}

function rawSummary(action: string, summary: string): string {
  if (action === "lead.created") {
    const type = LEGACY_LEAD_SUMMARY.exec(summary)?.[1];
    return type !== undefined ? `Sa sajta: ${LEAD_SUMMARY[type] ?? type}` : summary;
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
