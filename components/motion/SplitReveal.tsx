"use client";

import { useRef, type ElementType, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { DURATION, gsap, MOTION_QUERIES, SplitText, STAGGER, useGSAP } from "./gsap";

/**
 * Masked line reveal for serif headlines: each line rises from behind its own
 * `overflow: clip` wrapper (DESIGN §6.2).
 *
 * Four things here are load-bearing and easy to get wrong:
 *  - `document.fonts.ready` is awaited, because splitting before Cormorant
 *    arrives measures the fallback face and breaks every line;
 *  - `autoSplit` re-splits on a width change, so the tween MUST be created
 *    inside `onSplit` and returned from it — that is what lets SplitText revert
 *    and re-sync it;
 *  - `mask: "lines"` supplies the clip wrapper, so no extra markup is needed;
 *  - `aria: "auto"` leaves one readable label and hides the shards, and the
 *    element must never carry `text-wrap: balance` (CLAUDE.md hard rule).
 */

export type SplitRevealProps = {
  children: ReactNode;
  as?: ElementType;
  className?: string;
  /** Seconds between lines. */
  stagger?: number;
  delay?: number;
};

export function SplitReveal({
  children,
  as: Tag = "span",
  className,
  stagger = STAGGER.lines,
  delay = 0,
}: SplitRevealProps) {
  const root = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      const el = root.current;
      if (el === null) return;

      const mm = gsap.matchMedia();
      let split: SplitText | null = null;
      let cancelled = false;

      mm.add(MOTION_QUERIES.reduced, () => {
        gsap.set(el, { opacity: 1 });
      });

      const build = (duration: number, each: number) => {
        gsap.set(el, { opacity: 1 });
        void document.fonts.ready.then(() => {
          if (cancelled) return;
          split = SplitText.create(el, {
            type: "lines",
            mask: "lines",
            aria: "auto",
            autoSplit: true,
            linesClass: "split-line",
            onSplit(self) {
              return gsap.from(self.lines, {
                yPercent: 110,
                duration,
                delay,
                stagger: each,
                ease: "expo.out",
                scrollTrigger: { trigger: el, start: "top 85%", once: true },
              });
            },
          });
        });
      };

      mm.add(MOTION_QUERIES.mobile, () => {
        build(DURATION.revealFast, Math.min(stagger, 0.06));
      });

      mm.add(MOTION_QUERIES.desktop, () => {
        build(DURATION.revealSlow, stagger);
      });

      return () => {
        cancelled = true;
        split?.revert();
        split = null;
        mm.revert();
      };
    },
    { scope: root, dependencies: [stagger, delay] },
  );

  // The element starts invisible so the un-split text never flashes before the
  // fonts resolve; every matchMedia branch (including reduced) sets it to 1.
  return (
    <Tag ref={root} className={cn("opacity-0", className)}>
      {children}
    </Tag>
  );
}
