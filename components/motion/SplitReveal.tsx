"use client";

import { useRef, type ElementType, type ReactNode } from "react";
import { fixOrphans } from "@/lib/format";
import { cn } from "@/lib/utils";
import { DURATION, gsap, MOTION_QUERIES, SplitText, STAGGER, useGSAP } from "./gsap";

/**
 * Masked line reveal for serif headlines: each line rises from behind its own
 * `overflow: clip` wrapper (DESIGN §6.2).
 *
 * Four things here are load-bearing and easy to get wrong:
 *  - `document.fonts.ready` is awaited, because splitting before the display face
 *    arrives measures the fallback face and breaks every line;
 *  - `autoSplit` re-splits on a width change, so the tween MUST be created
 *    inside `onSplit` and returned from it — that is what lets SplitText revert
 *    and re-sync it;
 *  - `mask: "lines"` supplies the clip wrapper, so no extra markup is needed;
 *  - the element must never carry `text-wrap: balance` (CLAUDE.md hard rule).
 *
 * Accessibility: SplitText's own `aria: "auto"` writes `aria-label` onto the
 * split element, and `aria-label` is prohibited on a roleless `<span>` (axe
 * flags it as a serious violation). So aria is left alone (`aria: "none"`), the
 * animated copy is `aria-hidden`, and a visually hidden twin carries the text —
 * the pattern the GSAP docs recommend when the split element has no role.
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
  const root = useRef<HTMLSpanElement>(null);

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
            aria: "none",
            autoSplit: true,
            linesClass: "split-line",
            // Without this SplitText normalises the non-breaking spaces that
            // `fixOrphans` inserted back into ordinary spaces BEFORE it decides
            // where the lines break, so a break still lands on "... mesta u".
            reduceWhiteSpace: false,
            onSplit(self) {
              return gsap.from(self.lines, {
                yPercent: 110,
                duration,
                delay,
                stagger: each,
                ease: "expo.out",
                scrollTrigger: { trigger: el, start: "top 94%", once: true },
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

  // Serbian never strands a one-letter preposition at a line end, and the
  // usual remedy (`text-wrap: balance`) is forbidden on a split element.
  // Both copies get it: SplitText rebuilds the text nodes of the animated one,
  // so the accessible twin is what guarantees the joins survive.
  const content = typeof children === "string" ? fixOrphans(children) : children;

  return (
    <Tag className={cn("relative", className)}>
      {/* The accessible copy. Never split, never animated. */}
      <span className="sr-only">{content}</span>
      {/* The animated copy starts invisible so the un-split text never flashes
          before the fonts resolve; every matchMedia branch sets it to 1. */}
      <span ref={root} data-split="" aria-hidden="true" className="block opacity-0">
        {content}
      </span>
    </Tag>
  );
}
