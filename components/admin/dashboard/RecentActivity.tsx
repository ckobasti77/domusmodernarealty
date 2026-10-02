"use client";

import { useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import Link from "next/link";
import { Fragment, type ReactNode } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/convex/_generated/api";
import { formatRelative } from "@/lib/admin/format";
import { actionLabel, targetHref } from "@/components/admin/activity/labels";
import { activityActor, diffCountLabel, feedSummary } from "./activity-labels";
import { DashCard } from "./DashCard";
import { isoOf } from "./format";

type ActivityRow = FunctionReturnType<typeof api.activity.list>["page"][number];
type TargetKind = NonNullable<ActivityRow["target"]>["kind"];

/** Lines shown after collapsing repeats. */
const FEED_ROWS = 6;
/** Rows read to fill those lines when bursts (e.g. several leads) collapse. */
const FEED_READ = 30;

/** Link text for a line whose summary adds nothing: what the link opens. */
const OPEN_TARGET: Record<TargetKind, string> = {
  listing: "otvori nekretninu",
  lead: "otvori upit",
  viewing: "otvori razgledanje",
  post: "otvori tekst",
  location: "otvori lokaciju",
  contact: "otvori kontakt",
  settings: "otvori podešavanja",
};

type FeedItem = {
  key: string;
  label: string;
  /** What follows the label: the summary, else what the link opens. */
  subject: string | undefined;
  href: string | null;
  actor: string;
  /** Newest time in the run. */
  at: number;
  count: number;
  /** Fields changed (single `listing.updated` rows only). */
  changed: number;
};

/**
 * Consecutive rows with the same action, wording, target and author read as
 * one line with a count ("3× Izmenjena nekretnina · ME-1042").
 */
function collapse(rows: readonly ActivityRow[]): FeedItem[] {
  const items: FeedItem[] = [];
  for (const row of rows) {
    const target = row.action !== "listing.deleted" ? row.target : undefined;
    const href = target !== undefined ? targetHref(target) : null;
    const subject = feedSummary(row) ?? (target !== undefined ? OPEN_TARGET[target.kind] : undefined);
    const actor = activityActor(row);
    const key = [row.action, subject ?? "", href ?? "", actor].join("\u0000");
    const last = items[items.length - 1];
    if (last !== undefined && last.key === key) {
      last.count += 1;
      last.changed = 0;
      continue;
    }
    items.push({
      key,
      label: actionLabel(row.action),
      subject,
      href,
      actor,
      at: row.at,
      count: 1,
      changed: row.action === "listing.updated" && row.diff !== undefined ? row.diff.length : 0,
    });
  }
  return items;
}

/** Listing refs (`ME-1042`) never break across lines. */
const REF = /([A-Z]{2,}-\d+)/;

function withUnbrokenRefs(text: string): ReactNode {
  const parts = text.split(REF);
  if (parts.length === 1) return text;
  return parts.map((part, index) =>
    index % 2 === 1 ? (
      <span key={index} className="whitespace-nowrap">
        {part}
      </span>
    ) : (
      <Fragment key={index}>{part}</Fragment>
    ),
  );
}

/** The newest activity-log lines (managers only — the query refuses others). */
export function RecentActivity({ clock, className }: { clock: number; className?: string }) {
  const result = useQuery(api.activity.list, { paginationOpts: { numItems: FEED_READ, cursor: null } });
  const items = result === undefined ? undefined : collapse(result.page).slice(0, FEED_ROWS);

  return (
    <DashCard
      title="Nedavna aktivnost"
      description="Poslednje izmene u panelu"
      className={className}
      data-testid="recent-activity"
    >
      {items === undefined ? (
        <div aria-busy="true" className="space-y-3">
          {Array.from({ length: FEED_ROWS }, (_, index) => (
            <Skeleton key={index} className="h-10 w-full" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <p className="py-1 text-sm text-muted-foreground">Još nema zabeležene aktivnosti.</p>
      ) : (
        <ol className="divide-y">
          {items.map((item) => (
            <ActivityItem key={`${item.key}-${item.at}`} item={item} clock={clock} />
          ))}
        </ol>
      )}
    </DashCard>
  );
}

function ActivityItem({ item, clock }: { item: FeedItem; clock: number }) {
  return (
    <li className="py-2 first:pt-0 last:pb-0">
      <p className="text-sm leading-snug">
        {item.count > 1 ? (
          <span className="mr-1 text-muted-foreground tabular-nums">
            <span aria-hidden="true">{item.count}×</span>
            <span className="sr-only">{item.count} puta:</span>
          </span>
        ) : null}
        <span className="font-medium">{item.label}</span>
        {item.subject !== undefined ? (
          <>
            <span aria-hidden="true" className="text-muted-foreground">
              {" · "}
            </span>
            {item.href !== null ? (
              <Link
                href={item.href}
                className="rounded-sm text-foreground underline decoration-foreground/25 underline-offset-2 transition-colors duration-150 outline-none hover:decoration-primary focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                {withUnbrokenRefs(item.subject)}
              </Link>
            ) : (
              <span className="text-muted-foreground">{withUnbrokenRefs(item.subject)}</span>
            )}
          </>
        ) : null}
        {item.changed > 0 ? <span className="text-muted-foreground"> ({diffCountLabel(item.changed)})</span> : null}
      </p>
      <p className="mt-0.5 text-xs text-muted-foreground">
        {item.actor}
        <span aria-hidden="true">{" · "}</span>
        <time dateTime={isoOf(item.at)} data-numeric>
          {formatRelative(Math.min(item.at, clock), clock)}
        </time>
      </p>
    </li>
  );
}
