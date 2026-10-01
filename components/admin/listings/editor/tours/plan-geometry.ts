/**
 * Top-down geometry for the floor editor. The SVG's viewBox is in model units
 * with x to the right and z downward, which is the floor seen from above
 * (world Y up, right-handed). Yaw 0 looks toward −Z (up on screen) and a
 * positive yaw turns left, counter-clockwise on screen, as in the walk viewer.
 */

export type PlanPoint = { x: number; z: number };
export type PlanView = { minX: number; minZ: number; size: number };

/** With nothing drawn yet the grid spans ±6 units. */
const DEFAULT_EXTENT = 6;
const MIN_SIZE = 4;

/** A square view around every point with ~15 % padding (at least one unit). */
export function fitView(points: readonly PlanPoint[]): PlanView {
  if (points.length === 0) return { minX: -DEFAULT_EXTENT, minZ: -DEFAULT_EXTENT, size: DEFAULT_EXTENT * 2 };
  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  for (const point of points) {
    minX = Math.min(minX, point.x);
    maxX = Math.max(maxX, point.x);
    minZ = Math.min(minZ, point.z);
    maxZ = Math.max(maxZ, point.z);
  }
  const span = Math.max(maxX - minX, maxZ - minZ);
  const size = Math.max(span + 2 * Math.max(1, span * 0.15), MIN_SIZE);
  return { minX: (minX + maxX) / 2 - size / 2, minZ: (minZ + maxZ) / 2 - size / 2, size };
}

export function viewCenter(view: PlanView): PlanPoint {
  return { x: view.minX + view.size / 2, z: view.minZ + view.size / 2 };
}

/** A 1-2-5 grid step giving roughly ten lines across the view. */
export function gridStep(size: number): number {
  const raw = size / 10;
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  const normalized = raw / magnitude;
  const nice = normalized < 1.5 ? 1 : normalized < 3.5 ? 2 : normalized < 7.5 ? 5 : 10;
  return nice * magnitude;
}

/** Grid line positions from `min` to `min + size`, on multiples of `step`. */
export function gridLines(min: number, size: number, step: number): number[] {
  const lines: number[] = [];
  for (let value = Math.ceil(min / step) * step; value <= min + size + 1e-9; value += step) {
    lines.push(Math.round(value / step) * step);
  }
  return lines;
}

/** Unit vector of the view direction for a yaw, in plan coordinates. */
export function yawVector(yaw: number): PlanPoint {
  return { x: -Math.sin(yaw), z: -Math.cos(yaw) };
}

/** The yaw that looks from `from` toward `to`. */
export function yawToward(from: PlanPoint, to: PlanPoint): number {
  return Math.atan2(-(to.x - from.x), -(to.z - from.z));
}

/** The point on segment a–b closest to p. */
export function nearestOnSegment(p: PlanPoint, a: PlanPoint, b: PlanPoint): PlanPoint {
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  const lengthSq = dx * dx + dz * dz;
  if (lengthSq === 0) return a;
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.z - a.z) * dz) / lengthSq));
  return { x: a.x + t * dx, z: a.z + t * dz };
}
