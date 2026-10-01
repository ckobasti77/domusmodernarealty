"use client";

import { useQuery } from "convex/react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { pluralSr } from "@/components/admin/dashboard/format";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { AgendaList } from "./AgendaList";
import { CalendarGrid } from "./CalendarGrid";
import {
  DAY_MS,
  dayKeyOfWall,
  instantOf,
  longDayLabel,
  minutesIntoDay,
  mondayOf,
  wallOfDayKey,
  wallMidnightOf,
  weekRangeLabel,
} from "./time";
import type { CalendarDay, ViewingRow } from "./types";

/**
 * While the next week loads, keep the previous one on screen (dimmed)
 * instead of flashing a skeleton on every "next".
 */
function useHeld<T>(value: T | undefined): { value: T | undefined; stale: boolean } {
  const [held, setHeld] = useState(value);
  if (value !== undefined && value !== held) setHeld(value);
  return { value: value ?? held, stale: value === undefined && held !== undefined };
}

function countLabel(count: number): string {
  return `${count} ${pluralSr(count, "razgledanje", "razgledanja")}`;
}

/**
 * Week and day calendar. The visible Belgrade days are turned into absolute
 * instants here (DST-safe: each day's bounds are its own local midnights) and
 * sent to `viewingsAdmin.range`, which pins agents to their own viewings.
 */
export function CalendarView({
  view,
  dateKey,
  agentId,
  now,
  phone,
  showAgent,
  onDateChange,
  onOpen,
}: {
  view: "week" | "day";
  /** The `?date=` value; anything invalid falls back to today. */
  dateKey: string | undefined;
  agentId: Id<"agents"> | undefined;
  now: number;
  phone: boolean;
  showAgent: boolean;
  onDateChange: (key: string | undefined) => void;
  onOpen: (id: string) => void;
}) {
  const todayWall = wallMidnightOf(now);
  const todayKey = dayKeyOfWall(todayWall);
  const anchor = wallOfDayKey(dateKey) ?? todayWall;
  const firstWall = view === "week" ? mondayOf(anchor) : anchor;
  const days: CalendarDay[] = Array.from({ length: view === "week" ? 7 : 1 }, (_, index) => {
    const wall = firstWall + index * DAY_MS;
    return { key: dayKeyOfWall(wall), wall };
  });
  const from = instantOf(firstWall);
  const to = instantOf(firstWall + days.length * DAY_MS);

  const data = useQuery(api.viewingsAdmin.range, {
    from,
    to,
    ...(agentId !== undefined ? { agentId } : {}),
  });
  const { value: rows, stale } = useHeld<ViewingRow[]>(data);

  const step = view === "week" ? 7 : 1;
  const shift = (direction: -1 | 1) => {
    const next = dayKeyOfWall(anchor + direction * step * DAY_MS);
    onDateChange(next === todayKey ? undefined : next);
  };
  const showsToday = days.some((day) => day.key === todayKey);
  const title = view === "week" ? weekRangeLabel(firstWall) : longDayLabel(firstWall);
  const visible = rows?.filter((row) => row.end > from && row.start < to).length;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1" role="group" aria-label="Kretanje kroz kalendar">
          <Button
            variant="outline"
            size="icon"
            onClick={() => shift(-1)}
            aria-label={view === "week" ? "Prethodna nedelja" : "Prethodni dan"}
          >
            <ChevronLeft aria-hidden="true" />
          </Button>
          <Button variant="outline" onClick={() => onDateChange(undefined)} disabled={showsToday}>
            Danas
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={() => shift(1)}
            aria-label={view === "week" ? "Sledeća nedelja" : "Sledeći dan"}
          >
            <ChevronRight aria-hidden="true" />
          </Button>
        </div>
        <h2 className="text-base font-semibold" aria-live="polite">
          {title}
        </h2>
        <p className="ml-auto text-sm text-muted-foreground tabular-nums" aria-live="polite">
          {visible === undefined ? "Učitavanje…" : visible === 0 ? "Nema razgledanja" : countLabel(visible)}
        </p>
      </div>

      {rows === undefined ? (
        <Skeleton className="h-[32rem] w-full rounded-xl" />
      ) : phone ? (
        <AgendaList
          days={days}
          rows={rows}
          todayKey={todayKey}
          showAgent={showAgent}
          stale={stale}
          onOpen={onOpen}
        />
      ) : (
        <CalendarGrid
          days={days}
          rows={rows}
          todayKey={todayKey}
          nowMinutes={minutesIntoDay(now)}
          showAgent={showAgent}
          stale={stale}
          onOpen={onOpen}
        />
      )}
    </div>
  );
}
