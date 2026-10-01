import type { PageBlock, PageKey } from "@/convex/lib/validators";

/**
 * Editor-facing names for the site's content blocks. The keys are fixed by
 * the site (`lib/content/pages.ts` for the landing, the seeded templates for
 * the rest); editors see these names, never the keys.
 */

export type BlockInfo = {
  title: string;
  description?: string;
  /** Per-field labels where the generic one would be vague ("Naslov (H1)"). */
  fields?: Partial<Record<FieldName, string>>;
  /** Fields the site does not read for this block (kept in code/messages). */
  hidden?: readonly FieldName[];
};

export type FieldName = "title" | "body" | "lede" | "heading" | "sub" | "note" | "label" | "href" | "item" | "caption";

const LANDING_CTA_HINT = "Tekst i odredište dugmeta su deo dizajna sajta i menjaju se u kodu.";

const BLOCKS: Partial<Record<PageKey, Record<string, BlockInfo>>> = {
  home: {
    hero: {
      title: "Naslovna sekcija (hero)",
      description: "Prvo što posetilac vidi, preko fotografije, iznad pretrage.",
      fields: { title: "Naslov (H1)", body: "Podnaslov" },
    },
    intro: {
      title: "Uvodna izjava",
      description: "Veliki pasus ispod naslovne sekcije, bez naslova.",
      fields: { body: "Izjava" },
    },
    neighborhoodsIntro: {
      title: "Lokacije — naslov i uvod",
      description: "Lokacije u spisku ispod naslova uređuju se u delu „Lokacije”.",
      fields: { title: "Naslov", body: "Uvod" },
    },
    services: {
      title: "Usluge",
      description: "Šest usluga, istim redom kao linkovi na sajtu (kupovina, prodaja, zakup, procena, 3D ture, relokacija).",
      fields: { title: "Naslov sekcije", item: "Usluga" },
    },
    tours3d: {
      title: "3D ture — naslov i uvod",
      fields: { title: "Naslov", body: "Uvod" },
    },
    process: {
      title: "Kako prodajemo (proces)",
      description: "Pet koraka prodaje, uz dugme „Prodajte sa nama”.",
      fields: { title: "Naslov sekcije", lede: "Uvod", item: "Korak" },
    },
    numbers: {
      title: "Brojke",
      description: "Četiri brojke agencije. Upisujte samo stvarne podatke.",
      fields: { title: "Naslov sekcije", item: "Brojka" },
    },
    valuationCta: {
      title: "Poziv na procenu",
      description: `Sekcija sa malom formom za procenu. ${LANDING_CTA_HINT} Onlajn procena je okvirna, iz prosečnih cena u kraju; stvarne transakcije pominje samo procena agenta na terenu.`,
      fields: { heading: "Naslov", sub: "Uvod", note: "Napomena ispod forme" },
      hidden: ["label", "href"],
    },
    finalCta: {
      title: "Završni poziv (kontakt)",
      description: `Poslednja sekcija pre podnožja, sa kontakt kanalima iz Podešavanja. ${LANDING_CTA_HINT}`,
      fields: { heading: "Naslov", sub: "Uvod" },
      hidden: ["label", "href"],
    },
  },
  about: {
    story: { title: "Ko smo i kako radimo" },
    values: { title: "Šta nam je važno", fields: { item: "Vrednost" } },
    method: { title: "Standardi rada" },
  },
  sell: {
    lede: { title: "Uvod" },
    benefits: { title: "Šta dobijate" },
    process: { title: "Proces prodaje", fields: { item: "Korak" } },
    faq: { title: "Česta pitanja" },
  },
  valuation: {
    lede: { title: "Uvod" },
    whatWeLookAt: { title: "Šta gledamo" },
    faq: { title: "Česta pitanja" },
    bookOnSite: { title: "Poziv: procena na terenu" },
  },
  contact: {
    lede: { title: "Uvod" },
    faq: { title: "Česta pitanja" },
  },
};

const TYPE_TITLE: Record<PageBlock["type"], string> = {
  richText: "Tekst",
  stats: "Brojke",
  steps: "Koraci",
  faq: "Česta pitanja",
  cta: "Poziv na akciju",
  media: "Slika",
  list: "Lista",
};

const FIELD_DEFAULT: Record<FieldName, string> = {
  title: "Naslov",
  body: "Tekst",
  lede: "Uvod",
  heading: "Naslov",
  sub: "Podnaslov",
  note: "Napomena",
  label: "Tekst dugmeta",
  href: "Odredište dugmeta",
  item: "Stavka",
  caption: "Opis slike",
};

/** Legal pages: the draft notice gets a name of its own, other sections their title. */
const NOTICE_KEY = "notice";

export function blockInfo(
  page: PageKey,
  block: { key: string; type: PageBlock["type"] },
  index: number,
  srTitle: string,
): BlockInfo {
  const known = BLOCKS[page]?.[block.key];
  if (known !== undefined) return known;
  if (block.key === NOTICE_KEY) {
    return {
      title: "Napomena: nacrt",
      description:
        "Upozorenje da tekst još nije pravno proveren. Vidi se samo ovde, u administraciji — javna stranica ga ne prikazuje. Uklonite ga kada pravnik odobri tekst.",
    };
  }
  const title = srTitle.trim();
  return { title: title.length > 0 ? title : `${TYPE_TITLE[block.type]} ${index + 1}` };
}

export function fieldLabel(info: BlockInfo, field: FieldName): string {
  return info.fields?.[field] ?? FIELD_DEFAULT[field];
}

export function isHidden(info: BlockInfo, field: FieldName): boolean {
  return info.hidden?.includes(field) ?? false;
}

/** Names for the routes a CTA may point to (`pagesAdmin.get` → `ctaTargets`). */
export const CTA_TARGET_LABEL: Record<string, string> = {
  "/": "Početna",
  "/properties": "Nekretnine",
  "/locations": "Lokacije",
  "/valuation": "Procena",
  "/sell": "Prodajte",
  "/agents": "Agenti",
  "/about": "O nama",
  "/contact": "Kontakt",
  "/journal": "Magazin",
  "/favorites": "Omiljeno",
  "/compare": "Uporedi",
  "/privacy": "Politika privatnosti",
  "/terms": "Uslovi korišćenja",
  "/cookies": "Kolačići",
};
