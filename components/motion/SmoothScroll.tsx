"use client";

import { ReactLenis, useLenis, type LenisRef } from "lenis/react";
import { useEffect, useRef, type ReactNode } from "react";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { gsap, ScrollTrigger } from "./gsap";

const OPTIONS = {
  autoRaf: false,
  anchors: true,
  stopInertiaOnNavigate: true,
  lerp: 0.1,
} as const;

function LenisRoot({ children }: { children: ReactNode }) {
  const lenisRef = useRef<LenisRef>(null);

  // One raf source: GSAP's ticker drives Lenis, so pins and scrubs stay in sync.
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

  useLenis(() => ScrollTrigger.update());

  return (
    <ReactLenis root options={OPTIONS} ref={lenisRef}>
      {children}
    </ReactLenis>
  );
}

/**
 * Mounts Lenis for the public site only. Under `prefers-reduced-motion: reduce`
 * nothing is mounted at all, so scrolling stays native. The preference is read
 * through `useSyncExternalStore`, so the correct branch is chosen on the first
 * client render instead of mounting and then tearing Lenis down.
 */
export function SmoothScroll({ children }: { children: ReactNode }) {
  const reduced = useReducedMotion();

  if (reduced) return <>{children}</>;
  return <LenisRoot>{children}</LenisRoot>;
}
