"use client";

import { useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import dynamic from "next/dynamic";
import { useState } from "react";
import { DashCard } from "@/components/admin/dashboard/DashCard";
import { formatCount, pluralSr } from "@/components/admin/dashboard/format";
import { Skeleton } from "@/components/ui/skeleton";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { api } from "@/convex/_generated/api";
import type { LeadSource, LeadType } from "@/convex/lib/validators";
import { LEAD_SOURCE_LABEL, LEAD_TYPE_LABEL } from "@/lib/admin/labels";
import type { Series } from "./LeadsTrendChart";
import { CappedNote, formatShare, tableClass, useTableToggle, weekLabel, type Period } from "./shared";

type Trend = FunctionReturnType<typeof api.analytics.leadsOverTime>;
type Dimension = "source" | "type";

function ChartSkeleton() {
  return <Skeleton className="h-[420px] w-full" />;
}

/** The SVG chart is its own chunk, fetched only when this screen opens. */
const LeadsTrendChart = dynamic(() => import("./LeadsTrendChart").then((mod) => mod.LeadsTrendChart), {
  ssr: false,
  loading: () => <ChartSkeleton />,
});

function seriesOf(trend: Trend, dimension: Dimension): Series[] {
  if (dimension === "source") {
    return (Object.keys(LEAD_SOURCE_LABEL) as LeadSource[]).map((key) => ({
      key,
      label: LEAD_SOURCE_LABEL[key],
      values: trend.weeks.map((week) => week.bySource[key]),
      total: trend.totals.bySource[key],
    }));
  }
  return (Object.keys(LEAD_TYPE_LABEL) as LeadType[]).map((key) => ({
    key,
    label: LEAD_TYPE_LABEL[key],
    values: trend.weeks.map((week) => week.byType[key]),
    total: trend.totals.byType[key],
  }));
}

/** Leads per calendar week (Monday–Sunday), by source or by type. */
export function LeadsTrendCard({ now, period, className }: { now: number; period: Period; className?: string }) {
  const trend = useQuery(api.analytics.leadsOverTime, { now, days: period });
  const [dimension, setDimension] = useState<Dimension>("source");
  const table = useTableToggle();
  const series = trend !== undefined ? seriesOf(trend, dimension) : [];
  const dimensionLabel = dimension === "source" ? "izvoru" : "vrsti";

  const current = trend?.weeks.at(-1);
  const leader = [...series].sort((a, b) => b.total - a.total)[0];
  const summary =
    trend === undefined
      ? ""
      : `${formatCount(trend.totals.total)} ${pluralSr(trend.totals.total, "upit", "upita")} u ${trend.weeks.length} nedelja.${
          leader !== undefined && leader.total > 0
            ? ` Najviše po ${dimensionLabel}: ${leader.label} (${formatCount(leader.total)}, ${formatShare(leader.total, trend.totals.total)}).`
            : ""
        }`;

  return (
    <DashCard
      title="Upiti po nedeljama"
      description={`Po ${dimensionLabel}, nedelje od ponedeljka do nedelje; poslednja je tekuća i još nije završena`}
      className={className}
      action={
        <div className="flex flex-wrap items-center justify-end gap-2">
          <ToggleGroup
            type="single"
            variant="outline"
            size="sm"
            spacing={0}
            value={dimension}
            aria-label="Podela upita"
            onValueChange={(value) => {
              if (value === "source" || value === "type") setDimension(value);
            }}
          >
            <ToggleGroupItem value="source" className="px-3">
              Po izvoru
            </ToggleGroupItem>
            <ToggleGroupItem value="type" className="px-3">
              Po vrsti
            </ToggleGroupItem>
          </ToggleGroup>
          {table.toggle}
        </div>
      }
      data-testid="analytics-leads-chart"
    >
      {trend === undefined ? (
        <div aria-busy="true">
          <Skeleton className="mb-3 h-5 w-64" />
          <ChartSkeleton />
        </div>
      ) : trend.totals.total === 0 ? (
        <p className="grid h-40 place-items-center rounded-lg border border-dashed px-6 text-center text-sm text-muted-foreground">
          U poslednjih {period} dana nije stigao nijedan upit.
        </p>
      ) : (
        <figure>
          <figcaption className="mb-3 text-sm" aria-live="polite">
            {summary}
          </figcaption>
          <LeadsTrendChart weeks={trend.weeks} totals={trend.weeks.map((week) => week.total)} series={series} />
          {current !== undefined ? (
            <p className="mt-3 text-xs text-muted-foreground">
              Svetlija kolona je tekuća nedelja, {weekLabel(current)}.
            </p>
          ) : null}
          <div className={table.shown ? undefined : "sr-only"}>
          <table className={tableClass(table.shown)}>
            <caption className="sr-only">Upiti po nedeljama i po {dimensionLabel}</caption>
            <thead>
              <tr className="border-b text-xs text-muted-foreground">
                <th scope="col" className="py-1.5 text-left font-medium">
                  Nedelja
                </th>
                <th scope="col" className="py-1.5 text-right font-medium">
                  Ukupno
                </th>
                {series.map((item) => (
                  <th key={item.key} scope="col" className="py-1.5 pl-2 text-right font-medium">
                    {item.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {trend.weeks.map((week, index) => (
                <tr key={week.start} className="border-b last:border-0">
                  <th scope="row" className="py-1.5 text-left font-normal whitespace-nowrap">
                    {weekLabel(week)}
                  </th>
                  <td className="py-1.5 text-right tabular-nums">{formatCount(week.total)}</td>
                  {series.map((item) => (
                    <td key={item.key} className="py-1.5 pl-2 text-right tabular-nums">
                      {formatCount(item.values[index] ?? 0)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </figure>
      )}
      {trend?.capped === true ? (
        <CappedNote>
          U ovom periodu ima više od 2.000 upita; grafikon prikazuje prvih 2.000, pa su poslednje nedelje nepotpune.
        </CappedNote>
      ) : null}
    </DashCard>
  );
}
