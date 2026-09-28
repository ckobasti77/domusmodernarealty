"use client";

import { useSyncExternalStore } from "react";

const QUERY = "(prefers-reduced-motion: reduce)";

function subscribe(onChange: () => void) {
  const mql = window.matchMedia(QUERY);
  mql.addEventListener("change", onChange);
  return () => mql.removeEventListener("change", onChange);
}

function getSnapshot() {
  return window.matchMedia(QUERY).matches;
}

/** The server cannot know the preference; assume motion is allowed. */
function getServerSnapshot() {
  return false;
}

/**
 * `true` when the visitor asked for reduced motion, read straight from the
 * media query through `useSyncExternalStore` so there is no state-in-effect
 * round trip and the value is correct on the first client render.
 */
export function useReducedMotion(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

/** Synchronous read for code paths that only ever run in the browser. */
export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia(QUERY).matches;
}
