"use client";

import Image from "next/image";
import { useRef } from "react";
import { frameLoader } from "@/lib/image-loaders";
import { cn } from "@/lib/utils";
import { DURATION, gsap, MOTION_QUERIES, useGSAP } from "./gsap";

/**
 * A photograph that uncovers itself with a `clip-path` inset as it enters, the
 * image scaling 1.12 → 1 underneath so the frame feels like a camera settling
 * rather than a box growing. `clip-path` and `transform` are both compositor
 * properties, so nothing here reflows.
 */

export type ImageRevealProps = {
  src: string;
  alt: string;
  /** Tailwind aspect utility, e.g. `aspect-[4/5]`. */
  ratio?: string;
  sizes?: string;
  priority?: boolean;
  /** Height / width of the frame; lets a demo photo arrive cropped to it. */
  crop?: number;
  /** Which edge the reveal travels from. */
  from?: "bottom" | "top" | "left" | "right";
  className?: string;
  imageClassName?: string;
};

const HIDDEN: Record<NonNullable<ImageRevealProps["from"]>, string> = {
  bottom: "inset(0% 0% 100% 0%)",
  top: "inset(100% 0% 0% 0%)",
  left: "inset(0% 100% 0% 0%)",
  right: "inset(0% 0% 0% 100%)",
};

export function ImageReveal({
  src,
  alt,
  ratio = "aspect-[4/5]",
  sizes = "(min-width: 1024px) 40vw, 100vw",
  priority = false,
  crop,
  from = "bottom",
  className,
  imageClassName,
}: ImageRevealProps) {
  const root = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const frame = root.current;
      if (frame === null) return;
      const picture = frame.querySelector("[data-reveal-image]");
      if (picture === null) return;

      const mm = gsap.matchMedia();

      mm.add(MOTION_QUERIES.reduced, () => {
        gsap.set(frame, { clipPath: "inset(0% 0% 0% 0%)" });
        gsap.set(picture, { scale: 1 });
      });

      const animate = (duration: number, scale: number) => {
        const tl = gsap.timeline({
          defaults: { ease: "estate" },
          scrollTrigger: { trigger: frame, start: "top 85%", once: true },
        });
        tl.fromTo(
          frame,
          { clipPath: HIDDEN[from] },
          { clipPath: "inset(0% 0% 0% 0%)", duration },
          0,
        ).fromTo(picture, { scale }, { scale: 1, duration: duration * 1.2 }, 0);
      };

      mm.add(MOTION_QUERIES.mobile, () => animate(DURATION.revealFast, 1.06));
      mm.add(MOTION_QUERIES.desktop, () => animate(DURATION.reveal, 1.12));

      return () => mm.revert();
    },
    { scope: root, dependencies: [from] },
  );

  return (
    <div
      ref={root}
      data-image-reveal=""
      className={cn("relative overflow-hidden bg-ivory-2", ratio, className)}
      style={{ clipPath: HIDDEN[from] }}
    >
      <Image
        data-reveal-image=""
        src={src}
        loader={crop !== undefined ? frameLoader(src, crop) : undefined}
        alt={alt}
        fill
        sizes={sizes}
        priority={priority}
        className={cn("object-cover", imageClassName)}
      />
    </div>
  );
}
