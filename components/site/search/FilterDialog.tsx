"use client";

import { useLenis } from "lenis/react";
import { X } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Dialog } from "radix-ui";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { buttonClasses } from "@/components/site/Button";
import type { Locale } from "@/i18n/routing";
import { formatCount } from "@/lib/format";
import type { LocationIndex } from "@/lib/search-locations";
import { clearFilters, toConvexFilters, type SearchState } from "@/lib/search-params";
import { resolveLocations } from "@/lib/search-locations";
import { cn } from "@/lib/utils";
import {
  AddedSection,
  AreaSection,
  ConstructionSection,
  FeaturesSection,
  FloorSection,
  HeatingSection,
  LocationSection,
  PriceSection,
  RoomsSection,
  TransactionSection,
  TypeSection,
} from "./FilterSections";
import { useResultCount } from "./useResultCount";

/**
 * The two full filter panels, one Radix Dialog underneath:
 *
 *  - `drawer` — desktop "Svi filteri": a right-hand panel with the filters the
 *    top bar has no room for. Every change applies at once, like the bar.
 *  - `sheet` — phones: a bottom sheet with EVERY filter. Changes stay a draft
 *    until "Prikaži N rezultata", whose live count answers "what would I get"
 *    before the visitor commits (PRD A3 "sticky result count").
 *
 * Lenis is paused while a panel is open so the wheel scrolls the panel, not
 * the page behind it; the panel body carries `data-lenis-prevent` as well.
 */
export type FilterDialogProps = {
  mode: "drawer" | "sheet";
  state: SearchState;
  onApply: (next: SearchState) => void;
  index: LocationIndex;
  now: number;
  trigger: ReactNode;
};

export function FilterDialog({ mode, state, onApply, index, now, trigger }: FilterDialogProps) {
  const [open, setOpen] = useState(false);
  const lenis = useLenis();

  useEffect(() => {
    if (!open || lenis === undefined) return;
    lenis.stop();
    return () => lenis.start();
  }, [open, lenis]);

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>{trigger}</Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay
          className={cn(
            "fixed inset-0 z-(--z-menu) bg-ink/45",
            "data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=closed]:animate-out data-[state=closed]:fade-out-0",
            "duration-300 motion-reduce:duration-0",
          )}
        />
        {/* The portal mounts its children only while open (and through the
            exit animation), so the sheet's draft is re-seeded on every open. */}
        <Panel
          mode={mode}
          state={state}
          onApply={(next) => {
            onApply(next);
            if (mode === "sheet") setOpen(false);
          }}
          onClose={() => setOpen(false)}
          index={index}
          now={now}
        />
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function Panel({
  mode,
  state,
  onApply,
  onClose,
  index,
  now,
}: {
  mode: "drawer" | "sheet";
  state: SearchState;
  onApply: (next: SearchState) => void;
  onClose: () => void;
  index: LocationIndex;
  now: number;
}) {
  const t = useTranslations("filters");
  const tSearch = useTranslations("search");
  const tCommon = useTranslations("common");
  const locale = useLocale() as Locale;

  // The sheet edits a draft seeded from the URL when it opens (it mounts on open).
  const [draft, setDraft] = useState(state);
  const current = mode === "sheet" ? draft : state;
  const change = mode === "sheet" ? setDraft : onApply;

  const filters = useMemo(
    () => toConvexFilters(current, resolveLocations(index, current.locations), now),
    [current, index, now],
  );
  const { value: count, pending } = useResultCount(filters);

  const showLabel =
    count === undefined
      ? tSearch("counting")
      : count.exact
        ? tSearch("showResults", { count: count.count })
        : tSearch("showResultsApprox", { count: formatCount(count.count, locale) });

  return (
    <Dialog.Content
      aria-describedby={undefined}
      data-testid={mode === "sheet" ? "filter-sheet" : "filter-drawer"}
      className={cn(
        "fixed z-(--z-menu) flex flex-col bg-paper text-ink focus-visible:outline-none",
        "duration-300 ease-(--ease-estate) motion-reduce:duration-0",
        "data-[state=open]:animate-in data-[state=closed]:animate-out",
        mode === "drawer"
          ? "inset-y-0 right-0 w-[min(32rem,100vw)] border-l border-hairline-light data-[state=open]:slide-in-from-right data-[state=closed]:slide-out-to-right"
          : "inset-x-0 bottom-0 max-h-[92svh] border-t border-hairline-light data-[state=open]:slide-in-from-bottom data-[state=closed]:slide-out-to-bottom",
      )}
    >
      <header className="flex items-center justify-between border-b border-hairline-light px-gutter py-4 md:px-gutter-md">
        {mode === "sheet" ? (
          <span aria-hidden="true" className="absolute left-1/2 top-2 h-1 w-10 -translate-x-1/2 bg-ink/15" />
        ) : null}
        <Dialog.Title className="font-display text-h3 font-normal">
          {mode === "drawer" ? t("more") : t("heading")}
        </Dialog.Title>
        <Dialog.Close
          aria-label={tCommon("close")}
          className="inline-flex size-11 items-center justify-center text-ink transition-colors duration-200 pointer-fine:hover:text-bronze-text focus-visible:outline-2 focus-visible:outline-bronze-text"
        >
          <X aria-hidden="true" strokeWidth={1.25} className="size-5" />
        </Dialog.Close>
      </header>

      <div data-lenis-prevent="" className="flex-1 overflow-y-auto overscroll-contain px-gutter py-8 md:px-gutter-md">
        <div className="flex flex-col gap-10">
          {mode === "sheet" ? (
            <>
              <TransactionSection state={current} onChange={change} />
              <LocationSection state={current} onChange={change} index={index} collapsed />
              <TypeSection state={current} onChange={change} />
              <PriceSection state={current} onChange={change} />
              <AreaSection state={current} onChange={change} />
              <RoomsSection state={current} onChange={change} />
            </>
          ) : null}
          <FloorSection state={current} onChange={change} />
          <HeatingSection state={current} onChange={change} />
          <ConstructionSection state={current} onChange={change} />
          <FeaturesSection state={current} onChange={change} />
          <AddedSection state={current} onChange={change} />
        </div>
      </div>

      <footer
        className="flex items-center gap-4 border-t border-hairline-light bg-paper px-gutter py-4 md:px-gutter-md"
        style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}
      >
        <button
          type="button"
          onClick={() => change(clearFilters(current))}
          className="inline-flex min-h-11 shrink-0 items-center font-sans text-label uppercase tracking-[0.12em] text-stone-text transition-colors duration-200 pointer-fine:hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-bronze-text"
          data-testid="filters-clear"
        >
          {t("clearAll")}
        </button>
        <button
          type="button"
          onClick={() => (mode === "sheet" ? onApply(draft) : onClose())}
          aria-busy={pending}
          data-testid="filters-apply"
          // One line whatever the count, so the button never changes height.
          className={cn(buttonClasses({ variant: "primary", size: "default" }), "ml-auto flex-1 whitespace-nowrap px-5 tracking-[0.08em] sm:flex-none")}
        >
          <span data-numeric aria-live="polite">
            {showLabel}
          </span>
        </button>
      </footer>
    </Dialog.Content>
  );
}
