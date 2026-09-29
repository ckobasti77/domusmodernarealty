import type { ImageLoader } from "next/image";

/**
 * `next/image` loaders for the verified Unsplash demo photographs
 * (`docs/assets/demo-media.json`). Unsplash serves through imgix, which can
 * crop to an aspect at the requested width, so a landscape photo in a portrait
 * frame arrives already portrait: `object-cover` then shows it at 1:1 instead
 * of enlarging a 3:2 source ~1.9x to fill a 4:5 box (what made the landing's
 * cards look soft). `auto=format` negotiates AVIF/WebP on the CDN.
 *
 * Anything else (Convex storage uploads) keeps the default optimizer.
 */

const UNSPLASH = "https://images.unsplash.com/";

export function isUnsplash(src: string): boolean {
  return src.startsWith(UNSPLASH);
}

/** A loader that crops to `heightRatio` (height / width), e.g. 1.25 for 4:5. */
export function unsplashCrop(heightRatio: number): ImageLoader {
  return ({ src, width, quality }) => {
    const [base] = src.split("?");
    const params = new URLSearchParams({
      w: String(width),
      h: String(Math.round(width * heightRatio)),
      fit: "crop",
      crop: "entropy",
      auto: "format",
      q: String(quality ?? 75),
    });
    return `${base}?${params.toString()}`;
  };
}

/** The loader for `src` in a frame of `heightRatio`, or the default optimizer. */
export function frameLoader(src: string, heightRatio: number): ImageLoader | undefined {
  return isUnsplash(src) ? unsplashCrop(heightRatio) : undefined;
}
