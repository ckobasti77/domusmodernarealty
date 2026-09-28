import type { PublicImage } from "@/convex/lib/dto";
import type { RoomTag } from "@/convex/lib/validators";

/**
 * Unsplash serves any width from the same URL through its `w` parameter, so a
 * lightbox slide can offer a real `srcSet` instead of one 1600px file for a
 * phone and a 5K screen alike. Convex storage URLs have one size only.
 */
const UNSPLASH_WIDTHS = [640, 1080, 1600, 2400] as const;

export function isUnsplash(url: string): boolean {
  return url.startsWith("https://images.unsplash.com/");
}

export function unsplashAt(url: string, width: number): string {
  const parsed = new URL(url);
  parsed.searchParams.set("w", String(width));
  parsed.searchParams.set("q", "80");
  parsed.searchParams.set("auto", "format");
  parsed.searchParams.set("fit", "crop");
  return parsed.toString();
}

export function srcSetFor(image: PublicImage): { src: string; width: number; height: number }[] | undefined {
  if (!isUnsplash(image.url)) return undefined;
  const ratio = image.w !== undefined && image.h !== undefined && image.w > 0 ? image.h / image.w : 2 / 3;
  return UNSPLASH_WIDTHS.map((width) => ({
    src: unsplashAt(image.url, width),
    width,
    height: Math.round(width * ratio),
  }));
}

/** Room tags in order of first appearance, for the filter chips. */
export function roomsIn(images: readonly PublicImage[]): RoomTag[] {
  const seen: RoomTag[] = [];
  for (const image of images) {
    if (image.room !== undefined && !seen.includes(image.room)) seen.push(image.room);
  }
  return seen;
}
