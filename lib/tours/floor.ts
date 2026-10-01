/**
 * Floor-plan collision for the splat walkthrough (docs/06-3D-TOURS.md): the
 * visitor walks on the floor plane and is kept inside `floorPolygon`, sliding
 * along walls instead of stopping dead. Coordinates are world x/z.
 */

export type Vec2 = { x: number; z: number };
export type Polygon = readonly (readonly number[])[];

/** Even-odd ray casting; points exactly on an edge count as inside. */
export function pointInPolygon(point: Vec2, polygon: Polygon): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
    const [xi, zi] = polygon[i];
    const [xj, zj] = polygon[j];
    if (onSegment(point, { x: xi, z: zi }, { x: xj, z: zj })) return true;
    const crosses = zi > point.z !== zj > point.z;
    if (crosses && point.x < ((xj - xi) * (point.z - zi)) / (zj - zi) + xi) inside = !inside;
  }
  return inside;
}

function onSegment(p: Vec2, a: Vec2, b: Vec2): boolean {
  const cross = (b.x - a.x) * (p.z - a.z) - (b.z - a.z) * (p.x - a.x);
  if (Math.abs(cross) > 1e-9) return false;
  return (
    p.x >= Math.min(a.x, b.x) - 1e-9 &&
    p.x <= Math.max(a.x, b.x) + 1e-9 &&
    p.z >= Math.min(a.z, b.z) - 1e-9 &&
    p.z <= Math.max(a.z, b.z) + 1e-9
  );
}

/** The point of segment a–b nearest to p. */
export function closestPointOnSegment(p: Vec2, a: Vec2, b: Vec2): Vec2 {
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  const lengthSq = dx * dx + dz * dz;
  if (lengthSq === 0) return { x: a.x, z: a.z };
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.z - a.z) * dz) / lengthSq));
  return { x: a.x + t * dx, z: a.z + t * dz };
}

/** The point on the polygon's outline nearest to p. */
export function closestPointOnPolygon(p: Vec2, polygon: Polygon): Vec2 {
  let best: Vec2 = { x: polygon[0][0], z: polygon[0][1] };
  let bestDistance = Number.POSITIVE_INFINITY;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
    const candidate = closestPointOnSegment(
      p,
      { x: polygon[j][0], z: polygon[j][1] },
      { x: polygon[i][0], z: polygon[i][1] },
    );
    const distance = (candidate.x - p.x) ** 2 + (candidate.z - p.z) ** 2;
    if (distance < bestDistance) {
      bestDistance = distance;
      best = candidate;
    }
  }
  return best;
}

/** Arithmetic mean of the vertices: a stable "inward" reference for nudging. */
function centroid(polygon: Polygon): Vec2 {
  let x = 0;
  let z = 0;
  for (const [px, pz] of polygon) {
    x += px;
    z += pz;
  }
  return { x: x / polygon.length, z: z / polygon.length };
}

const NUDGE = 1e-3;

/**
 * Moves from `from` toward `to` without leaving the polygon. A step that would
 * cross a wall is projected onto it, so the motion along the wall survives
 * (wall sliding). Without a usable polygon the move is free.
 */
export function clampToPolygon(from: Vec2, to: Vec2, polygon: Polygon | undefined): Vec2 {
  if (polygon === undefined || polygon.length < 3) return to;
  if (pointInPolygon(to, polygon)) return to;

  const onWall = closestPointOnPolygon(to, polygon);
  // Step a hair back inside, toward where we came from (or the middle of the room).
  const anchor = pointInPolygon(from, polygon) ? from : centroid(polygon);
  const dx = anchor.x - onWall.x;
  const dz = anchor.z - onWall.z;
  const length = Math.hypot(dx, dz);
  const slid =
    length > 0 ? { x: onWall.x + (dx / length) * NUDGE, z: onWall.z + (dz / length) * NUDGE } : onWall;
  if (pointInPolygon(slid, polygon)) return slid;
  return pointInPolygon(from, polygon) ? from : onWall;
}

/** The nearest walkable point: `p` itself when inside, else the closest point on the outline. */
export function snapInside(p: Vec2, polygon: Polygon | undefined): Vec2 {
  if (polygon === undefined || polygon.length < 3 || pointInPolygon(p, polygon)) return p;
  return clampToPolygon(centroid(polygon), p, polygon);
}
