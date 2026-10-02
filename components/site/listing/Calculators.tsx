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
import { formatInputNumber, formatPrice, parseLocaleNumber } from "@/lib/format";
import { computeMortgage, DOWN_PAYMENT_PRESETS, MORTGAGE_LIMITS, normalizeMortgageInput } from "@/lib/mortgage";
import { cn } from "@/lib/utils";
import { TextField } from "../Field";

/**
 * The two buyer calculators (PRD A5). All maths lives in `lib/mortgage.ts` and
 * `lib/costs.ts` (unit-tested); these components only hold the inputs.
 *
 * Inputs are kept as the strings the visitor typed, so clearing a field to
 * retype it does not snap back to 0; the number is parsed per render, and the
 * results carry `aria-live` so a screen reader hears the new monthly payment.
 * A mortgage field left empty or unreadable falls back to its default, and a
 * value outside the limits (a 150% down payment, a 45-year term) is computed
 * at the limit; either way the field shows the number used once the visitor
 * leaves it, so what is on screen is what the payment was computed from.
 */

/** Reads "430.000" / "5,4" in the page's own notation; falls back while a field is empty. */
function toNumber(value: string, fallback: number, locale: Locale): number {
  return parseLocaleNumber(value, locale) ?? fallback;
}

function Row({ label, value, strong = false, note }: { label: string; value: string; strong?: boolean; note?: string }) {
  return (
    <div className="hairline-t grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-6 py-3">
      <dt className={cn("text-small", strong ? "font-medium text-ink" : "text-stone-text")}>{label}</dt>
      <dd data-numeric className={cn("text-right", strong ? "text-body-l font-medium text-ink" : "text-body text-ink")}>
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
  const [priceInput, setPriceInput] = useState(() => formatInputNumber(price, locale));
  const [downInput, setDownInput] = useState(() => formatInputNumber(defaults.downPct, locale));
  const [yearsInput, setYearsInput] = useState(() => formatInputNumber(defaults.years, locale));
  const [rateInput, setRateInput] = useState(() => formatInputNumber(defaults.rate, locale));

  const used = normalizeMortgageInput({
    price: toNumber(priceInput, price, locale),
    downPct: toNumber(downInput, defaults.downPct, locale),
    years: toNumber(yearsInput, defaults.years, locale),
    ratePct: toNumber(rateInput, defaults.rate, locale),
  });
  const result = computeMortgage(used);

  /** On leaving a field: unless it holds exactly the number used, show that number. */
  const settle = (input: string, value: number, set: (next: string) => void) => () => {
    if (parseLocaleNumber(input, locale) !== value) set(formatInputNumber(value, locale));
  };

  return (
    <section aria-labelledby="mortgage-heading" className="flex flex-col gap-6" data-testid="mortgage-calculator">
      <h3 id="mortgage-heading" className="font-display text-h3">
        {t("heading")}
      </h3>
      <div className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
        <TextField
          label={t("price")}
          inputMode="numeric"
          value={priceInput}
          onChange={(e) => setPriceInput(e.target.value)}
          onBlur={settle(priceInput, used.price, setPriceInput)}
        />
        <TextField
          label={t("downPct")}
          inputMode="decimal"
          value={downInput}
          onChange={(e) => setDownInput(e.target.value)}
          onBlur={settle(downInput, used.downPct, setDownInput)}
          min={MORTGAGE_LIMITS.downPct.min}
          max={MORTGAGE_LIMITS.downPct.max}
        />
        <TextField
          label={t("years")}
          inputMode="numeric"
          value={yearsInput}
          onChange={(e) => setYearsInput(e.target.value)}
          onBlur={settle(yearsInput, used.years, setYearsInput)}
        />
        <TextField
          label={t("rate")}
          inputMode="decimal"
          value={rateInput}
          onChange={(e) => setRateInput(e.target.value)}
          onBlur={settle(rateInput, used.ratePct, setRateInput)}
        />
      </div>
      <div role="group" aria-label={t("presetsLabel")} className="flex flex-wrap gap-2">
        {DOWN_PAYMENT_PRESETS.map((pct) => (
          <button
            key={pct}
            type="button"
            aria-pressed={used.downPct === pct}
            onClick={() => setDownInput(formatInputNumber(pct, locale))}
            className={cn(
              "inline-flex min-h-11 items-center border px-4 font-sans text-label font-medium uppercase tracking-[0.12em] transition-colors duration-200",
              used.downPct === pct ? "border-ink bg-ink text-ivory" : "border-ink/30 text-ink pointer-fine:hover:border-bronze",
            )}
          >
            {t("preset", { pct })}
          </button>
        ))}
      </div>

      <div aria-live="polite">
        <p className="eyebrow text-stone-text">{t("monthly")}</p>
        <p data-numeric data-testid="mortgage-monthly" className="mt-1 font-sans text-[2rem] font-medium leading-tight">
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
  const [feeInput, setFeeInput] = useState(() => formatInputNumber(DEFAULT_AGENCY_FEE_PCT, locale));

  const result = computePurchaseCosts({
    price,
    propertyType,
    constructionType,
    ...(vatIncluded !== undefined ? { vatIncluded } : {}),
    agencyFeePct: toNumber(feeInput, 0, locale),
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
      <h3 id="costs-heading" className="font-display text-h3">
        {t("heading")}
      </h3>
      <TextField
        label={t("agencyFeePct")}
        hint={t("agencyFeeNote")}
        inputMode="decimal"
        value={feeInput}
        onChange={(e) => setFeeInput(e.target.value)}
      />
      <div aria-live="polite">
        <p className="eyebrow text-stone-text">{t("total")}</p>
        <p data-numeric data-testid="cost-total" className="mt-1 font-sans text-[2rem] font-medium leading-tight">
          {formatPrice(result.total, locale)}
        </p>
      </div>
      <dl>
        {result.lines.map((line) => (
          <Row
            key={line.key}
            label={labelOf(line.key, line.ratePct)}
            value={formatPrice(line.amount, locale)}
            note={line.includedInPrice ? t("vatIncluded") : undefined}
          />
        ))}
        <Row label={t("extras")} value={formatPrice(result.extras, locale)} strong />
      </dl>
      <p className="text-small text-ink">{result.isNewBuild ? t("vatNote") : `${t("transferTaxNote")} ${t("firstHome")}`}</p>
      <p className="text-small text-stone-text">{t("disclaimer")}</p>
    </section>
  );
}
