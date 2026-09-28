"use client";

import { useRef, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { gsap, MOTION_QUERIES, useGSAP } from "./gsap";

/**
 * Scroll parallax for whatever it wraps — a still, a video, or both stacked.
 * The layer is drawn `amount`% taller at each edge so the drift (yPercent
 * −amount → +amount while its parent crosses the viewport) never uncovers an
 * edge. The parent must clip (`overflow: clip`).
 *
 * Desktop gets the full travel, phones half of it, reduced motion none.
 * `ParallaxImage` is the single-image, fixed-aspect sibling of this.
 */
export function ParallaxLayer({
  children,
  amount = 8,
  className,
}: {
  children: ReactNode;
  /** Travel in percent of the layer's height, each way. */
  amount?: number;
  className?: string;
}) {
  const root = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const layer = root.current;
      const host = layer?.parentElement;
      if (layer === null || host === null || host === undefined) return;

      const mm = gsap.matchMedia();
      const drift = (travel: number) => {
        // yPercent is relative to the LAYER, which is (100 + 2·amount)% of the
        // host, so the host-relative margin is converted back into layer units.
        const shift = travel / (1 + (2 * amount) / 100);
        gsap.fromTo(
          layer,
          { yPercent: -shift },
          {
            yPercent: shift,
            ease: "none",
            scrollTrigger: { trigger: host, start: "top bottom", end: "bottom top", scrub: true },
          },
        );
      };
      mm.add(MOTION_QUERIES.mobile, () => drift(amount / 2));
      mm.add(MOTION_QUERIES.desktop, () => drift(amount));
      return () => mm.revert();
    },
    { dependencies: [amount] },
  );

  return (
    <div
      ref={root}
      className={cn(className)}
      style={{ top: `-${amount}%`, bottom: `-${amount}%`, height: "auto" }}
    >
      {children}
    </div>
  );
}
