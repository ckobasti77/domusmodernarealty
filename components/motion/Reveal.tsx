"use client";

import { useRef, type ElementType, type HTMLAttributes, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { DURATION, gsap, MOTION_QUERIES, STAGGER, useGSAP } from "./gsap";

/**
 * The house reveal: children rise and fade once, when the block reaches
 * `top 80%`. Every motion component in this folder follows the same shape —
 * one `gsap.matchMedia()` with three branches, and the reduced branch paints
 * the final state instead of animating toward it.
 *
 * Only `transform` and `opacity` are touched, so the reveal never triggers
 * layout. `will-change` is added for the duration of the tween and dropped
 * again by `clearProps`.
 */

export type RevealProps = {
  children: ReactNode;
  /** Renders as this element. `div` by default. */
  as?: ElementType;
  /** Seconds between children. 0 reveals the whole block as one unit. */
  stagger?: number;
  /** Travel distance in px. */
  distance?: number;
  delay?: number;
  /**
   * Leave the block alone when it is already on screen at hydration. For
   * server-rendered content pages: hiding text the visitor is reading, only to
   * fade it back in, would read as a flicker.
   */
  skipInView?: boolean;
  className?: string;
} & Omit<HTMLAttributes<HTMLElement>, "children" | "className">;

export function Reveal({
  children,
  as: Tag = "div",
  stagger = STAGGER.lines,
  distance = 28,
  delay = 0,
  skipInView = false,
  className,
  ...rest
}: RevealProps) {
  const root = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      const el = root.current;
      if (el === null) return;
      if (skipInView && el.getBoundingClientRect().top < window.innerHeight) return;
      const targets = stagger > 0 ? Array.from(el.children) : [el];
      if (targets.length === 0) return;

      const mm = gsap.matchMedia();

      mm.add(MOTION_QUERIES.reduced, () => {
        gsap.set(targets, { clearProps: "all" });
      });

      const animate = (travel: number, duration: number, each: number) => {
        gsap.set(targets, { opacity: 0, y: travel, willChange: "transform, opacity" });
        gsap.to(targets, {
          opacity: 1,
          y: 0,
          duration,
          delay,
          stagger: each,
          ease: "estate",
          clearProps: "willChange,opacity,transform",
          scrollTrigger: { trigger: el, start: "top 80%", once: true },
        });
      };

      mm.add(MOTION_QUERIES.mobile, () => {
        animate(Math.min(distance, 16), DURATION.revealFast, Math.min(stagger, 0.06));
      });

      mm.add(MOTION_QUERIES.desktop, () => {
        animate(distance, DURATION.reveal, stagger);
      });

      return () => mm.revert();
    },
    { scope: root, dependencies: [stagger, distance, delay, skipInView] },
  );

  return (
    <Tag ref={root} className={cn(className)} {...rest}>
      {children}
    </Tag>
  );
}
