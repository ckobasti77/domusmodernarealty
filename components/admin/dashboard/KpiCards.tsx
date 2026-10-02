"use client";

import { useQuery } from "convex/react";
import type { ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/convex/_generated/api";
import { formatDate } from "@/lib/admin/format";
import { formatCapped, formatCount, formatDuration, pluralSr } from "./format";

/** `leadsAdmin.awaitingResponse` returns at most this many leads. */
const AWAITING_CAP = 20;

type Kpi = {
  key: string;
  label: string;
  /** Undefined while loading. */
  value: string | undefined;
  hint: ReactNode;
};

/**
 * The response-time hint. The average covers answered leads only, so the
 * leads still waiting (the "bez odgovora duže od 1 h" queue) are named next
 * to it rather than read into a fast average.
 */
function responseHint(answered: boolean, waiting: number): string {
  const scope = answered ? "Samo odgovoreni upiti iz 7 dana" : "Još nema odgovorenih upita";
  if (waiting === 0) return scope;
  return `${scope} · ${formatCapped(waiting, AWAITING_CAP)} ${pluralSr(waiting, "čeka", "čeka", "čekaju")}`;
}

/**
 * Agency-wide KPIs (managers only — `analytics.dashboard` refuses anyone else).
 * Listing counts are exact (denormalized counters); new leads and today's
 * viewings are read with `.take(n)`, so a value at that limit reads `n+`.
 * The cards do not link: no screen lists exactly what they count (the
 * listings table filters one status, "active" is published plus reserved).
 */
export function KpiCards({ now }: { now: number }) {
  const stats = useQuery(api.analytics.dashboard, { now });
  // The leads card's own subscription (same arguments): Convex shares it.
  const awaiting = useQuery(api.leadsAdmin.awaitingResponse, { now });

  const kpis: Kpi[] = [
    {
      key: "active",
      label: "Aktivne nekretnine",
      value: stats === undefined ? undefined : formatCount(stats.activeListings),
      hint: stats === undefined ? undefined : `Objavljene i rezervisane · ${formatCount(stats.draftListings)} u nacrtu`,
    },
    {
      key: "leads",
      label: "Novi upiti (7 dana)",
      value:
        stats === undefined
          ? undefined
          : `${formatCount(stats.newLeads7d)}${stats.newLeads7dCapped ? "+" : ""}`,
      hint: "Svi kanali i svi agenti",
    },
    {
      key: "viewings",
      label: "Razgledanja danas",
      value: stats === undefined ? undefined : formatCapped(stats.viewingsToday, 200),
      // The date the server counted for; non-breaking so it never splits.
      hint: `Svi agenti, ${formatDate(now).replace(/ /g, "\u00a0")}`,
    },
    {
      key: "response",
      label: "Prosečno vreme odgovora",
      value:
        stats === undefined
          ? undefined
          : stats.avgFirstResponseMinutes === undefined
            ? "—"
            : formatDuration(stats.avgFirstResponseMinutes),
      hint:
        stats === undefined || awaiting === undefined
          ? undefined
          : responseHint(stats.avgFirstResponseMinutes !== undefined, awaiting.length),
    },
  ];

  return (
    <section
      aria-labelledby="kpi-heading"
      data-testid="kpi-cards"
      aria-busy={stats === undefined || awaiting === undefined}
    >
      <h2 id="kpi-heading" className="sr-only">
        Ključni pokazatelji
      </h2>
      <ul className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        {kpis.map((kpi) => (
          <li key={kpi.key} className="min-w-0">
            <KpiCard kpi={kpi} />
          </li>
        ))}
      </ul>
    </section>
  );
}

function KpiCard({ kpi }: { kpi: Kpi }) {
  return (
    // Compact on phones, where two cards share a row.
    <Card className="h-full max-sm:[--card-spacing:--spacing(3)]">
      <CardContent>
        <p className="text-xs font-medium text-muted-foreground">{kpi.label}</p>
        {kpi.value === undefined ? (
          <Skeleton className="mt-2 h-8 w-20 sm:h-9 sm:w-24" />
        ) : (
          <p className="mt-2 text-2xl leading-8 font-semibold tracking-tight sm:text-3xl sm:leading-9" data-numeric>
            {kpi.value}
          </p>
        )}
        {kpi.hint === undefined ? (
          <Skeleton className="mt-1.5 h-4 w-28" />
        ) : (
          <p className="mt-1.5 text-xs leading-4 text-pretty text-muted-foreground">{kpi.hint}</p>
        )}
      </CardContent>
    </Card>
  );
}
