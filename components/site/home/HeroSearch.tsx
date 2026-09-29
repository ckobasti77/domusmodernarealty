"use client";

import { Search, X } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useId, useRef, useState, type FormEvent, type ReactNode } from "react";
import { buttonClasses } from "@/components/site/Button";
import { useRouter } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { formatPrice } from "@/lib/format";
import { searchQuery, type SearchTransaction } from "@/lib/search-params";
import { cn } from "@/lib/utils";
import type { LocationOption } from "./types";

/**
 * The hero search (DESIGN §6.2): a transaction switch over three hairline
 * cells — location, budget, submit. It routes to the localized search path
 * (`/sr/nekretnine`, `/de/immobilien`, …) with locale-independent query params
 * from `lib/search-params.ts`, so a result is shareable and a language switch
 * keeps the filters.
 *
 * Only locations that have at least one listing for the chosen transaction are
 * offered, from the denormalized counters: a search from the landing never
 * lands on "no results". The tree is shown by indentation inside a native
 * `<select>`, which keeps the platform picker on phones.
 *
 * Below `md` the bar collapses into one "Pretražite nekretnine" button that
 * opens a bottom sheet (DESIGN §6.2 Mobile). The sheet is a native `<dialog>`:
 * `showModal()` brings the focus trap, the inert page, Escape and the backdrop.
 */

export type HeroSearchProps = {
  locations: readonly LocationOption[];
  className?: string;
};

/** Budget ladders in EUR: a purchase price for sale, a monthly rent for rent. */
const BUDGETS: Record<SearchTransaction, readonly number[]> = {
  sale: [100_000, 150_000, 200_000, 300_000, 500_000, 1_000_000],
  rent: [500, 800, 1_200, 2_000, 3_500],
};

/** Em spaces survive `<option>` whitespace collapsing, unlike ordinary spaces. */
const INDENT = " ";

function useSearch(locations: readonly LocationOption[]) {
  const router = useRouter();
  const [transaction, setTransaction] = useState<SearchTransaction>("sale");
  const [location, setLocation] = useState("");
  const [priceMax, setPriceMax] = useState("");

  const available = locations.filter((item) => item[transaction] > 0);

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const budget = Number(priceMax);
    router.push({
      pathname: "/properties",
      query: searchQuery({
        transaction,
        location: location.length > 0 ? location : undefined,
        priceMax: Number.isFinite(budget) && budget > 0 ? budget : undefined,
      }),
    });
  };

  // A rent budget is an order of magnitude below a price, and a location may
  // have listings for one transaction only: carrying either across a switch
  // would silently filter everything out.
  const switchTransaction = (next: SearchTransaction) => {
    setTransaction(next);
    setPriceMax("");
    if (location.length > 0 && !locations.some((item) => item.slug === location && item[next] > 0)) {
      setLocation("");
    }
  };

  return { transaction, switchTransaction, location, setLocation, priceMax, setPriceMax, submit, available };
}

type SearchState = ReturnType<typeof useSearch>;

const SELECT_CLASSES = cn(
  "w-full min-w-0 appearance-none truncate bg-transparent py-1 pr-7 font-sans text-body text-ivory",
  "focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-bronze",
  // The open menu is painted by the OS; without an explicit palette some
  // Linux/Chrome builds render the options black on black.
  "[&>option]:bg-ink [&>option]:text-ivory",
);

function Cell({ id, label, children, className }: { id: string; label: string; children: ReactNode; className?: string }) {
  return (
    <div className={cn("relative flex min-w-0 flex-col justify-center gap-1.5 px-6 py-4", className)}>
      <label htmlFor={id} className="font-mono text-label uppercase text-mist">
        {label}
      </label>
      <div className="relative flex items-center">
        {children}
        <span
          aria-hidden="true"
          className="pointer-events-none absolute right-1 size-2 -translate-y-0.5 rotate-45 border-b border-r border-mist"
        />
      </div>
    </div>
  );
}

function TransactionSwitch({
  state,
  labels,
  legend,
  className,
}: {
  state: SearchState;
  labels: Record<SearchTransaction, string>;
  legend: string;
  className?: string;
}) {
  return (
    <div role="group" aria-label={legend} className={cn("flex", className)}>
      {(["sale", "rent"] as const).map((option) => {
        const active = state.transaction === option;
        return (
          <button
            key={option}
            type="button"
            aria-pressed={active}
            onClick={() => state.switchTransaction(option)}
            className={cn(
              "relative min-h-11 flex-1 px-4 font-sans text-small font-medium uppercase tracking-[0.12em]",
              "transition-colors duration-200 ease-out",
              "focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-bronze",
              "after:absolute after:inset-x-4 after:bottom-1.5 after:h-px after:bg-bronze after:transition-transform after:duration-300 after:ease-out",
              active ? "text-ivory after:scale-x-100" : "text-mist after:scale-x-0 pointer-fine:hover:text-ivory",
            )}
          >
            {labels[option]}
          </button>
        );
      })}
    </div>
  );
}

function Fields({ state, idPrefix }: { state: SearchState; idPrefix: string }) {
  const t = useTranslations("home");
  const locale = useLocale() as Locale;

  return (
    <>
      <Cell id={`${idPrefix}-location`} label={t("searchLocation")} className="flex-1">
        <select
          id={`${idPrefix}-location`}
          value={state.location}
          onChange={(event) => state.setLocation(event.target.value)}
          className={SELECT_CLASSES}
        >
          <option value="">{t("searchLocationAny")}</option>
          {state.available.map((item) => (
            <option key={item.slug} value={item.slug}>
              {INDENT.repeat(item.depth)}
              {item.name}
            </option>
          ))}
        </select>
      </Cell>
      <Cell id={`${idPrefix}-budget`} label={t("searchBudget")} className="flex-1 md:max-w-60">
        <select
          id={`${idPrefix}-budget`}
          value={state.priceMax}
          onChange={(event) => state.setPriceMax(event.target.value)}
          className={SELECT_CLASSES}
        >
          <option value="">{t("searchBudgetAny")}</option>
          {BUDGETS[state.transaction].map((amount) => (
            <option key={amount} value={String(amount)}>
              {t("searchBudgetUpTo", { amount: formatPrice(amount, locale) })}
            </option>
          ))}
        </select>
      </Cell>
    </>
  );
}

export function HeroSearch({ locations, className }: HeroSearchProps) {
  const t = useTranslations("home");
  const state = useSearch(locations);
  const [open, setOpen] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const baseId = useId();

  const labels: Record<SearchTransaction, string> = {
    sale: t("searchSale"),
    rent: t("searchRent"),
  };

  useEffect(() => {
    const element = dialog.current;
    if (element === null) return;
    if (open && !element.open) element.showModal();
    if (!open && element.open) element.close();
  }, [open]);

  return (
    <div className={className}>
      {/* Tablet and up: the full bar. */}
      <form
        onSubmit={state.submit}
        aria-label={t("searchLegend")}
        className="hidden border border-ivory/25 bg-ink/55 backdrop-blur-[2px] md:block"
      >
        {/* One row: the transaction toggle is the bar's first cell, so the
            search button is the only filled shape in the hero. */}
        <div className="flex items-stretch divide-x divide-ivory/25">
          <TransactionSwitch
            state={state}
            labels={labels}
            legend={t("searchLegend")}
            className="shrink-0 items-center px-2"
          />
          <Fields state={state} idPrefix={`${baseId}-bar`} />
          <div className="flex">
            <button type="submit" className={cn(buttonClasses({ variant: "inverse" }), "h-auto min-h-[52px] px-10")}>
              <span className="flex items-center gap-2">
                <Search aria-hidden="true" strokeWidth={1.5} className="size-4" />
                {t("searchSubmit")}
              </span>
            </button>
          </div>
        </div>
      </form>

      {/* Phones: one button, then a sheet. */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        className={cn(buttonClasses({ variant: "inverse" }), "w-full md:hidden")}
      >
        <span className="flex items-center gap-2">
          <Search aria-hidden="true" strokeWidth={1.5} className="size-4" />
          {t("searchOpen")}
        </span>
      </button>

      <dialog
        ref={dialog}
        onClose={() => setOpen(false)}
        data-lenis-prevent=""
        aria-labelledby={`${baseId}-sheet-title`}
        className={cn(
          "fixed inset-x-0 bottom-0 top-auto m-0 w-full max-w-none bg-transparent p-0 text-ivory md:hidden",
          "backdrop:bg-ink/70",
          // Slides up from the bottom edge; 280ms is inside the UI budget and
          // the global reduced-motion rule flattens it.
          "translate-y-0 transition-[translate,display,overlay] transition-discrete duration-300 ease-out",
          "starting:open:translate-y-full",
        )}
      >
        <div className="bg-ink-2 px-gutter pb-10 pt-6">
          <div className="mb-6 flex items-center justify-between">
            <p id={`${baseId}-sheet-title`} className="eyebrow text-bronze">
              {t("searchLegend")}
            </p>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label={t("searchClose")}
              className="-mr-2 inline-flex size-11 items-center justify-center text-mist transition-colors duration-200 pointer-fine:hover:text-ivory"
            >
              <X aria-hidden="true" strokeWidth={1.25} className="size-5" />
            </button>
          </div>

          <form onSubmit={state.submit} className="flex flex-col">
            <TransactionSwitch
              state={state}
              labels={labels}
              legend={t("searchLegend")}
              className="border border-ivory/25"
            />
            <div className="mt-4 flex flex-col divide-y divide-ivory/25 border border-ivory/25 [&>div]:px-5">
              <Fields state={state} idPrefix={`${baseId}-sheet`} />
            </div>
            <button type="submit" className={cn(buttonClasses({ variant: "inverse" }), "mt-6 w-full")}>
              <span>{t("searchSubmit")}</span>
            </button>
          </form>
        </div>
      </dialog>
    </div>
  );
}
