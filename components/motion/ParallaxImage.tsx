"use client";

import Image from "next/image";
import { useRef } from "react";
import { cn } from "@/lib/utils";
import { gsap, MOTION_QUERIES, useGSAP } from "./gsap";

/**
 * Scrubbed parallax: the image is rendered taller than its frame and drifts
 * `±amount` percent as the frame crosses the viewport. The frame keeps
 * `overflow: hidden`, so the extra height never shows.
 *
 * Mobile halves the travel (a phone scrolls far faster relative to the viewport,
 * so the full amount reads as a glitch) and the reduced branch centres the image
 * and creates no ScrollTrigger at all.
 */

export type ParallaxImageProps = {
  src: string;
  alt: string;
  ratio?: string;
  sizes?: string;
  priority?: boolean;
  /** yPercent travel; DESIGN §4 calls for ±8. */
  amount?: number;
  className?: string;
};

export function ParallaxImage({
  src,
  alt,
  ratio = "aspect-[3/4]",
  sizes = "(min-width: 1024px) 45vw, 100vw",
  priority = false,
  amount = 8,
  className,
}: ParallaxImageProps) {
  const root = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const frame = root.current;
      if (frame === null) return;
      const picture = frame.querySelector("[data-parallax-image]");
      if (picture === null) return;

      const mm = gsap.matchMedia();

      mm.add(MOTION_QUERIES.reduced, () => {
        gsap.set(picture, { yPercent: 0 });
      });

      const drift = (travel: number) => {
        gsap.fromTo(
          picture,
          { yPercent: -travel },
          {
            yPercent: travel,
            ease: "none",
            scrollTrigger: {
              trigger: frame,
              start: "top bottom",
              end: "bottom top",
              scrub: true,
            },
          },
        );
      };

      mm.add(MOTION_QUERIES.mobile, () => drift(amount / 2));
      mm.add(MOTION_QUERIES.desktop, () => drift(amount));

      return () => mm.revert();
    },
    { scope: root, dependencies: [amount] },
  );

  return (
    <div ref={root} className={cn("relative overflow-hidden bg-ivory-2", ratio, className)}>
      {/* Taller than the frame by 2×amount so the drift never exposes an edge. */}
      <div
        data-parallax-image=""
        className="absolute inset-x-0"
        style={{ top: `-${amount}%`, bottom: `-${amount}%` }}
      >
        <Image src={src} alt={alt} fill sizes={sizes} priority={priority} className="object-cover" />
      </div>
    </div>
  );
}
