"use client";

import { useRef } from "react";
import { gsap, MOTION_QUERIES, useGSAP } from "@/components/motion/gsap";
import { cn } from "@/lib/utils";

/**
 * A hairline that draws itself from left to right when it scrolls in — the one
 * ornament the design system allows (DESIGN §4 "HairlineDraw").
 *
 * `scaleX` on a 1px element is a compositor-only change; animating `width` here
 * would relayout the whole section on every frame.
 */

export type DividerProps = {
  /** Which surface the rule sits on; picks the hairline colour. */
  tone?: "light" | "dark" | "bronze";
  className?: string;
};

const TONE: Record<NonNullable<DividerProps["tone"]>, string> = {
  light: "bg-hairline-light",
  dark: "bg-hairline-dark",
  bronze: "bg-bronze",
};

export function Divider({ tone = "light", className }: DividerProps) {
  const root = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const el = root.current;
      if (el === null) return;

      const mm = gsap.matchMedia();

      mm.add(MOTION_QUERIES.reduced, () => {
        gsap.set(el, { scaleX: 1 });
      });

      const draw = (duration: number) => {
        gsap.fromTo(
          el,
          { scaleX: 0 },
          {
            scaleX: 1,
            duration,
            ease: "estate",
            scrollTrigger: { trigger: el, start: "top 92%", once: true },
          },
        );
      };

      mm.add(MOTION_QUERIES.mobile, () => draw(0.7));
      mm.add(MOTION_QUERIES.desktop, () => draw(1));

      return () => mm.revert();
    },
    { scope: root },
  );

  return (
    <div
      ref={root}
      role="presentation"
      data-divider=""
      className={cn("h-px w-full origin-left", TONE[tone], className)}
    />
  );
}
