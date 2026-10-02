"use client";

import type Lenis from "lenis";
import { useLenis } from "lenis/react";
import { useEffect } from "react";

/**
 * Holds the page's smooth scroll still while an overlay is up (a lightbox, a
 * filter panel, the intro curtain).
 *
 * Holds are counted, so one overlay closing never restarts the scroll under
 * another that is still open, and `SmoothScroll` can tell a forgotten stop from
 * a real one. A hold taken through `useLenisLock` is released when its overlay
 * closes AND when it unmounts: a browser Back unmounts the whole page with the
 * overlay open, and an overlay library's own "closed" callback never runs then.
 */

let holders = 0;

/** True while any overlay holds the page still. */
export function isLenisHeld(): boolean {
  return holders > 0;
}

/**
 * Stops Lenis and returns the release; releasing twice is a no-op. The scroll
 * starts again when the last hold is released.
 */
export function holdLenis(lenis: Lenis): () => void {
  holders += 1;
  lenis.stop();
  let held = true;
  return () => {
    if (!held) return;
    held = false;
    holders -= 1;
    if (holders === 0) lenis.start();
  };
}

/** Holds the page still for as long as `active` is true and the caller is mounted. */
export function useLenisLock(active: boolean): void {
  const lenis = useLenis();
  useEffect(() => {
    if (!active || lenis === undefined) return;
    return holdLenis(lenis);
  }, [active, lenis]);
}
