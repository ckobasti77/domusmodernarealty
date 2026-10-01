import type { FunctionReturnType } from "convex/server";
import type { api } from "@/convex/_generated/api";
import type { Locale } from "@/i18n/routing";
import { pickL10n } from "@/lib/l10n";
import type { TourScene, WalkData } from "./types";

/**
 * Maps the public Convex tour reads (convex/tours.ts) onto the viewer props:
 * titles localized here on the server (with the Serbian fallback marked by
 * `lang`), dangling links dropped, and walkthrough defaults filled in.
 */

type RawScenes = FunctionReturnType<typeof api.tours.scenes>;
type RawWalk = NonNullable<FunctionReturnType<typeof api.tours.walk3d>>;

export function toTourScenes(raw: RawScenes, locale: Locale): TourScene[] {
  const ids = new Set(raw.map((scene) => scene._id));
  return raw.map((scene) => {
    const title = pickL10n(scene.title, locale);
    return {
      id: scene._id,
      title: title.text,
      titleLang: title.lang,
      panoUrl: scene.panoUrl,
      ...(scene.panoMobileUrl !== undefined ? { panoMobileUrl: scene.panoMobileUrl } : {}),
      ...(scene.thumbUrl !== undefined ? { thumbUrl: scene.thumbUrl } : {}),
      ...(scene.initialView !== undefined ? { initialView: scene.initialView } : {}),
      links: scene.links
        .filter((link) => ids.has(link.toSceneId))
        .map((link) => ({ to: link.toSceneId, yaw: link.yaw ?? 0, pitch: link.pitch ?? 0 })),
      ...(scene.credit !== undefined ? { credit: scene.credit } : {}),
    };
  });
}

/** `null` when there is no desktop model to load. */
export function toWalkData(raw: RawWalk, locale: Locale): WalkData | null {
  if (raw.desktopUrl === undefined || raw.desktopFormat === undefined) return null;
  return {
    desktop: {
      url: raw.desktopUrl,
      format: raw.desktopFormat,
      ...(raw.desktopBytes !== undefined ? { bytes: raw.desktopBytes } : {}),
    },
    ...(raw.mobileUrl !== undefined && raw.mobileFormat !== undefined
      ? {
          mobile: {
            url: raw.mobileUrl,
            format: raw.mobileFormat,
            ...(raw.mobileBytes !== undefined ? { bytes: raw.mobileBytes } : {}),
          },
        }
      : {}),
    spawn: raw.spawn ?? { x: 0, y: 0, z: 0, yaw: 0 },
    eyeHeight: raw.eyeHeight ?? 1.6,
    ...(raw.floorPolygon !== undefined && raw.floorPolygon.length >= 3 ? { floorPolygon: raw.floorPolygon } : {}),
    hotspots: (raw.hotspots ?? []).map((hotspot) => {
      const label = pickL10n(hotspot.label, locale);
      return { label: label.text, lang: label.lang, x: hotspot.x, z: hotspot.z, yaw: hotspot.yaw };
    }),
    ...(raw.credits !== undefined ? { credits: raw.credits } : {}),
    aiGenerated: raw.aiGenerated === true,
  };
}
