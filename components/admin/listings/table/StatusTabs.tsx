"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, type CSSProperties } from "react";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { ListingStatus } from "@/convex/lib/validators";
import { STATUS_LABEL, STATUS_ORDER } from "@/lib/admin/labels";
import { formatCount } from "@/lib/format";
import { cn } from "@/lib/utils";

/** `listingsAdmin.counts` reads at most 501 rows per status. */
export const COUNT_CAP = 501;

function countLabel(count: number, capped: boolean): string {
  if (capped) return `${formatCount(COUNT_CAP - 1, "sr-Latn")}+`;
  return formatCount(count, "sr-Latn");
}

type TabKey = "all" | ListingStatus;
type Tab = { key: TabKey; status: ListingStatus | undefined; label: string };

const TABS: readonly Tab[] = [
  { key: "all", status: undefined, label: "Sve" },
  ...STATUS_ORDER.map((status) => ({ key: status, status, label: STATUS_LABEL[status] })),
];

function isTabKey(value: string): value is TabKey {
  return TABS.some((tab) => tab.key === value);
}

/** Fade width at a clipped edge of the strip. */
const FADE_PX = 32;

/**
 * Which ends of a horizontal scroller have content hidden past them, kept in
 * sync on scroll and resize. Drives the edge fade so an overflowing strip
 * never looks like it simply ends.
 */
function useClippedEdges(node: HTMLElement | null): { start: boolean; end: boolean } {
  const [edges, setEdges] = useState({ start: false, end: false });
  const measure = useCallback(() => {
    if (node === null) return;
    const start = node.scrollLeft > 1;
    const end = node.scrollLeft + node.clientWidth < node.scrollWidth - 1;
    setEdges((prev) => (prev.start === start && prev.end === end ? prev : { start, end }));
  }, [node]);

  useEffect(() => {
    if (node === null) return;
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    const list = node.firstElementChild;
    if (list !== null) observer.observe(list);
    node.addEventListener("scroll", measure, { passive: true });
    return () => {
      observer.disconnect();
      node.removeEventListener("scroll", measure);
    };
  }, [node, measure]);

  return edges;
}

function fadeMask({ start, end }: { start: boolean; end: boolean }): CSSProperties | undefined {
  if (!start && !end) return undefined;
  const from = start ? `transparent, black ${FADE_PX}px` : "black";
  const to = end ? `black calc(100% - ${FADE_PX}px), transparent` : "black";
  const mask = `linear-gradient(to right, ${from}, ${to})`;
  return { maskImage: mask, WebkitMaskImage: mask };
}

/**
 * Status filter. From `sm` up it is a row of links: each view has its own URL,
 * so a tab can be opened in a new browser tab and the active one carries
 * `aria-current`; the strip scrolls sideways (with an edge fade) instead of
 * wrapping. On phones a single select takes its place.
 */
export function StatusTabs({
  current,
  counts,
  hrefFor,
  onSelect,
}: {
  current: ListingStatus | undefined;
  counts: readonly { status: ListingStatus; count: number }[] | undefined;
  hrefFor: (status: ListingStatus | undefined) => string;
  onSelect: (status: ListingStatus | undefined) => void;
}) {
  const [scroller, setScroller] = useState<HTMLElement | null>(null);
  const edges = useClippedEdges(scroller);

  const byStatus = new Map(counts?.map((row) => [row.status, row.count]));
  const total = counts?.reduce((sum, row) => sum + Math.min(row.count, COUNT_CAP - 1), 0);
  const totalCapped = counts?.some((row) => row.count >= COUNT_CAP) ?? false;

  const tabs = TABS.map((tab) => {
    const count = tab.status === undefined ? total : byStatus.get(tab.status);
    const capped = tab.status === undefined ? totalCapped : (count ?? 0) >= COUNT_CAP;
    return {
      ...tab,
      active: tab.status === current,
      count,
      countText: count === undefined ? undefined : countLabel(count, capped),
    };
  });

  return (
    <>
      <div className="mb-4 sm:hidden">
        <Label htmlFor="status-select" className="sr-only">
          Status nekretnine
        </Label>
        <Select
          value={current ?? "all"}
          onValueChange={(value) => {
            if (!isTabKey(value)) return;
            onSelect(value === "all" ? undefined : value);
          }}
        >
          <SelectTrigger id="status-select" data-testid="status-select" className="w-full">
            <span className="flex min-w-0 items-center gap-1.5">
              <span className="text-muted-foreground">Status:</span>
              <SelectValue />
            </span>
          </SelectTrigger>
          <SelectContent position="popper" align="start">
            {tabs.map((tab) => (
              <SelectItem key={tab.key} value={tab.key}>
                {tab.countText !== undefined ? `${tab.label} (${tab.countText})` : tab.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <nav
        ref={setScroller}
        aria-label="Status nekretnine"
        // `relative`: the tabs' sr-only counts are absolutely positioned and
        // must be clipped by this scroller, not widen the page.
        className="relative -mx-1 mb-4 hidden overflow-x-auto px-1 sm:block"
        style={fadeMask(edges)}
      >
        <ul className="flex w-max min-w-full gap-1 border-b">
          {tabs.map((tab) => {
            const empty = tab.count === 0;
            return (
              <li key={tab.key}>
                <Link
                  href={hrefFor(tab.status)}
                  replace
                  scroll={false}
                  data-testid={`status-tab-${tab.key}`}
                  aria-current={tab.active ? "page" : undefined}
                  className={cn(
                    "-mb-px inline-flex h-9 items-center gap-2 rounded-t-md border-b-2 px-3 text-sm whitespace-nowrap transition-colors duration-150 outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                    tab.active
                      ? "border-primary font-medium text-foreground"
                      : empty
                        ? "border-transparent text-muted-foreground hover:border-border"
                        : "border-transparent text-foreground/85 hover:border-border hover:text-foreground",
                  )}
                >
                  {tab.label}
                  {tab.countText !== undefined && !empty ? (
                    <span
                      className={cn(
                        "rounded-full px-1.5 py-px text-xs tabular-nums",
                        tab.active ? "bg-primary/10 text-foreground" : "bg-muted text-muted-foreground",
                      )}
                    >
                      {tab.countText}
                    </span>
                  ) : empty ? (
                    <span className="sr-only">(0)</span>
                  ) : null}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </>
  );
}
