"use client";

import { Search, X } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useCallback, useEffect, useId, useRef, useState, type FormEvent } from "react";
import { buttonClasses } from "@/components/site/Button";
import { useRouter } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { formatPrice } from "@/lib/format";
import { searchQuery } from "@/lib/search-params";
import { cn } from "@/lib/utils";

/**
 * The hero search bar (DESIGN §6.2): four hairline-separated cells on a dark
 * surface — transaction, location, budget, submit.
 *
 * Below `md` the bar would either wrap into four stacked rows inside the hero
 * or shrink each control under the touch minimum, so it collapses into a single
 * "Pretražite nekretnine" button that opens a sheet, exactly as the design
 * calls for. The sheet is a native `<dialog>`: `showModal()` already gives the
 * focus trap, the inert background, Escape and the backdrop, and every
 * re-implementation of those is worse.
 *
 * Submitting navigates to the localized search path with locale-independent
 * query params (see `lib/search-params.ts`), so the result is shareable and the
 * language switcher keeps the filters.
 */

export type HeroSearchLocation = {
  slug: string;
  /** Already parent-qualified, e.g. "Vračar, Beograd". */
  label: string;
};

export type HeroSearchProps = {
  locations: readonly HeroSearchLocation[];
  className?: string;
};

/** Budget ladders in EUR. Sale is a purchase price, rent a monthly rent. */
const BUDGETS = {
  sale: [100_000, 150_000, 200_000, 300_000, 500_000, 1_000_000],
  rent: [500, 800, 1_200, 2_000, 3_500],
} as const;

type Transaction = "sale" | "rent";

function useSearchState(locations: readonly HeroSearchLocation[]) {
  const router = useRouter();
  const [transaction, setTransaction] = useState<Transaction>("sale");
  const [location, setLocation] = useState("");
  const [priceMax, setPriceMax] = useState("");

  const submit = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const parsed = Number(priceMax);
      router.push({
        pathname: "/properties",
        query: searchQuery({
          transaction,
          location: location.length > 0 ? location : undefined,
          priceMax: Number.isFinite(parsed) && parsed > 0 ? parsed : undefined,
        }),
      });
    },
    [location, priceMax, router, transaction],
  );

  // Rent budgets are an order of magnitude smaller, so a sale figure carried
  // over would silently filter everything out.
  const switchTransaction = useCallback((next: Transaction) => {
    setTransaction(next);
    setPriceMax("");
  }, []);

  return { transaction, switchTransaction, location, setLocation, priceMax, setPriceMax, submit, locations };
}

/**
 * A flat option list, deliberately. `<optgroup>` would need three more
 * translated strings for labels a visitor does not need: the list is already
 * ordered city → municipality → neighborhood and every neighbourhood label
 * arrives parent-qualified ("Vračar, Beograd"), which is the information an
 * `<optgroup>` heading would have carried.
 */
function LocationOptions({
  locations,
  anyLabel,
}: {
  locations: readonly HeroSearchLocation[];
  anyLabel: string;
}) {
  return (
    <>
      <option value="">{anyLabel}</option>
      {locations.map((item) => (
        <option key={item.slug} value={item.slug}>
          {item.label}
        </option>
      ))}
    </>
  );
}

const SELECT_CLASSES = [
  "w-full appearance-none bg-transparent pr-6 font-sans text-body text-ivory",
  "focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-bronze",
  // A native menu is painted by the OS, so its options need an explicit dark
  // palette or they render as black-on-black in some Linux/Chrome builds.
  "[&>option]:bg-ink [&>option]:text-ivory [&>optgroup]:bg-ink [&>optgroup]:text-mist",
].join(" ");

function Cell({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("relative flex min-w-0 flex-col justify-center gap-1.5 px-6 py-4", className)}>
      <span className="font-mono text-label uppercase tracking-[0.08em] text-mist">{label}</span>
      <div className="relative flex items-center">
        {children}
        <span
          aria-hidden="true"
          className="pointer-events-none absolute right-0 size-2 -translate-y-1 rotate-45 border-b border-r border-mist"
        />
      </div>
    </div>
  );
}

function TransactionToggle({
  value,
  onChange,
  labels,
  className,
}: {
  value: Transaction;
  onChange: (next: Transaction) => void;
  labels: Record<Transaction, string>;
  className?: string;
}) {
  return (
    <div role="group" className={cn("flex", className)}>
      {(["sale", "rent"] as const).map((option) => (
        <button
          key={option}
          type="button"
          aria-pressed={value === option}
          onClick={() => onChange(option)}
          className={cn(
            "flex-1 px-5 py-3 font-sans text-small font-medium uppercase tracking-[0.12em]",
            "transition-colors duration-200 ease-out",
            "focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-bronze",
            value === option ? "bg-ivory text-ink" : "text-mist pointer-fine:hover:text-ivory",
          )}
        >
          {labels[option]}
        </button>
      ))}
    </div>
  );
}

export function HeroSearch({ locations, className }: HeroSearchProps) {
  const t = useTranslations("home");
  const locale = useLocale() as Locale;
  const state = useSearchState(locations);
  const [open, setOpen] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const formId = useId();

  const transactionLabels: Record<Transaction, string> = {
    sale: t("searchSale"),
    rent: t("searchRent"),
  };

  const budgetOptions = BUDGETS[state.transaction].map((amount) => ({
    value: String(amount),
    label: t("searchBudgetUpTo", { amount: formatPrice(amount, locale) }),
  }));

  useEffect(() => {
    const element = dialog.current;
    if (element === null) return;
    if (open && !element.open) element.showModal();
    if (!open && element.open) element.close();
  }, [open]);

  const fields = (
    <>
      <Cell label={t("searchLocation")} className="flex-1">
        <select
          value={state.location}
          onChange={(event) => state.setLocation(event.target.value)}
          aria-label={t("searchLocation")}
          className={SELECT_CLASSES}
        >
          <LocationOptions locations={locations} anyLabel={t("searchLocationAny")} />
        </select>
      </Cell>
      <Cell label={t("searchBudget")} className="flex-1 md:max-w-[15rem]">
        <select
          value={state.priceMax}
          onChange={(event) => state.setPriceMax(event.target.value)}
          aria-label={t("searchBudget")}
          className={SELECT_CLASSES}
        >
          <option value="">{t("searchBudgetAny")}</option>
          {budgetOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </Cell>
    </>
  );

  return (
    <div className={className}>
      {/* Desktop and tablet: the full bar. */}
      <form
        onSubmit={state.submit}
        aria-labelledby={`${formId}-legend`}
        className="hidden border border-ivory/25 bg-ink/45 backdrop-blur-[2px] md:block"
      >
        <p id={`${formId}-legend`} className="sr-only">
          {t("searchLegend")}
        </p>
        <TransactionToggle
          value={state.transaction}
          onChange={state.switchTransaction}
          labels={transactionLabels}
          className="w-full max-w-xs border-b border-ivory/25"
        />
        <div className="flex items-stretch divide-x divide-ivory/25">
          {fields}
          <div className="flex items-center p-3">
            <button type="submit" className={cn(buttonClasses({ variant: "inverse" }), "h-[52px]")}>
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
        data-lenis-prevent
        aria-label={t("searchLegend")}
        className={cn(
          "m-0 w-full max-w-none bg-transparent p-0 backdrop:bg-ink/70 md:hidden",
          "mt-auto", // bottom sheet
        )}
      >
        <div className="bg-ink-2 px-gutter pb-10 pt-6 text-ivory">
          <div className="mb-6 flex items-center justify-between">
            <p className="eyebrow text-bronze">{t("searchLegend")}</p>
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
            <TransactionToggle
              value={state.transaction}
              onChange={state.switchTransaction}
              labels={transactionLabels}
              className="border border-ivory/25"
            />
            <div className="mt-4 divide-y divide-ivory/25 border border-ivory/25 [&>div]:px-5">
              {fields}
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
