import manifest from "./media-manifest.json";

/**
 * Typed reader for `lib/media-manifest.json`, which `npm run media:optimize`
 * writes from whatever is in `media-src/`.
 *
 * The manifest is the contract between the owner's asset folder and the site:
 * drop `hero.mp4` into `media-src/`, re-run the script, and the hero switches
 * from a still to a video with no code change. Every accessor returns `null`
 * for a key that was never optimized, so a half-delivered asset set degrades to
 * the next-best treatment instead of a broken `<source>`.
 */

export type MediaImage = {
  key: string;
  kind: "image";
  width: number;
  height: number;
  fallback: string;
  blurDataURL: string;
  variants: { width: number; format: "avif" | "webp"; src: string }[];
};

export type MediaVideo = {
  key: string;
  kind: "video";
  width: number;
  height: number;
  poster: string;
  blurDataURL: string;
  sources: { type: string; src: string }[];
  /** 720p MP4 for phones and data-saver connections. */
  mobileSrc?: string;
};

export type MediaItem = MediaImage | MediaVideo;

const ITEMS = manifest.items as Record<string, MediaItem | undefined>;

/** The optimized image for `key`, or `null` if it was never delivered. */
export function mediaImage(key: string): MediaImage | null {
  const item = ITEMS[key];
  return item !== undefined && item.kind === "image" ? item : null;
}

/** The optimized video for `key`, or `null` if it was never delivered. */
export function mediaVideo(key: string): MediaVideo | null {
  const item = ITEMS[key];
  return item !== undefined && item.kind === "video" ? item : null;
}

/**
 * `srcSet` for a `<source>` element, newest format first. `next/image` is not
 * used for these: they are static art direction, not user uploads, and the
 * optimizer has already produced exactly the two widths the layout asks for.
 */
export function mediaSrcSet(image: MediaImage, format: "avif" | "webp"): string {
  return image.variants
    .filter((variant) => variant.format === format)
    .map((variant) => `${variant.src} ${variant.width}w`)
    .join(", ");
}
