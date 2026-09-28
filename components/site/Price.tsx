"use client";

import { useLocale, useTranslations } from "next-intl";
import type { Locale } from "@/i18n/routing";
import { formatPrice, formatPricePerM2, priceDeltaPct } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * Price + €/m², which CLAUDE.md requires to appear together everywhere. Sans,
 * tabular (`data-numeric`), with the per-m² figure muted beside it.
 *
 * When `previousPrice` is higher than `price` the old figure is struck through
 * and the drop is stated in words for screen readers — the strike-through alone
 * is a visual-only signal.
 */

export type PriceProps = {
  price: number;
  /** Omit to hide the per-m² figure (e.g. land without a stated area). */
  pricePerM2?: number;
  previousPrice?: number;
  priceOnRequest?: boolean;
  transaction?: "sale" | "rent";
  size?: "sm" | "md" | "lg";
  tone?: "light" | "dark";
  className?: string;
};

const SIZE = {
  sm: "text-body",
  md: "text-body-l",
  lg: "text-h3",
} as const;

export function Price({
  price,
  pricePerM2,
  previousPrice,
  priceOnRequest = false,
  transaction = "sale",
  size = "md",
  tone = "light",
  className,
}: PriceProps) {
  const locale = useLocale() as Locale;
  const t = useTranslations("listing");
  const tUnits = useTranslations("units");

  const muted = tone === "dark" ? "text-mist" : "text-stone-text";

  if (priceOnRequest) {
    return (
      <p className={cn("font-sans font-medium", SIZE[size], className)}>{t("priceOnRequest")}</p>
    );
  }

  const reduced = previousPrice !== undefined && previousPrice > price;
  const delta = reduced ? priceDeltaPct(previousPrice, price) : 0;

  return (
    <div className={cn("flex flex-wrap items-baseline gap-x-3 gap-y-1", className)}>
      <p data-numeric className={cn("font-sans font-medium", SIZE[size])}>
        {formatPrice(price, locale)}
        {transaction === "rent" ? (
          <span className={cn("ml-1 font-normal", muted)}>{tUnits("perMonth")}</span>
        ) : null}
      </p>

      {reduced ? (
        <p data-numeric className={cn("text-small line-through", muted)}>
          <span className="sr-only">{t("priceHistory")}: </span>
          {formatPrice(previousPrice, locale)}
          <span className="sr-only"> ({delta}%)</span>
        </p>
      ) : null}

      {pricePerM2 !== undefined && pricePerM2 > 0 ? (
        <p data-numeric className={cn("text-small", muted)}>
          {formatPricePerM2(pricePerM2, locale)}
        </p>
      ) : null}
    </div>
  );
}
