"use client";

import { useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import Link from "next/link";
import { useState } from "react";
import { DashCard } from "@/components/admin/dashboard/DashCard";
import { formatCount } from "@/components/admin/dashboard/format";
import { StatusBadge } from "@/components/admin/common/StatusBadge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { api } from "@/convex/_generated/api";
import { CappedNote, type Period } from "./shared";

/** A ranked row; `periodLeads` only in the by-leads ranking. */
type Row = FunctionReturnType<typeof api.analytics.topListings>[number] & { periodLeads?: number };
type Ranking = "views" | "leads";

const LIMIT = 10;

/**
 * The ten most viewed listings (all time — views are counted per listing in
 * total) and the ten with the most leads in the chosen period, each linked to
 * its editor.
 */
export function TopListingsCard({ now, period }: { now: number; period: Period }) {
  const [ranking, setRanking] = useState<Ranking>("views");
  const byViews = useQuery(api.analytics.topListings, { limit: LIMIT });
  const byLeads = useQuery(api.analytics.topListingsByLeads, { now, days: period, limit: LIMIT });

  return (
    <DashCard
      title="Najuspešniji oglasi"
      description={
        ranking === "views"
          ? "Po broju pregleda od objave"
          : `Po broju upita u poslednjih ${period} dana`
      }
      data-testid="analytics-top-listings"
    >
      <Tabs value={ranking} onValueChange={(value) => setRanking(value === "leads" ? "leads" : "views")}>
        <TabsList aria-label="Rangiranje">
          <TabsTrigger value="views">Po pregledima</TabsTrigger>
          <TabsTrigger value="leads">Po upitima</TabsTrigger>
        </TabsList>
        <TabsContent value="views" className="mt-2">
          <RankTable rows={byViews} ranking="views" period={period} />
        </TabsContent>
        <TabsContent value="leads" className="mt-2">
          <RankTable rows={byLeads?.rows} ranking="leads" period={period} />
          {byLeads?.capped === true ? (
            <CappedNote>
              U ovom periodu ima više upita nego što se čita odjednom (2.000); rang je izračunat iz najstarijih.
            </CappedNote>
          ) : null}
        </TabsContent>
      </Tabs>
    </DashCard>
  );
}

function RankTable({
  rows,
  ranking,
  period,
}: {
  rows: readonly Row[] | undefined;
  ranking: Ranking;
  period: Period;
}) {
  if (rows === undefined) {
    return (
      <div aria-busy="true" className="space-y-2">
        {Array.from({ length: 5 }, (_, index) => (
          <Skeleton key={index} className="h-9 w-full" />
        ))}
      </div>
    );
  }
  if (rows.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-muted-foreground">
        {ranking === "views"
          ? "Još nema zabeleženih pregleda oglasa."
          : `Nijedan upit u poslednjih ${period} dana nije vezan za oglas.`}
      </p>
    );
  }
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-8 text-right">#</TableHead>
          <TableHead>Nekretnina</TableHead>
          <TableHead className="text-right">Pregledi</TableHead>
          <TableHead className="hidden text-right sm:table-cell">Omiljeno</TableHead>
          <TableHead className="text-right">{ranking === "leads" ? `Upiti (${period} d)` : "Upiti"}</TableHead>
          <TableHead className="hidden text-right sm:table-cell">Razgledanja</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row, index) => (
          <TableRow key={row.listingId}>
            <TableCell className="text-right text-muted-foreground tabular-nums">{index + 1}</TableCell>
            <TableCell className="max-w-0 min-w-40 whitespace-normal">
              <Link
                href={`/admin/nekretnine/${row.listingId}`}
                className="group block rounded-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                <span className="flex items-center gap-2">
                  <span className="font-mono text-xs text-muted-foreground">{row.ref}</span>
                  <StatusBadge status={row.status} />
                </span>
                <span className="block truncate underline decoration-foreground/25 underline-offset-2 transition-colors duration-150 group-hover:decoration-primary">
                  {row.titleSr}
                </span>
              </Link>
            </TableCell>
            <TableCell className="text-right tabular-nums">{formatCount(row.views)}</TableCell>
            <TableCell className="hidden text-right tabular-nums sm:table-cell">{formatCount(row.favorites)}</TableCell>
            <TableCell className="text-right tabular-nums">
              {formatCount(ranking === "leads" ? (row.periodLeads ?? 0) : row.leads)}
            </TableCell>
            <TableCell className="hidden text-right tabular-nums sm:table-cell">{formatCount(row.viewings)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
