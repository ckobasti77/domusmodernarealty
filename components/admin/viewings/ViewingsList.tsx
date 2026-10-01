"use client";

import { usePaginatedQuery } from "convex/react";
import { ChevronRight, Video } from "lucide-react";
import { EmptyState, FilterSelect, LoadMore } from "@/components/admin/common/ListToolbar";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import type { ViewingStatus } from "@/convex/lib/validators";
import { VIEWING_MODE_LABEL, VIEWING_STATUS_LABEL } from "@/lib/admin/labels";
import { cn } from "@/lib/utils";
import type { ListWhen } from "./params";
import { VIEWING_STATUS_ORDER, ViewingStatusBadge } from "./status";
import { formatSpan, longDayLabel, wallMidnightOf } from "./time";
import type { ViewingRow } from "./types";

const PAGE_SIZE = 25;
const SKELETON_ROWS = 6;
const STATUS_OPTIONS = VIEWING_STATUS_ORDER.map((value) => ({ value, label: VIEWING_STATUS_LABEL[value] }));

/**
 * Upcoming or past viewings, a page at a time (`viewingsAdmin.list`). Upcoming
 * reads soonest first, past latest first. A table from `md`, a stacked list
 * on a phone.
 */
export function ViewingsList({
  when,
  status,
  agentId,
  now,
  phone,
  showAgent,
  onWhenChange,
  onStatusChange,
  onOpen,
}: {
  when: ListWhen;
  status: ViewingStatus | undefined;
  agentId: Id<"agents"> | undefined;
  /** Fixed for the screen's lifetime: a moving `now` would restart the pagination. */
  now: number;
  phone: boolean;
  showAgent: boolean;
  onWhenChange: (when: ListWhen) => void;
  onStatusChange: (status: ViewingStatus | undefined) => void;
  onOpen: (id: string) => void;
}) {
  const { results, status: pageStatus, loadMore } = usePaginatedQuery(
    api.viewingsAdmin.list,
    {
      when,
      now,
      ...(status !== undefined ? { status } : {}),
      ...(agentId !== undefined ? { agentId } : {}),
    },
    { initialNumItems: PAGE_SIZE },
  );
  const loading = pageStatus === "LoadingFirstPage";

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-3">
        <ToggleGroup
          type="single"
          variant="outline"
          spacing={0}
          value={when}
          aria-label="Razgledanja"
          onValueChange={(next) => {
            if (next === "upcoming" || next === "past") onWhenChange(next);
          }}
        >
          <ToggleGroupItem value="upcoming" className="px-3 max-md:h-11">
            Predstojeća
          </ToggleGroupItem>
          <ToggleGroupItem value="past" className="px-3 max-md:h-11">
            Protekla
          </ToggleGroupItem>
        </ToggleGroup>
        <FilterSelect
          label="Status"
          value={status}
          onChange={onStatusChange}
          options={STATUS_OPTIONS}
          allLabel="Svi statusi"
        />
      </div>

      {loading ? (
        <div aria-busy="true" aria-label="Razgledanja se učitavaju" className="space-y-2 rounded-xl border bg-card p-3">
          {Array.from({ length: SKELETON_ROWS }, (_, index) => (
            <Skeleton key={index} className="h-10 w-full" />
          ))}
        </div>
      ) : results.length === 0 ? (
        <EmptyState
          title={when === "upcoming" ? "Nema predstojećih razgledanja." : "Nema proteklih razgledanja."}
          description={
            status !== undefined
              ? `Nijedno razgledanje sa statusom „${VIEWING_STATUS_LABEL[status]}”.`
              : when === "upcoming"
                ? "Zahtevi sa sajta i razgledanja koja zakažete pojaviće se ovde."
                : undefined
          }
        />
      ) : phone ? (
        <PhoneList rows={results} showAgent={showAgent} onOpen={onOpen} />
      ) : (
        <DesktopTable rows={results} showAgent={showAgent} onOpen={onOpen} />
      )}

      <LoadMore status={pageStatus} shown={results.length} onLoadMore={() => loadMore(PAGE_SIZE)} />
    </div>
  );
}

function DesktopTable({
  rows,
  showAgent,
  onOpen,
}: {
  rows: ViewingRow[];
  showAgent: boolean;
  onOpen: (id: string) => void;
}) {
  return (
    <div className="rounded-xl border bg-card">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="pl-4">Datum i vreme</TableHead>
            <TableHead>Nekretnina</TableHead>
            <TableHead>Kontakt</TableHead>
            {showAgent ? <TableHead>Agent</TableHead> : null}
            <TableHead>Način</TableHead>
            <TableHead className="pr-4">Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow
              key={row._id}
              data-testid="viewing-row"
              data-viewing-id={row._id}
              data-status={row.status}
              className="cursor-pointer"
              onClick={() => onOpen(row._id)}
            >
              <TableCell className="py-2 pl-4">
                {/* The real control; the row click is a mouse shortcut to the same action. */}
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    onOpen(row._id);
                  }}
                  className="rounded-sm text-left outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  <span className="block font-medium">{longDayLabel(wallMidnightOf(row.start))}</span>
                  <span
                    className={cn(
                      "block text-xs text-muted-foreground tabular-nums",
                      row.status === "cancelled" && "line-through",
                    )}
                  >
                    {formatSpan(row.start, row.end)}
                  </span>
                </button>
              </TableCell>
              <TableCell className="max-w-64 py-2">
                <span className="block font-mono text-xs text-muted-foreground">{row.listingRef}</span>
                <span className="block truncate">{row.listingTitleSr}</span>
              </TableCell>
              <TableCell className="py-2">
                {row.contactName !== undefined ? (
                  <>
                    <span className="block">{row.contactName}</span>
                    {row.contactPhone !== undefined ? (
                      <span className="block text-xs text-muted-foreground tabular-nums">{row.contactPhone}</span>
                    ) : null}
                  </>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </TableCell>
              {showAgent ? <TableCell className="py-2">{row.agentName}</TableCell> : null}
              <TableCell className="py-2">{VIEWING_MODE_LABEL[row.mode]}</TableCell>
              <TableCell className="py-2 pr-4">
                <ViewingStatusBadge status={row.status} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function PhoneList({
  rows,
  showAgent,
  onOpen,
}: {
  rows: ViewingRow[];
  showAgent: boolean;
  onOpen: (id: string) => void;
}) {
  return (
    <ul className="divide-y rounded-xl border bg-card" aria-label="Razgledanja">
      {rows.map((row) => (
        <li key={row._id} data-testid="viewing-row" data-viewing-id={row._id} data-status={row.status}>
          <button
            type="button"
            onClick={() => onOpen(row._id)}
            className="flex w-full items-center gap-3 px-3 py-3 text-left transition-colors duration-150 outline-none hover:bg-muted/50 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:ring-inset active:bg-muted"
          >
            <span className="min-w-0 flex-1">
              <span className="flex items-center justify-between gap-2">
                <span className="truncate text-sm font-medium">{longDayLabel(wallMidnightOf(row.start))}</span>
                <ViewingStatusBadge status={row.status} />
              </span>
              <span className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground tabular-nums">
                <span className={cn(row.status === "cancelled" && "line-through")}>
                  {formatSpan(row.start, row.end)}
                </span>
                {row.mode === "video" ? (
                  <span className="inline-flex items-center gap-1">
                    <Video className="size-3.5" aria-hidden="true" />
                    Video
                  </span>
                ) : null}
              </span>
              <span className="mt-1 block truncate text-sm">
                <span className="font-mono text-xs">{row.listingRef}</span>
                {row.contactName !== undefined ? ` · ${row.contactName}` : ""}
              </span>
              {showAgent ? <span className="block truncate text-xs text-muted-foreground">{row.agentName}</span> : null}
            </span>
            <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          </button>
        </li>
      ))}
    </ul>
  );
}
