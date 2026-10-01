/**
 * Serbian wording for the activity log: action codes written by
 * `logActivity(...)` across `convex/`, the fields a diff names, and the admin
 * route each record type opens. Unknown action codes and fields are shown
 * raw, so a new server action never disappears from the log.
 */
import type { FunctionReturnType } from "convex/server";
import type { api } from "@/convex/_generated/api";
import type { LeadStatus, ListingStatus, PostStatus, ViewingStatus } from "@/convex/lib/validators";
import {
  LEAD_STATUS_LABEL,
  POST_STATUS_LABEL,
  STATUS_LABEL,
  VIEWING_STATUS_LABEL,
} from "@/lib/admin/labels";

export type ActivityRow = FunctionReturnType<typeof api.activity.list>["page"][number];
type Target = NonNullable<ActivityRow["target"]>;

const ACTION_LABEL: Record<string, string> = {
  "listing.created": "Kreirana nekretnina",
  "listing.updated": "Izmenjena nekretnina",
  "listing.published": "Nekretnina objavljena",
  "listing.duplicated": "Napravljena kopija nekretnine",
  "listing.deleted": "Nekretnina obrisana",
  "listing.slug.regenerated": "Nova adresa oglasa",
  "listing.mandateExpired": "Istekao ugovor o posredovanju",
  "listing.previewRotated": "Nov link za pregled pre objave",
  "listing.owner.linked": "Povezan vlasnik",
  "listing.owner.unlinked": "Uklonjen vlasnik",
  "listing.owner.updated": "Izmenjeni podaci vlasnika",
  "media.attached": "Dodate fotografije",
  "media.cover": "Promenjena naslovna fotografija",
  "media.meta": "Izmenjen opis fotografije",
  "media.removed": "Uklonjena fotografija",
  "media.reordered": "Promenjen redosled fotografija",
  "media.video": "Izmenjen video",
  "tour.360.set": "Podešena 360° tura",
  "tour.scene.created": "Dodata 360° scena",
  "tour.scene.updated": "Izmenjena 360° scena",
  "tour.scene.removed": "Uklonjena 360° scena",
  "tour.scene.links": "Povezane 360° scene",
  "tour.scenes.reordered": "Promenjen redosled 360° scena",
  "tour.walk3d.set": "Podešena 3D šetnja",
  "lead.created": "Novi upit",
  "lead.assigned": "Upit dodeljen agentu",
  "lead.responded": "Odgovoreno na upit",
  "lead.note": "Beleška uz upit",
  "lead.nextAction": "Zakazan sledeći korak",
  "viewing.requested": "Zatraženo razgledanje",
  "viewing.created": "Zakazano razgledanje",
  "viewing.feedback": "Utisak sa razgledanja",
  "contact.anonymized": "Kontakt anonimizovan",
  "contact.merged": "Kontakti spojeni",
  "contact.note": "Beleška uz kontakt",
  "contact.exported": "Izvezeni kontakti (CSV)",
  "invite.created": "Poslata pozivnica",
  "invite.accepted": "Pozivnica prihvaćena",
  "invite.revoked": "Pozivnica opozvana",
  "invite.renewed": "Pozivnica obnovljena",
  "user.role": "Promenjena uloga",
  "user.status": "Promenjen status naloga",
  "user.agentLinked": "Nalog povezan sa profilom agenta",
  "agent.created": "Dodat agent",
  "agent.updated": "Izmenjen profil agenta",
  "agent.deleted": "Uklonjen agent",
  "agent.reordered": "Promenjen redosled agenata",
  "agent.availability": "Izmenjena dostupnost agenta",
  "agent.published": "Agent prikazan na sajtu",
  "agent.hidden": "Agent sakriven sa sajta",
  "location.created": "Dodata lokacija",
  "location.updated": "Izmenjena lokacija",
  "location.deleted": "Obrisana lokacija",
  "location.reordered": "Promenjen redosled lokacija",
  "location.avgPrice": "Izmenjena prosečna cena po m²",
  "post.created": "Novi tekst",
  "post.updated": "Izmenjen tekst",
  "post.deleted": "Obrisan tekst",
  "post.image_added": "Dodata slika u tekst",
  "post.scheduled": "Tekst zakazan za objavu",
  "post.schedule_failed": "Zakazana objava teksta nije uspela",
  "page.created": "Kreirana stranica",
  "page.updated": "Izmenjen sadržaj stranice",
  "page.seedRefreshed": "Osvežen početni sadržaj stranica",
  "testimonial.created": "Dodat utisak",
  "testimonial.updated": "Izmenjen utisak",
  "testimonial.deleted": "Obrisan utisak",
  "testimonial.reordered": "Promenjen redosled utisaka",
  "testimonial.verified": "Utisak potvrđen",
  "testimonial.unverified": "Utisak više nije potvrđen",
  "settings.updated": "Izmenjena podešavanja",
  "settings.legal.real": "Uneti pravi podaci agencije",
  "demo.purge.started": "Pokrenuto brisanje demo sadržaja",
  "demo.purge.finished": "Demo sadržaj obrisan",
};

const BULK_LABEL: Record<string, string> = {
  publish: "objava",
  unpublish: "povlačenje sa sajta",
  archive: "arhiviranje",
  feature: "izdvajanje",
  unfeature: "uklanjanje iz izdvojenih",
  assign: "dodela agenta",
  deleteDemo: "brisanje demo nekretnina",
};

function has<K extends string>(labels: Record<K, string>, key: string): key is K {
  return Object.hasOwn(labels, key);
}

/** Human label of an action code; dynamic codes carry their status. */
export function actionLabel(action: string): string {
  const exact = ACTION_LABEL[action];
  if (exact !== undefined) return exact;
  const [entity, second, third] = action.split(".");
  if (entity === "listing" && second === "status" && third !== undefined && has<ListingStatus>(STATUS_LABEL, third)) {
    return `Status nekretnine: ${STATUS_LABEL[third]}`;
  }
  if (entity === "listing" && second === "bulk" && third !== undefined && has(BULK_LABEL, third)) {
    return `Grupna izmena: ${BULK_LABEL[third]}`;
  }
  if (entity === "lead" && second === "status" && third !== undefined && has<LeadStatus>(LEAD_STATUS_LABEL, third)) {
    return `Status upita: ${LEAD_STATUS_LABEL[third]}`;
  }
  // `viewing.status.done`; older rows wrote `viewing.done`.
  const viewingStatus = second === "status" ? third : third === undefined ? second : undefined;
  if (entity === "viewing" && viewingStatus !== undefined && has<ViewingStatus>(VIEWING_STATUS_LABEL, viewingStatus)) {
    return `Razgledanje: ${VIEWING_STATUS_LABEL[viewingStatus]}`;
  }
  if (entity === "post" && second !== undefined && third === undefined && has<PostStatus>(POST_STATUS_LABEL, second)) {
    return `Tekst: ${POST_STATUS_LABEL[second]}`;
  }
  return action;
}

const FIELD_LABEL: Record<string, string> = {
  // Settings (flattened by convex/settingsAdmin.ts)
  companyName: "Naziv agencije",
  legalName: "Poslovno ime",
  address: "Adresa",
  pib: "PIB",
  mb: "Matični broj",
  registryNo: "Registar posrednika",
  insurance: "Osiguranje",
  phones: "Telefoni",
  email: "E-pošta",
  viber: "Viber",
  whatsapp: "WhatsApp",
  officeHours: "Radno vreme",
  officeLat: "Geografska širina",
  officeLng: "Geografska dužina",
  termsPdf: "Opšti uslovi (PDF)",
  "mortgage.rate": "Kamatna stopa",
  "mortgage.years": "Rok otplate",
  "mortgage.downPct": "Učešće",
  eurRsd: "Kurs EUR → RSD",
  "socials.instagram": "Instagram",
  "socials.facebook": "Facebook",
  "socials.linkedin": "LinkedIn",
  "socials.youtube": "YouTube",
  commissionText: "Tekst o proviziji",
  "seo.defaultTitle": "SEO naslov",
  "seo.defaultDescription": "SEO opis",
  "seo.ogImage": "OG slika",
  "analytics.plausibleDomain": "Plausible domen",
  "analytics.ga4Id": "GA4 ID",
  "analytics.metaPixelId": "Meta Pixel ID",
  isDemo: "Demo podaci",
  // Listings, leads, viewings, content
  title: "Naslov",
  description: "Opis",
  highlights: "Istaknuto",
  price: "Cena",
  status: "Status",
  visibility: "Vidljivost",
  transaction: "Transakcija",
  propertyType: "Tip",
  subtype: "Podtip",
  agentId: "Agent",
  areaM2: "Kvadratura",
  rooms: "Broj soba",
  bedrooms: "Spavaće sobe",
  bathrooms: "Kupatila",
  floor: "Sprat",
  totalFloors: "Spratnost",
  heating: "Grejanje",
  features: "Opremljenost",
  parking: "Parking",
  furnishing: "Nameštenost",
  condition: "Stanje",
  constructionType: "Gradnja",
  legal: "Pravni status",
  mandate: "Ugovor o posredovanju",
  location: "Lokacija",
  cityId: "Grad",
  municipalityId: "Opština",
  neighborhoodId: "Naselje",
  slug: "URL adresa",
  seo: "SEO",
  isExclusive: "Ekskluziva",
  isFeatured: "Izdvojeno",
  lossReason: "Razlog gubitka",
  nextActionAt: "Sledeći korak",
  feedback: "Utisak",
  start: "Početak",
  end: "Kraj",
  name: "Ime",
  phone: "Telefon",
  role: "Uloga",
  bio: "Biografija",
  languages: "Jezici",
  order: "Redosled",
  verified: "Potvrđeno",
  quote: "Citat",
  author: "Autor",
  body: "Tekst",
  excerpt: "Uvod",
  category: "Kategorija",
  tags: "Oznake",
  cover: "Naslovna slika",
  publishedAt: "Datum objave",
};

const LOCALE_SUFFIX: Record<string, string> = { sr: "SR", en: "EN", ru: "RU", de: "DE" };

/** `seo.defaultTitle.en` → `SEO naslov (EN)`; unknown keys stay raw. */
export function fieldLabel(field: string): { label: string; known: boolean } {
  const exact = FIELD_LABEL[field];
  if (exact !== undefined) return { label: exact, known: true };
  const dot = field.lastIndexOf(".");
  if (dot > 0) {
    const locale = LOCALE_SUFFIX[field.slice(dot + 1)];
    const base = FIELD_LABEL[field.slice(0, dot)];
    if (locale !== undefined && base !== undefined) return { label: `${base} (${locale})`, known: true };
  }
  return { label: field, known: false };
}

/** Where a row's record opens in the admin. */
export function targetHref(target: Target): string {
  switch (target.kind) {
    case "listing":
      return `/admin/nekretnine/${target.id ?? ""}`;
    case "lead":
      return `/admin/upiti?id=${target.id ?? ""}`;
    case "viewing":
      return `/admin/razgledanja?id=${target.id ?? ""}`;
    case "post":
      return `/admin/magazin/${target.id ?? ""}`;
    case "location":
      return `/admin/lokacije?id=${target.id ?? ""}`;
    case "contact":
      return `/admin/kontakti?id=${target.id ?? ""}`;
    case "settings":
      return "/admin/podesavanja";
  }
}
