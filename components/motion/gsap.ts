"use client";

import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { CustomEase } from "gsap/CustomEase";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { SplitText } from "gsap/SplitText";

/**
 * Single GSAP registration point for the public site. Importing this module
 * anywhere registers the plugins exactly once (ES modules are evaluated once)
 * and defines the brand ease. Only the plugins the site uses are registered:
 * every one of them ships in the JavaScript of every public page.
 *
 * Never import this from `app/admin/**` — the admin uses CSS transitions only
 * (see the motion house rule in CLAUDE.md).
 */
gsap.registerPlugin(useGSAP, ScrollTrigger, SplitText, CustomEase);

/** "estate" mirrors --ease-estate in globals.css: cubic-bezier(.22,1,.36,1). */
if (!CustomEase.get("estate")) {
  CustomEase.create("estate", "M0,0 C0.22,1 0.36,1 1,1");
}

/** Project-wide defaults: slow, confident, transform-only. */
gsap.defaults({ ease: "estate", duration: 1 });

export { gsap, ScrollTrigger, SplitText, CustomEase, useGSAP };

/** Durations from DESIGN 6 "Motion rules", in seconds. */
export const DURATION = {
  reveal: 1.1,
  revealFast: 0.9,
  revealSlow: 1.4,
  ui: 0.28,
  curtain: 1.1,
} as const;

/** Stagger amounts from DESIGN 6. */
export const STAGGER = {
  tight: 0.04,
  lines: 0.08,
  cards: 0.1,
} as const;

/** The media queries every scroll-choreographed component branches on. */
export const MOTION_QUERIES = {
  desktop: "(min-width: 1024px) and (prefers-reduced-motion: no-preference)",
  mobile: "(max-width: 1023px) and (prefers-reduced-motion: no-preference)",
  reduced: "(prefers-reduced-motion: reduce)",
} as const;

/**
 * `contextSafe` (the second argument of a `useGSAP` or `matchMedia` callback)
 * with the wrapped function's signature preserved — GSAP types the result as a
 * bare `Function`. Anything a wrapped function creates later (in an event
 * handler, a timer, a promise) is recorded in that context and reverted with it.
 */
export function contextSafeFn<A extends unknown[]>(
  contextSafe: gsap.ContextSafeFunc | undefined,
  fn: (...args: A) => void,
): (...args: A) => void {
  return contextSafe === undefined ? fn : (contextSafe(fn) as (...args: A) => void);
}
