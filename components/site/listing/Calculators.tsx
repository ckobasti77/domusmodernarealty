"use client";

import { useFormatter, useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import type { Locale } from "@/i18n/routing";
import {
  computePurchaseCosts,
  DEFAULT_AGENCY_FEE_PCT,
  type ConstructionType,
  type CostPropertyType,
} from "@/lib/costs";
import { formatPrice } from "@/lib/format";
import { computeMortgage, DOWN_PAYMENT_PRESETS, MORTGAGE_LIMITS } from "@/lib/mortgage";
import { cn } from "@/lib/utils";
import { TextField } from "../Field";

/**
 * The two buyer calculators (PRD A5). All maths lives in `lib/mortgage.ts` and
 * `lib/costs.ts` (unit-tested); these components only hold the inputs.
 *
 * Inputs are kept as the strings the visitor typed, so clearing a field to
 * retype it does not snap back to 0; the number is parsed per render, and the
 * results carry `aria-live` so a screen reader hears the new monthly payment.
 */

function toNumber(value: string, fallback: number): number {
  const parsed = Number(value.replace(",", ".").replace(/\s/g, ""));
  return Number.isFinite(parsed) && value.trim().length > 0 ? parsed : fallback;
}

function Row({ label, value, strong = false, note }: { label: string; value: string; strong?: boolean; note?: string }) {
  return (
    <div className="hairline-t flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 py-3">
      <dt className={cn("text-small", strong ? "font-medium text-ink" : "text-stone-text")}>{label}</dt>
      <dd data-numeric className={cn(strong ? "text-body-l font-medium text-ink" : "text-body text-ink")}>
        {value}
        {note !== undefined ? <span className="ml-2 text-small text-stone-text">{note}</span> : null}
      </dd>
    </div>
  );
}

export function MortgageCalculator({
  price,
  defaults,
}: {
  price: number;
  defaults: { rate: number; years: number; downPct: number };
}) {
  const locale = useLocale() as Locale;
  const t = useTranslations("listing.mortgage");
  const [priceInput, setPriceInput] = useState(String(price));
  const [downInput, setDownInput] = useState(String(defaults.downPct));
  const [yearsInput, setYearsInput] = useState(String(defaults.years));
  const [rateInput, setRateInput] = useState(String(defaults.rate));

  const downPct = toNumber(downInput, defaults.downPct);
  const result = computeMortgage({
    price: toNumber(priceInput, price),
    downPct,
    years: toNumber(yearsInput, defaults.years),
    ratePct: toNumber(rateInput, defaults.rate),
  });

  return (
    <section aria-labelledby="mortgage-heading" className="flex flex-col gap-6" data-testid="mortgage-calculator">
      <h3 id="mortgage-heading" className="font-serif text-h3">
        {t("heading")}
      </h3>
      <div className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
        <TextField label={t("price")} inputMode="numeric" value={priceInput} onChange={(e) => setPriceInput(e.target.value)} />
        <TextField
          label={t("downPct")}
          inputMode="decimal"
          value={downInput}
          onChange={(e) => setDownInput(e.target.value)}
          min={MORTGAGE_LIMITS.downPct.min}
          max={MORTGAGE_LIMITS.downPct.max}
        />
        <TextField label={t("years")} inputMode="numeric" value={yearsInput} onChange={(e) => setYearsInput(e.target.value)} />
        <TextField label={t("rate")} inputMode="decimal" value={rateInput} onChange={(e) => setRateInput(e.target.value)} />
      </div>
      <div role="group" aria-label={t("presetsLabel")} className="flex flex-wrap gap-2">
        {DOWN_PAYMENT_PRESETS.map((pct) => (
          <button
            key={pct}
            type="button"
            aria-pressed={downPct === pct}
            onClick={() => setDownInput(String(pct))}
            className={cn(
              "inline-flex min-h-11 items-center border px-4 font-sans text-label font-medium uppercase tracking-[0.12em] transition-colors duration-200",
              downPct === pct ? "border-ink bg-ink text-ivory" : "border-ink/30 text-ink pointer-fine:hover:border-bronze",
            )}
          >
            {t("preset", { pct })}
          </button>
        ))}
      </div>

      <div aria-live="polite">
        <p className="eyebrow text-stone-text">{t("monthly")}</p>
        <p data-numeric data-testid="mortgage-monthly" className="mt-1 font-serif text-[2.5rem] leading-none">
          {formatPrice(result.monthlyPayment, locale)}
        </p>
        <p className="mt-2 text-small text-stone-text">
          {t("term", { years: result.months / 12, months: result.months })}
        </p>
      </div>
      <dl>
        <Row label={t("loan")} value={formatPrice(result.principal, locale)} />
        <Row label={t("downPayment")} value={formatPrice(result.downPayment, locale)} />
        <Row label={t("totalInterest")} value={formatPrice(result.totalInterest, locale)} />
      </dl>
      <p className="text-small text-ink">{t("youngNote")}</p>
      <p className="text-small text-stone-text">{t("disclaimer")}</p>
    </section>
  );
}

export function CostCalculator({
  price,
  propertyType,
  constructionType,
  vatIncluded,
}: {
  price: number;
  propertyType: CostPropertyType;
  constructionType: ConstructionType;
  vatIncluded?: boolean;
}) {
  const locale = useLocale() as Locale;
  const t = useTranslations("listing.costs");
  const format = useFormatter();
  const [feeInput, setFeeInput] = useState(String(DEFAULT_AGENCY_FEE_PCT));

  const result = computePurchaseCosts({
    price,
    propertyType,
    constructionType,
    ...(vatIncluded !== undefined ? { vatIncluded } : {}),
    agencyFeePct: toNumber(feeInput, 0),
  });

  const labelOf = (key: string, rate?: number) => {
    // "2,5" in sr/ru/de, "2.5" in en.
    const pct = format.number(rate ?? 0, { maximumFractionDigits: 2 });
    switch (key) {
      case "transferTax":
        return t("transferTax", { rate: pct });
      case "vat":
        return t("vat", { rate: pct });
      case "agencyFee":
        return t("agencyFee", { rate: pct });
      default:
        return t(key);
    }
  };

  return (
    <section aria-labelledby="costs-heading" className="flex flex-col gap-6" data-testid="cost-calculator">
      <h3 id="costs-heading" className="font-serif text-h3">
        {t("heading")}
      </h3>
      <TextField
        label={t("agencyFeePct")}
        hint={t("agencyFeeNote")}
        inputMode="decimal"
        value={feeInput}
        onChange={(e) => setFeeInput(e.target.value)}
        className="max-w-xs"
      />
      <dl aria-live="polite">
        {result.lines.map((line) => (
          <Row
            key={line.key}
            label={labelOf(line.key, line.ratePct)}
            value={formatPrice(line.amount, locale)}
            note={line.includedInPrice ? t("vatIncluded") : undefined}
          />
        ))}
        <Row label={t("extras")} value={formatPrice(result.extras, locale)} strong />
        <Row label={t("total")} value={formatPrice(result.total, locale)} strong />
      </dl>
      <p className="text-small text-ink">{result.isNewBuild ? t("vatNote") : `${t("transferTaxNote")} ${t("firstHome")}`}</p>
      <p className="text-small text-stone-text">{t("disclaimer")}</p>
    </section>
  );
}
