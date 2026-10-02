/** Money and valuation maths shared by seed, admin and the public funnel. */

import type { Infer } from "convex/values";
import type { conditionV, floorV, valuationResultV } from "./validators";

export type Condition = Infer<typeof conditionV>;
export type FloorValue = Infer<typeof floorV>;
export type ValuationResult = Infer<typeof valuationResultV>;

/**
 * Sortable storey, the scale of `listings.floorNum` and of the public floor
 * filter (`lib/search-params.ts` maps its selects through this too). PK
 * (attic) sits just above the top floor; without the building's height that
 * is floor 1 at least, so "not the top floor" tests PK itself (`lib/search.ts`).
 */
export function floorToNumber(floor: FloorValue, totalFloors?: number): number {
  if (typeof floor === "number") return floor;
  switch (floor) {
    case "SUT":
      return -1;
    case "PSUT":
      return -0.5;
    case "PR":
      return 0;
    case "VPR":
      return 0.5;
    case "PK":
      return (totalFloors ?? 0) + 1;
  }
}

export function round(value: number, step: number): number {
  return Math.round(value / step) * step;
}

const CONDITION_FACTOR: Record<Condition, number> = {
  lux: 1.14,
  renovated: 1.06,
  original: 1,
  needs_renovation: 0.86,
};

/**
 * Indicative valuation range from the neighborhood average €/m², adjusted for
 * condition, floor and the presence of a lift. Deliberately coarse: the copy
 * calls it "indicative" and always offers an on-site valuation.
 */
export function computeValuation(input: {
  avgPricePerM2: number;
  areaM2: number;
  condition: Condition;
  floorNum: number;
  totalFloors?: number;
  hasElevator?: boolean;
}): ValuationResult {
  const { avgPricePerM2, areaM2, condition, floorNum } = input;
  let factor = CONDITION_FACTOR[condition];

  if (floorNum <= 0) factor *= 0.95;
  else if (floorNum >= 1 && floorNum <= 4) factor *= 1.02;
  if (floorNum >= 5 && input.hasElevator === false) factor *= 0.9;
  if (input.totalFloors !== undefined && floorNum === input.totalFloors) {
    factor *= 0.97;
  }

  const pricePerM2 = round(avgPricePerM2 * factor, 10);
  const mid = round(pricePerM2 * areaM2, 500);
  return {
    low: round(mid * 0.92, 500),
    mid,
    high: round(mid * 1.08, 500),
    pricePerM2,
    basis: "Prosečna cena po m² u odabranoj lokaciji, korigovana za stanje, sprat i lift.",
  };
}
