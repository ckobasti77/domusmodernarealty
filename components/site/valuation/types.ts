import type { Id } from "@/convex/_generated/dataModel";

/**
 * View models the valuation page's server code hands to the funnel island.
 * They live apart from `content.ts`, which is `server-only`.
 */

/** One `<option>` of the location select, already localized. */
export type LocationChoice = {
  id: Id<"locations">;
  slug: string;
  /** Option text, indented with em spaces under its municipality. */
  label: string;
  /** The plain place name, for the result summary. */
  name: string;
  /** Set when the name fell back to Serbian. */
  lang?: string;
  /**
   * A municipality without an average of its own whose neighborhoods have
   * one: shown as a sub-heading so the indentation under it still reads.
   */
  disabled?: boolean;
};

/** One `<optgroup>`: a city with its areas, or the group of smaller cities. */
export type LocationGroup = {
  label: string;
  lang?: string;
  options: LocationChoice[];
};

/** What the landing's mini-form handed over (`?location=vracar&area=64`). */
export type FunnelInitial = {
  locationId?: Id<"locations">;
  /** Already in the visitor's notation ("68,5" in sr/de/ru). */
  area?: string;
};

/**
 * `leads.createValuation` area bounds, shared by the server-side prefill and
 * the client-side validation (the landing's mini-form allows more).
 */
export const AREA_LIMITS = { min: 8, max: 2000 } as const;
