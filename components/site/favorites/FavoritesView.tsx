"use client";

import { Heart, X } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { isListingId } from "@/components/site/compare/listing-ids";
import { useListingsById } from "@/components/site/compare/useListingsById";
import { buttonClasses } from "@/components/site/Button";
import { Container } from "@/components/site/Container";
import { Eyebrow } from "@/components/site/Eyebrow";
import { PropertyCard, type CardMortgage } from "@/components/site/PropertyCard";
import { CompareTray } from "@/components/site/search/CompareTray";
import { api } from "@/convex/_generated/api";
import type { ListingCard } from "@/convex/lib/dto";
import { useHydrated } from "@/hooks/useHydrated";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { fixTypography } from "@/lib/format";
import { pickL10n } from "@/lib/l10n";
import { COMPARE_MIN, useCompareIds } from "@/lib/stores/compare";
import { clearFavorites, favoritesStore, toggleFavorite, useFavorites } from "@/lib/stores/favorites";
import { cn } from "@/lib/utils";

/**
 * The favorites grid (PRD A12). The ids come from `localStorage`, so:
 *
 * - the server and the hydration render show a neutral loading shell (never
 *   "you have saved nothing", which would flash for everyone who has);
 * - each saved id is its own live query (see `useListingsById`), so a heart
 *   taken off a card removes that card and nothing else reloads;
 * - ids whose listing is no longer public are counted, explained, and can be
 *   cleared in one go — never silently dropped from the visitor's list.
 *
 * Every removal is announced in a polite live region; a single removal also
 * offers "Undo" in a bar at the bottom of the screen, which takes focus only
 * when the removed card took the focus with it.
 */

type Notice =
  | { kind: "removed"; id: string; title: string }
  | { kind: "restored"; title: string }
  | { kind: "cleared" }
  | { kind: "pruned"; count: number };

/** How long a notice stays when nothing holds it (focus or pointer inside). */
const NOTICE_MS = 8000;

const GRID = "grid gap-x-8 gap-y-14 md:grid-cols-2 xl:grid-cols-3";
const CARD_SIZES = "(min-width: 1280px) 30vw, (min-width: 768px) 45vw, 92vw";

type FocusTarget = "heading" | "empty" | "clear" | "cancel";

export function FavoritesView({ mortgage, now }: { mortgage?: CardMortgage; now: number }) {
  const t = useTranslations("favorites");
  const locale = useLocale() as Locale;
  const hydrated = useHydrated();
  const ids = useFavorites();
  const valid = useMemo(() => ids.filter(isListingId), [ids]);
  const states = useListingsById(api.listings.byIds, valid);
  const compareOpen = useCompareIds().length >= COMPARE_MIN;

  const { cards, pending, unavailable } = useMemo(() => {
    const found: ListingCard[] = [];
    const gone: string[] = [];
    let loading = 0;
    for (const id of ids) {
      const state = isListingId(id) ? states.get(id) : undefined;
      if (state?.status === "found") found.push(state.listing);
      else if (state?.status === "loading") loading += 1;
      else gone.push(id);
    }
    return { cards: found, pending: loading, unavailable: gone };
  }, [ids, states]);

  const known = useMemo(() => new Map<string, ListingCard>(cards.map((card) => [card._id, card])), [cards]);

  const [notice, setNotice] = useState<Notice | null>(null);
  const [held, setHeld] = useState(false);
  const [confirming, setConfirming] = useState(false);

  // Titles of every card shown so far, so a removal can be named after the
  // card (and its query) is gone. Written after render, read in callbacks.
  const titles = useRef(new Map<string, string>());
  useEffect(() => {
    for (const card of cards) titles.current.set(card._id, pickL10n(card.title, locale).text);
  }, [cards, locale]);

  // A heart on a card writes to the store directly; this is where the page
  // learns which single listing left the list.
  useEffect(() => {
    let previous = favoritesStore.read();
    return favoritesStore.subscribe(() => {
      const current = favoritesStore.read();
      const gone = previous.filter((id) => !current.includes(id));
      const single = gone.length === 1 && current.length === previous.length - 1;
      previous = current;
      const id = gone[0];
      const title = id !== undefined ? titles.current.get(id) : undefined;
      if (single && id !== undefined && title !== undefined) setNotice({ kind: "removed", id, title });
    });
  }, []);

  useEffect(() => {
    if (notice === null || held) return;
    const timer = window.setTimeout(() => setNotice(null), NOTICE_MS);
    return () => window.clearTimeout(timer);
  }, [notice, held]);

  const focusRequest = useRef<FocusTarget | null>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const emptyRef = useRef<HTMLHeadingElement>(null);
  const clearRef = useRef<HTMLButtonElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const undoRef = useRef<HTMLButtonElement>(null);

  // Focus moves only on the visitor's own action, after the DOM it needs exists.
  useEffect(() => {
    const target = focusRequest.current;
    if (target === null) return;
    focusRequest.current = null;
    const element = {
      heading: headingRef.current,
      empty: emptyRef.current,
      clear: clearRef.current,
      cancel: cancelRef.current,
    }[target];
    element?.focus();
  });

  // The removed card took the focused heart with it: hand focus to "Undo".
  useEffect(() => {
    if (notice?.kind !== "removed") return;
    const active = document.activeElement;
    if (active === null || active === document.body) undoRef.current?.focus();
  }, [notice]);

  function startClear() {
    focusRequest.current = "cancel";
    setConfirming(true);
  }

  function cancelClear() {
    focusRequest.current = "clear";
    setConfirming(false);
  }

  function confirmClear() {
    clearFavorites();
    focusRequest.current = "empty";
    setConfirming(false);
    setNotice({ kind: "cleared" });
  }

  function pruneUnavailable() {
    const count = unavailable.length;
    for (const id of unavailable) favoritesStore.remove(id);
    // With nothing left the list gives way to the empty state.
    focusRequest.current = count === ids.length ? "empty" : "heading";
    setNotice({ kind: "pruned", count });
  }

  function undo(entry: Extract<Notice, { kind: "removed" }>) {
    toggleFavorite(entry.id);
    setNotice({ kind: "restored", title: entry.title });
  }

  const message =
    notice === null
      ? ""
      : notice.kind === "removed"
        ? t("removed", { title: notice.title })
        : notice.kind === "restored"
          ? t("restored", { title: notice.title })
          : notice.kind === "cleared"
            ? t("cleared")
            : t("pruned", { count: notice.count });

  let content;
  if (!hydrated) {
    content = <LoadingShell label={t("loading")} />;
  } else if (ids.length === 0) {
    content = <EmptyState headingRef={emptyRef} />;
  } else {
    const shown = ids.length - unavailable.length;
    content = (
      <section aria-labelledby="favorites-list-heading" className={cn("bg-ivory", compareOpen && "pb-20")}>
        <Container className="py-16 lg:py-24">
          <div className="hairline-b flex flex-wrap items-end justify-between gap-x-8 gap-y-4 pb-6">
            <h2
              id="favorites-list-heading"
              ref={headingRef}
              tabIndex={-1}
              data-numeric
              className="font-display text-h2 font-normal text-ink focus:outline-none"
            >
              {t("count", { count: shown })}
            </h2>
            <ClearControl
              confirming={confirming}
              onStart={startClear}
              onCancel={cancelClear}
              onConfirm={confirmClear}
              clearRef={clearRef}
              cancelRef={cancelRef}
            />
          </div>
          <p className="mt-4 max-w-[64ch] text-small text-stone-text">{fixTypography(t("compareHint"))}</p>

          {pending === 0 && unavailable.length > 0 ? (
            <div
              className="mt-10 flex flex-wrap items-center justify-between gap-x-8 gap-y-3 border-l-2 border-bronze-text bg-ivory-2 px-5 py-4"
              data-testid="favorites-unavailable"
            >
              <p className="text-body text-ink">{t("unavailable", { count: unavailable.length })}</p>
              <button
                type="button"
                onClick={pruneUnavailable}
                className={buttonClasses({ variant: "outline", size: "compact" })}
              >
                {t("unavailableRemove", { count: unavailable.length })}
              </button>
            </div>
          ) : null}

          {cards.length === 0 && pending === 0 ? (
            <div className="mt-12 flex flex-col items-start gap-6">
              <p className="max-w-[48ch] text-body-l text-stone-text">{t("allUnavailable")}</p>
              <Link href="/properties" className={buttonClasses({ variant: "primary" })}>
                {t("emptyCta")}
              </Link>
            </div>
          ) : (
            <ul aria-labelledby="favorites-list-heading" className={cn(GRID, "mt-12")} data-testid="favorites-grid">
              {ids.map((id) => {
                const state = isListingId(id) ? states.get(id) : undefined;
                if (state?.status === "found") {
                  return (
                    <li key={id} className="motion-safe:animate-in motion-safe:fade-in motion-safe:duration-300">
                      <PropertyCard
                        listing={state.listing}
                        ratio="3/2"
                        sizes={CARD_SIZES}
                        now={now}
                        compare
                        {...(mortgage !== undefined ? { mortgage } : {})}
                      />
                    </li>
                  );
                }
                if (state?.status === "loading") {
                  return (
                    <li key={id} aria-hidden="true">
                      <CardSkeleton />
                    </li>
                  );
                }
                return null;
              })}
            </ul>
          )}

          <p className="mt-16 max-w-[64ch] text-small text-stone-text">{fixTypography(t("deviceNote"))}</p>
        </Container>
      </section>
    );
  }

  return (
    <>
      {content}

      {/* Always mounted, so a new message is announced rather than inserted. */}
      <p role="status" aria-live="polite" className="sr-only">
        {message}
      </p>

      <div
        className={cn(
          "fixed inset-x-0 z-(--z-sticky) flex justify-center px-gutter transition-[opacity,translate] duration-200 ease-out",
          notice === null ? "pointer-events-none translate-y-2 opacity-0" : "translate-y-0 opacity-100",
        )}
        // Above the compare tray when it shows, and lifted over the cookie banner
        // by a transform (not `bottom`, which would count as a layout shift).
        style={{
          bottom: compareOpen ? "5.5rem" : "1.5rem",
          translate: "0 calc(-1 * var(--consent-h, 0px))",
        }}
        onPointerEnter={() => setHeld(true)}
        onPointerLeave={() => setHeld(false)}
        onFocus={() => setHeld(true)}
        onBlur={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget)) setHeld(false);
        }}
        inert={notice === null}
      >
        <div className="flex w-full max-w-[36rem] items-center gap-4 border border-ivory/15 bg-ink py-2 pl-5 pr-2 text-ivory">
          <p aria-hidden="true" className="min-w-0 flex-1 truncate text-small">
            {message}
          </p>
          {notice?.kind === "removed" ? (
            <button
              ref={undoRef}
              type="button"
              onClick={() => undo(notice)}
              aria-label={t("undoLabel", { title: notice.title })}
              className="inline-flex min-h-11 shrink-0 items-center px-3 font-sans text-small font-medium uppercase tracking-[0.12em] text-bronze transition-colors duration-200 pointer-fine:hover:text-ivory focus-visible:outline-bronze"
            >
              {t("undo")}
            </button>
          ) : null}
          <DismissButton onClick={() => setNotice(null)} />
        </div>
      </div>

      {hydrated && ids.length > 0 ? <CompareTray known={known} /> : null}
    </>
  );
}

function DismissButton({ onClick }: { onClick: () => void }) {
  const t = useTranslations("common");
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={t("close")}
      className="inline-flex size-11 shrink-0 items-center justify-center text-mist transition-colors duration-200 pointer-fine:hover:text-ivory focus-visible:outline-bronze"
    >
      <X aria-hidden="true" strokeWidth={1.25} className="size-4" />
    </button>
  );
}

/** "Clear list" with an inline confirmation: no modal for a two-button question. */
function ClearControl({
  confirming,
  onStart,
  onCancel,
  onConfirm,
  clearRef,
  cancelRef,
}: {
  confirming: boolean;
  onStart: () => void;
  onCancel: () => void;
  onConfirm: () => void;
  clearRef: RefObject<HTMLButtonElement | null>;
  cancelRef: RefObject<HTMLButtonElement | null>;
}) {
  const t = useTranslations("favorites");
  const quiet =
    "inline-flex min-h-11 items-center font-sans text-small uppercase tracking-[0.12em] transition-colors duration-200 focus-visible:outline-bronze-text";

  if (!confirming) {
    return (
      <button
        ref={clearRef}
        type="button"
        onClick={onStart}
        data-testid="favorites-clear"
        className={cn(quiet, "text-stone-text pointer-fine:hover:text-ink")}
      >
        {t("clear")}
      </button>
    );
  }

  return (
    <div role="group" aria-labelledby="favorites-clear-question" className="flex flex-wrap items-center gap-x-5 gap-y-2">
      <p id="favorites-clear-question" className="text-small text-ink">
        {t("clearConfirm")}
      </p>
      <div className="flex items-center gap-5">
        <button
          type="button"
          onClick={onConfirm}
          data-testid="favorites-clear-confirm"
          className={cn(quiet, "font-medium text-danger pointer-fine:hover:text-ink")}
        >
          {t("clearYes")}
        </button>
        <button ref={cancelRef} type="button" onClick={onCancel} className={cn(quiet, "text-ink pointer-fine:hover:text-bronze-text")}>
          {t("clearNo")}
        </button>
      </div>
    </div>
  );
}

function EmptyState({ headingRef }: { headingRef: RefObject<HTMLHeadingElement | null> }) {
  const t = useTranslations("favorites");
  return (
    <section aria-labelledby="favorites-empty-heading" className="bg-ivory" data-testid="favorites-empty">
      <Container className="py-section lg:py-32">
        <div className="grid gap-12 lg:grid-cols-12 lg:items-start lg:gap-x-6">
          <div className="flex flex-col items-start gap-6 lg:col-span-7">
            <Eyebrow>{t("emptyEyebrow")}</Eyebrow>
            <h2
              id="favorites-empty-heading"
              ref={headingRef}
              tabIndex={-1}
              className="max-w-[20ch] font-display text-display-m font-normal text-ink focus:outline-none"
            >
              {fixTypography(t("empty"))}
            </h2>
            <p className="max-w-[52ch] text-pretty text-body-l text-stone-text">{fixTypography(t("emptyBody"))}</p>
            <Link href="/properties" className={cn(buttonClasses({ variant: "primary" }), "mt-4")}>
              {t("emptyCta")}
            </Link>
          </div>
          {/* How the list fills up: the same heart the cards carry. */}
          <div aria-hidden="true" className="hidden lg:col-span-4 lg:col-start-9 lg:block">
            <div className="hairline-t flex items-center gap-5 pt-6">
              <span className="inline-flex size-14 items-center justify-center border border-ink/20">
                <Heart strokeWidth={1} className="size-6 fill-bronze text-bronze" />
              </span>
              <span className="font-sans text-label uppercase tracking-[0.12em] text-stone-text">
                {t("emptyHow")}
              </span>
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}

function LoadingShell({ label }: { label: string }) {
  return (
    <section aria-busy="true" aria-label={label} className="bg-ivory">
      <Container className="py-16 lg:py-24">
        <div className="hairline-b pb-6">
          <div className="h-10 w-64 max-w-full animate-pulse bg-ivory-2 motion-reduce:animate-none" />
        </div>
        <div className="mt-4 h-4 w-80 max-w-full animate-pulse bg-ivory-2 motion-reduce:animate-none" />
        <div className={cn(GRID, "mt-12")}>
          {Array.from({ length: 3 }, (_, index) => (
            <CardSkeleton key={index} />
          ))}
        </div>
      </Container>
    </section>
  );
}

function CardSkeleton() {
  return (
    <div className="flex flex-col gap-4" aria-hidden="true">
      <div className="aspect-[3/2] animate-pulse bg-ivory-2 motion-reduce:animate-none" />
      <div className="h-6 w-4/5 animate-pulse bg-ivory-2 motion-reduce:animate-none" />
      <div className="h-4 w-2/5 animate-pulse bg-ivory-2 motion-reduce:animate-none" />
      <div className="h-7 w-1/2 animate-pulse bg-ivory-2 motion-reduce:animate-none" />
    </div>
  );
}
