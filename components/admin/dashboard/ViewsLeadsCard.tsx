"use client";

import { useQuery } from "convex/react";
import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/convex/_generated/api";
import { formatShortDay } from "@/lib/admin/format";
import { DashCard } from "./DashCard";
import { formatCount } from "./format";
import { CHART_HEIGHT, chartWindow, SHORT_HISTORY_DAYS } from "./series";

function ChartSkeleton() {
  return <Skeleton className="w-full" style={{ height: CHART_HEIGHT }} />;
}

/** The SVG chart is its own chunk, fetched only when a manager opens the dashboard. */
const ViewsLeadsChart = dynamic(
  () => import("./ViewsLeadsChart").then((mod) => mod.ViewsLeadsChart),
  { ssr: false, loading: () => <ChartSkeleton /> },
);

/**
 * 30-day views & leads from the nightly `dailyStats` rollup. Uses the same
 * `analytics.dashboard` subscription as the KPI cards (Convex dedupes
 * identical queries), so it costs no extra round trip.
 */
export function ViewsLeadsCard({ now, className }: { now: number; className?: string }) {
  const stats = useQuery(api.analytics.dashboard, { now });
  const range = stats === undefined ? null : chartWindow(stats.series, now);
  const ready = range !== null && range.recorded >= 2;
  const first = range?.days[0];
  const last = range?.days[range.days.length - 1];
  // A young record says where it starts, so the flat stone span before it is
  // not read as thirty quiet days.
  const since =
    ready && range.recorded < SHORT_HISTORY_DAYS ? range.days[range.firstRecorded] : undefined;

  return (
    <DashCard
      title="Pregledi i upiti"
      description={
        ready && first !== undefined && last !== undefined
          ? `Po danu, ${formatShortDay(first.ms)} – ${formatShortDay(last.ms)}`
          : "Poslednjih 30 dana, po danu"
      }
      className={className}
      data-testid="views-leads-chart"
    >
      {range === null ? (
        <div aria-busy="true">
          <Skeleton className="mb-3 h-5 w-64" />
          <ChartSkeleton />
        </div>
      ) : ready ? (
        <>
          <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
            <Legend views={range.totalViews} leads={range.totalLeads} />
            {since !== undefined ? (
              <p className="text-xs text-muted-foreground" data-numeric>
                Podaci od {formatShortDay(since.ms)}
              </p>
            ) : null}
          </div>
          <ViewsLeadsChart days={range.days} />
        </>
      ) : (
        <div
          className="grid place-items-center rounded-lg border border-dashed px-6 text-center"
          style={{ height: CHART_HEIGHT + 32 }}
        >
          <p className="max-w-sm text-sm text-pretty text-muted-foreground">
            Grafikon se puni svake noći (03:05 UTC) iz dnevne statistike — podaci se pojavljuju
            posle prve noći rada.
          </p>
        </div>
      )}
    </DashCard>
  );
}

/** Legend with 30-day totals. Identity is carried by the mark shape too, never colour alone. */
function Legend({ views, leads }: { views: number; leads: number }) {
  return (
    <ul className="flex flex-wrap items-center gap-x-6 gap-y-1 text-xs text-muted-foreground">
      <li className="flex items-center gap-2">
        <svg aria-hidden="true" width="18" height="10" viewBox="0 0 18 10" className="shrink-0">
          <rect x="0" y="3" width="18" height="7" className="fill-chart-1/20" />
          <line
            x1="0"
            y1="3"
            x2="18"
            y2="3"
            strokeWidth="2"
            strokeLinecap="round"
            className="stroke-chart-2 dark:stroke-chart-1"
          />
        </svg>
        <span>
          Pregledi{" "}
          <span className="font-medium text-foreground" data-numeric>
            {formatCount(views)}
          </span>
        </span>
      </li>
      <li className="flex items-center gap-2">
        <svg aria-hidden="true" width="10" height="10" viewBox="0 0 10 10" className="shrink-0">
          <rect x="1" y="0" width="8" height="10" rx="1.5" className="fill-chart-4" />
        </svg>
        <span>
          Upiti{" "}
          <span className="font-medium text-foreground" data-numeric>
            {formatCount(leads)}
          </span>
        </span>
      </li>
    </ul>
  );
}
