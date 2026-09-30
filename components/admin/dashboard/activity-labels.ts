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

/**
 * The server writes summaries for staff but with raw enum keys
 * (`ME-1024: draft → published`, `ME-1024: +3 (gallery)`); this swaps in the
 * Serbian words and drops internal media item ids.
 */
export function activitySummary(action: string, summary: string | undefined): string | undefined {
  if (summary === undefined || summary.length === 0) return undefined;
  if (action.startsWith("listing.status.")) {
    return summary.replace(STATUS_WORD, (word) => (isListingStatus(word) ? STATUS_LABEL[word] : word));
  }
  if (action === "media.meta" || action === "media.cover" || action === "media.removed") {
    return summary.split(":")[0];
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
