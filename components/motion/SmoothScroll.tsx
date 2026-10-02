"use client";

import { ReactLenis, useLenis, type LenisRef } from "lenis/react";
import { usePathname } from "next/navigation";
import { useEffect, useRef, type ReactNode } from "react";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { gsap, ScrollTrigger } from "./gsap";
import { isLenisHeld } from "./lenis-lock";

const OPTIONS = {
  autoRaf: false,
  anchors: true,
  stopInertiaOnNavigate: true,
  lerp: 0.1,
} as const;

/**
 * Creates the root Lenis instance and drives it from GSAP's ticker, so pins and
 * scrubs stay in sync with the smooth scroll. It renders nothing: a root
 * `ReactLenis` publishes its instance through lenis/react's root store, which
 * is what every `useLenis()` below it reads.
 */
function LenisDriver() {
  const lenisRef = useRef<LenisRef>(null);

  useEffect(() => {
    function raf(time: number) {
      lenisRef.current?.lenis?.raf(time * 1000);
    }

    gsap.ticker.add(raf);
    gsap.ticker.lagSmoothing(0);

    return () => {
      gsap.ticker.remove(raf);
      gsap.ticker.lagSmoothing(500, 33);
    };
  }, []);

  const lenis = useLenis(() => ScrollTrigger.update());

  // Safety net: a new route never inherits a stopped scroll. Overlays hold
  // Lenis through `lenis-lock`, so a stop nobody holds any more is a leak
  // (an overlay that stopped it directly and was unmounted mid-way). This runs
  // after the old route's cleanups and before the new route's own effects, so
  // an overlay the new page opens at once still takes its hold afterwards.
  const pathname = usePathname();
  useEffect(() => {
    if (lenis !== undefined && !isLenisHeld()) lenis.start();
  }, [lenis, pathname]);

  return <ReactLenis root options={OPTIONS} ref={lenisRef} />;
}

/**
 * Mounts Lenis for the public site only; under `prefers-reduced-motion: reduce`
 * scrolling stays native.
 *
 * The children always sit at the same position in the tree, beside the driver
 * rather than inside it. The preference is read through `useSyncExternalStore`,
 * whose server snapshot is "motion allowed" — so for a reduced-motion visitor it
 * flips right after hydration, and a wrapper that appeared or disappeared at
 * that moment would unmount and rebuild the entire page.
 */
export function SmoothScroll({ children }: { children: ReactNode }) {
  const reduced = useReducedMotion();

  return (
    <>
      {reduced ? null : <LenisDriver />}
      {children}
    </>
  );
}
