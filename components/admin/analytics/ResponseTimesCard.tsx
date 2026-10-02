"use client";

import { useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { PHONE_QUERY } from "@/components/admin/common/breakpoints";
import { DashCard } from "@/components/admin/dashboard/DashCard";
import { formatCount, formatDuration } from "@/components/admin/dashboard/format";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCaption, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { api } from "@/convex/_generated/api";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { cn } from "@/lib/utils";
import { CappedNote, formatShare, type Period } from "./shared";

type Result = FunctionReturnType<typeof api.analytics.responseTimes>;
type Row = Result["rows"][number];

/** Share as a short meter plus the number; the number carries the meaning. */
function ShareMeter({ part, whole }: { part: number; whole: number }) {
  const ratio = whole > 0 ? part / whole : 0;
  return (
    <span className="inline-flex items-center justify-end gap-2">
      <span aria-hidden="true" className="hidden h-1.5 w-12 overflow-hidden rounded-full bg-muted lg:block">
        <span className="block h-full rounded-full bg-chart-2 dark:bg-chart-1" style={{ width: `${ratio * 100}%` }} />
      </span>
      <span className="min-w-12 tabular-nums">{formatShare(part, whole)}</span>
    </span>
  );
}

function duration(minutes: number | undefined): string {
  return minutes === undefined ? "—" : formatDuration(minutes);
}

/**
 * First-response times per agent: the time from a lead's arrival to the first
 * move past "Novi". Shares count only leads old enough to have been answered
 * in time (or already answered), so this morning's lead is not a miss yet.
 */
export function ResponseTimesCard({ now, period, className }: { now: number; period: Period; className?: string }) {
  const data = useQuery(api.analytics.responseTimes, { now, days: period });
  const phone = useMediaQuery(PHONE_QUERY);

  return (
    <DashCard
      title="Brzina odgovora na upite"
      description={`Upiti iz poslednjih ${period} dana, po agentu; „bez odgovora” su svi upiti koji još čekaju u statusu Novi`}
      className={className}
      data-testid="analytics-response-times"
    >
      {data === undefined ? (
        <div aria-busy="true" className="space-y-2">
          {Array.from({ length: 4 }, (_, index) => (
            <Skeleton key={index} className="h-9 w-full" />
          ))}
        </div>
      ) : data.rows.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">Još nema agenata ni upita.</p>
      ) : phone ? (
        <PhoneList rows={data.rows} total={data.total} />
      ) : (
        <Table>
          <TableCaption className="sr-only">Brzina odgovora na upite po agentu, poslednjih {period} dana</TableCaption>
          <TableHeader>
            <TableRow>
              <TableHead>Agent</TableHead>
              <TableHead className="text-right">Upiti</TableHead>
              <TableHead className="text-right">Odgovoreno</TableHead>
              <TableHead className="text-right">Medijana</TableHead>
              <TableHead className="text-right">Prosek</TableHead>
              <TableHead className="text-right">U roku od 1 h</TableHead>
              <TableHead className="text-right">U roku od 24 h</TableHead>
              <TableHead className="text-right">Bez odgovora</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.rows.map((row) => (
              <ResponseRow key={row.agentId ?? "unassigned"} row={row} />
            ))}
          </TableBody>
          <TableFooter>
            <ResponseRow row={data.total} strong />
          </TableFooter>
        </Table>
      )}
      {data?.capped === true ? (
        <CappedNote>U ovom periodu ima više od 2.000 upita; vremena su izračunata iz prvih 2.000.</CappedNote>
      ) : null}
      {data?.openCapped === true ? (
        <CappedNote>Više od 1.000 upita čeka odgovor; broj „bez odgovora” je donja granica.</CappedNote>
      ) : null}
    </DashCard>
  );
}

function ResponseRow({ row, strong = false }: { row: Row; strong?: boolean }) {
  return (
    <TableRow className={cn(strong && "font-medium")}>
      <TableCell className="whitespace-normal">{row.name}</TableCell>
      <TableCell className="text-right tabular-nums">{formatCount(row.leads)}</TableCell>
      <TableCell className="text-right tabular-nums">{formatCount(row.responded)}</TableCell>
      <TableCell className="text-right tabular-nums">{duration(row.medianMinutes)}</TableCell>
      <TableCell className="text-right tabular-nums">{duration(row.avgMinutes)}</TableCell>
      <TableCell className="text-right">
        <ShareMeter part={row.within1h} whole={row.eligible1h} />
      </TableCell>
      <TableCell className="text-right">
        <ShareMeter part={row.within24h} whole={row.eligible24h} />
      </TableCell>
      <TableCell className={cn("text-right tabular-nums", row.openUnanswered > 0 && "font-medium")}>
        {formatCount(row.openUnanswered)}
      </TableCell>
    </TableRow>
  );
}

function PhoneList({ rows, total }: { rows: readonly Row[]; total: Row }) {
  return (
    <ul className="divide-y">
      {[...rows, total].map((row, index) => (
        <li key={row.agentId ?? `row-${index}`} className="py-3 first:pt-0 last:pb-0">
          <p className={cn("text-sm", index === rows.length ? "font-semibold" : "font-medium")}>{row.name}</p>
          <dl className="mt-1.5 grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
            <div className="flex justify-between gap-2">
              <dt className="text-muted-foreground">Upiti</dt>
              <dd className="tabular-nums">
                {formatCount(row.responded)} / {formatCount(row.leads)}
              </dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-muted-foreground">Medijana</dt>
              <dd className="tabular-nums">{duration(row.medianMinutes)}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-muted-foreground">U roku od 1 h</dt>
              <dd className="tabular-nums">{formatShare(row.within1h, row.eligible1h)}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-muted-foreground">U roku od 24 h</dt>
              <dd className="tabular-nums">{formatShare(row.within24h, row.eligible24h)}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-muted-foreground">Prosek</dt>
              <dd className="tabular-nums">{duration(row.avgMinutes)}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-muted-foreground">Bez odgovora</dt>
              <dd className="tabular-nums">{formatCount(row.openUnanswered)}</dd>
            </div>
          </dl>
        </li>
      ))}
    </ul>
  );
}
