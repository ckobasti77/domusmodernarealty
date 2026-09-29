/**
 * The hero's two art directions. The 9:16 render serves phones AND tablets
 * held upright: centre-cropping the 16:9 master to 3:4 put a full-height
 * window mullion through the headline. `LANDSCAPE` is the exact complement of
 * `PORTRAIT`, so every viewport matches one of them and never both.
 */
export const PORTRAIT = "(max-width: 767px), (max-width: 1023px) and (orientation: portrait)";
export const LANDSCAPE = "(min-width: 1024px), (min-width: 768px) and (orientation: landscape)";

/**
 * Verified demo photographs shot in hard noon light (the Pobednik monument,
 * the Kalemegdan aerial). The standard grade cannot pull them close enough to
 * the owner's warm renders, so they get the stronger one.
 */
const HARD_DAYLIGHT = ["photo-1632343084107", "photo-1632343084054"];

export function photoGrade(src: string): "photo-grade" | "photo-grade-strong" {
  return HARD_DAYLIGHT.some((id) => src.includes(id)) ? "photo-grade-strong" : "photo-grade";
}
