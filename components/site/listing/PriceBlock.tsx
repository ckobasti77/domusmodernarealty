"use client";

import { ChevronDown, TrendingDown } from "lucide-react";
import { useFormatter, useLocale, useTranslations } from "next-intl";
import { useId, useState } from "react";
import type { Locale } from "@/i18n/routing";
import { formatPrice, formatPricePerM2, formatRsd, priceDeltaPct } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * The detail page's price block (PRD A5): price and €/m² together, the
 * price-drop badge with a disclosable history, an informative RSD figure at the
 * rate from settings, and the Art. 18 compliance line directly under the price.
 *
 * The history is a disclosure (`aria-expanded` + `aria-controls`), not a modal
 * popover: it holds a short list the visitor reads in place, and a disclosure
 * needs no focus trap, works on touch, and cannot be dismissed by accident.
 */

export type PriceBlockProps = {
  price: number;
  pricePerM2: number;
  previousPrice?: number;
  priceOnRequest: boolean;
  transaction: "sale" | "rent";
  history: readonly { at: number; from: number; price: number }[];
  eurRsd?: number;
  vatIncluded?: boolean;
  deposit?: number;
  company: { name: string; registryNo: string } | null;
};

export function PriceBlock({
  price,
  pricePerM2,
  previousPrice,
  priceOnRequest,
  transaction,
  history,
  eurRsd,
  vatIncluded,
  deposit,
  company,
}: PriceBlockProps) {
  const locale = useLocale() as Locale;
  const t = useTranslations("listing");
  const tUnits = useTranslations("units");
  const format = useFormatter();
  const [rsd, setRsd] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const historyId = useId();

  const reduced = previousPrice !== undefined && previousPrice > price;
  const showRsd = rsd && eurRsd !== undefined;
  const date = (at: number) => format.dateTime(new Date(at), { dateStyle: "medium" });

  return (
    <div className="flex flex-col gap-3">
      {priceOnRequest ? (
        <p className="font-sans text-[2rem] font-medium leading-tight">{t("priceOnRequest")}</p>
      ) : (
        <>
          <p className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <span data-numeric data-testid="listing-price" className="font-sans text-[2rem] font-medium leading-tight md:text-[2.5rem]">
              {showRsd ? `≈ ${formatRsd(price, eurRsd, locale)}` : formatPrice(price, locale)}
            </span>
            {transaction === "rent" ? (
              <span className="text-body text-stone-text">{tUnits("perMonth")}</span>
            ) : null}
          </p>
          <p data-numeric className="flex flex-wrap items-center gap-x-4 gap-y-1 text-body text-stone-text">
            {transaction === "sale" && pricePerM2 > 0 ? (
              <span>{formatPricePerM2(pricePerM2, locale, tUnits("m2"))}</span>
            ) : null}
            {showRsd ? <span>{formatPrice(price, locale)}</span> : null}
            {deposit !== undefined ? <span>{t("price.deposit", { amount: formatPrice(deposit, locale) })}</span> : null}
          </p>
          {showRsd ? (
            <p className="text-small text-stone-text">
              {t("price.rsdNote", { rate: format.number(eurRsd, { maximumFractionDigits: 2 }) })}
            </p>
          ) : null}
          {vatIncluded === true ? <p className="text-small text-stone-text">{t("price.vatIncluded")}</p> : null}
        </>
      )}

      {!priceOnRequest && (reduced || history.length > 0 || eurRsd !== undefined) ? (
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
          {reduced ? (
            <span className="inline-flex items-center gap-1.5 border border-bronze-text px-2.5 py-1 font-sans text-label font-medium uppercase tracking-[0.12em] text-bronze-text">
              <TrendingDown aria-hidden="true" strokeWidth={1.5} className="size-3.5" />
              {t("price.dropBy", { pct: Math.abs(priceDeltaPct(previousPrice, price)) })}
            </span>
          ) : null}
          {history.length > 0 ? (
            <button
              type="button"
              aria-expanded={historyOpen}
              aria-controls={historyId}
              onClick={() => setHistoryOpen((value) => !value)}
              className="inline-flex min-h-11 items-center gap-1.5 text-small text-ink underline decoration-ink/30 underline-offset-4 transition-colors duration-200 pointer-fine:hover:decoration-bronze"
            >
              {t("priceHistory")}
              <ChevronDown
                aria-hidden="true"
                strokeWidth={1.5}
                className={cn("size-4 transition-transform duration-200", historyOpen && "rotate-180")}
              />
            </button>
          ) : null}
          {eurRsd !== undefined ? (
            <button
              type="button"
              aria-pressed={rsd}
              onClick={() => setRsd((value) => !value)}
              className="inline-flex min-h-11 items-center text-small text-ink underline decoration-ink/30 underline-offset-4 transition-colors duration-200 pointer-fine:hover:decoration-bronze"
            >
              {rsd ? t("price.showEur") : t("price.showRsd")}
            </button>
          ) : null}
        </div>
      ) : null}

      {history.length > 0 ? (
        <div id={historyId} hidden={!historyOpen} className="border-l border-bronze-text pl-4">
          <ol className="flex flex-col gap-2 text-small">
            <li className="flex flex-wrap justify-between gap-x-6">
              <span className="text-stone-text">{t("price.historyInitial")}</span>
              <span data-numeric>{formatPrice(history[0].from, locale)}</span>
            </li>
            {history.map((entry) => (
              <li key={entry.at} className="flex flex-wrap justify-between gap-x-6">
                <span className="text-stone-text">
                  {t("price.historyChange")} · <time dateTime={new Date(entry.at).toISOString()}>{date(entry.at)}</time>
                </span>
                <span data-numeric>
                  {formatPrice(entry.price, locale)}{" "}
                  <span className="text-stone-text">
                    ({priceDeltaPct(entry.from, entry.price) > 0 ? "+" : ""}
                    {priceDeltaPct(entry.from, entry.price)}%)
                  </span>
                </span>
              </li>
            ))}
          </ol>
        </div>
      ) : null}

      {company !== null ? (
        <p data-testid="listing-compliance" className="hairline-t pt-3 text-small text-stone-text">
          {t("compliance", { company: company.name, registryNo: company.registryNo })}
        </p>
      ) : null}
    </div>
  );
}
