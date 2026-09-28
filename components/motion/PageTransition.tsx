"use client";

import { useRef, type ReactNode } from "react";
import { usePathname } from "@/i18n/navigation";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { DURATION, gsap, useGSAP } from "./gsap";

/**
 * The ink wipe between public routes (DESIGN §6 "Page transitions").
 *
 * Next's App Router has already swapped the tree by the time a new pathname
 * arrives, so this plays the *second* half of the wipe: the panel starts covering
 * the viewport and lifts away, revealing the page that is already mounted. That
 * is the only honest option without blocking navigation, and it reads the same
 * way to a visitor.
 *
 * Under reduced motion nothing is rendered at all — no panel, no timeline.
 */
export function PageTransition({ children }: { children: ReactNode }) {
  const reduced = useReducedMotion();
  const pathname = usePathname();
  const panel = useRef<HTMLDivElement>(null);
  const first = useRef(true);

  useGSAP(
    () => {
      const el = panel.current;
      if (el === null) return;

      // Never wipe on the initial load; the preloader owns that moment.
      if (first.current) {
        first.current = false;
        gsap.set(el, { autoAlpha: 0, yPercent: -100 });
        return;
      }

      gsap.set(el, { autoAlpha: 1, yPercent: 0 });
      gsap.to(el, {
        yPercent: -100,
        duration: DURATION.curtain * 0.55,
        ease: "expo.inOut",
        onComplete: () => {
          gsap.set(el, { autoAlpha: 0 });
        },
      });
    },
    { dependencies: [pathname], revertOnUpdate: false },
  );

  return (
    <>
      {reduced ? null : (
        <div
          ref={panel}
          aria-hidden="true"
          className="pointer-events-none fixed inset-0 z-(--z-curtain) bg-ink opacity-0"
        />
      )}
      {children}
    </>
  );
}
