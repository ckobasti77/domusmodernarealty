"use client";

import { ChevronRight, Video } from "lucide-react";
import { cn } from "@/lib/utils";
import { ViewingStatusBadge } from "./status";
import { DAY_MS, formatSpan, longDayLabel, wallOf } from "./time";
import type { CalendarDay, ViewingRow } from "./types";

/**
 * The calendar on a phone: the visible day (or week) as a time-ordered list
 * grouped by day. A 7-column grid is unreadable at 390 px; this keeps the same
 * events, test ids and detail sheet.
 */
export function AgendaList({
  days,
  rows,
  todayKey,
  showAgent,
  stale,
  onOpen,
}: {
  days: CalendarDay[];
  rows: ViewingRow[];
  todayKey: string;
  showAgent: boolean;
  stale: boolean;
  onOpen: (id: string) => void;
}) {
  const sorted = [...rows].sort((a, b) => a.start - b.start);
  const groups = days.map((day) => ({
    day,
    items: sorted.filter((row) => {
      const wall = wallOf(row.start);
      return wall >= day.wall && wall < day.wall + DAY_MS;
    }),
  }));
  // A single day always shows, even empty; a week lists only its busy days.
  const shown = days.length === 1 ? groups : groups.filter((group) => group.items.length > 0);

  if (shown.length === 0) {
    return (
      <p className="rounded-xl border border-dashed px-4 py-10 text-center text-sm text-muted-foreground">
        Nema razgledanja u ovoj nedelji.
      </p>
    );
  }

  return (
    <div className={cn("space-y-5 transition-opacity duration-150", stale && "opacity-60")} aria-busy={stale}>
      {shown.map(({ day, items }) => (
        <section key={day.key} aria-labelledby={`agenda-${day.key}`}>
          <h2 id={`agenda-${day.key}`} className="mb-2 text-sm font-semibold">
            {longDayLabel(day.wall)}
            {day.key === todayKey ? <span className="ml-2 text-xs font-medium text-muted-foreground">danas</span> : null}
          </h2>
          {items.length === 0 ? (
            <p className="rounded-xl border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
              Nema razgledanja ovog dana.
            </p>
          ) : (
            <ul className="divide-y rounded-xl border bg-card">
              {items.map((row) => (
                <li key={row._id}>
                  <button
                    type="button"
                    data-testid="viewing-event"
                    data-viewing-id={row._id}
                    data-status={row.status}
                    onClick={() => onOpen(row._id)}
                    className="flex min-h-11 w-full items-center gap-3 px-3 py-3 text-left transition-colors duration-150 outline-none hover:bg-muted/50 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:ring-inset active:bg-muted"
                  >
                    <span
                      className={cn(
                        "w-24 shrink-0 text-sm font-semibold tabular-nums",
                        row.status === "cancelled" && "text-muted-foreground line-through",
                      )}
                    >
                      {formatSpan(row.start, row.end)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2">
                        <ViewingStatusBadge status={row.status} />
                        {row.mode === "video" ? (
                          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                            <Video className="size-3.5" aria-hidden="true" />
                            Video
                          </span>
                        ) : null}
                      </span>
                      <span className="mt-1 block truncate text-sm">
                        <span className="font-mono text-xs">{row.listingRef}</span>
                        {row.contactName !== undefined ? ` · ${row.contactName}` : ""}
                      </span>
                      {showAgent ? (
                        <span className="block truncate text-xs text-muted-foreground">{row.agentName}</span>
                      ) : null}
                    </span>
                    <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      ))}
    </div>
  );
}
