"use client";

import { useRef, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { DURATION, gsap, MOTION_QUERIES, useGSAP } from "./gsap";

/**
 * `ImageReveal` for media that is not a single `next/image` — an art-directed
 * `<picture>`, a still with a film over it. The frame uncovers itself with a
 * `clip-path` inset as it enters while its content settles from a slight
 * zoom, so it reads as a camera settling rather than a box growing. Both are
 * compositor properties; nothing reflows.
 *
 * The frame is closed from the first paint by CSS (`[data-clip-reveal]` in
 * globals.css, only when motion is allowed), so nothing is painted and then
 * snatched away at hydration; the no-JS rule in the locale layout opens
 * `[data-image-reveal]` again.
 */

export type ClipRevealProps = {
  children: ReactNode;
  /** Which edge the reveal travels from. */
  from?: "bottom" | "top" | "left" | "right";
  className?: string;
};

const HIDDEN: Record<NonNullable<ClipRevealProps["from"]>, string> = {
  bottom: "inset(0% 0% 100% 0%)",
  top: "inset(100% 0% 0% 0%)",
  left: "inset(0% 100% 0% 0%)",
  right: "inset(0% 0% 0% 100%)",
};

export function ClipReveal({ children, from = "bottom", className }: ClipRevealProps) {
  const root = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const frame = root.current;
      if (frame === null) return;
      const content = frame.querySelector("[data-clip-content]");
      if (content === null) return;

      const mm = gsap.matchMedia();

      mm.add(MOTION_QUERIES.reduced, () => {
        gsap.set(frame, { clipPath: "inset(0% 0% 0% 0%)" });
      });

      const animate = (duration: number, scale: number) => {
        gsap
          .timeline({
            defaults: { ease: "estate" },
            scrollTrigger: { trigger: frame, start: "top 85%", once: true },
          })
          .fromTo(frame, { clipPath: HIDDEN[from] }, { clipPath: "inset(0% 0% 0% 0%)", duration }, 0)
          .fromTo(content, { scale }, { scale: 1, duration: duration * 1.25 }, 0);
      };

      mm.add(MOTION_QUERIES.mobile, () => animate(DURATION.revealFast, 1.06));
      mm.add(MOTION_QUERIES.desktop, () => animate(DURATION.reveal, 1.12));

      return () => mm.revert();
    },
    { scope: root, dependencies: [from] },
  );

  return (
    <div ref={root} data-image-reveal="" data-clip-reveal={from} className={cn("relative overflow-hidden bg-ink-2", className)}>
      <div data-clip-content="" className="absolute inset-0">
        {children}
      </div>
    </div>
  );
}
