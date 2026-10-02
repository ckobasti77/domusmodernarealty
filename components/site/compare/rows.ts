import { displayFloor, displayTotalFloors } from "@/components/site/listing/floor";
import type { Locale } from "@/i18n/routing";
import { formatArea, formatCount, formatPrice, formatPricePerM2, priceDeltaPct } from "@/lib/format";
import { floorLabel, structureShort, type ListingTranslator } from "@/lib/listing-text";
import type { CompareItem } from "./compare-item";

/**
 * The comparison as data: groups of rows, one cell per listing, and for every
 * row the columns that hold its standout figure. Pure, so the rules below are the
 * whole story of what gets highlighted.
 *
 * - Only figures with an obvious direction compete: the lowest price, €/m² and
 *   monthly costs; the largest area, outdoor space and plot; the most rooms and
 *   bathrooms; the newest building. Categorical rows (heating, condition…)
 *   never do — "Centralno" is not better than "Etažno" for every buyer.
 * - Only the price rows call their standout the best value. The others say
 *   what it is ("Najveća površina", "Najnovija gradnja"): a bigger, newer and
 *   dearer flat is not the better deal, and it collected every "best value".
 * - A missing value never wins, and a row needs two stated values to compete.
 * - Ties highlight every tied column, but when ALL stated values are equal
 *   nothing stands out, so nothing is highlighted.
 * - A sale price and a monthly rent are not comparable: with mixed
 *   transactions the price rows show their figures without a winner.
 */

export type CompareCell = {
  text: string;
  /** A second, quieter line (a price cut, a renovation year, a cost breakdown). */
  detail?: string;
  /** The figure that competes for the row's standout. */
  value?: number;
};

export type CompareRow = {
  key: string;
  label: string;
  /** `null` when the listing does not state it. */
  cells: (CompareCell | null)[];
  /** Column indexes holding the row's standout figure; empty when the row has no winner. */
  best: ReadonlySet<number>;
  /** The words under a standout figure ("Najbolja vrednost", "Najviše soba"). */
  mark?: string;
};

export type CompareGroup = { key: string; label: string; rows: CompareRow[] };

export type CompareTranslators = {
  compare: ListingTranslator;
  listing: ListingTranslator;
  units: ListingTranslator;
};

type Rule = "min" | "max";

/** How a row picks its standout, and what the standout cell then says. */
type Highlight = { rule: Rule; mark: string };

const NONE: ReadonlySet<number> = new Set();

export function bestColumns(cells: readonly (CompareCell | null)[], rule: Rule): ReadonlySet<number> {
  const scored: { index: number; value: number }[] = [];
  cells.forEach((cell, index) => {
    if (cell?.value !== undefined && Number.isFinite(cell.value)) scored.push({ index, value: cell.value });
  });
  if (scored.length < 2) return NONE;
  const values = scored.map((entry) => entry.value);
  const target = rule === "min" ? Math.min(...values) : Math.max(...values);
  if (values.every((value) => value === target)) return NONE;
  return new Set(scored.filter((entry) => entry.value === target).map((entry) => entry.index));
}

function row(
  key: string,
  label: string,
  cells: (CompareCell | null)[],
  highlight?: Highlight,
): CompareRow | null {
  if (cells.every((cell) => cell === null)) return null;
  if (highlight === undefined) return { key, label, cells, best: NONE };
  return { key, label, cells, best: bestColumns(cells, highlight.rule), mark: highlight.mark };
}

function group(key: string, label: string, rows: (CompareRow | null)[]): CompareGroup | null {
  const kept = rows.filter((entry): entry is CompareRow => entry !== null);
  return kept.length > 0 ? { key, label, rows: kept } : null;
}

const hasRooms = (item: CompareItem) => item.propertyType !== "land" && item.propertyType !== "garage";
const hasInterior = (item: CompareItem) => item.propertyType !== "land";

export function buildCompareGroups(
  items: readonly CompareItem[],
  t: CompareTranslators,
  locale: Locale,
): CompareGroup[] {
  const m2 = t.units("m2");
  const comparablePrices = items.every((item) => item.transaction === items[0]?.transaction);
  const yesNo = (value: boolean | undefined): CompareCell | null =>
    value === undefined ? null : { text: value ? t.listing("facts.yes") : t.listing("facts.no") };
  // Lists of enum values read as "Centralno (CG), gas", like the detail page.
  const sentence = (values: string[]): CompareCell | null => {
    if (values.length === 0) return null;
    const text = values.join(", ");
    return { text: text.charAt(0).toLocaleUpperCase(locale) + text.slice(1) };
  };
  const area = (value: number | undefined): CompareCell | null =>
    value === undefined ? null : { text: formatArea(value, locale, m2), value };
  const count = (value: number | undefined): CompareCell | null =>
    value === undefined ? null : { text: formatCount(value, locale), value };

  const price = items.map((item): CompareCell => {
    const figure = formatPrice(item.price, locale);
    const reduced = item.previousPrice !== undefined && item.previousPrice > item.price;
    return {
      text: item.transaction === "rent" ? `${figure} ${t.units("perMonth")}` : figure,
      ...(reduced
        ? { detail: t.listing("price.dropBy", { pct: Math.abs(priceDeltaPct(item.previousPrice ?? item.price, item.price)) }) }
        : {}),
      ...(comparablePrices ? { value: item.price } : {}),
    };
  });

  const perM2 = items.map((item): CompareCell | null =>
    item.pricePerM2 <= 0
      ? null
      : {
          text: formatPricePerM2(item.pricePerM2, locale, m2),
          ...(comparablePrices ? { value: item.pricePerM2 } : {}),
        },
  );

  const bills = items.map((item): CompareCell | null => {
    const infostan = item.costs?.infostan;
    const maintenance = item.costs?.maintenance;
    if (infostan === undefined && maintenance === undefined) return null;
    const parts = [
      ...(infostan !== undefined ? [t.compare("billsInfostan", { amount: formatPrice(infostan, locale) })] : []),
      ...(maintenance !== undefined ? [t.compare("billsMaintenance", { amount: formatPrice(maintenance, locale) })] : []),
    ];
    const total = (infostan ?? 0) + (maintenance ?? 0);
    return {
      text: t.compare("billsTotal", { amount: formatPrice(total, locale) }),
      detail: parts.join(" · "),
      value: total,
    };
  });

  const bestValue: Highlight = { rule: "min", mark: t.compare("bestValue") };
  const largest: Highlight = { rule: "max", mark: t.compare("markLargest") };

  const groups = [
    group("price", t.compare("groups.price"), [
      row("price", t.compare("rowPrice"), price, bestValue),
      row("pricePerM2", t.listing("pricePerM2"), perM2, bestValue),
      row("bills", t.listing("facts.bills"), bills, bestValue),
    ]),
    group("space", t.compare("groups.space"), [
      row("area", t.listing("area"), items.map((item) => area(item.areaM2)), largest),
      row(
        "rooms",
        t.listing("rooms"),
        items.map((item) =>
          hasRooms(item)
            ? {
                // "Trosoban" agrees with "stan"; an office or a house gets the plain count.
                text:
                  item.propertyType === "apartment"
                    ? structureShort(t.listing, t.units, item.rooms)
                    : t.units("rooms", { count: item.rooms }),
                value: item.rooms,
              }
            : null,
        ),
        { rule: "max", mark: t.compare("markMostRooms") },
      ),
      row("bathrooms", t.listing("facts.bathrooms"), items.map((item) => count(item.bathrooms)), {
        rule: "max",
        mark: t.compare("markMostBathrooms"),
      }),
      row("outdoor", t.listing("facts.outdoor"), items.map((item) => area(item.outdoorAreaM2)), largest),
      row("plot", t.listing("facts.plotArea"), items.map((item) => area(item.plotAreaM2)), largest),
      row(
        "floor",
        t.listing("floor"),
        items.map((item) =>
          hasInterior(item)
            ? {
                text: floorLabel(
                  t.listing,
                  displayFloor(item.floor, locale),
                  displayTotalFloors(item.totalFloors, locale),
                ),
              }
            : null,
        ),
      ),
    ]),
    group("building", t.compare("groups.building"), [
      row(
        "yearBuilt",
        t.listing("yearBuilt"),
        items.map((item) =>
          item.yearBuilt === undefined
            ? null
            : {
                text: String(item.yearBuilt),
                value: item.yearBuilt,
                ...(item.renovatedYear !== undefined
                  ? { detail: `${t.listing("facts.renovated")} ${item.renovatedYear}` }
                  : {}),
              },
        ),
        { rule: "max", mark: t.compare("markNewest") },
      ),
      row(
        "construction",
        t.listing("facts.construction"),
        items.map((item) => ({ text: t.listing(`construction.${item.constructionType}`) })),
      ),
      row(
        "condition",
        t.listing("facts.condition"),
        items.map((item) => (hasInterior(item) ? { text: t.listing(`condition.${item.condition}`) } : null)),
      ),
      row(
        "furnishing",
        t.listing("furnishing"),
        items.map((item) => (hasInterior(item) ? { text: t.listing(`furnishingValue.${item.furnishing}`) } : null)),
      ),
      row(
        "heating",
        t.listing("heating"),
        items.map((item) => sentence(item.heating.map((value) => t.listing(`heatingValue.${value}`)))),
      ),
      row(
        "parking",
        t.listing("parking"),
        items.map((item) => sentence(item.parking.map((value) => t.listing(`parkingValue.${value}`)))),
      ),
      row(
        "elevator",
        t.listing("facts.elevator"),
        items.map((item) =>
          item.propertyType === "apartment" || item.propertyType === "office" ? yesNo(item.elevator) : null,
        ),
      ),
      row(
        "energyClass",
        t.listing("energyClass"),
        items.map((item) => (item.energyClass !== undefined ? { text: item.energyClass } : null)),
      ),
    ]),
    group("legal", t.compare("groups.legal"), [
      row(
        "registration",
        t.listing("legalBlock.registration"),
        items.map((item) => ({ text: t.listing(`registration.${item.registration}`) })),
      ),
      // Only worth a row once at least one listing has verified documents.
      items.some((item) => item.docsVerified)
        ? row("docsVerified", t.listing("verifiedDocs"), items.map((item) => yesNo(item.docsVerified)))
        : null,
      row(
        "mortgage",
        t.listing("feature.mortgage"),
        items.map((item) => (item.transaction === "sale" ? yesNo(item.mortgageEligible) : null)),
      ),
      row(
        "vatRefund",
        t.listing("feature.vatRefund"),
        items.map((item) => (item.transaction === "sale" ? yesNo(item.vatRefundEligible) : null)),
      ),
    ]),
  ];

  return groups.filter((entry): entry is CompareGroup => entry !== null);
}
