import type { SplatFormat } from "@/lib/tours/splat-source";

/** A 360° scene as the public viewer gets it: titles already localized on the server. */
export type TourScene = {
  id: string;
  title: string;
  /** BCP 47 tag of `title` (the Serbian fallback is marked `sr-Latn`). */
  titleLang: string;
  panoUrl: string;
  panoMobileUrl?: string;
  thumbUrl?: string;
  initialView?: { yaw: number; pitch: number };
  links: { to: string; yaw: number; pitch: number }[];
  credit?: string;
};

export type WalkAsset = { url: string; format: SplatFormat; bytes?: number };

export type WalkHotspot = { label: string; lang: string; x: number; z: number; yaw: number };

/** The splat walkthrough as the public viewer gets it. */
export type WalkData = {
  desktop: WalkAsset;
  mobile?: WalkAsset;
  /** Floor point the visitor starts on (world frame, Y up) and the initial heading. */
  spawn: { x: number; y: number; z: number; yaw: number };
  /** Eye height in model units; 1.6 m in a metric scan. */
  eyeHeight: number;
  floorPolygon?: number[][];
  hotspots: WalkHotspot[];
  credits?: string;
  aiGenerated: boolean;
};
