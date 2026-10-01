"use client";

import { VIEWING_STATUS_LABEL } from "@/lib/admin/labels";
import { cn } from "@/lib/utils";
import { EVENT_SURFACE } from "./status";
import {
  DAY_MS,
  dayMonthLabel,
  formatHm,
  formatSpan,
  hmOfMinutes,
  longDayLabel,
  MINUTE_MS,
  wallOf,
  weekdayShortName,
} from "./time";
import type { CalendarDay, ViewingRow } from "./types";

/** The working day the grid always shows; it grows to fit earlier or later viewings. */
const FIRST_HOUR = 8;
const LAST_HOUR = 21;
/** Blocks shorter than this still get room for one line of text. */
const MIN_BLOCK_MIN = 20;
/** Below this height a block prints one line (time, status, ref). */
const COMPACT_PX = 46;

type Block = {
  row: ViewingRow;
  startMin: number;
  endMin: number;
  lane: number;
  lanes: number;
};

/** Minutes of a viewing inside one Belgrade day, clipped to that day. */
function clipToDay(row: ViewingRow, dayWall: number): { startMin: number; endMin: number } | null {
  const startMin = (wallOf(row.start) - dayWall) / MINUTE_MS;
  const endMin = (wallOf(row.end) - dayWall) / MINUTE_MS;
  if (endMin <= 0 || startMin >= DAY_MS / MINUTE_MS) return null;
  return { startMin: Math.max(0, startMin), endMin: Math.min(DAY_MS / MINUTE_MS, endMin) };
}

/**
 * Side-by-side lanes for overlapping viewings (two agents at 10:00): each
 * cluster of overlapping blocks is split into as many equal columns as it
 * needs at its busiest moment.
 */
function layoutDay(rows: ViewingRow[], dayWall: number): Block[] {
  const items = rows
    .map((row) => {
      const clip = clipToDay(row, dayWall);
      return clip === null ? null : { row, ...clip };
    })
    .filter((item) => item !== null)
    .sort((a, b) => a.startMin - b.startMin || b.endMin - a.endMin);

  const out: Block[] = [];
  let cluster: Block[] = [];
  let laneEnds: number[] = [];
  let clusterEnd = Number.NEGATIVE_INFINITY;
  const flush = () => {
    for (const block of cluster) block.lanes = laneEnds.length;
    cluster = [];
    laneEnds = [];
  };

  for (const item of items) {
    const visualEnd = Math.max(item.endMin, item.startMin + MIN_BLOCK_MIN);
    if (item.startMin >= clusterEnd) {
      flush();
      clusterEnd = Number.NEGATIVE_INFINITY;
    }
    let lane = laneEnds.findIndex((end) => end <= item.startMin);
    if (lane === -1) {
      lane = laneEnds.length;
      laneEnds.push(visualEnd);
    } else {
      laneEnds[lane] = visualEnd;
    }
    const block: Block = { ...item, lane, lanes: 1 };
    cluster.push(block);
    out.push(block);
    clusterEnd = Math.max(clusterEnd, visualEnd);
  }
  flush();
  return out;
}

function eventLabel(row: ViewingRow): string {
  return [
    formatSpan(row.start, row.end),
    row.listingRef,
    row.contactName ?? "bez kontakta",
    row.agentName,
    VIEWING_STATUS_LABEL[row.status],
  ].join(", ");
}

/**
 * Week (7 columns) or day (1 column) calendar: a CSS grid of hour rows with
 * the viewings positioned by their Belgrade start and end. Each day is a list
 * of buttons in time order, so keyboard and screen-reader users move through
 * the week day by day; the geometry is only for the eye.
 */
export function CalendarGrid({
  days,
  rows,
  todayKey,
  nowMinutes,
  showAgent,
  stale,
  onOpen,
}: {
  days: CalendarDay[];
  rows: ViewingRow[];
  todayKey: string;
  /** Minutes after Belgrade midnight now, for the "now" line. */
  nowMinutes: number;
  showAgent: boolean;
  /** New range loading while the previous one stays on screen. */
  stale: boolean;
  onOpen: (id: string) => void;
}) {
  const single = days.length === 1;
  const hourPx = single ? 64 : 56;
  const perMinute = hourPx / 60;

  const laidOut = days.map((day) => ({ day, blocks: layoutDay(rows, day.wall) }));
  let firstHour = FIRST_HOUR;
  let lastHour = LAST_HOUR;
  for (const { blocks } of laidOut) {
    for (const block of blocks) {
      firstHour = Math.min(firstHour, Math.floor(block.startMin / 60));
      lastHour = Math.max(lastHour, Math.ceil(block.endMin / 60));
    }
  }
  const hours = Array.from({ length: lastHour - firstHour }, (_, index) => firstHour + index);
  const bodyHeight = hours.length * hourPx;
  const nowTop = (nowMinutes - firstHour * 60) * perMinute;

  return (
    <div
      className={cn(
        "relative max-h-[min(78svh,56rem)] overflow-auto rounded-xl border bg-card transition-opacity duration-150",
        stale && "opacity-60",
      )}
      aria-busy={stale}
    >
      <div
        className={cn("grid", single ? "min-w-[20rem]" : "min-w-[50rem]")}
        style={{ gridTemplateColumns: `3.5rem repeat(${days.length}, minmax(0, 1fr))` }}
      >
        {/* Header row: sticky while the hours scroll under it. */}
        <div className="sticky top-0 left-0 z-30 border-r border-b bg-card" aria-hidden="true" />
        {days.map((day) => {
          const today = day.key === todayKey;
          return (
            <div
              key={day.key}
              className={cn(
                "sticky top-0 z-20 flex items-baseline gap-1.5 border-b bg-card px-2 py-2 text-sm not-last:border-r",
                today && "text-foreground",
              )}
            >
              <span className="text-xs text-muted-foreground uppercase">{weekdayShortName(day.wall)}</span>
              <span
                className={cn(
                  "tabular-nums",
                  today && "rounded-md bg-primary px-1.5 font-semibold text-primary-foreground",
                )}
              >
                {dayMonthLabel(day.wall)}
              </span>
              {today ? <span className="sr-only">(danas)</span> : null}
            </div>
          );
        })}

        {/* Hour gutter. */}
        <div className="sticky left-0 z-10 border-r bg-card" style={{ height: bodyHeight }} aria-hidden="true">
          {hours.map((hour) => (
            <div
              key={hour}
              className="relative pr-2 text-right text-[11px] text-muted-foreground tabular-nums"
              style={{ height: hourPx }}
            >
              <span className="absolute top-0.5 right-2">{hmOfMinutes(hour * 60)}</span>
            </div>
          ))}
        </div>

        {laidOut.map(({ day, blocks }) => {
          const today = day.key === todayKey;
          return (
            <div
              key={day.key}
              role="group"
              aria-label={`${longDayLabel(day.wall)}${today ? " (danas)" : ""}`}
              className={cn("relative not-last:border-r", today && "bg-muted/50")}
              style={{
                height: bodyHeight,
                backgroundImage: `repeating-linear-gradient(to bottom, var(--border) 0 1px, transparent 1px ${hourPx}px)`,
              }}
            >
              {blocks.length === 0 ? (
                <p className="sr-only">Nema razgledanja.</p>
              ) : (
                <ol aria-label={`Razgledanja: ${blocks.length}`}>
                  {blocks.map((block) => (
                    <EventBlock
                      key={block.row._id}
                      block={block}
                      top={(block.startMin - firstHour * 60) * perMinute}
                      height={Math.max(block.endMin - block.startMin, MIN_BLOCK_MIN) * perMinute}
                      showAgent={showAgent}
                      onOpen={onOpen}
                    />
                  ))}
                </ol>
              )}
              {today && nowTop >= 0 && nowTop <= bodyHeight ? (
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-x-0 z-10 h-0.5 bg-primary"
                  style={{ top: nowTop }}
                >
                  <span className="absolute -top-[3px] -left-1 size-2 rounded-full bg-primary" />
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function EventBlock({
  block,
  top,
  height,
  showAgent,
  onOpen,
}: {
  block: Block;
  top: number;
  height: number;
  showAgent: boolean;
  onOpen: (id: string) => void;
}) {
  const { row } = block;
  const compact = height < COMPACT_PX;
  const cancelled = row.status === "cancelled";
  const width = 100 / block.lanes;
  return (
    <li
      className="absolute px-0.5"
      style={{ top, height, left: `${block.lane * width}%`, width: `${width}%` }}
    >
      <button
        type="button"
        data-testid="viewing-event"
        data-viewing-id={row._id}
        data-status={row.status}
        aria-label={eventLabel(row)}
        onClick={() => onOpen(row._id)}
        className={cn(
          "flex size-full flex-col overflow-hidden rounded-md border border-l-[3px] px-1.5 text-left text-[11px] leading-[14px] transition-[filter] duration-150 outline-none hover:brightness-95 focus-visible:ring-3 focus-visible:ring-ring/60 dark:hover:brightness-125",
          compact ? "justify-center py-0" : "py-1",
          EVENT_SURFACE[row.status],
        )}
      >
        {compact ? (
          <span className="truncate">
            <span className={cn("font-semibold tabular-nums", cancelled && "line-through")}>{formatHm(row.start)}</span>{" "}
            {VIEWING_STATUS_LABEL[row.status]} · <span className="font-mono">{row.listingRef}</span>
          </span>
        ) : (
          <>
            <span className={cn("truncate font-semibold tabular-nums", cancelled && "line-through")}>
              {formatSpan(row.start, row.end)}
            </span>
            {/* Second line, so the status survives when a short block clips the rest. */}
            <span className="truncate font-medium">{VIEWING_STATUS_LABEL[row.status]}</span>
            <span className="truncate">
              <span className="font-mono">{row.listingRef}</span>
              {row.contactName !== undefined ? ` · ${row.contactName}` : ""}
            </span>
            {showAgent ? <span className="truncate opacity-80">{row.agentName}</span> : null}
          </>
        )}
      </button>
    </li>
  );
}
