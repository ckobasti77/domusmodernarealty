"use client";

import { useRef } from "react";
import { cn } from "@/lib/utils";
import { gsap, MOTION_QUERIES, useGSAP } from "./gsap";

/**
 * A 1px bronze hairline that fills as the document scrolls. Purely an indicator,
 * so it carries `role="presentation"` — a progressbar role would be announced on
 * every scroll tick with no useful value.
 *
 * `scaleX` is driven by one scrubbed ScrollTrigger over the whole body, which is
 * cheaper than a scroll listener and stays in sync with Lenis because Lenis and
 * ScrollTrigger share the GSAP ticker.
 */

export function ScrollProgress({ className }: { className?: string }) {
  const root = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const bar = root.current;
      if (bar === null) return;

      const mm = gsap.matchMedia();

      mm.add(MOTION_QUERIES.reduced, () => {
        // Still useful information, just not animated: jump in steps.
        gsap.set(bar, { scaleX: 0 });
        gsap.to(bar, {
          scaleX: 1,
          ease: "none",
          scrollTrigger: { trigger: document.body, start: "top top", end: "bottom bottom", scrub: 0.6 },
        });
      });

      mm.add("(prefers-reduced-motion: no-preference)", () => {
        gsap.set(bar, { scaleX: 0 });
        gsap.to(bar, {
          scaleX: 1,
          ease: "none",
          scrollTrigger: { trigger: document.body, start: "top top", end: "bottom bottom", scrub: true },
        });
      });

      return () => mm.revert();
    },
    { scope: root },
  );

  return (
    <div
      ref={root}
      role="presentation"
      className={cn("h-px w-full origin-left bg-bronze", className)}
    />
  );
}
