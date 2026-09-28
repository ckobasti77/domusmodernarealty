/**
 * Total purchase cost for the listing calculator (PRD A5). Pure functions,
 * unit-tested in `lib/costs.test.ts`.
 *
 * The rules are the Serbian ones a buyer meets in practice:
 *  - RESALE (the second and every later sale) pays the 2.5% property transfer
 *    tax (porez na prenos apsolutnih prava). The seller is the statutory
 *    taxpayer, but contracts routinely move it to the buyer, so the calculator
 *    counts it and the UI says so.
 *  - A NEW BUILD's first sale is a VAT supply instead: 10% for residential
 *    space, 20% for everything else. It is normally already in the quoted
 *    price, so it is shown as "included" and not added twice.
 *  - The first-home exemptions (transfer tax, or a VAT refund on a new build)
 *    cover 40 m² for the buyer plus 15 m² per household member. They depend on
 *    documents only a notary or the tax office can check, so they are
 *    EXPLAINED in the UI and never subtracted here.
 *  - Notary and cadastre figures are rough, clearly labelled estimates.
 */

export type ConstructionType = "new" | "old" | "under_construction";
export type CostPropertyType =
  | "apartment"
  | "house"
  | "commercial"
  | "office"
  | "land"
  | "garage"
  | "cottage";

export const TRANSFER_TAX_PCT = 2.5;
export const VAT_RESIDENTIAL_PCT = 10;
export const VAT_STANDARD_PCT = 20;
export const FIRST_HOME_BASE_M2 = 40;
export const FIRST_HOME_PER_MEMBER_M2 = 15;
/** Default shown in the agency-fee field; the real figure is in the brokerage agreement. */
export const DEFAULT_AGENCY_FEE_PCT = 2;

/**
 * Notary fee estimate by price band (EUR). The notary tariff is value-based and
 * capped; these bands approximate it for a standard sale contract and are only
 * ever shown as "okvirno" (approximate).
 */
const NOTARY_BANDS: readonly { upTo: number; fee: number }[] = [
  { upTo: 50_000, fee: 250 },
  { upTo: 100_000, fee: 350 },
  { upTo: 200_000, fee: 450 },
  { upTo: 500_000, fee: 600 },
  { upTo: Number.POSITIVE_INFINITY, fee: 800 },
];

/** Cadastre (RGZ) registration of the new owner, approximate. */
export const CADASTRE_FEE_EUR = 80;

const RESIDENTIAL: ReadonlySet<CostPropertyType> = new Set(["apartment", "house", "cottage"]);

export type PurchaseCostInput = {
  price: number;
  propertyType: CostPropertyType;
  constructionType: ConstructionType;
  /** `false` only when the listing states the price is quoted without VAT. */
  vatIncluded?: boolean;
  agencyFeePct: number;
};

export type CostLineKey = "transferTax" | "vat" | "agencyFee" | "notary" | "cadastre";

export type CostLine = {
  key: CostLineKey;
  amount: number;
  /** Already inside the asking price: shown for information, not added. */
  includedInPrice: boolean;
  /** A rough figure rather than a statutory rate. */
  estimate: boolean;
  /** The rate behind the amount, when there is one. */
  ratePct?: number;
};

export type PurchaseCostResult = {
  isNewBuild: boolean;
  lines: CostLine[];
  /** Everything the buyer pays on top of the asking price. */
  extras: number;
  total: number;
};

export function isNewBuild(constructionType: ConstructionType): boolean {
  return constructionType !== "old";
}

export function vatRateFor(propertyType: CostPropertyType): number {
  return RESIDENTIAL.has(propertyType) ? VAT_RESIDENTIAL_PCT : VAT_STANDARD_PCT;
}

export function notaryEstimate(price: number): number {
  for (const band of NOTARY_BANDS) {
    if (price <= band.upTo) return band.fee;
  }
  return NOTARY_BANDS[NOTARY_BANDS.length - 1].fee;
}

/** The area a first-home exemption covers for a household of `members` people (buyer included). */
export function firstHomeExemptArea(members: number): number {
  const household = Math.max(1, Math.floor(Number.isFinite(members) ? members : 1));
  return FIRST_HOME_BASE_M2 + FIRST_HOME_PER_MEMBER_M2 * (household - 1);
}

export function computePurchaseCosts(input: PurchaseCostInput): PurchaseCostResult {
  const price = Math.max(0, Number.isFinite(input.price) ? input.price : 0);
  const feePct = Math.min(Math.max(Number.isFinite(input.agencyFeePct) ? input.agencyFeePct : 0, 0), 10);
  const newBuild = isNewBuild(input.constructionType);
  const lines: CostLine[] = [];

  if (newBuild) {
    const rate = vatRateFor(input.propertyType);
    const included = input.vatIncluded !== false;
    // Included VAT is the share of the gross price: price × r / (100 + r).
    const amount = included ? (price * rate) / (100 + rate) : (price * rate) / 100;
    lines.push({ key: "vat", amount, includedInPrice: included, estimate: false, ratePct: rate });
  } else {
    lines.push({
      key: "transferTax",
      amount: (price * TRANSFER_TAX_PCT) / 100,
      includedInPrice: false,
      estimate: false,
      ratePct: TRANSFER_TAX_PCT,
    });
  }

  lines.push({
    key: "agencyFee",
    amount: (price * feePct) / 100,
    includedInPrice: false,
    estimate: false,
    ratePct: feePct,
  });
  lines.push({ key: "notary", amount: notaryEstimate(price), includedInPrice: false, estimate: true });
  lines.push({ key: "cadastre", amount: price > 0 ? CADASTRE_FEE_EUR : 0, includedInPrice: false, estimate: true });

  const extras = lines.reduce((sum, line) => (line.includedInPrice ? sum : sum + line.amount), 0);
  return { isNewBuild: newBuild, lines, extras, total: price + extras };
}
