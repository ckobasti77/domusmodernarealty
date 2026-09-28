import { describe, expect, it } from "vitest";
import { annuityPayment, computeMortgage } from "./mortgage";

describe("annuityPayment", () => {
  it("matches the textbook annuity for 100 000 € at 5.4% over 25 years", () => {
    // r = 0.054 / 12 = 0.0045, n = 300 → 100000 × r / (1 − (1 + r)^−300) ≈ 608.12
    expect(annuityPayment(100_000, 5.4, 300)).toBeCloseTo(608.12, 1);
  });

  it("divides evenly when the rate is zero", () => {
    expect(annuityPayment(120_000, 0, 240)).toBe(500);
  });

  it("returns 0 for an empty principal or term", () => {
    expect(annuityPayment(0, 5, 300)).toBe(0);
    expect(annuityPayment(100_000, 5, 0)).toBe(0);
  });
});

describe("computeMortgage", () => {
  it("applies the down payment before computing the loan", () => {
    const result = computeMortgage({ price: 250_000, downPct: 20, years: 25, ratePct: 5.4 });
    expect(result.downPayment).toBe(50_000);
    expect(result.principal).toBe(200_000);
    expect(result.months).toBe(300);
    expect(result.monthlyPayment).toBeCloseTo(1216.24, 1);
    expect(result.totalPaid).toBeCloseTo(result.monthlyPayment * 300, 6);
    expect(result.totalInterest).toBeCloseTo(result.totalPaid - 200_000, 6);
  });

  it("a 10% preset borrows more and pays more per month than 20%", () => {
    const twenty = computeMortgage({ price: 180_000, downPct: 20, years: 25, ratePct: 5 });
    const ten = computeMortgage({ price: 180_000, downPct: 10, years: 25, ratePct: 5 });
    expect(ten.principal).toBe(162_000);
    expect(ten.monthlyPayment).toBeGreaterThan(twenty.monthlyPayment);
  });

  it("clamps nonsense inputs instead of producing NaN", () => {
    const result = computeMortgage({ price: 100_000, downPct: 150, years: 0, ratePct: Number.NaN });
    expect(result.downPayment).toBe(90_000);
    expect(result.months).toBe(12);
    expect(Number.isFinite(result.monthlyPayment)).toBe(true);
    expect(result.monthlyPayment).toBeCloseTo(10_000 / 12, 6);
  });

  it("rounds a fractional term to whole years", () => {
    expect(computeMortgage({ price: 100_000, downPct: 20, years: 24.6, ratePct: 5 }).months).toBe(300);
  });
});
