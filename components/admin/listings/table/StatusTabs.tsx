"use client";

import Link from "next/link";
import type { ListingStatus } from "@/convex/lib/validators";
import { STATUS_LABEL, STATUS_ORDER } from "@/lib/admin/labels";
import { formatCount } from "@/lib/format";
import { cn } from "@/lib/utils";

/** `listingsAdmin.counts` reads at most 501 rows per status. */
const COUNT_CAP = 501;

function countLabel(count: number, capped: boolean): string {
  if (capped) return `${formatCount(COUNT_CAP - 1, "sr-Latn")}+`;
  return formatCount(count, "sr-Latn");
}

type Tab = { key: "all" | ListingStatus; status: ListingStatus | undefined; label: string };

const TABS: readonly Tab[] = [
  { key: "all", status: undefined, label: "Sve" },
  ...STATUS_ORDER.map((status) => ({ key: status, status, label: STATUS_LABEL[status] })),
];

/**
 * Status filter as a row of links: each view has its own URL, so a tab can be
 * opened in a new browser tab and the active one carries `aria-current`.
 * Scrolls sideways on narrow screens instead of wrapping.
 */
export function StatusTabs({
  current,
  counts,
  hrefFor,
}: {
  current: ListingStatus | undefined;
  counts: readonly { status: ListingStatus; count: number }[] | undefined;
  hrefFor: (status: ListingStatus | undefined) => string;
}) {
  const byStatus = new Map(counts?.map((row) => [row.status, row.count]));
  const total = counts?.reduce((sum, row) => sum + Math.min(row.count, COUNT_CAP - 1), 0);
  const totalCapped = counts?.some((row) => row.count >= COUNT_CAP) ?? false;

  return (
    <nav aria-label="Status nekretnine" className="-mx-1 mb-4 overflow-x-auto px-1">
      <ul className="flex w-max min-w-full gap-1 border-b">
        {TABS.map((tab) => {
          const active = tab.status === current;
          const count = tab.status === undefined ? total : byStatus.get(tab.status);
          const capped = tab.status === undefined ? totalCapped : (count ?? 0) >= COUNT_CAP;
          return (
            <li key={tab.key}>
              <Link
                href={hrefFor(tab.status)}
                replace
                scroll={false}
                data-testid={`status-tab-${tab.key}`}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "-mb-px inline-flex h-9 items-center gap-2 rounded-t-md border-b-2 px-3 text-sm whitespace-nowrap transition-colors duration-150 outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                  active
                    ? "border-primary font-medium text-foreground"
                    : "border-transparent text-muted-foreground hover:border-border hover:text-foreground",
                )}
              >
                {tab.label}
                {count !== undefined ? (
                  <span
                    className={cn(
                      "rounded-full px-1.5 py-px text-xs tabular-nums",
                      active ? "bg-primary/10 text-foreground" : "bg-muted text-muted-foreground",
                    )}
                  >
                    {countLabel(count, capped)}
                  </span>
                ) : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
