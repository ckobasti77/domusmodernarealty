import type { MediaItem } from "@/convex/lib/validators";

/** The two media collections of a listing (`media.*` mutations call it `target`). */
export type MediaTarget = "gallery" | "floorPlans";

/** Mirrors the server limits in `convex/media.ts`. */
export const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/avif"] as const;
export const ACCEPT_ATTR = ACCEPTED_TYPES.join(",");
export const MAX_FILE_BYTES = 20 * 1024 * 1024;
export const MAX_FILES = 60;

/** Publish checklist minimum and the recommendation from the PRD. */
export const MIN_PHOTOS = 5;

/** Below this many pixels on the long side a photo looks soft in the public lightbox. */
export const MIN_LONG_SIDE = 1600;

export const ALT_MAX = 160;

/** Serbian nouns per collection, with the three plural forms `Intl.PluralRules("sr")` returns. */
export const NOUNS: Record<MediaTarget, { one: string; few: string; other: string }> = {
  gallery: { one: "fotografija", few: "fotografije", other: "fotografija" },
  floorPlans: { one: "tlocrt", few: "tlocrta", other: "tlocrta" },
};

const pluralRules = new Intl.PluralRules("sr-Latn");

/** `one | few | other` for a Serbian count (1 fotografija, 2 fotografije, 5 fotografija, 21 fotografija). */
export function pluralForm(count: number): "one" | "few" | "other" {
  const rule = pluralRules.select(count);
  return rule === "one" || rule === "few" ? rule : "other";
}

export function countNoun(count: number, target: MediaTarget): string {
  return `${count} ${NOUNS[target][pluralForm(count)]}`;
}

/** Server order, independent of how the array happens to be stored. */
export function sortByOrder(items: readonly MediaItem[]): MediaItem[] {
  return [...items].sort((a, b) => a.order - b.order);
}

/** True when the image is known to be smaller than {@link MIN_LONG_SIDE} on its long side. */
export function isLowRes(w: number | undefined, h: number | undefined): boolean {
  if (w === undefined || h === undefined) return false;
  return Math.max(w, h) < MIN_LONG_SIDE;
}

const mbFormat = new Intl.NumberFormat("sr-Latn", { maximumFractionDigits: 1 });

export function formatMb(bytes: number): string {
  return `${mbFormat.format(bytes / 1_048_576)} MB`;
}

/**
 * A lighter thumbnail for remote demo photos (Unsplash accepts resize params);
 * Convex storage URLs are served as uploaded.
 */
export function thumbUrl(url: string): string {
  try {
    const parsed = new URL(url);
    if (parsed.hostname !== "images.unsplash.com") return url;
    parsed.searchParams.set("w", "640");
    parsed.searchParams.set("q", "70");
    parsed.searchParams.set("auto", "format");
    parsed.searchParams.set("fit", "crop");
    return parsed.toString();
  } catch {
    return url;
  }
}
