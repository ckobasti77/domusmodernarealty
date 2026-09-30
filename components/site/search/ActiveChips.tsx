"use client";

import { X } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import type { Locale } from "@/i18n/routing";
import { activeChips, clearFilters, removeChip, type FilterChip, type SearchState } from "@/lib/search-params";
import { chipLabel, type PlaceName } from "@/lib/search-text";
import { useSearchTranslators } from "./useSearchTranslators";

/** Stable React key per chip. */
function chipKey(chip: FilterChip): string {
  return "value" in chip ? `${chip.kind}:${String(chip.value)}` : chip.kind;
}

/**
 * One removable chip per active value, plus "Obriši sve" (PRD A3). Each chip
 * is a button whose accessible name says what removing it does.
 */
export function ActiveChips({
  state,
  onChange,
  placeName,
}: {
  state: SearchState;
  onChange: (next: SearchState) => void;
  placeName: PlaceName;
}) {
  const t = useTranslations("search");
  const translators = useSearchTranslators();
  const locale = useLocale() as Locale;
  const chips = activeChips(state);
  if (chips.length === 0) return null;

  return (
    <div role="group" aria-label={t("chips.label")} className="flex flex-wrap items-center gap-2" data-testid="active-chips">
      {chips.map((chip) => {
        const label = chipLabel(translators, chip, state, locale, placeName);
        return (
          <button
            key={chipKey(chip)}
            type="button"
            onClick={() => onChange(removeChip(state, chip))}
            aria-label={t("chips.remove", { label })}
            data-testid="active-chip"
            className="inline-flex min-h-9 items-center gap-2 border border-ink/30 bg-paper py-1 pl-3 pr-2 font-sans text-small text-ink transition-colors duration-200 pointer-fine:hover:border-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-bronze-text"
          >
            <span data-numeric>{label}</span>
            <X aria-hidden="true" strokeWidth={1.5} className="size-3.5 text-stone-text" />
          </button>
        );
      })}
      <button
        type="button"
        onClick={() => onChange(clearFilters(state))}
        data-testid="chips-clear"
        className="inline-flex min-h-9 items-center px-2 font-sans text-small uppercase tracking-[0.12em] text-bronze-text underline-offset-4 transition-colors duration-200 pointer-fine:hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-bronze-text"
      >
        {t("chips.clearAll")}
      </button>
    </div>
  );
}
