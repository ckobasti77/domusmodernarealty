"use client";

import { ChevronDown, TrendingDown } from "lucide-react";
import { useFormatter, useLocale, useTranslations } from "next-intl";
import { useId, useState } from "react";
import type { Locale } from "@/i18n/routing";
import { formatPrice, formatPricePerM2, formatRsd, priceDeltaPct } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * The detail page's price block (PRD A5): price and €/m² on one baseline, the
 * price-drop badge with a disclosable history, an informative RSD figure at the
 * rate from settings, and the Art. 18 compliance line directly under the price.
 *
 * It sits in the ink header band, so `tone="dark"` is the default. A sold or
 * rented listing keeps its last price for reference but demotes it: no drop
 * badge, no history, no currency toggle — nothing that invites an offer.
 *
 * The history is a disclosure (`aria-expanded` + `aria-controls`), not a modal
 * popover: it holds a short list the visitor reads in place, and a disclosure
 * needs no focus trap, works on touch, and cannot be dismissed by accident.
 */

export type PriceBlockProps = {
  price: number;
  pricePerM2: number;
  previousPrice?: number;
  transaction: "sale" | "rent";
  history: readonly { at: number; from: number; price: number }[];
  eurRsd?: number;
  vatIncluded?: boolean;
  deposit?: number;
  company: { name: string; registryNo: string } | null;
  /** "Prodato" / "Izdato" when the listing is closed. */
  closedLabel?: string;
  tone?: "dark" | "light";
};

export function PriceBlock({
  price,
  pricePerM2,
  previousPrice,
  transaction,
  history,
  eurRsd,
  vatIncluded,
  deposit,
  company,
  closedLabel,
  tone = "dark",
}: PriceBlockProps) {
  const locale = useLocale() as Locale;
  const t = useTranslations("listing");
  const tUnits = useTranslations("units");
  const format = useFormatter();
  const [rsd, setRsd] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const historyId = useId();

  const dark = tone === "dark";
  const strong = dark ? "text-ivory" : "text-ink";
  const muted = dark ? "text-mist" : "text-stone-text";
  const link = cn(
    "inline-flex min-h-11 items-center gap-1.5 text-small underline underline-offset-4 transition-colors duration-200 pointer-fine:hover:decoration-bronze",
    dark ? "text-ivory decoration-ivory/40" : "text-ink decoration-ink/30",
  );

  const closed = closedLabel !== undefined;
  const reduced = !closed && previousPrice !== undefined && previousPrice > price;
  const showRsd = !closed && rsd && eurRsd !== undefined;
  const showHistory = !closed && history.length > 0;
  const date = (at: number) => format.dateTime(new Date(at), { dateStyle: "medium" });

  return (
    <div className="flex flex-col gap-3">
      {closed ? <p className={cn("eyebrow", dark ? "text-bronze" : "text-bronze-text")}>{closedLabel}</p> : null}

      <p className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <span
          data-numeric
          data-testid="listing-price"
          className={cn(
            "font-sans font-medium leading-tight",
            closed ? cn("text-h3", muted) : cn("text-[2rem] md:text-[2.5rem]", strong),
          )}
        >
          {showRsd ? `≈ ${formatRsd(price, eurRsd, locale)}` : formatPrice(price, locale)}
        </span>
        {transaction === "rent" ? <span className={cn("text-body", muted)}>{tUnits("perMonth")}</span> : null}
        {/* €/m² goes beside every price (CLAUDE.md), a monthly rent's too, as on its card. */}
        {pricePerM2 > 0 && !showRsd ? (
          <span data-numeric className={cn("text-body", muted)}>
            {formatPricePerM2(pricePerM2, locale, tUnits("m2"))}
          </span>
        ) : null}
      </p>
      {showRsd || deposit !== undefined ? (
        <p data-numeric className={cn("flex flex-wrap gap-x-4 text-small", muted)}>
          {showRsd ? <span>{formatPrice(price, locale)}</span> : null}
          {showRsd && pricePerM2 > 0 ? (
            <span>{formatPricePerM2(pricePerM2, locale, tUnits("m2"))}</span>
          ) : null}
          {deposit !== undefined ? <span>{t("price.deposit", { amount: formatPrice(deposit, locale) })}</span> : null}
        </p>
      ) : null}
      {showRsd ? (
        <p className={cn("text-small", muted)}>
          {t("price.rsdNote", { rate: format.number(eurRsd, { maximumFractionDigits: 2 }) })}
        </p>
      ) : null}
      {vatIncluded === true && !closed ? <p className={cn("text-small", muted)}>{t("price.vatIncluded")}</p> : null}

      {!closed && (reduced || showHistory || eurRsd !== undefined) ? (
        <div className="flex flex-wrap items-center gap-x-5 gap-y-1">
          {reduced ? (
            <span
              className={cn(
                "inline-flex items-center gap-1.5 border px-2.5 py-1 font-sans text-label font-medium uppercase tracking-[0.12em]",
                dark ? "border-bronze text-bronze" : "border-bronze-text text-bronze-text",
              )}
            >
              <TrendingDown aria-hidden="true" strokeWidth={1.5} className="size-3.5" />
              {t("price.dropBy", { pct: Math.abs(priceDeltaPct(previousPrice, price)) })}
            </span>
          ) : null}
          {showHistory ? (
            <button
              type="button"
              aria-expanded={historyOpen}
              aria-controls={historyId}
              onClick={() => setHistoryOpen((value) => !value)}
              className={link}
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
            <button type="button" aria-pressed={rsd} onClick={() => setRsd((value) => !value)} className={link}>
              {rsd ? t("price.showEur") : t("price.showRsd")}
            </button>
          ) : null}
        </div>
      ) : null}

      {showHistory ? (
        <div id={historyId} hidden={!historyOpen} className={cn("border-l pl-4", dark ? "border-bronze" : "border-bronze-text")}>
          <ol className="flex flex-col gap-2 text-small">
            <li className="flex flex-wrap justify-between gap-x-6">
              <span className={muted}>{t("price.historyInitial")}</span>
              <span data-numeric className={strong}>
                {formatPrice(history[0].from, locale)}
              </span>
            </li>
            {history.map((entry) => (
              <li key={entry.at} className="flex flex-wrap justify-between gap-x-6">
                <span className={muted}>
                  {t("price.historyChange")} · <time dateTime={new Date(entry.at).toISOString()}>{date(entry.at)}</time>
                </span>
                <span data-numeric className={strong}>
                  {formatPrice(entry.price, locale)}{" "}
                  <span className={muted}>
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
        <p
          data-testid="listing-compliance"
          className={cn("pt-3 text-small", dark ? "hairline-t-dark text-mist" : "hairline-t text-stone-text")}
        >
          {/* The registry number never wraps away from "br." */}
          {t("compliance", { company: company.name, registryNo: company.registryNo }).replace(/ (\S+)$/, "\u00A0$1")}
        </p>
      ) : null}
    </div>
  );
}
