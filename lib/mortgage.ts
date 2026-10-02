/**
 * Mortgage maths for the listing calculator (PRD A5). Pure functions only, so
 * the numbers are unit-tested (`lib/mortgage.test.ts`) and identical on the
 * server and in the browser.
 *
 * The monthly payment is the standard annuity: equal instalments over the whole
 * term, interest charged monthly on the outstanding principal. Serbian banks
 * quote a nominal annual rate (NKS); the effective rate (EKS) the customer
 * actually pays also includes fees and insurance, which is why the UI carries
 * an EKS disclaimer instead of pretending this figure is an offer.
 */

export type MortgageInput = {
  /** Purchase price in EUR. */
  price: number;
  /** Down payment as a percentage of the price, 0–100. */
  downPct: number;
  /** Loan term in years. */
  years: number;
  /** Nominal annual interest rate in percent, e.g. 5.4. */
  ratePct: number;
};

export type MortgageResult = {
  downPayment: number;
  principal: number;
  months: number;
  monthlyPayment: number;
  totalPaid: number;
  totalInterest: number;
};

/** The two presets PRD A5 asks for; 20% is the usual bank minimum. */
export const DOWN_PAYMENT_PRESETS = [20, 10] as const;

/**
 * The same bounds the admin accepts for the site-wide defaults
 * (`settingsAdmin`), so a default is never silently cut. A 100% down payment
 * is a cash purchase: no loan, no instalment.
 */
export const MORTGAGE_LIMITS = {
  downPct: { min: 0, max: 100 },
  years: { min: 1, max: 40 },
  ratePct: { min: 0, max: 30 },
} as const;

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(Math.max(value, min), max);
}

/**
 * The inputs the maths actually uses: each one inside `MORTGAGE_LIMITS`, the
 * term in whole years, the price never negative. The calculator shows these
 * back in its fields, so a clamped value is never a silent one.
 */
export function normalizeMortgageInput(input: MortgageInput): MortgageInput {
  return {
    price: Math.max(0, Number.isFinite(input.price) ? input.price : 0),
    downPct: clamp(input.downPct, MORTGAGE_LIMITS.downPct.min, MORTGAGE_LIMITS.downPct.max),
    years: Math.round(clamp(input.years, MORTGAGE_LIMITS.years.min, MORTGAGE_LIMITS.years.max)),
    ratePct: clamp(input.ratePct, MORTGAGE_LIMITS.ratePct.min, MORTGAGE_LIMITS.ratePct.max),
  };
}

/**
 * Monthly annuity for a principal, a nominal annual rate and a term in months.
 * A zero rate degrades to straight division rather than dividing by zero.
 */
export function annuityPayment(principal: number, annualRatePct: number, months: number): number {
  if (principal <= 0 || months <= 0) return 0;
  const monthlyRate = annualRatePct / 100 / 12;
  if (monthlyRate === 0) return principal / months;
  return (principal * monthlyRate) / (1 - Math.pow(1 + monthlyRate, -months));
}

export function computeMortgage(input: MortgageInput): MortgageResult {
  const { price, downPct, years, ratePct } = normalizeMortgageInput(input);

  const downPayment = (price * downPct) / 100;
  const principal = price - downPayment;
  const months = years * 12;
  const monthlyPayment = annuityPayment(principal, ratePct, months);
  const totalPaid = monthlyPayment * months;

  return {
    downPayment,
    principal,
    months,
    monthlyPayment,
    totalPaid,
    totalInterest: Math.max(0, totalPaid - principal),
  };
}
