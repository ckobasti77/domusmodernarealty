"use client";

import { ArrowUpDown, ChevronDown, SlidersHorizontal } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Popover } from "radix-ui";
import { useState, type ComponentPropsWithRef, type ReactNode } from "react";
import type { Locale } from "@/i18n/routing";
import { pickL10n } from "@/lib/l10n";
import type { LocationIndex } from "@/lib/search-locations";
import {
  SORT_OPTIONS,
  activeCount,
  effectiveSort,
  moreFiltersCount,
  type SearchState,
  type SortOption,
} from "@/lib/search-params";
import { SORT_LABEL_KEYS, areaText, priceText, roomsLong } from "@/lib/search-text";
import { cn } from "@/lib/utils";
import { Segmented } from "./controls";
import { FilterDialog } from "./FilterDialog";
import { AreaSection, LocationSection, PriceSection, RoomsSection, TypeSection } from "./FilterSections";
import { useSearchTranslators } from "./useSearchTranslators";

/**
 * The sticky filter bar (PRD A3, step 06 task 3).
 *
 * Desktop: the transaction switch, one popover per main filter (each trigger
 * shows its current value), "Svi filteri" for the rest, and the sort. Every
 * change applies at once.
 * Phones: one "Filteri" button opening the full sheet, the live result count
 * (PRD A3 "sticky result count"), the transaction switch from 640 px, and
 * the sort.
 */
export type FilterBarProps = {
  state: SearchState;
  onChange: (next: SearchState) => void;
  /** The phone sheet's "Prikaži": applies, then brings the results into view. */
  onSheetApply: (next: SearchState) => void;
  index: LocationIndex;
  now: number;
  countText: string;
};

export function FilterBar({ state, onChange, onSheetApply, index, now, countText }: FilterBarProps) {
  const t = useTranslations("filters");
  const tListing = useTranslations("listing");
  const translators = useSearchTranslators();
  const locale = useLocale() as Locale;

  const placeLabel = () => {
    if (state.locations.length === 0) return undefined;
    const first = index.bySlug.get(state.locations[0]);
    const name = first !== undefined ? pickL10n(first.name, locale).text : state.locations[0];
    return state.locations.length > 1 ? `${name} +${state.locations.length - 1}` : name;
  };
  const typeLabel = () => {
    if (state.types.length === 0) return undefined;
    const name = tListing(`propertyType.${state.types[0]}`);
    return state.types.length > 1 ? `${name} +${state.types.length - 1}` : name;
  };
  // "Dvosoban" / "Dvosoban +2": a bare "2" says nothing in the bar.
  const roomsLabel = () => {
    if (state.rooms.length === 0) return undefined;
    const name = roomsLong(translators, state.rooms[0]);
    return state.rooms.length > 1 ? `${name} +${state.rooms.length - 1}` : name;
  };

  const more = moreFiltersCount(state);
  const total = activeCount(state);

  const transactionSwitch = (name: string, className: string) => (
    <Segmented
      name={name}
      joined
      value={state.transaction}
      options={[
        { value: "sale", label: t("sale") },
        { value: "rent", label: t("rent") },
      ]}
      // Rent and sale prices differ by three orders of magnitude, so a price
      // range never survives the switch.
      onChange={(transaction) => {
        const next: SearchState = { ...state, transaction };
        delete next.priceMin;
        delete next.priceMax;
        onChange(next);
      }}
      className={className}
    />
  );

  return (
    <div className="flex items-center gap-3">
      {/* ------------------------------------------------------ desktop bar */}
      {/* The buttons never shrink, so on a narrow desktop (or with the longer
          ru/de labels) the row wraps instead of running under the sort. */}
      <div className="hidden min-w-0 flex-1 flex-wrap items-center gap-2 lg:flex">
        {transactionSwitch("transaction-bar", "mr-2 flex-nowrap")}
        <FilterPopover label={t("location")} value={placeLabel()} testId="bar-location" wide>
          <LocationSection state={state} onChange={onChange} index={index} />
        </FilterPopover>
        <FilterPopover label={t("propertyType")} value={typeLabel()} testId="bar-type">
          <TypeSection state={state} onChange={onChange} />
        </FilterPopover>
        <FilterPopover label={t("price")} value={priceText(translators, state, locale)} testId="bar-price" wide>
          <PriceSection state={state} onChange={onChange} />
        </FilterPopover>
        <FilterPopover label={t("area")} value={areaText(translators, state, locale)} testId="bar-area" wide>
          <AreaSection state={state} onChange={onChange} />
        </FilterPopover>
        <FilterPopover label={t("rooms")} value={roomsLabel()} testId="bar-rooms">
          <RoomsSection state={state} onChange={onChange} />
        </FilterPopover>
        <FilterDialog
          mode="drawer"
          state={state}
          onApply={onChange}
          index={index}
          now={now}
          trigger={
            <BarButton active={more > 0} data-testid="bar-more">
              <SlidersHorizontal aria-hidden="true" strokeWidth={1.25} className="size-4" />
              {t("more")}
              {more > 0 ? <CountBadge inverted>{more}</CountBadge> : null}
            </BarButton>
          }
        />
      </div>

      {/* ------------------------------------------------------- phone bar */}
      <div className="flex min-w-0 flex-1 items-center gap-3 overflow-hidden lg:hidden">
        {transactionSwitch("transaction-phone-bar", "hidden flex-nowrap sm:flex")}
        <FilterDialog
          mode="sheet"
          state={state}
          onApply={onSheetApply}
          index={index}
          now={now}
          trigger={
            <BarButton active={total > 0} data-testid="open-filter-sheet">
              <SlidersHorizontal aria-hidden="true" strokeWidth={1.25} className="size-4" />
              {t("heading")}
              {total > 0 ? <CountBadge inverted>{total}</CountBadge> : null}
            </BarButton>
          }
        />
        <p data-numeric aria-hidden="true" className="min-w-0 truncate font-sans text-small text-stone-text">
          {countText}
        </p>
      </div>

      <SortSelect state={state} onChange={onChange} />
    </div>
  );
}

/** A count inside a trigger; `inverted` for the ink-filled (active) trigger it sits on. */
function CountBadge({ children, inverted = false }: { children: ReactNode; inverted?: boolean }) {
  return (
    <span
      data-numeric
      className={cn(
        "inline-flex h-5 min-w-5 items-center justify-center px-1 font-mono text-label",
        inverted ? "bg-paper text-ink" : "bg-ink text-ivory",
      )}
    >
      {children}
    </span>
  );
}

type BarButtonProps = ComponentPropsWithRef<"button"> & { active: boolean };

/** Takes a ref (a React 19 prop): Radix triggers (`asChild`) attach to it. */
function BarButton({ active, className, children, ...rest }: BarButtonProps) {
  return (
    <button
      type="button"
      className={cn(
        "inline-flex h-11 shrink-0 items-center gap-2 border px-4 font-sans text-small",
        "transition-[background-color,color,border-color] duration-200 ease-out",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-bronze-text",
        "data-[state=open]:border-ink",
        // An applied filter is an ink block, the same "on" as every chip.
        active ? "border-ink bg-ink text-paper" : "border-ink/30 text-ink pointer-fine:hover:border-ink",
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}

function FilterPopover({
  label,
  value,
  children,
  testId,
  wide = false,
}: {
  label: string;
  value?: string;
  children: ReactNode;
  testId: string;
  wide?: boolean;
}) {
  const tFilters = useTranslations("filters");
  const [open, setOpen] = useState(false);
  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <BarButton active={value !== undefined} data-testid={testId} aria-label={value !== undefined ? `${label}: ${value}` : label}>
          <span className="max-w-[11rem] truncate">{value ?? label}</span>
          <ChevronDown
            aria-hidden="true"
            strokeWidth={1.25}
            className={cn("size-4 transition-transform duration-200", open && "rotate-180")}
          />
        </BarButton>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="start"
          sideOffset={8}
          collisionPadding={16}
          data-testid={`${testId}-panel`}
          data-lenis-prevent=""
          className={cn(
            "z-(--z-overlay) border border-hairline-light bg-paper p-6 text-ink shadow-[0_24px_48px_-24px_rgb(14_13_11/0.28)]",
            // Never taller than the space under the sticky bar.
            "max-h-[calc(100svh-var(--header-h,85px)-6rem)] overflow-y-auto overscroll-contain",
            "data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=closed]:animate-out data-[state=closed]:fade-out-0",
            "duration-200 motion-reduce:duration-0",
            wide ? "w-[min(26rem,calc(100vw-2rem))]" : "w-[min(22rem,calc(100vw-2rem))]",
          )}
        >
          {children}
          <div className="mt-6 flex justify-end">
            <Popover.Close className="inline-flex h-11 items-center px-2 font-sans text-small uppercase tracking-[0.12em] text-ink transition-colors duration-200 pointer-fine:hover:text-bronze-text focus-visible:outline-2 focus-visible:outline-bronze-text">
              {tFilters("done")}
            </Popover.Close>
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

function SortSelect({ state, onChange }: { state: SearchState; onChange: (next: SearchState) => void }) {
  const t = useTranslations("search");
  const current = effectiveSort(state);
  const options: SortOption[] = state.q !== undefined ? ["relevance", ...SORT_OPTIONS] : [...SORT_OPTIONS];
  return (
    // Below 640 px the sort is a 44 px icon with the native select laid over
    // it: the result count keeps the room, and the picker is still native.
    <label className="relative ml-auto flex shrink-0 items-center gap-3 max-sm:size-11 max-sm:justify-center max-sm:border max-sm:border-ink/30">
      <ArrowUpDown aria-hidden="true" strokeWidth={1.25} className="size-4 sm:hidden" />
      <span className="hidden font-sans text-label uppercase tracking-[0.12em] text-stone-text xl:inline">
        {t("sortLabel")}
      </span>
      <select
        value={current}
        aria-label={t("sortLabel")}
        data-testid="sort-select"
        onChange={(event) => onChange({ ...state, sort: event.target.value as SortOption })}
        className="h-11 appearance-none border-0 border-b border-ink/30 bg-transparent pr-7 font-sans text-small text-ink focus:border-ink focus-visible:outline-none max-sm:absolute max-sm:inset-0 max-sm:size-full max-sm:cursor-pointer max-sm:opacity-0"
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {t(SORT_LABEL_KEYS[option])}
          </option>
        ))}
      </select>
      <span
        aria-hidden="true"
        className="pointer-events-none absolute right-1 top-1/2 size-2 -translate-y-3/4 rotate-45 border-b border-r border-stone-text max-sm:hidden"
      />
    </label>
  );
}
