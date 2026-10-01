"use client";

import { Crosshair, Eraser, Scan, Trash2 } from "lucide-react";
import {
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { useFormContext, useWatch } from "react-hook-form";
import { ConfirmDialog } from "@/components/admin/common/ConfirmDialog";
import { Button } from "@/components/ui/button";
import { TOUR_LIMITS } from "@/convex/lib/tours";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import type { ListingForm } from "@/lib/admin/listing-form";
import { cn } from "@/lib/utils";
import { useFieldError } from "../fields";
import { formatDecimal, formatDegrees, normalizeYaw, roundCoord, toRadians } from "./numbers";
import {
  fitView,
  gridLines,
  gridStep,
  nearestOnSegment,
  viewCenter,
  yawToward,
  yawVector,
  type PlanPoint,
  type PlanView,
} from "./plan-geometry";

const DIRTY = { shouldDirty: true, shouldValidate: true } as const;
/** Rendered width before the first measurement. */
const FALLBACK_PX = 400;
/** Pointer travel (px) that turns a press into a drag. */
const DRAG_SLOP = 4;
const YAW_STEP = toRadians(15);

type Drag =
  | { kind: "vertex"; index: number; point: PlanPoint; moved: boolean }
  | { kind: "spawn"; point: PlanPoint; moved: boolean }
  | { kind: "spawnYaw"; yaw: number; moved: boolean }
  | { kind: "hotspot"; index: number; point: PlanPoint; moved: boolean }
  | { kind: "background"; moved: boolean };

type Press = { pointerId: number; clientX: number; clientY: number; drag: Drag };

function isNum(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function label(point: PlanPoint): string {
  return `x ${formatDecimal(point.x, 2)}, z ${formatDecimal(point.z, 2)}`;
}

/**
 * The grid's view, shared by the floor editor and "Dodaj prostoriju". It fits
 * the content once and then stays put while everything is inside it, so the
 * grid does not jump under the pointer while a room is being drawn; it refits
 * when something leaves it, and on demand (`fit`).
 */
export function usePlanView(): { view: PlanView; fit: () => void } {
  const [polygon, spawn, hotspots] = useWatch<ListingForm, ["walk3d.floorPolygon", "walk3d.spawn", "walk3d.hotspots"]>({
    name: ["walk3d.floorPolygon", "walk3d.spawn", "walk3d.hotspots"],
  });
  const content = planPoints(polygon, spawn, hotspots);
  const [view, setView] = useState<PlanView>(() => fitView(content));
  // Adjusting state while rendering (not in an effect): the fitted view always covers the content, so this settles at once.
  if (!covers(view, content)) setView(fitView(content));
  return { view, fit: () => setView(fitView(content)) };
}

function covers(view: PlanView, points: readonly PlanPoint[]): boolean {
  const margin = view.size * 0.02;
  return points.every(
    (point) =>
      point.x >= view.minX + margin &&
      point.x <= view.minX + view.size - margin &&
      point.z >= view.minZ + margin &&
      point.z <= view.minZ + view.size - margin,
  );
}

function polygonPoints(polygon: ListingForm["walk3d"]["floorPolygon"]): PlanPoint[] {
  return polygon.flatMap(([x, z]) => (isNum(x) && isNum(z) ? [{ x, z }] : []));
}

function planPoints(
  polygon: ListingForm["walk3d"]["floorPolygon"],
  spawn: ListingForm["walk3d"]["spawn"],
  hotspots: ListingForm["walk3d"]["hotspots"],
): PlanPoint[] {
  return [
    ...polygonPoints(polygon),
    ...(isNum(spawn.x) && isNum(spawn.z) ? [{ x: spawn.x, z: spawn.z }] : []),
    ...hotspots.flatMap((spot) => (isNum(spot.x) && isNum(spot.z) ? [{ x: spot.x, z: spot.z }] : [])),
  ];
}

/**
 * The floor polygon drawn top-down on a grid in model units, with the start
 * point and the hotspots on it. Click empty space to add a point (or an edge to
 * insert one), drag points to move them, select one and press Delete to remove
 * it. Every handle is also a keyboard control. Drags are local until the
 * pointer is released, so autosave sees one change per gesture. `view` comes
 * from `usePlanView`.
 */
export function FloorPlanEditor({ view, onFit }: { view: PlanView; onFit: () => void }) {
  const { setValue, getValues } = useFormContext<ListingForm>();
  const [polygon, spawn, hotspots] = useWatch<ListingForm, ["walk3d.floorPolygon", "walk3d.spawn", "walk3d.hotspots"]>({
    name: ["walk3d.floorPolygon", "walk3d.spawn", "walk3d.hotspots"],
  });
  const error = useFieldError("walk3d.floorPolygon");
  const instructionsId = useId();
  const svgRef = useRef<SVGSVGElement>(null);
  const [pxWidth, setPxWidth] = useState(FALLBACK_PX);
  const [press, setPress] = useState<Press | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [focusKey, setFocusKey] = useState<string | null>(null);
  const [hover, setHover] = useState<PlanPoint | null>(null);
  const coarse = useMediaQuery("(pointer: coarse)");

  useEffect(() => {
    const svg = svgRef.current;
    if (svg === null) return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry !== undefined && entry.contentRect.width > 0) setPxWidth(entry.contentRect.width);
    });
    observer.observe(svg);
    return () => observer.disconnect();
  }, []);

  const points = polygonPoints(polygon);
  const spawnPoint = isNum(spawn.x) && isNum(spawn.z) ? { x: spawn.x, z: spawn.z } : null;
  const spawnYaw = isNum(spawn.yaw) ? spawn.yaw : 0;
  const unit = view.size / pxWidth;
  const step = gridStep(view.size);
  const hitRadius = (coarse ? 20 : 11) * unit;
  const selectedIndex = selected !== null && selected < points.length ? selected : null;

  // What is drawn: the committed values with the gesture in progress laid over them.
  const drag = press?.drag ?? null;
  const shownPoints =
    drag?.kind === "vertex" ? points.map((point, index) => (index === drag.index ? drag.point : point)) : points;
  const shownSpawn = drag?.kind === "spawn" ? drag.point : spawnPoint;
  const shownYaw = drag?.kind === "spawnYaw" ? drag.yaw : spawnYaw;
  const shownHotspots = hotspots.map((spot, index) =>
    drag?.kind === "hotspot" && drag.index === index
      ? { ...spot, x: drag.point.x, z: drag.point.z }
      : spot,
  );

  /* ------------------------------------------------------------ commits */

  const commitPolygon = (next: PlanPoint[]) =>
    setValue(
      "walk3d.floorPolygon",
      next.map((point) => [roundCoord(point.x), roundCoord(point.z)]),
      DIRTY,
    );

  const commitSpawn = (patch: { x?: number; z?: number; yaw?: number }) => {
    const current = getValues("walk3d.spawn");
    setValue(
      "walk3d.spawn",
      {
        x: patch.x !== undefined ? roundCoord(patch.x) : current.x,
        y: isNum(current.y) ? current.y : 0,
        z: patch.z !== undefined ? roundCoord(patch.z) : current.z,
        yaw: patch.yaw !== undefined ? Number(normalizeYaw(patch.yaw).toFixed(4)) : isNum(current.yaw) ? current.yaw : 0,
      },
      DIRTY,
    );
  };

  const commitHotspot = (index: number, point: PlanPoint) =>
    setValue(
      "walk3d.hotspots",
      getValues("walk3d.hotspots").map((spot, at) =>
        at === index ? { ...spot, x: roundCoord(point.x), z: roundCoord(point.z) } : spot,
      ),
      DIRTY,
    );

  const removePoint = (index: number) => {
    commitPolygon(points.filter((_, at) => at !== index));
    setSelected(null);
  };

  /* ----------------------------------------------------------- pointers */

  const toPlan = (event: { clientX: number; clientY: number }): PlanPoint | null => {
    const matrix = svgRef.current?.getScreenCTM();
    if (matrix === null || matrix === undefined) return null;
    const point = new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse());
    return { x: point.x, z: point.y };
  };

  const begin = (event: ReactPointerEvent<SVGElement>, next: Drag) => {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    event.stopPropagation();
    svgRef.current?.setPointerCapture(event.pointerId);
    setPress({ pointerId: event.pointerId, clientX: event.clientX, clientY: event.clientY, drag: next });
  };

  const onPointerMove = (event: ReactPointerEvent<SVGSVGElement>) => {
    const at = toPlan(event);
    setHover(at);
    if (press === null || event.pointerId !== press.pointerId || at === null) return;
    const moved =
      press.drag.moved || Math.hypot(event.clientX - press.clientX, event.clientY - press.clientY) > DRAG_SLOP;
    if (!moved) return;
    const current = press.drag;
    const next: Drag =
      current.kind === "vertex"
        ? { ...current, point: at, moved }
        : current.kind === "spawn"
          ? { ...current, point: at, moved }
          : current.kind === "spawnYaw"
            ? { ...current, yaw: spawnPoint !== null ? yawToward(spawnPoint, at) : current.yaw, moved }
            : current.kind === "hotspot"
              ? { ...current, point: at, moved }
              : { kind: "background", moved };
    setPress({ ...press, drag: next });
  };

  const onPointerUp = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (press === null || event.pointerId !== press.pointerId) return;
    const current = press.drag;
    setPress(null);
    switch (current.kind) {
      case "vertex":
        if (current.moved) commitPolygon(points.map((point, index) => (index === current.index ? current.point : point)));
        setSelected(current.index);
        break;
      case "spawn":
        if (current.moved) commitSpawn(current.point);
        break;
      case "spawnYaw":
        if (current.moved) commitSpawn({ yaw: current.yaw });
        break;
      case "hotspot":
        if (current.moved) commitHotspot(current.index, current.point);
        break;
      case "background": {
        const at = toPlan(event);
        if (current.moved || at === null || points.length >= TOUR_LIMITS.floorPoints) break;
        commitPolygon([...points, at]);
        setSelected(points.length);
        break;
      }
    }
  };

  const onEdgeDown = (event: ReactPointerEvent<SVGElement>, index: number) => {
    const at = toPlan(event);
    const a = points[index];
    const b = points[(index + 1) % points.length];
    if (at === null || a === undefined || b === undefined || points.length >= TOUR_LIMITS.floorPoints) return;
    const inserted = nearestOnSegment(at, a, b);
    commitPolygon([...points.slice(0, index + 1), inserted, ...points.slice(index + 1)]);
    setSelected(index + 1);
    begin(event, { kind: "vertex", index: index + 1, point: inserted, moved: false });
  };

  /* ----------------------------------------------------------- keyboard */

  const keyStep = (event: ReactKeyboardEvent) => (event.shiftKey ? step : step / 10);

  const arrowDelta = (event: ReactKeyboardEvent): PlanPoint | null => {
    const amount = keyStep(event);
    switch (event.key) {
      case "ArrowLeft":
        return { x: -amount, z: 0 };
      case "ArrowRight":
        return { x: amount, z: 0 };
      case "ArrowUp":
        return { x: 0, z: -amount };
      case "ArrowDown":
        return { x: 0, z: amount };
      default:
        return null;
    }
  };

  const onVertexKey = (event: ReactKeyboardEvent, index: number) => {
    const point = points[index];
    if (point === undefined) return;
    const delta = arrowDelta(event);
    if (delta !== null) {
      event.preventDefault();
      commitPolygon(points.map((item, at) => (at === index ? { x: item.x + delta.x, z: item.z + delta.z } : item)));
      setSelected(index);
    } else if (event.key === "Delete" || event.key === "Backspace") {
      event.preventDefault();
      removePoint(index);
    } else if (event.key === "Escape") {
      setSelected(null);
    }
  };

  const onSpawnKey = (event: ReactKeyboardEvent) => {
    if (spawnPoint === null) return;
    const delta = arrowDelta(event);
    if (delta !== null) {
      event.preventDefault();
      commitSpawn({ x: spawnPoint.x + delta.x, z: spawnPoint.z + delta.z });
    } else if (event.code === "BracketLeft" || event.code === "BracketRight") {
      event.preventDefault();
      commitSpawn({ yaw: spawnYaw + (event.code === "BracketLeft" ? YAW_STEP : -YAW_STEP) });
    }
  };

  const onHotspotKey = (event: ReactKeyboardEvent, index: number) => {
    const spot = hotspots[index];
    const delta = arrowDelta(event);
    if (spot === undefined || delta === null || !isNum(spot.x) || !isNum(spot.z)) return;
    event.preventDefault();
    commitHotspot(index, { x: spot.x + delta.x, z: spot.z + delta.z });
  };

  /* -------------------------------------------------------------- draw */

  const focusProps = (key: string, onFocus?: () => void) => ({
    tabIndex: 0,
    role: "button",
    "aria-roledescription": "tačka koja se pomera",
    "aria-describedby": instructionsId,
    onFocus: () => {
      setFocusKey(key);
      onFocus?.();
    },
    onBlur: () => setFocusKey((current) => (current === key ? null : current)),
    className: "cursor-grab touch-none outline-none active:cursor-grabbing",
  });

  const xLines = gridLines(view.minX, view.size, step);
  const zLines = gridLines(view.minZ, view.size, step);
  const labelEvery = xLines.length > 8 ? 2 : 1;
  const fontSize = 10 * unit;
  const arrowLength = 26 * unit;
  const spawnTip =
    shownSpawn !== null
      ? { x: shownSpawn.x + yawVector(shownYaw).x * arrowLength, z: shownSpawn.z + yawVector(shownYaw).z * arrowLength }
      : null;
  const closed = shownPoints.length >= 3;
  const pathPoints = shownPoints.map((point) => `${point.x},${point.z}`).join(" ");

  return (
    <div className="flex min-w-0 flex-col gap-3" data-testid="floor-plan-editor">
      <p id={instructionsId} className="text-xs leading-relaxed text-muted-foreground">
        Kliknite na prazno polje da dodate tačku, ili na ivicu da umetnete tačku između dve postojeće. Tačke i početnu
        tačku prevucite mišem ili prstom. Sa tastature: Tab bira tačku, strelice je pomeraju (Shift za veći korak),
        Delete je uklanja; tasteri [ i ] okreću smer pogleda početne tačke.
      </p>
      <div className="grid gap-3 @2xl:grid-cols-[minmax(0,28rem)_minmax(0,1fr)] @2xl:items-start @5xl:grid-cols-[minmax(0,32rem)_minmax(0,1fr)]">
        <div className="relative w-full max-w-[32rem]">
          <svg
            ref={svgRef}
            viewBox={`${view.minX} ${view.minZ} ${view.size} ${view.size}`}
            role="group"
            aria-label={`Tlocrt poda odozgo: ${points.length} tačaka${spawnPoint !== null ? ", sa početnom tačkom" : ""}`}
            className="block aspect-square w-full touch-pan-y rounded-lg border bg-background select-none"
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={() => setPress(null)}
            onPointerLeave={() => setHover(null)}
          >
            <rect
              x={view.minX}
              y={view.minZ}
              width={view.size}
              height={view.size}
              className="fill-transparent"
              onPointerDown={(event) => begin(event, { kind: "background", moved: false })}
            />
            <g aria-hidden="true" className="pointer-events-none">
              {xLines.map((x) => (
                <line
                  key={`x${x}`}
                  x1={x}
                  x2={x}
                  y1={view.minZ}
                  y2={view.minZ + view.size}
                  strokeWidth={unit}
                  className={Math.abs(x) < step / 2 ? "stroke-muted-foreground/60" : "stroke-border"}
                />
              ))}
              {zLines.map((z) => (
                <line
                  key={`z${z}`}
                  y1={z}
                  y2={z}
                  x1={view.minX}
                  x2={view.minX + view.size}
                  strokeWidth={unit}
                  className={Math.abs(z) < step / 2 ? "stroke-muted-foreground/60" : "stroke-border"}
                />
              ))}
              {xLines.map((x, index) =>
                index % labelEvery === 0 && x < view.minX + view.size - 16 * unit ? (
                  <text
                    key={`xl${x}`}
                    x={x + 2 * unit}
                    y={view.minZ + view.size - 3 * unit}
                    fontSize={fontSize}
                    className="fill-muted-foreground tabular-nums"
                  >
                    {formatDecimal(x, 2)}
                  </text>
                ) : null,
              )}
              {zLines.map((z, index) =>
                index % labelEvery === 0 && z > view.minZ + 14 * unit && z < view.minZ + view.size - 16 * unit ? (
                  <text
                    key={`zl${z}`}
                    x={view.minX + 3 * unit}
                    y={z - 2 * unit}
                    fontSize={fontSize}
                    className="fill-muted-foreground tabular-nums"
                  >
                    {formatDecimal(z, 2)}
                  </text>
                ) : null,
              )}
            </g>

            {closed ? (
              <polygon
                points={pathPoints}
                strokeWidth={2 * unit}
                strokeLinejoin="round"
                className="pointer-events-none fill-primary/15 stroke-primary"
              />
            ) : shownPoints.length === 2 ? (
              <polyline points={pathPoints} strokeWidth={2 * unit} className="pointer-events-none fill-none stroke-primary" />
            ) : null}

            {/* Edge hit lines: press to insert a point there. */}
            {drag === null && points.length >= 2
              ? points.map((point, index) => {
                  const next = points[(index + 1) % points.length];
                  if (next === undefined || (index === points.length - 1 && points.length < 3)) return null;
                  return (
                    <line
                      key={`e${index}`}
                      x1={point.x}
                      y1={point.z}
                      x2={next.x}
                      y2={next.z}
                      strokeWidth={hitRadius}
                      className="cursor-copy touch-none stroke-transparent"
                      onPointerDown={(event) => onEdgeDown(event, index)}
                    />
                  );
                })
              : null}

            {shownHotspots.map((spot, index) => {
              const sx = spot.x;
              const sz = spot.z;
              if (!isNum(sx) || !isNum(sz)) return null;
              const key = `h${index}`;
              const yaw = isNum(spot.yaw) ? spot.yaw : 0;
              const tip = { x: sx + yawVector(yaw).x * 16 * unit, z: sz + yawVector(yaw).z * 16 * unit };
              const name = spot.label.sr.trim() || `Prostorija ${index + 1}`;
              return (
                <g
                  key={key}
                  {...focusProps(key)}
                  aria-label={`Prostorija za skok ${index + 1}, ${name}: ${label({ x: sx, z: sz })}`}
                  onPointerDown={(event) => begin(event, { kind: "hotspot", index, point: { x: sx, z: sz }, moved: false })}
                  onKeyDown={(event) => onHotspotKey(event, index)}
                >
                  <circle cx={sx} cy={sz} r={hitRadius} className="fill-transparent" />
                  <line
                    x1={sx}
                    y1={sz}
                    x2={tip.x}
                    y2={tip.z}
                    strokeWidth={2 * unit}
                    strokeLinecap="round"
                    className="pointer-events-none stroke-amber-600"
                  />
                  <rect
                    x={sx - 6 * unit}
                    y={sz - 6 * unit}
                    width={12 * unit}
                    height={12 * unit}
                    transform={`rotate(45 ${sx} ${sz})`}
                    strokeWidth={1.5 * unit}
                    className="fill-amber-600 stroke-background"
                  />
                  <text
                    x={sx + 9 * unit}
                    y={sz - 7 * unit}
                    fontSize={fontSize * 1.1}
                    className="pointer-events-none fill-amber-800 font-semibold dark:fill-amber-300"
                  >
                    {index + 1}
                  </text>
                  {focusKey === key ? (
                    <circle cx={sx} cy={sz} r={12 * unit} strokeWidth={2 * unit} strokeDasharray={`${3 * unit}`} className="fill-none stroke-ring" />
                  ) : null}
                </g>
              );
            })}

            {shownPoints.map((point, index) => {
              const key = `v${index}`;
              const isSelected = selectedIndex === index;
              return (
                <g
                  key={key}
                  {...focusProps(key, () => setSelected(index))}
                  aria-label={`Tačka ${index + 1} od ${shownPoints.length}: ${label(point)}`}
                  aria-pressed={isSelected}
                  data-testid="floor-point"
                  onPointerDown={(event) => {
                    setSelected(index);
                    begin(event, { kind: "vertex", index, point, moved: false });
                  }}
                  onKeyDown={(event) => onVertexKey(event, index)}
                >
                  <circle cx={point.x} cy={point.z} r={hitRadius} className="fill-transparent" />
                  <circle
                    cx={point.x}
                    cy={point.z}
                    r={(isSelected ? 6 : 4.5) * unit}
                    strokeWidth={2 * unit}
                    className={cn("stroke-primary", isSelected ? "fill-primary" : "fill-background")}
                  />
                  {isSelected ? (
                    <text
                      x={point.x + 8 * unit}
                      y={point.z - 8 * unit}
                      fontSize={fontSize * 1.1}
                      className="pointer-events-none fill-primary font-semibold"
                    >
                      {index + 1}
                    </text>
                  ) : null}
                  {focusKey === key ? (
                    <circle cx={point.x} cy={point.z} r={10 * unit} strokeWidth={2 * unit} strokeDasharray={`${3 * unit}`} className="fill-none stroke-ring" />
                  ) : null}
                </g>
              );
            })}

            {shownSpawn !== null && spawnTip !== null ? (
              <>
                <line
                  x1={shownSpawn.x}
                  y1={shownSpawn.z}
                  x2={spawnTip.x}
                  y2={spawnTip.z}
                  strokeWidth={2.5 * unit}
                  strokeLinecap="round"
                  className="pointer-events-none stroke-success"
                />
                <g
                  {...focusProps("spawn")}
                  aria-label={`Početna tačka: ${label(shownSpawn)}, smer ${formatDegrees(shownYaw)}°`}
                  data-testid="floor-spawn"
                  onPointerDown={(event) => begin(event, { kind: "spawn", point: shownSpawn, moved: false })}
                  onKeyDown={onSpawnKey}
                >
                  <circle cx={shownSpawn.x} cy={shownSpawn.z} r={hitRadius} className="fill-transparent" />
                  <circle
                    cx={shownSpawn.x}
                    cy={shownSpawn.z}
                    r={7 * unit}
                    strokeWidth={2 * unit}
                    className="fill-success stroke-background"
                  />
                  {focusKey === "spawn" ? (
                    <circle cx={shownSpawn.x} cy={shownSpawn.z} r={12 * unit} strokeWidth={2 * unit} strokeDasharray={`${3 * unit}`} className="fill-none stroke-ring" />
                  ) : null}
                </g>
                {/* Drag the arrow's tip to turn the start direction (keyboard: [ and ]). */}
                <g aria-hidden="true" onPointerDown={(event) => begin(event, { kind: "spawnYaw", yaw: shownYaw, moved: false })} className="cursor-grab touch-none">
                  <circle cx={spawnTip.x} cy={spawnTip.z} r={hitRadius * 0.8} className="fill-transparent" />
                  <circle cx={spawnTip.x} cy={spawnTip.z} r={4 * unit} strokeWidth={2 * unit} className="fill-background stroke-success" />
                </g>
              </>
            ) : null}
          </svg>
          <p aria-hidden="true" className="mt-1 flex flex-wrap justify-between gap-x-3 text-[11px] text-muted-foreground tabular-nums">
            <span>x → desno, z ↓ dole · mreža {formatDecimal(step, 2)} j.</span>
            <span>{hover !== null ? label(hover) : null}</span>
          </p>
        </div>

        <div className="flex min-w-0 flex-col gap-3">
          <ul className="grid gap-1.5 text-xs text-muted-foreground" aria-label="Legenda tlocrta">
            <li className="flex items-center gap-2">
              <span aria-hidden="true" className="size-3 rounded-sm border-2 border-primary bg-primary/15" />
              Pod (tlocrt): {points.length} {points.length === 1 ? "tačka" : points.length >= 2 && points.length <= 4 ? "tačke" : "tačaka"}
            </li>
            <li className="flex items-center gap-2">
              <span aria-hidden="true" className="size-3 rounded-full bg-success" />
              Početna tačka i smer pogleda
            </li>
            <li className="flex items-center gap-2">
              <span aria-hidden="true" className="size-2.5 rotate-45 bg-amber-600" />
              Prostorije za skok (brojevi kao u listi ispod)
            </li>
          </ul>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={selectedIndex === null}
              onClick={() => {
                if (selectedIndex !== null) removePoint(selectedIndex);
              }}
            >
              <Eraser aria-hidden="true" />
              Ukloni tačku{selectedIndex !== null ? ` ${selectedIndex + 1}` : ""}
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={onFit}>
              <Scan aria-hidden="true" />
              Prilagodi prikaz
            </Button>
            {spawnPoint === null ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  const center = viewCenter(view);
                  commitSpawn({ x: center.x, z: center.z, yaw: 0 });
                }}
              >
                <Crosshair aria-hidden="true" />
                Postavi početnu tačku
              </Button>
            ) : null}
            {points.length > 0 ? (
              <ConfirmDialog
                trigger={
                  <Button type="button" variant="ghost" size="sm" className="text-destructive">
                    <Trash2 aria-hidden="true" />
                    Obriši tlocrt
                  </Button>
                }
                title="Obrisati tlocrt poda?"
                description="Sve tačke poligona se uklanjaju. Bez tlocrta se posetilac u 3D šetnji ne zaustavlja na zidovima."
                confirmLabel="Obriši"
                destructive
                onConfirm={() => {
                  commitPolygon([]);
                  setSelected(null);
                }}
              />
            ) : null}
          </div>
          {error !== undefined ? (
            <p role="alert" className="text-xs font-medium text-destructive">
              {error}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
