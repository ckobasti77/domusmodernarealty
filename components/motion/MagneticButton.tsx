"use client";

import { useRef, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { gsap, useGSAP } from "./gsap";

/**
 * A CTA that leans toward the pointer by at most `strength` px and springs back
 * on leave (DESIGN §4: "Magnetic CTA only on desktop pointer devices").
 *
 * The wrapper listens, the inner element moves — moving the element you are
 * hovering would shift its own hit area and make the motion fight the pointer.
 */

export type MagneticButtonProps = {
  children: ReactNode;
  /** Maximum offset in px. */
  strength?: number;
  className?: string;
};

const GATE =
  "(min-width: 1024px) and (hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)";

export function MagneticButton({ children, strength = 8, className }: MagneticButtonProps) {
  const root = useRef<HTMLSpanElement>(null);

  useGSAP(
    () => {
      const el = root.current;
      if (el === null) return;
      const inner = el.querySelector<HTMLElement>("[data-magnetic-inner]");
      if (inner === null) return;

      const mm = gsap.matchMedia();

      mm.add(GATE, () => {
        const xTo = gsap.quickTo(inner, "x", { duration: 0.4, ease: "power3" });
        const yTo = gsap.quickTo(inner, "y", { duration: 0.4, ease: "power3" });

        const onMove = (event: PointerEvent) => {
          const box = el.getBoundingClientRect();
          const dx = (event.clientX - (box.left + box.width / 2)) / (box.width / 2);
          const dy = (event.clientY - (box.top + box.height / 2)) / (box.height / 2);
          xTo(gsap.utils.clamp(-1, 1, dx) * strength);
          yTo(gsap.utils.clamp(-1, 1, dy) * strength);
        };

        const onLeave = () => {
          xTo(0);
          yTo(0);
        };

        el.addEventListener("pointermove", onMove);
        el.addEventListener("pointerleave", onLeave);
        // A keyboard user never generates pointermove, so reset on blur too.
        el.addEventListener("focusout", onLeave);

        return () => {
          el.removeEventListener("pointermove", onMove);
          el.removeEventListener("pointerleave", onLeave);
          el.removeEventListener("focusout", onLeave);
          gsap.set(inner, { x: 0, y: 0 });
        };
      });

      return () => mm.revert();
    },
    { scope: root, dependencies: [strength] },
  );

  return (
    <span ref={root} className={cn("inline-block", className)}>
      <span data-magnetic-inner className="inline-block">
        {children}
      </span>
    </span>
  );
}
