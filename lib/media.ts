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
 * optimizer has already produced exactly the widths the layout asks for.
 */
export function mediaSrcSet(image: MediaImage, format: "avif" | "webp"): string {
  return image.variants
    .filter((variant) => variant.format === format)
    .map((variant) => `${variant.src} ${variant.width}w`)
    .join(", ");
}

/**
 * What an art-directed `<picture>` renders, whichever pipeline produced the
 * pixels: the owner's optimized renders (typed AVIF/WebP sources) or a verified
 * remote photo (one `srcSet` on the `<img>`, the CDN negotiates the format).
 */
export type ResponsiveImage = {
  width: number;
  height: number;
  /** `<img src>`, a format every browser decodes. */
  src: string;
  /** Typed `<source>` sets, best format first. */
  sources: { type: "image/avif" | "image/webp"; srcSet: string }[];
  /** `srcSet` on the `<img>` itself, for remote images without typed sources. */
  srcSet?: string;
};

export function responsiveImage(image: MediaImage): ResponsiveImage {
  const sources: ResponsiveImage["sources"] = [];
  for (const format of ["avif", "webp"] as const) {
    const srcSet = mediaSrcSet(image, format);
    if (srcSet.length > 0) sources.push({ type: `image/${format}`, srcSet });
  }
  return { width: image.width, height: image.height, src: image.fallback, sources };
}

const REMOTE_WIDTHS = [640, 1280, 1920, 2560] as const;

/**
 * A verified Unsplash photo (`docs/assets/demo-media.json`) as a responsive
 * image. `base` must be a URL from that list — never an invented one.
 */
export function remoteResponsiveImage(base: string, width: number, height: number): ResponsiveImage {
  const at = (w: number) => `${base}?w=${w}&q=80&auto=format&fit=crop`;
  return {
    width,
    height,
    src: at(1920),
    sources: [],
    srcSet: REMOTE_WIDTHS.map((w) => `${at(w)} ${w}w`).join(", "),
  };
}
