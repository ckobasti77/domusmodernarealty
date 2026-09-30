/**
 * Short Serbian phrases for the activity log's action keys (`listing.created`,
 * `listing.status.sold`, …). Unknown keys fall back to the raw key, so a new
 * server action never disappears from the feed.
 */
import type { ListingStatus } from "@/convex/lib/validators";
import { STATUS_LABEL } from "@/lib/admin/labels";
import { pluralSr } from "./format";

const EXACT: Record<string, string> = {
  "listing.created": "Nova nekretnina",
  "listing.updated": "Izmena",
  "listing.published": "Objavljeno",
  "listing.duplicated": "Kopija nekretnine",
  "listing.deleted": "Nekretnina obrisana",
  "listing.slug.regenerated": "Nova adresa stranice",
  "media.video": "Video",
  "lead.created": "Novi upit",
  "lead.assigned": "Upit dodeljen",
  "lead.responded": "Odgovor na upit",
  "lead.note": "Beleška uz upit",
  "viewing.requested": "Zahtev za razgledanje",
  "viewing.created": "Zakazano razgledanje",
  "viewing.feedback": "Utisak sa razgledanja",
  "contact.anonymized": "Kontakt anonimizovan",
  "contact.merged": "Kontakti spojeni",
  "invite.created": "Poslata pozivnica",
  "invite.accepted": "Pozivnica prihvaćena",
  "invite.revoked": "Pozivnica opozvana",
  "user.role": "Promena uloge",
  "user.status": "Status naloga",
  "testimonial.verified": "Utisak potvrđen",
  "testimonial.unverified": "Utisak nepotvrđen",
  "demo.purge.started": "Brisanje demo sadržaja pokrenuto",
  "demo.purge.finished": "Demo sadržaj obrisan",
  "settings.updated": "Podešavanja",
};

/** Longest prefix first, so `listing.status.` wins over `listing.`. */
const PREFIX: readonly (readonly [string, string])[] = [
  ["listing.status.", "Promena statusa"],
  ["listing.bulk.", "Grupna izmena"],
  ["listing.owner.", "Vlasnik nekretnine"],
  ["lead.status.", "Status upita"],
  ["media.", "Fotografije"],
  ["tour.", "360° tura"],
  ["listing.", "Nekretnina"],
  ["lead.", "Upit"],
  ["viewing.", "Razgledanje"],
  ["contact.", "Kontakt"],
  ["invite.", "Pozivnica"],
  ["user.", "Nalog"],
  ["agent.", "Agent"],
  ["location.", "Lokacija"],
  ["post.", "Magazin"],
  ["page.", "Stranica"],
  ["testimonial.", "Utisak"],
  ["settings.", "Podešavanja"],
  ["demo.", "Demo sadržaj"],
];

export function activityLabel(action: string): string {
  const exact = EXACT[action];
  if (exact !== undefined) return exact;
  for (const [prefix, label] of PREFIX) {
    if (action.startsWith(prefix)) return label;
  }
  return action;
}

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
  return withoutLabel(rawSummary(action, summary), activityLabel(action));
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

/**
 * The listing editor is the only admin detail screen so far. Media rows carry
 * the listing id too; deleted listings get no link.
 */
export function activityHref(entity: string, entityId: string | undefined, action: string): string | null {
  if (entityId === undefined || action === "listing.deleted") return null;
  if (entity === "listing" || entity === "media") return `/admin/nekretnine/${entityId}`;
  return null;
}
