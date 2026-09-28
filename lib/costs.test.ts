import { describe, expect, it } from "vitest";
import {
  CADASTRE_FEE_EUR,
  computePurchaseCosts,
  firstHomeExemptArea,
  notaryEstimate,
  vatRateFor,
} from "./costs";

function line(result: ReturnType<typeof computePurchaseCosts>, key: string) {
  const found = result.lines.find((item) => item.key === key);
  if (found === undefined) throw new Error(`missing line ${key}`);
  return found;
}

describe("computePurchaseCosts: resale", () => {
  const result = computePurchaseCosts({
    price: 200_000,
    propertyType: "apartment",
    constructionType: "old",
    agencyFeePct: 2,
  });

  it("charges the 2.5% transfer tax and no VAT", () => {
    expect(line(result, "transferTax").amount).toBe(5_000);
    expect(result.lines.some((item) => item.key === "vat")).toBe(false);
  });

  it("adds the agency fee, notary and cadastre estimates", () => {
    expect(line(result, "agencyFee").amount).toBe(4_000);
    expect(line(result, "notary").amount).toBe(450);
    expect(line(result, "notary").estimate).toBe(true);
    expect(line(result, "cadastre").amount).toBe(CADASTRE_FEE_EUR);
    expect(result.extras).toBe(5_000 + 4_000 + 450 + CADASTRE_FEE_EUR);
    expect(result.total).toBe(200_000 + result.extras);
  });
});

describe("computePurchaseCosts: new build", () => {
  it("shows residential VAT as included and does not add it", () => {
    const result = computePurchaseCosts({
      price: 110_000,
      propertyType: "apartment",
      constructionType: "new",
      agencyFeePct: 0,
    });
    const vat = line(result, "vat");
    expect(vat.ratePct).toBe(10);
    expect(vat.includedInPrice).toBe(true);
    expect(vat.amount).toBeCloseTo(10_000, 6);
    expect(result.lines.some((item) => item.key === "transferTax")).toBe(false);
    expect(result.extras).toBe(notaryEstimate(110_000) + CADASTRE_FEE_EUR);
  });

  it("adds VAT on top when the price is quoted without it", () => {
    const result = computePurchaseCosts({
      price: 100_000,
      propertyType: "office",
      constructionType: "under_construction",
      vatIncluded: false,
      agencyFeePct: 0,
    });
    const vat = line(result, "vat");
    expect(vat.ratePct).toBe(20);
    expect(vat.includedInPrice).toBe(false);
    expect(vat.amount).toBe(20_000);
    expect(result.total).toBe(100_000 + 20_000 + notaryEstimate(100_000) + CADASTRE_FEE_EUR);
  });
});

describe("helpers", () => {
  it("uses 10% VAT for homes and 20% for everything else", () => {
    expect(vatRateFor("house")).toBe(10);
    expect(vatRateFor("cottage")).toBe(10);
    expect(vatRateFor("commercial")).toBe(20);
    expect(vatRateFor("land")).toBe(20);
  });

  it("steps the notary estimate by price band", () => {
    expect(notaryEstimate(40_000)).toBe(250);
    expect(notaryEstimate(50_000)).toBe(250);
    expect(notaryEstimate(50_001)).toBe(350);
    expect(notaryEstimate(2_000_000)).toBe(800);
  });

  it("explains the first-home area: 40 m² plus 15 m² per extra household member", () => {
    expect(firstHomeExemptArea(1)).toBe(40);
    expect(firstHomeExemptArea(3)).toBe(70);
    expect(firstHomeExemptArea(0)).toBe(40);
  });

  it("clamps the agency fee to a sane range", () => {
    const result = computePurchaseCosts({
      price: 100_000,
      propertyType: "apartment",
      constructionType: "old",
      agencyFeePct: 50,
    });
    expect(line(result, "agencyFee").ratePct).toBe(10);
  });
});
