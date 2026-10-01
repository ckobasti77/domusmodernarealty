"use client";

import { usePaginatedQuery } from "convex/react";
import type { FunctionArgs } from "convex/server";
import { Loader2 } from "lucide-react";
import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { formatDateTime, formatRelative } from "@/lib/admin/format";
import { LEAD_TYPE_LABEL } from "@/lib/admin/labels";
import { formatCount } from "@/lib/format";
import { cn } from "@/lib/utils";
import { DemoTag, LeadStatusBadge, NextActionDate, ResponseTimer } from "./cells";
import type { LeadRow } from "./shared";

export type ListArgs = Omit<FunctionArgs<typeof api.leadsAdmin.list>, "paginationOpts">;

const PAGE_SIZE = 25;
/**
 * Filters the server applies after reading a page can leave it short. Top the
 * first screen up to PAGE_SIZE rows, but stop after this many extra pages so
 * a filter that matches nothing does not walk the whole table.
 */
const MAX_AUTO_LOADS = 6;
const SKELETON_ROWS = 8;

/** Keep the previous rows on screen while a new filter's first page loads. */
function useHeldWhileLoading<T>(value: T, loading: boolean): T {
  const [held, setHeld] = useState(value);
  if (!loading && held !== value) setHeld(value);
  return loading ? held : value;
}

export function LeadsList({
  args,
  now,
  showAgent,
  phone,
  onOpen,
  empty,
}: {
  args: ListArgs | "skip";
  now: number;
  showAgent: boolean;
  phone: boolean;
  onOpen: (id: Id<"leads">) => void;
  empty: (partial: boolean) => ReactNode;
}) {
  const { results, status, loadMore } = usePaginatedQuery(api.leadsAdmin.list, args, {
    initialNumItems: PAGE_SIZE,
  });
  const argsKey = JSON.stringify(args);

  const autoLoads = useRef({ key: "", count: 0 });
  useLayoutEffect(() => {
    if (status !== "CanLoadMore" || results.length >= PAGE_SIZE) return;
    if (autoLoads.current.key !== argsKey) autoLoads.current = { key: argsKey, count: 0 };
    if (autoLoads.current.count >= MAX_AUTO_LOADS) return;
    autoLoads.current.count += 1;
    loadMore(PAGE_SIZE);
  }, [status, results.length, argsKey, loadMore]);

  const waiting = status === "LoadingFirstPage" || (status === "LoadingMore" && results.length === 0);
  const rows = useHeldWhileLoading(results, waiting);
  const loading = (waiting || args === "skip") && rows.length === 0;
  const refreshing = waiting && rows.length > 0;
  const canLoadMore = status === "CanLoadMore" || status === "LoadingMore";
  const emptyNode = empty(status === "CanLoadMore");

  return (
    <>
      {phone ? (
        <PhoneList rows={rows} loading={loading} refreshing={refreshing} now={now} onOpen={onOpen} empty={emptyNode} />
      ) : (
        <Table
          rows={rows}
          loading={loading}
          refreshing={refreshing}
          now={now}
          showAgent={showAgent}
          onOpen={onOpen}
          empty={emptyNode}
        />
      )}
      {!loading && (rows.length > 0 || canLoadMore) ? (
        <div className="flex flex-wrap items-center justify-between gap-2 border-t px-3 py-2 text-sm text-muted-foreground">
          <p className="tabular-nums" aria-live="polite">
            Prikazano {formatCount(rows.length, "sr-Latn")}
            {status === "Exhausted" ? "" : " (ima još)"}
          </p>
          {canLoadMore ? (
            <Button
              variant="outline"
              size="sm"
              disabled={status === "LoadingMore"}
              onClick={() => loadMore(PAGE_SIZE)}
            >
              {status === "LoadingMore" ? <Loader2 className="animate-spin" aria-hidden="true" /> : null}
              {status === "LoadingMore" ? "Učitavanje…" : "Učitaj još"}
            </Button>
          ) : null}
        </div>
      ) : null}
    </>
  );
}

function ContactLines({ row }: { row: LeadRow }) {
  const line = [row.contactEmail, row.contactPhone].filter((item) => item !== undefined).join(" · ");
  return line.length > 0 ? <span className="block truncate text-xs text-muted-foreground">{line}</span> : null;
}

function Received({ at, now }: { at: number; now: number }) {
  return (
    <time dateTime={new Date(at).toISOString()} title={formatDateTime(at)} className="text-xs whitespace-nowrap text-muted-foreground">
      {formatRelative(at, now)}
    </time>
  );
}

function Response({ row, now }: { row: LeadRow; now: number }) {
  if (row.firstResponseAt !== undefined) {
    return <span className="text-xs text-muted-foreground">Odgovoreno</span>;
  }
  return <ResponseTimer createdAt={row.createdAt} firstResponseAt={undefined} now={now} />;
}

const HEAD = "h-9 text-xs font-medium text-muted-foreground";

function Table({
  rows,
  loading,
  refreshing,
  now,
  showAgent,
  onOpen,
  empty,
}: {
  rows: LeadRow[];
  loading: boolean;
  refreshing: boolean;
  now: number;
  showAgent: boolean;
  onOpen: (id: Id<"leads">) => void;
  empty: ReactNode;
}) {
  const columns = showAgent ? 8 : 7;
  return (
    <div
      role="region"
      aria-label="Tabela upita"
      tabIndex={0}
      className="relative overflow-auto outline-none focus-visible:ring-3 focus-visible:ring-ring/50 md:max-h-[max(20rem,calc(100svh-19rem))]"
    >
      <table
        data-testid="leads-table"
        aria-busy={loading || refreshing}
        className={cn(
          "w-full min-w-[900px] table-fixed caption-bottom text-sm transition-opacity duration-150",
          refreshing && "opacity-60",
        )}
      >
        <caption className="sr-only">Upiti, najnoviji prvi. Otvorite upit klikom na ime kontakta.</caption>
        <TableHeader className="sticky top-0 z-10 bg-card shadow-[inset_0_-1px_0_var(--border)] [&_tr]:border-b-0">
          <TableRow className="hover:bg-transparent">
            <TableHead scope="col" className={HEAD}>Kontakt</TableHead>
            <TableHead scope="col" className={cn(HEAD, "w-24")}>Vrsta</TableHead>
            <TableHead scope="col" className={cn(HEAD, "w-24")}>Nekretnina</TableHead>
            {showAgent ? <TableHead scope="col" className={cn(HEAD, "w-32")}>Agent</TableHead> : null}
            <TableHead scope="col" className={cn(HEAD, "w-28")}>Faza</TableHead>
            <TableHead scope="col" className={cn(HEAD, "w-28")}>Primljen</TableHead>
            <TableHead scope="col" className={cn(HEAD, "w-36")}>Odgovor</TableHead>
            <TableHead scope="col" className={cn(HEAD, "w-28")}>Sledeći korak</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading
            ? Array.from({ length: SKELETON_ROWS }, (_, index) => (
                <TableRow key={`skeleton-${index}`} className="h-14 hover:bg-transparent" aria-hidden="true">
                  {Array.from({ length: columns }, (_unused, cell) => (
                    <TableCell key={cell}>
                      <Skeleton className="h-4 w-full min-w-6" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            : null}
          {!loading && rows.length === 0 ? (
            <TableRow className="hover:bg-transparent">
              <TableCell colSpan={columns} className="h-48 text-center whitespace-normal">
                {empty}
              </TableCell>
            </TableRow>
          ) : null}
          {!loading
            ? rows.map((row) => (
                <TableRow
                  key={row._id}
                  data-testid="lead-row"
                  data-lead-id={row._id}
                  data-status={row.status}
                  className="h-14 cursor-pointer"
                  onClick={(event) => {
                    // Links and buttons inside the row keep their own action.
                    if (event.target instanceof Element && event.target.closest("a,button") !== null) return;
                    onOpen(row._id);
                  }}
                >
                  <TableCell className="py-1.5">
                    <div className="flex min-w-0 items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => onOpen(row._id)}
                        className="min-w-0 truncate rounded-sm text-left font-medium outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
                      >
                        {row.contactName}
                      </button>
                      {row.isDemo ? <DemoTag /> : null}
                    </div>
                    <ContactLines row={row} />
                  </TableCell>
                  <TableCell className="text-xs">{LEAD_TYPE_LABEL[row.type]}</TableCell>
                  <TableCell className="font-mono text-xs">{row.listingRef ?? <span className="text-muted-foreground">—</span>}</TableCell>
                  {showAgent ? (
                    <TableCell className="truncate text-xs">
                      {row.agentName ?? <span className="text-muted-foreground">Bez agenta</span>}
                    </TableCell>
                  ) : null}
                  <TableCell>
                    <LeadStatusBadge status={row.status} />
                  </TableCell>
                  <TableCell>
                    <Received at={row.createdAt} now={now} />
                  </TableCell>
                  <TableCell>
                    <Response row={row} now={now} />
                  </TableCell>
                  <TableCell>
                    <NextActionDate at={row.nextActionAt} now={now} />
                  </TableCell>
                </TableRow>
              ))
            : null}
        </TableBody>
      </table>
    </div>
  );
}

function PhoneList({
  rows,
  loading,
  refreshing,
  now,
  onOpen,
  empty,
}: {
  rows: LeadRow[];
  loading: boolean;
  refreshing: boolean;
  now: number;
  onOpen: (id: Id<"leads">) => void;
  empty: ReactNode;
}) {
  if (loading) {
    return (
      <ul aria-busy="true" aria-label="Upiti se učitavaju" className="divide-y">
        {Array.from({ length: 6 }, (_, index) => (
          <li key={index} className="space-y-2 px-3 py-3">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-3 w-56" />
            <Skeleton className="h-3 w-24" />
          </li>
        ))}
      </ul>
    );
  }
  if (rows.length === 0) return <div className="px-4 py-10 text-center">{empty}</div>;
  return (
    <ul aria-label="Upiti" aria-busy={refreshing} className={cn("divide-y transition-opacity duration-150", refreshing && "opacity-60")}>
      {rows.map((row) => (
        <li key={row._id} data-testid="lead-row" data-lead-id={row._id} data-status={row.status}>
          <button
            type="button"
            onClick={() => onOpen(row._id)}
            className="flex w-full flex-col gap-1 px-3 py-3 text-left transition-colors duration-150 outline-none hover:bg-muted/50 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:ring-inset active:bg-muted"
          >
            <span className="flex w-full items-center justify-between gap-2">
              <span className="flex min-w-0 items-center gap-1.5">
                <span className="truncate text-sm font-medium">{row.contactName}</span>
                {row.isDemo ? <DemoTag /> : null}
              </span>
              <LeadStatusBadge status={row.status} />
            </span>
            <span className="text-xs text-muted-foreground">
              {LEAD_TYPE_LABEL[row.type]}
              {row.listingRef !== undefined ? <span className="font-mono">{` · ${row.listingRef}`}</span> : null}
              {row.agentName !== undefined ? ` · ${row.agentName}` : null}
            </span>
            <span className="flex w-full items-center justify-between gap-2">
              <Response row={row} now={now} />
              <Received at={row.createdAt} now={now} />
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}
