"use client";

import { RotateCcw } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Button } from "@/components/site/Button";
import type { Id } from "@/convex/_generated/dataModel";
import type { PropertyType } from "@/convex/lib/validators";
import type { Locale } from "@/i18n/routing";
import { formatArea, formatPrice, formatPricePerM2 } from "@/lib/format";
import { roomsKey, structureTitle } from "@/lib/listing-text";
import { OnsiteRequest } from "./OnsiteRequest";

/** What the funnel keeps from a successful `leads.createValuation`. */
export type ValuationOutcome = {
  leadId: Id<"leads">;
  valuation: { low: number; mid: number; high: number; pricePerM2: number };
  propertyType: PropertyType;
  rooms: number;
  areaM2: number;
  place: { name: string; lang?: string } | null;
};

/**
 * Step 3: the indicative range. The figures are the server's (`low`, `mid`,
 * `high`, the adjusted €/m²); the page only lays them out — the range as the
 * headline, then a ruled scale with the three marks, then the basis (€/m² ×
 * area) and the disclaimer.
 *
 * Copy rule (owner decision, 2026-09-28): this estimate is described as
 * indicative and based on average prices in the area, adjusted for condition,
 * floor and lift — never as based on real transactions. Only the on-site
 * valuation below may mention the RGZ price register.
 */
export function ValuationResult({ outcome, onRestart }: { outcome: ValuationOutcome; onRestart: () => void }) {
  const locale = useLocale() as Locale;
  const t = useTranslations("valuation");
  const tListing = useTranslations("listing");
  const tUnits = useTranslations("units");
  const { valuation } = outcome;
  const m2 = tUnits("m2");
  const area = formatArea(outcome.areaM2, locale, m2);

  // "Dvosoban stan · 64 m² · Vračar"; other types already carry the area ("Kuća, 240 m²").
  const title = structureTitle(tListing, { propertyType: outcome.propertyType, rooms: outcome.rooms, areaM2: outcome.areaM2 }, locale, m2);
  const titled = outcome.propertyType === "apartment" && roomsKey(outcome.rooms) !== null;

  return (
    <div data-testid="valuation-result" className="flex flex-col gap-10">
      <div className="flex flex-col gap-6">
        <p className="text-small text-stone-text">
          {title}
          {titled ? <> · {area}</> : null}
          {outcome.place !== null ? (
            <>
              {" · "}
              <span lang={outcome.place.lang}>{outcome.place.name}</span>
            </>
          ) : null}
        </p>
        <p data-numeric className="font-display text-display-m font-normal text-ink">
          {t("resultRange", { min: formatPrice(valuation.low, locale), max: formatPrice(valuation.high, locale) })}
        </p>
      </div>

      <div className="flex flex-col gap-4">
        {/* The scale is drawing only; the three figures below carry the content. */}
        <div aria-hidden="true" className="relative h-5">
          <span className="absolute inset-x-0 top-1/2 h-0.5 -translate-y-1/2 bg-bronze-deep" />
          <span className="absolute left-0 top-0 h-full w-px bg-ink" />
          <span className="absolute right-0 top-0 h-full w-px bg-ink" />
          <span className="absolute left-1/2 top-1/2 size-2.5 -translate-x-1/2 -translate-y-1/2 rotate-45 bg-ink" />
        </div>
        <dl className="grid grid-cols-3 gap-3">
          <div className="flex min-w-0 flex-col gap-1">
            <dt className="font-mono text-label uppercase text-stone-text">{t("rangeLow")}</dt>
            <dd data-numeric data-testid="valuation-range-low" className="text-small font-medium text-ink sm:text-body">
              {formatPrice(valuation.low, locale)}
            </dd>
          </div>
          <div className="flex min-w-0 flex-col items-center gap-1 text-center">
            <dt className="font-mono text-label uppercase text-stone-text">{t("rangeMid")}</dt>
            <dd data-numeric className="text-small font-medium text-ink sm:text-body">
              {formatPrice(valuation.mid, locale)}
            </dd>
          </div>
          <div className="flex min-w-0 flex-col items-end gap-1 text-right">
            <dt className="font-mono text-label uppercase text-stone-text">{t("rangeHigh")}</dt>
            <dd data-numeric data-testid="valuation-range-high" className="text-small font-medium text-ink sm:text-body">
              {formatPrice(valuation.high, locale)}
            </dd>
          </div>
        </dl>
      </div>

      <dl className="grid gap-6 hairline-t pt-6 sm:grid-cols-2">
        <div className="flex flex-col gap-1">
          <dt className="font-mono text-label uppercase text-stone-text">{t("basisPricePerM2")}</dt>
          <dd data-numeric className="text-body-l text-ink">
            {formatPricePerM2(valuation.pricePerM2, locale, m2)}
          </dd>
        </div>
        <div className="flex flex-col gap-1">
          <dt className="font-mono text-label uppercase text-stone-text">{t("basisArea")}</dt>
          <dd data-numeric className="text-body-l text-ink">
            {area}
          </dd>
        </div>
      </dl>

      <p className="max-w-[60ch] text-pretty border-l border-bronze pl-5 text-small text-stone-text">
        {t("resultDisclaimer")}
      </p>

      <OnsiteRequest leadId={outcome.leadId} />

      <div>
        <Button variant="ghost" size="compact" onClick={onRestart} className="-ml-5">
          <RotateCcw aria-hidden="true" strokeWidth={1.25} className="mr-2 inline size-4 align-[-0.15em]" />
          {t("restart")}
        </Button>
      </div>
    </div>
  );
}
