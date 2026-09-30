"use client";

import { useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import Link from "next/link";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/convex/_generated/api";
import { formatRelative } from "@/lib/admin/format";
import { activityHref, activityLabel, activitySummary, diffCountLabel } from "./activity-labels";
import { DashCard } from "./DashCard";
import { isoOf } from "./format";

type ActivityRow = FunctionReturnType<typeof api.activity.list>["page"][number];

const FEED_SIZE = 10;

/** The ten newest activity-log rows (managers only — the query refuses others). */
export function RecentActivity({ clock, className }: { clock: number; className?: string }) {
  const result = useQuery(api.activity.list, { paginationOpts: { numItems: FEED_SIZE, cursor: null } });

  return (
    <DashCard
      title="Nedavna aktivnost"
      description="Poslednje izmene u panelu"
      className={className}
      data-testid="recent-activity"
    >
      {result === undefined ? (
        <div aria-busy="true" className="space-y-3">
          {Array.from({ length: 6 }, (_, index) => (
            <Skeleton key={index} className="h-10 w-full" />
          ))}
        </div>
      ) : result.page.length === 0 ? (
        <p className="py-2 text-sm text-muted-foreground">Još nema zabeležene aktivnosti.</p>
      ) : (
        <ol className="divide-y">
          {result.page.slice(0, FEED_SIZE).map((row) => (
            <ActivityItem key={row._id} row={row} clock={clock} />
          ))}
        </ol>
      )}
    </DashCard>
  );
}

function ActivityItem({ row, clock }: { row: ActivityRow; clock: number }) {
  const label = activityLabel(row.action);
  const summary = activitySummary(row.action, row.summary);
  const href = activityHref(row.entity, row.entityId, row.action);
  const changed = row.action === "listing.updated" && row.diff !== undefined ? row.diff.length : 0;
  const subject = summary ?? "otvori nekretninu";

  return (
    <li className="py-2 first:pt-0 last:pb-0">
      <p className="text-sm leading-snug">
        <span className="font-medium">{label}</span>
        {summary !== undefined || href !== null ? (
          <>
            <span aria-hidden="true" className="text-muted-foreground">
              {" · "}
            </span>
            {href !== null ? (
              <Link
                href={href}
                className="rounded-sm text-foreground underline decoration-foreground/25 underline-offset-2 transition-colors duration-150 outline-none hover:decoration-primary focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                {subject}
              </Link>
            ) : (
              <span className="text-muted-foreground">{subject}</span>
            )}
          </>
        ) : null}
        {changed > 0 ? <span className="text-muted-foreground"> ({diffCountLabel(changed)})</span> : null}
      </p>
      <p className="mt-0.5 text-xs text-muted-foreground">
        {row.byName ?? "sistem"}
        <span aria-hidden="true">{" · "}</span>
        <time dateTime={isoOf(row.at)} data-numeric>
          {formatRelative(Math.min(row.at, clock), clock)}
        </time>
      </p>
    </li>
  );
}
