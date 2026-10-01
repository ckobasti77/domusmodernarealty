import { describe, expect, it } from "vitest";
import {
  clampToPolygon,
  closestPointOnPolygon,
  closestPointOnSegment,
  pointInPolygon,
  snapInside,
} from "./floor";

const SQUARE = [
  [0, 0],
  [4, 0],
  [4, 4],
  [0, 4],
];

/** An L-shaped room: the top-right quarter is missing. */
const L_SHAPE = [
  [0, 0],
  [4, 0],
  [4, 2],
  [2, 2],
  [2, 4],
  [0, 4],
];

describe("pointInPolygon", () => {
  it("separates inside from outside", () => {
    expect(pointInPolygon({ x: 2, z: 2 }, SQUARE)).toBe(true);
    expect(pointInPolygon({ x: 5, z: 2 }, SQUARE)).toBe(false);
    expect(pointInPolygon({ x: -0.01, z: 2 }, SQUARE)).toBe(false);
  });

  it("counts points on an edge or a vertex as inside", () => {
    expect(pointInPolygon({ x: 4, z: 1 }, SQUARE)).toBe(true);
    expect(pointInPolygon({ x: 0, z: 0 }, SQUARE)).toBe(true);
  });

  it("handles concave rooms", () => {
    expect(pointInPolygon({ x: 1, z: 3 }, L_SHAPE)).toBe(true);
    expect(pointInPolygon({ x: 3, z: 3 }, L_SHAPE)).toBe(false);
  });
});

describe("closestPointOnSegment / closestPointOnPolygon", () => {
  it("projects onto the segment and clamps to its ends", () => {
    expect(closestPointOnSegment({ x: 2, z: 5 }, { x: 0, z: 0 }, { x: 4, z: 0 })).toEqual({ x: 2, z: 0 });
    expect(closestPointOnSegment({ x: -3, z: 1 }, { x: 0, z: 0 }, { x: 4, z: 0 })).toEqual({ x: 0, z: 0 });
  });

  it("finds the nearest wall of the outline", () => {
    expect(closestPointOnPolygon({ x: 5, z: 1 }, SQUARE)).toEqual({ x: 4, z: 1 });
  });
});

describe("clampToPolygon", () => {
  it("lets moves inside the room through unchanged", () => {
    expect(clampToPolygon({ x: 1, z: 1 }, { x: 2, z: 3 }, SQUARE)).toEqual({ x: 2, z: 3 });
  });

  it("slides along a wall instead of stopping", () => {
    // Walking diagonally into the right wall keeps the motion along it.
    const next = clampToPolygon({ x: 3.9, z: 1 }, { x: 4.3, z: 1.5 }, SQUARE);
    expect(next.x).toBeLessThanOrEqual(4);
    expect(next.x).toBeGreaterThan(3.99);
    expect(next.z).toBeCloseTo(1.5, 2);
    expect(pointInPolygon(next, SQUARE)).toBe(true);
  });

  it("never ends outside the room", () => {
    const from = { x: 1, z: 1 };
    for (const to of [
      { x: 10, z: 10 },
      { x: -5, z: 2 },
      { x: 3, z: 3 }, // the missing quarter of the L
      { x: 2.5, z: 2.5 },
    ]) {
      expect(pointInPolygon(clampToPolygon(from, to, L_SHAPE), L_SHAPE)).toBe(true);
    }
  });

  it("slides around the inner corner of a concave room", () => {
    const next = clampToPolygon({ x: 1.9, z: 3 }, { x: 2.4, z: 3.2 }, L_SHAPE);
    expect(next.x).toBeLessThanOrEqual(2);
    expect(next.z).toBeCloseTo(3.2, 2);
  });

  it("is a no-op without a usable polygon", () => {
    expect(clampToPolygon({ x: 0, z: 0 }, { x: 9, z: 9 }, undefined)).toEqual({ x: 9, z: 9 });
    expect(clampToPolygon({ x: 0, z: 0 }, { x: 9, z: 9 }, [[0, 0], [1, 1]])).toEqual({ x: 9, z: 9 });
  });
});

describe("snapInside", () => {
  it("keeps inside points and pulls outside ones onto the floor", () => {
    expect(snapInside({ x: 1, z: 1 }, SQUARE)).toEqual({ x: 1, z: 1 });
    const snapped = snapInside({ x: 6, z: 2 }, SQUARE);
    expect(pointInPolygon(snapped, SQUARE)).toBe(true);
    expect(snapped.x).toBeCloseTo(4, 2);
  });
});
