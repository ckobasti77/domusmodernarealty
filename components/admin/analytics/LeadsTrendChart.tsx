"use client";

import { useState, type PointerEvent } from "react";
import { formatCount } from "@/components/admin/dashboard/format";
import { niceMax } from "@/components/admin/dashboard/series";
import { cn } from "@/lib/utils";
import { formatShare, useWidth, weekLabel } from "./shared";

/*
 * Weekly leads as columns: the total on top, then one small panel per source
 * (or type) on a shared y scale, so panels compare by height. Identity is the
 * panel's title, never a colour: every series is the same bronze. The running
 * week is drawn at half strength and says so in its tooltip and the legend.
 * Hand-written SVG, no chart library (same house style as the dashboard).
 */

export type Week = { start: number; end: number; partial: boolean };
export type Series = { key: string; label: string; values: number[]; total: number };

export const TOTAL_HEIGHT = 168;
const PANEL_HEIGHT = 72;
const LEFT = 32;
const RIGHT = 8;

/** A column with a 4px rounded data end and a square foot on the baseline. */
function columnPath(x: number, y: number, w: number, h: number): string {
  const r = Math.min(4, w / 2, h);
  return [
    `M${x},${y + h}`,
    `V${y + r}`,
    `A${r},${r} 0 0 1 ${x + r},${y}`,
    `H${x + w - r}`,
    `A${r},${r} 0 0 1 ${x + w},${y + r}`,
    `V${y + h}`,
    "Z",
  ].join(" ");
}

/** `22. 9.` — week starts on the axis. */
const axisDayFmt = new Intl.DateTimeFormat("sr-Latn-RS", { day: "numeric", month: "numeric", timeZone: "Europe/Belgrade" });

function crisp(y: number): number {
  return Math.round(y) + 0.5;
}

function Columns({
  weeks,
  values,
  max,
  height,
  title,
  axis,
}: {
  weeks: readonly Week[];
  values: readonly number[];
  max: number;
  height: number;
  title: string;
  /** Week labels under the plot and y ticks (the big chart only). */
  axis: boolean;
}) {
  const [node, setNode] = useState<HTMLDivElement | null>(null);
  const width = useWidth(node);
  const [active, setActive] = useState<number | null>(null);

  const top = axis ? 12 : 6;
  const bottom = height - (axis ? 22 : 4);
  const left = axis ? LEFT : 4;
  const plotWidth = Math.max(0, width - left - RIGHT);
  const count = weeks.length;
  const step = count > 0 ? plotWidth / count : 0;
  const barWidth = Math.max(3, Math.min(28, step * 0.6));
  const xAt = (index: number) => left + step * (index + 0.5);
  const heightOf = (value: number) => (value / max) * (bottom - top);
  const labelEvery = width < 420 ? Math.ceil(count / 3) : count > 8 ? 2 : 1;

  function pick(event: PointerEvent<SVGRectElement>) {
    if (step <= 0) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    const index = Math.floor((event.clientX - bounds.left) / step);
    setActive(Math.min(count - 1, Math.max(0, index)));
  }

  const activeWeek = active !== null ? weeks[active] : undefined;
  const activeValue = active !== null ? (values[active] ?? 0) : 0;

  return (
    <div ref={setNode} className="relative" style={{ height }}>
      {width > 0 ? (
        <svg width={width} height={height} aria-hidden="true" className="block text-[11px]">
          {(axis ? [0, max] : [0]).map((tick) => (
            <g key={tick}>
              <line
                x1={left}
                x2={width - RIGHT}
                y1={crisp(bottom - heightOf(tick))}
                y2={crisp(bottom - heightOf(tick))}
                className="stroke-border"
                shapeRendering="crispEdges"
              />
              {axis ? (
                <text
                  x={left - 8}
                  y={bottom - heightOf(tick)}
                  textAnchor="end"
                  dominantBaseline="middle"
                  className="fill-muted-foreground tabular-nums"
                >
                  {formatCount(tick)}
                </text>
              ) : null}
            </g>
          ))}
          {values.map((value, index) => {
            const week = weeks[index];
            if (value <= 0 || week === undefined) return null;
            const h = heightOf(value);
            return (
              <path
                key={week.start}
                d={columnPath(xAt(index) - barWidth / 2, bottom - h, barWidth, h)}
                className={cn(
                  "fill-chart-2 dark:fill-chart-1",
                  week.partial && "opacity-45",
                  active !== null && active !== index && "opacity-40",
                )}
              />
            );
          })}
          {axis
            ? weeks.map((week, index) =>
                index % labelEvery === 0 || index === count - 1 ? (
                  <text
                    key={week.start}
                    x={xAt(index)}
                    y={height - 6}
                    textAnchor="middle"
                    className="fill-muted-foreground tabular-nums"
                  >
                    {axisDayFmt.format(week.start)}
                  </text>
                ) : null,
              )
            : null}
          <rect
            x={left}
            y={top}
            width={plotWidth}
            height={bottom - top}
            fill="transparent"
            onPointerMove={pick}
            onPointerDown={pick}
            onPointerLeave={() => setActive(null)}
          />
        </svg>
      ) : null}
      {activeWeek !== undefined && active !== null ? (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute z-10 min-w-36 rounded-md border bg-popover px-2.5 py-2 text-xs text-popover-foreground shadow-sm"
          style={{
            top: 0,
            left: xAt(active),
            transform: xAt(active) > width / 2 ? "translateX(calc(-100% - 12px))" : "translateX(12px)",
          }}
        >
          <p className="font-medium">{weekLabel(activeWeek)}</p>
          <p className="mt-1 flex items-center justify-between gap-3">
            <span className="text-muted-foreground">{title}</span>
            <span className="tabular-nums">{formatCount(activeValue)}</span>
          </p>
        </div>
      ) : null}
    </div>
  );
}

export function LeadsTrendChart({
  weeks,
  totals,
  series,
}: {
  weeks: readonly Week[];
  totals: readonly number[];
  series: readonly Series[];
}) {
  const totalMax = niceMax(Math.max(0, ...totals));
  const panelMax = niceMax(Math.max(0, ...series.flatMap((item) => item.values)));
  const grand = totals.reduce((sum, value) => sum + value, 0);

  return (
    <div className="animate-in duration-200 fade-in motion-reduce:animate-none">
      <p className="mb-1 text-xs font-medium text-muted-foreground">Ukupno po nedelji</p>
      <Columns weeks={weeks} values={totals} max={totalMax} height={TOTAL_HEIGHT} title="Upiti" axis />
      <p className="mt-5 mb-2 text-xs text-muted-foreground">
        Po kategoriji, ista skala za sve (do {formatCount(panelMax)} upita nedeljno)
      </p>
      <ul className="grid gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
        {series.map((item) => (
          <li key={item.key} className="min-w-0">
            <p className="flex items-baseline justify-between gap-2 text-sm">
              <span className="truncate font-medium">{item.label}</span>
              <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                {formatCount(item.total)} · {formatShare(item.total, grand)}
              </span>
            </p>
            <Columns weeks={weeks} values={item.values} max={panelMax} height={PANEL_HEIGHT} title={item.label} axis={false} />
          </li>
        ))}
      </ul>
    </div>
  );
}
