"use client";

import { useEffect, useId, useState, type PointerEvent } from "react";
import { formatShortDay } from "@/lib/admin/format";
import { cn } from "@/lib/utils";
import { formatCount, pluralSr } from "./format";
import { CHART_HEIGHT, dayTicks, niceMax, type ChartDay } from "./series";

/*
 * Small multiples on one shared day axis: views (area + line) on top, leads
 * (columns) below, each on its own y scale — two measures of very different
 * size, and never a dual-axis chart. Hand-written SVG: no chart library.
 * Days before the first rollup row are not data: they are drawn as a stone
 * hairline on the baseline, and bronze starts where the record does. The axis
 * is 30 days, or shorter while the record is (see `chartWindow`).
 */
const LEFT = 40;
const RIGHT = 16;
const VIEWS_TOP = 24;
const VIEWS_BOTTOM = 172;
const LEADS_TOP = 206;
const LEADS_BOTTOM = 254;
const AXIS_LABEL_Y = 272;

/** Rendered width of an element, tracked with ResizeObserver. */
function useWidth(node: HTMLElement | null): number {
  const [width, setWidth] = useState(0);
  useEffect(() => {
    if (node === null) return;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry !== undefined) setWidth(Math.floor(entry.contentRect.width));
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, [node]);
  return width;
}

/** A column with 4px rounded data-end and a square foot on the baseline. */
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

function crisp(y: number): number {
  return Math.round(y) + 0.5;
}

export function ViewsLeadsChart({ days }: { days: ChartDay[] }) {
  const [node, setNode] = useState<HTMLDivElement | null>(null);
  const width = useWidth(node);
  const [active, setActive] = useState<number | null>(null);
  const titleId = useId();
  const descId = useId();

  const count = days.length;
  const peakViews = Math.max(0, ...days.map((day) => day.views));
  const peakLeads = Math.max(0, ...days.map((day) => day.leads));
  const maxViews = niceMax(peakViews);
  const maxLeads = niceMax(peakLeads);
  const plotWidth = Math.max(0, width - LEFT - RIGHT);
  const step = count > 0 ? plotWidth / count : 0;
  // Slender at any axis length: a short record's wide days keep 16px columns.
  const barWidth = Math.max(2, Math.min(16, step * 0.6, step - 2));

  const xAt = (index: number) => LEFT + step * (index + 0.5);
  const yViews = (value: number) => VIEWS_BOTTOM - (value / maxViews) * (VIEWS_BOTTOM - VIEWS_TOP);
  const leadHeight = (value: number) => (value / maxLeads) * (LEADS_BOTTOM - LEADS_TOP);

  const first = Math.max(0, days.findIndex((day) => day.recorded));
  const line = days
    .slice(first)
    .map((day, offset) => {
      const index = first + offset;
      return `${offset === 0 ? "M" : "L"}${xAt(index).toFixed(1)},${yViews(day.views).toFixed(1)}`;
    })
    .join(" ");
  const area =
    count > first
      ? `${line} L${xAt(count - 1).toFixed(1)},${VIEWS_BOTTOM} L${xAt(first).toFixed(1)},${VIEWS_BOTTOM} Z`
      : "";

  const viewTicks = [0, maxViews, ...(Number.isInteger(maxViews / 2) && maxViews > 1 ? [maxViews / 2] : [])];
  const leadTicks = [0, maxLeads];
  const ticks = dayTicks(count, width < 420 ? 3 : 5);

  const totalViews = days.reduce((sum, day) => sum + day.views, 0);
  const totalLeads = days.reduce((sum, day) => sum + day.leads, 0);
  const peakDay = days.find((day) => day.views === peakViews && peakViews > 0);
  const firstDay = days[first];
  const last = days[count - 1];
  const summary =
    firstDay !== undefined && last !== undefined
      ? `${formatShortDay(firstDay.ms)} – ${formatShortDay(last.ms)}: ukupno ${formatCount(totalViews)} ${pluralSr(totalViews, "pregled", "pregleda")} i ${formatCount(totalLeads)} ${pluralSr(totalLeads, "upit", "upita")}.${
          peakDay !== undefined
            ? ` Najviše pregleda ${formatShortDay(peakDay.ms)} (${formatCount(peakDay.views)}).`
            : ""
        }`
      : "";

  function pick(event: PointerEvent<SVGRectElement>) {
    if (step <= 0) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    const index = Math.floor((event.clientX - bounds.left) / step);
    setActive(Math.min(count - 1, Math.max(0, index)));
  }

  const activeDay = active !== null ? days[active] : undefined;
  const activeX = active !== null ? xAt(active) : 0;

  return (
    <div
      ref={setNode}
      className="relative animate-in duration-200 fade-in motion-reduce:animate-none"
      style={{ height: CHART_HEIGHT }}
    >
      {width > 0 ? (
        <svg
          width={width}
          height={CHART_HEIGHT}
          role="img"
          aria-labelledby={`${titleId} ${descId}`}
          className="block text-[11px]"
        >
          <title id={titleId}>Pregledi i upiti po danu</title>
          <desc id={descId}>{summary}</desc>

          {/* Panel labels */}
          <text x={LEFT} y={VIEWS_TOP - 10} className="fill-muted-foreground font-medium">
            Pregledi
          </text>
          <text x={LEFT} y={LEADS_TOP - 10} className="fill-muted-foreground font-medium">
            Upiti
          </text>

          {/* Gridlines + y ticks */}
          {viewTicks.map((tick) => (
            <g key={`v${tick}`}>
              <line
                x1={LEFT}
                x2={width - RIGHT}
                y1={crisp(yViews(tick))}
                y2={crisp(yViews(tick))}
                className="stroke-border"
                shapeRendering="crispEdges"
              />
              <text
                x={LEFT - 8}
                y={yViews(tick)}
                textAnchor="end"
                dominantBaseline="middle"
                className="fill-muted-foreground tabular-nums"
              >
                {formatCount(tick)}
              </text>
            </g>
          ))}
          {leadTicks.map((tick) => (
            <g key={`l${tick}`}>
              <line
                x1={LEFT}
                x2={width - RIGHT}
                y1={crisp(LEADS_BOTTOM - leadHeight(tick))}
                y2={crisp(LEADS_BOTTOM - leadHeight(tick))}
                className="stroke-border"
                shapeRendering="crispEdges"
              />
              <text
                x={LEFT - 8}
                y={LEADS_BOTTOM - leadHeight(tick)}
                textAnchor="end"
                dominantBaseline="middle"
                className="fill-muted-foreground tabular-nums"
              >
                {formatCount(tick)}
              </text>
            </g>
          ))}

          {/* Before the first recorded day: a stone hairline, not a zero line */}
          {first > 0 ? (
            <g aria-hidden="true" className="stroke-chart-3" strokeWidth={1} shapeRendering="crispEdges">
              <line x1={xAt(0)} x2={xAt(first)} y1={crisp(VIEWS_BOTTOM)} y2={crisp(VIEWS_BOTTOM)} />
              <line x1={xAt(0)} x2={xAt(first)} y1={crisp(LEADS_BOTTOM)} y2={crisp(LEADS_BOTTOM)} />
            </g>
          ) : null}

          {/* Views: a 15% wash under a 2px line */}
          <path d={area} className="fill-chart-1/15" />
          <path
            d={line}
            fill="none"
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
            className="stroke-chart-2 dark:stroke-chart-1"
          />

          {/* Leads: one column per day */}
          {days.map((day, index) => {
            if (day.leads <= 0) return null;
            const height = leadHeight(day.leads);
            return (
              <path
                key={day.day}
                d={columnPath(xAt(index) - barWidth / 2, LEADS_BOTTOM - height, barWidth, height)}
                className={cn("fill-chart-4", active !== null && active !== index && "opacity-50")}
              />
            );
          })}

          {/* Shared day axis */}
          {ticks.map((index) => {
            const day = days[index];
            if (day === undefined) return null;
            return (
              <text
                key={day.day}
                x={xAt(index)}
                y={AXIS_LABEL_Y}
                textAnchor="middle"
                className="fill-muted-foreground tabular-nums"
              >
                {formatShortDay(day.ms)}
              </text>
            );
          })}

          {/* Hover layer: crosshair + marker */}
          {activeDay !== undefined ? (
            <g aria-hidden="true">
              <line
                x1={activeX}
                x2={activeX}
                y1={VIEWS_TOP}
                y2={LEADS_BOTTOM}
                strokeWidth={1}
                className="stroke-foreground/30"
              />
              {activeDay.recorded ? (
                <circle
                  cx={activeX}
                  cy={yViews(activeDay.views)}
                  r={4}
                  strokeWidth={2}
                  className="fill-chart-2 stroke-card dark:fill-chart-1"
                />
              ) : null}
            </g>
          ) : null}
          <rect
            x={LEFT}
            y={VIEWS_TOP}
            width={plotWidth}
            height={LEADS_BOTTOM - VIEWS_TOP}
            fill="transparent"
            onPointerMove={pick}
            onPointerDown={pick}
            onPointerLeave={() => setActive(null)}
          />
        </svg>
      ) : null}

      {activeDay !== undefined ? (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute z-10 min-w-32 rounded-md border bg-popover px-2.5 py-2 text-xs text-popover-foreground shadow-sm"
          style={{
            top: VIEWS_TOP,
            left: activeX,
            transform: activeX > width / 2 ? "translateX(calc(-100% - 12px))" : "translateX(12px)",
          }}
        >
          <p className="font-medium">{formatShortDay(activeDay.ms)}</p>
          {activeDay.recorded ? (
            <>
              <p className="mt-1 flex items-center justify-between gap-3">
                <span className="flex items-center gap-1.5 text-muted-foreground">
                  <span className="h-0.5 w-3 rounded-full bg-chart-2 dark:bg-chart-1" />
                  Pregledi
                </span>
                <span data-numeric>{formatCount(activeDay.views)}</span>
              </p>
              <p className="mt-0.5 flex items-center justify-between gap-3">
                <span className="flex items-center gap-1.5 text-muted-foreground">
                  <span className="size-2 rounded-[2px] bg-chart-4" />
                  Upiti
                </span>
                <span data-numeric>{formatCount(activeDay.leads)}</span>
              </p>
            </>
          ) : (
            <p className="mt-1 text-muted-foreground">Nema podataka za ovaj dan</p>
          )}
        </div>
      ) : null}

      <div className="sr-only">
      <table>
        <caption>Pregledi i upiti po danu</caption>
        <thead>
          <tr>
            <th scope="col">Dan</th>
            <th scope="col">Pregledi</th>
            <th scope="col">Upiti</th>
          </tr>
        </thead>
        <tbody>
          {days.map((day) => (
            <tr key={day.day}>
              <th scope="row">{formatShortDay(day.ms)}</th>
              <td>{day.recorded ? formatCount(day.views) : "nema podataka"}</td>
              <td>{day.recorded ? formatCount(day.leads) : "nema podataka"}</td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>
    </div>
  );
}
