"use client";

import { Check, Link2, Plus } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useMemo, useRef, useState } from "react";
import { buttonClasses } from "@/components/site/Button";
import { Container } from "@/components/site/Container";
import { Eyebrow } from "@/components/site/Eyebrow";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useHydrated } from "@/hooks/useHydrated";
import { getPathname, Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { fixTypography } from "@/lib/format";
import { pickL10n } from "@/lib/l10n";
import {
  COMPARE_MAX,
  COMPARE_MIN,
  clearCompare,
  removeFromCompare,
  toggleCompare,
  useCompareIds,
} from "@/lib/stores/compare";
import { useFavorites } from "@/lib/stores/favorites";
import { cn } from "@/lib/utils";
import { toCompareItem, type CompareItem } from "./compare-item";
import { CompareTable } from "./CompareTable";
import { isListingId } from "./listing-ids";
import { useListingsById } from "./useListingsById";

/**
 * The compare page's island (PRD A12). Two sources, one table:
 *
 * - a shared link (`?ids=a,b,c`) arrives server-rendered in `shared`; removing
 *   a column rewrites the URL in place, and "Save this comparison" makes the
 *   link's listings this device's own selection;
 * - without `?ids=` the page reads this device's selection from the compare
 *   store, so the server can only render a loading shell.
 *
 * Removing a column also takes the listing out of the stored selection, so
 * the search page's tray agrees with what the visitor last saw here.
 */

export type SharedComparison = {
  /** How many well-formed ids the link carried. */
  requested: number;
  /** The ones that are still public, in link order. */
  items: CompareItem[];
};

const NO_IDS: readonly Id<"listings">[] = Object.freeze([]);
const NO_REMOVED: ReadonlySet<string> = new Set();

type FocusTarget = { kind: "heading" } | { kind: "remove"; id: string } | { kind: "share" };

export function CompareView({ shared }: { shared: SharedComparison | null }) {
  const t = useTranslations("compare");
  const tCommon = useTranslations("common");
  const locale = useLocale() as Locale;
  const hydrated = useHydrated();
  const storeIds = useCompareIds();
  const favoriteCount = useFavorites().length;

  const localIds = useMemo(() => storeIds.filter(isListingId), [storeIds]);
  const states = useListingsById(api.listings.detailsByIds, shared === null ? localIds : NO_IDS);
  const [removed, setRemoved] = useState<ReadonlySet<string>>(NO_REMOVED);

  const local = useMemo(() => {
    const items: CompareItem[] = [];
    const gone: string[] = [];
    let pending = 0;
    for (const id of storeIds) {
      const state = isListingId(id) ? states.get(id) : undefined;
      if (state?.status === "found") items.push(toCompareItem(state.listing));
      else if (state?.status === "loading") pending += 1;
      else gone.push(id);
    }
    return { items, gone, pending };
  }, [storeIds, states]);

  const items = useMemo(
    () => (shared !== null ? shared.items.filter((item) => !removed.has(item._id)) : local.items),
    [shared, removed, local.items],
  );
  const loading = shared === null && (!hydrated || local.pending > 0);
  const unavailable = shared !== null ? shared.requested - shared.items.length : local.gone.length;

  const isOwnSelection =
    hydrated && items.length === storeIds.length && items.every((item) => storeIds.includes(item._id));
  const ownSelectionElsewhere = shared !== null && hydrated && storeIds.length >= COMPARE_MIN && !isOwnSelection;

  const [message, setMessage] = useState("");
  const [copied, setCopied] = useState(false);
  const [fallbackUrl, setFallbackUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), 3000);
    return () => window.clearTimeout(timer);
  }, [copied]);

  const headingRef = useRef<HTMLHeadingElement>(null);
  const shareRef = useRef<HTMLButtonElement>(null);
  const fallbackRef = useRef<HTMLInputElement>(null);
  const focusRequest = useRef<FocusTarget | null>(null);

  // Focus moves only after the visitor's own action, once the DOM it needs exists.
  useEffect(() => {
    const target = focusRequest.current;
    if (target === null) return;
    focusRequest.current = null;
    if (target.kind === "heading") headingRef.current?.focus();
    else if (target.kind === "share") shareRef.current?.focus();
    else document.querySelector<HTMLButtonElement>(`[data-remove-id="${target.id}"]`)?.focus();
  });

  useEffect(() => {
    if (fallbackUrl === null) return;
    fallbackRef.current?.focus();
    fallbackRef.current?.select();
  }, [fallbackUrl]);

  const comparePath = getPathname({ locale, href: "/compare" });
  const urlFor = (ids: readonly string[]) => (ids.length > 0 ? `${comparePath}?ids=${ids.join(",")}` : comparePath);

  function remove(item: CompareItem, index: number) {
    removeFromCompare(item._id);
    if (shared !== null) {
      const next = new Set(removed).add(item._id);
      setRemoved(next);
      const rest = shared.items.filter((entry) => !next.has(entry._id)).map((entry) => entry._id);
      // Next keeps its router in sync with `history.replaceState`; no navigation, no refetch.
      window.history.replaceState(null, "", urlFor(rest));
    }
    const remaining = items.length - 1;
    const neighbour = items[index + 1] ?? items[index - 1];
    focusRequest.current =
      remaining >= COMPARE_MIN && neighbour !== undefined ? { kind: "remove", id: neighbour._id } : { kind: "heading" };
    setFallbackUrl(null);
    setMessage(t("removed", { title: pickL10n(item.title, locale).text }));
  }

  function save() {
    const ids = items.map((item) => item._id);
    clearCompare();
    // The store lists the newest first, so adding in reverse keeps the link's order.
    for (const id of [...ids].reverse()) toggleCompare(id);
    focusRequest.current = { kind: "share" };
    setMessage(t("saved"));
  }

  function pruneUnavailable() {
    for (const id of local.gone) removeFromCompare(id);
    focusRequest.current = { kind: "heading" };
    setMessage(t("pruned"));
  }

  async function share() {
    const url = `${window.location.origin}${urlFor(items.map((item) => item._id))}`;
    setFallbackUrl(null);
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setMessage(tCommon("copied"));
    } catch {
      // No clipboard permission (or an old browser): try the legacy command,
      // and failing that show the link selected, ready for Ctrl+C.
      if (copyWithSelection(url)) {
        setCopied(true);
        setMessage(tCommon("copied"));
      } else {
        setFallbackUrl(url);
      }
    }
  }

  let content;
  if (loading) {
    content = <LoadingShell label={tCommon("loading")} />;
  } else if (items.length < COMPARE_MIN) {
    // A link whose listings are all gone (or that never named a valid one).
    const sharedGone = shared !== null && shared.items.length === 0;
    content = (
      <section aria-labelledby="compare-status-heading" className="bg-ivory">
        <Container className="py-section lg:py-32">
          <div className="flex max-w-[44rem] flex-col items-start gap-6">
            <Eyebrow>{t("needMoreEyebrow")}</Eyebrow>
            <h2
              id="compare-status-heading"
              ref={headingRef}
              tabIndex={-1}
              className="font-display text-display-m font-normal text-ink focus:outline-none"
            >
              {fixTypography(sharedGone ? t("sharedUnavailable") : t("needMoreTitle"))}
            </h2>
            <p className="text-pretty text-body-l text-stone-text">
              {fixTypography(t("empty"))}
            </p>
            {shared === null && unavailable > 0 ? (
              <UnavailableNote count={unavailable} onPrune={pruneUnavailable} />
            ) : null}
            <div className="mt-4 flex flex-wrap items-center gap-x-8 gap-y-4">
              <Link href="/properties" className={buttonClasses({ variant: "primary" })}>
                {t("browse")}
              </Link>
              {hydrated && favoriteCount > 0 ? (
                <Link href="/favorites" className={buttonClasses({ variant: "outline" })}>
                  {t("fromFavorites", { count: favoriteCount })}
                </Link>
              ) : null}
              {ownSelectionElsewhere ? (
                <Link
                  href={{ pathname: "/compare", query: { ids: storeIds.join(",") } }}
                  className={buttonClasses({ variant: "ghost" })}
                >
                  {t("ownSelection", { count: storeIds.length })}
                </Link>
              ) : null}
            </div>
          </div>
        </Container>
      </section>
    );
  } else {
    content = (
      <section aria-labelledby="compare-status-heading" className="bg-ivory">
        <Container className="py-16 lg:py-24">
          <div className="hairline-b flex flex-wrap items-end justify-between gap-x-10 gap-y-6 pb-6">
            <div className="flex flex-col gap-2">
              <h2
                id="compare-status-heading"
                ref={headingRef}
                tabIndex={-1}
                className="font-display text-h2 font-normal text-ink focus:outline-none"
              >
                {t("count", { count: items.length })}
              </h2>
              {shared !== null && hydrated && !isOwnSelection ? (
                <p className="max-w-[56ch] text-small text-stone-text">
                  {fixTypography(storeIds.length > 0 ? t("sharedNoteReplace") : t("sharedNote"))}
                </p>
              ) : null}
            </div>

            <div className="flex flex-wrap items-center gap-x-3 gap-y-3">
              {shared !== null && hydrated && !isOwnSelection ? (
                <button
                  type="button"
                  onClick={save}
                  data-testid="compare-save"
                  className={buttonClasses({ variant: "outline", size: "compact" })}
                >
                  {t("save")}
                </button>
              ) : null}
              <button
                ref={shareRef}
                type="button"
                onClick={share}
                data-testid="compare-share"
                className={cn(buttonClasses({ variant: "primary", size: "compact" }), "gap-2")}
              >
                {copied ? (
                  <Check aria-hidden="true" strokeWidth={1.5} className="size-4" />
                ) : (
                  <Link2 aria-hidden="true" strokeWidth={1.25} className="size-4" />
                )}
                {copied ? tCommon("copied") : t("shareCta")}
              </button>
              {items.length < COMPARE_MAX ? (
                <Link
                  href="/properties"
                  className={cn(buttonClasses({ variant: "ghost", size: "compact" }), "gap-2 px-3")}
                >
                  <Plus aria-hidden="true" strokeWidth={1.25} className="size-4" />
                  {t("addMore")}
                </Link>
              ) : null}
            </div>
          </div>

          {fallbackUrl !== null ? (
            <div className="mt-6 max-w-[40rem]">
              <label htmlFor="compare-share-url" className="text-small text-stone-text">
                {t("shareFallback")}
              </label>
              <input
                id="compare-share-url"
                ref={fallbackRef}
                readOnly
                value={fallbackUrl}
                onFocus={(event) => event.currentTarget.select()}
                className="mt-2 min-h-11 w-full border-0 border-b border-stone-text bg-transparent font-mono text-small text-ink focus:border-bronze focus:outline-none"
              />
            </div>
          ) : null}

          {unavailable > 0 ? (
            <div className="mt-8">
              {shared !== null ? (
                <p className="border-l-2 border-bronze-text bg-ivory-2 px-5 py-4 text-body text-ink">
                  {t("sharedSomeUnavailable", { count: unavailable })}
                </p>
              ) : (
                <UnavailableNote count={unavailable} onPrune={pruneUnavailable} />
              )}
            </div>
          ) : null}

          <div className="mt-10 lg:mt-14">
            <CompareTable items={items} onRemove={remove} />
          </div>
        </Container>
      </section>
    );
  }

  return (
    <>
      {content}
      {/* Always mounted, so removals, copies and saves are announced, not inserted. */}
      <p role="status" aria-live="polite" className="sr-only">
        {message}
      </p>
    </>
  );
}

function UnavailableNote({ count, onPrune }: { count: number; onPrune: () => void }) {
  const t = useTranslations("compare");
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-8 gap-y-3 border-l-2 border-bronze-text bg-ivory-2 px-5 py-4">
      <p className="text-body text-ink">{t("unavailable", { count })}</p>
      <button type="button" onClick={onPrune} className={buttonClasses({ variant: "outline", size: "compact" })}>
        {t("unavailableRemove", { count })}
      </button>
    </div>
  );
}

function LoadingShell({ label }: { label: string }) {
  return (
    <section aria-busy="true" aria-label={label} className="bg-ivory">
      <Container className="py-16 lg:py-24">
        <div className="hairline-b flex items-end justify-between gap-6 pb-6">
          <div className="h-10 w-72 max-w-full animate-pulse bg-ivory-2 motion-reduce:animate-none" />
          <div className="hidden h-11 w-56 animate-pulse bg-ivory-2 motion-reduce:animate-none sm:block" />
        </div>
        <div className="mt-10 grid grid-cols-[7rem_1fr_1fr] gap-x-6 md:grid-cols-[11rem_1fr_1fr_1fr] lg:mt-14 lg:grid-cols-[14rem_1fr_1fr_1fr]">
          <div />
          {Array.from({ length: 3 }, (_, index) => (
            <div key={index} className={cn("flex flex-col gap-3", index === 2 && "max-md:hidden")}>
              <div className="aspect-[3/2] animate-pulse bg-ivory-2 motion-reduce:animate-none" />
              <div className="h-6 w-4/5 animate-pulse bg-ivory-2 motion-reduce:animate-none" />
              <div className="h-4 w-2/5 animate-pulse bg-ivory-2 motion-reduce:animate-none" />
            </div>
          ))}
        </div>
        <div className="mt-12 flex flex-col">
          {Array.from({ length: 6 }, (_, index) => (
            <div key={index} className="hairline-t h-14" />
          ))}
        </div>
      </Container>
    </section>
  );
}

/** The pre-Clipboard-API copy: select a detached textarea and run `copy`. */
function copyWithSelection(text: string): boolean {
  const area = document.createElement("textarea");
  area.value = text;
  area.setAttribute("readonly", "");
  area.style.position = "fixed";
  area.style.opacity = "0";
  document.body.append(area);
  area.select();
  try {
    return document.execCommand("copy");
  } catch {
    return false;
  } finally {
    area.remove();
  }
}
