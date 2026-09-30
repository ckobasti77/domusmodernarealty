"use client";

import { useQuery } from "convex/react";
import { ArrowUpRight } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/convex/_generated/api";
import { formatCapped, formatDuration } from "./format";

type Kpi = {
  key: string;
  label: string;
  /** Undefined while loading. */
  value: string | undefined;
  hint: ReactNode;
  href?: string;
};

/**
 * Agency-wide KPIs (managers only — `analytics.dashboard` refuses anyone else).
 * The server counts with `.take(n)`, so values at that limit read `n+`.
 */
export function KpiCards({ now }: { now: number }) {
  const stats = useQuery(api.analytics.dashboard, { now });

  const kpis: Kpi[] = [
    {
      key: "active",
      label: "Aktivne nekretnine",
      value: stats === undefined ? undefined : formatCapped(stats.activeListings, 500),
      hint:
        stats === undefined ? undefined : `${formatCapped(stats.draftListings, 500)} u nacrtu`,
      href: "/admin/nekretnine?status=published",
    },
    {
      key: "leads",
      label: "Novi upiti (7 dana)",
      value: stats === undefined ? undefined : formatCapped(stats.newLeads7d, 500),
      hint: "Svi kanali, poslednjih 7 dana",
    },
    {
      key: "viewings",
      label: "Razgledanja danas",
      value: stats === undefined ? undefined : formatCapped(stats.viewingsToday, 200),
      hint: "Zakazana za danas",
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
        stats !== undefined && stats.avgFirstResponseMinutes === undefined
          ? "Još nema odgovorenih upita u 7 dana"
          : "Do prvog odgovora, upiti iz 7 dana",
    },
  ];

  return (
    <section aria-labelledby="kpi-heading" data-testid="kpi-cards" aria-busy={stats === undefined}>
      <h2 id="kpi-heading" className="sr-only">
        Ključni pokazatelji
      </h2>
      <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {kpis.map((kpi) => (
          <li key={kpi.key} className="min-w-0">
            {kpi.href !== undefined ? (
              <Link
                href={kpi.href}
                className="group block h-full rounded-xl outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                <KpiCard kpi={kpi} linked />
              </Link>
            ) : (
              <KpiCard kpi={kpi} linked={false} />
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

function KpiCard({ kpi, linked }: { kpi: Kpi; linked: boolean }) {
  return (
    <Card
      className={
        linked
          ? "h-full transition-colors duration-150 group-hover:bg-muted/70"
          : "h-full"
      }
    >
      <CardContent className="relative">
        <p className="pr-6 text-xs font-medium text-muted-foreground">{kpi.label}</p>
        {linked ? (
          <ArrowUpRight
            aria-hidden="true"
            className="absolute top-0 right-(--card-spacing) size-4 text-muted-foreground transition-colors duration-150 group-hover:text-primary"
          />
        ) : null}
        {kpi.value === undefined ? (
          <Skeleton className="mt-2 h-9 w-24" />
        ) : (
          <p className="mt-2 h-9 text-3xl leading-9 font-semibold tracking-tight" data-numeric>
            {kpi.value}
          </p>
        )}
        {kpi.hint === undefined ? (
          <Skeleton className="mt-1.5 h-4 w-28" />
        ) : (
          <p className="mt-1.5 h-4 text-xs leading-4 text-muted-foreground">{kpi.hint}</p>
        )}
      </CardContent>
    </Card>
  );
}
