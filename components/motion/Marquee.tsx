"use client";

import { useRef, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { gsap, MOTION_QUERIES, useGSAP } from "./gsap";

/**
 * A slow, linear marquee that pauses on hover. The track is duplicated once and
 * translated by exactly -50%, so the seam is invisible and the loop is perfect
 * regardless of content width.
 *
 * `ease: "none"` is mandatory — any easing makes the seam visibly stutter. The
 * duplicate is `aria-hidden` so a screen reader reads the content once.
 */

export type MarqueeProps = {
  children: ReactNode;
  /** Seconds for one full pass of the original track. */
  duration?: number;
  reverse?: boolean;
  className?: string;
};

export function Marquee({ children, duration = 40, reverse = false, className }: MarqueeProps) {
  const root = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const el = root.current;
      if (el === null) return;
      const track = el.querySelector("[data-marquee-track]");
      if (track === null) return;

      const mm = gsap.matchMedia();

      // A permanently moving element is exactly what reduced motion is for.
      mm.add(MOTION_QUERIES.reduced, () => {
        gsap.set(track, { xPercent: 0 });
      });

      const roll = (seconds: number) => {
        const from = reverse ? -50 : 0;
        const to = reverse ? 0 : -50;
        const tween = gsap.fromTo(
          track,
          { xPercent: from },
          { xPercent: to, duration: seconds, ease: "none", repeat: -1 },
        );

        const pause = () => tween.pause();
        const resume = () => tween.resume();
        el.addEventListener("pointerenter", pause);
        el.addEventListener("pointerleave", resume);
        // Keyboard users stop it by focusing anything inside.
        el.addEventListener("focusin", pause);
        el.addEventListener("focusout", resume);

        return () => {
          el.removeEventListener("pointerenter", pause);
          el.removeEventListener("pointerleave", resume);
          el.removeEventListener("focusin", pause);
          el.removeEventListener("focusout", resume);
        };
      };

      mm.add(MOTION_QUERIES.mobile, () => roll(duration * 0.7));
      mm.add(MOTION_QUERIES.desktop, () => roll(duration));

      return () => mm.revert();
    },
    { scope: root, dependencies: [duration, reverse] },
  );

  return (
    <div ref={root} className={cn("overflow-hidden", className)}>
      <div data-marquee-track className="flex w-max">
        <div className="flex shrink-0 items-center">{children}</div>
        <div aria-hidden="true" className="flex shrink-0 items-center">
          {children}
        </div>
      </div>
    </div>
  );
}
