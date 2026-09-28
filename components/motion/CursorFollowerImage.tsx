"use client";

import Image from "next/image";
import { useId, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { gsap, useGSAP } from "./gsap";

/**
 * The neighbourhood-list interaction from DESIGN §6.5: hovering a row reveals a
 * photograph that trails the pointer.
 *
 * `gsap.quickTo` is used instead of a tween per `pointermove` — it reuses one
 * tween, which is the difference between 60fps and a stutter. The whole thing is
 * gated on a fine pointer at ≥1024px with motion allowed; on touch, small
 * screens or reduced motion the rows are plain links and no image mounts.
 */

export type CursorFollowerItem = {
  id: string;
  label: ReactNode;
  /** Right-hand meta, e.g. a listing count. */
  meta?: ReactNode;
  href?: string;
  image: { src: string; alt: string };
};

export type CursorFollowerImageProps = {
  items: readonly CursorFollowerItem[];
  className?: string;
};

const GATE =
  "(min-width: 1024px) and (hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)";

const WIDTH = 320;
const HEIGHT = 400;

export function CursorFollowerImage({ items, className }: CursorFollowerImageProps) {
  const root = useRef<HTMLDivElement>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const listId = useId();

  useGSAP(
    () => {
      const el = root.current;
      if (el === null) return;
      const follower = el.querySelector<HTMLElement>("[data-follower]");
      if (follower === null) return;

      const mm = gsap.matchMedia();

      mm.add(GATE, () => {
        const xTo = gsap.quickTo(follower, "x", { duration: 0.45, ease: "power3" });
        const yTo = gsap.quickTo(follower, "y", { duration: 0.45, ease: "power3" });

        const onMove = (event: PointerEvent) => {
          const box = el.getBoundingClientRect();
          xTo(event.clientX - box.left - WIDTH / 2);
          yTo(event.clientY - box.top - HEIGHT / 2);
        };

        const onEnter = (event: PointerEvent) => {
          const row = (event.target as HTMLElement | null)?.closest<HTMLElement>("[data-row-id]");
          if (row === null || row === undefined) return;
          setActiveId(row.dataset.rowId ?? null);
          gsap.to(follower, { autoAlpha: 1, scale: 1, duration: 0.4, ease: "estate" });
        };

        const onLeave = () => {
          setActiveId(null);
          gsap.to(follower, { autoAlpha: 0, scale: 0.94, duration: 0.3, ease: "power3.out" });
        };

        gsap.set(follower, { autoAlpha: 0, scale: 0.94 });
        el.addEventListener("pointermove", onMove);
        el.addEventListener("pointerover", onEnter);
        el.addEventListener("pointerleave", onLeave);

        return () => {
          el.removeEventListener("pointermove", onMove);
          el.removeEventListener("pointerover", onEnter);
          el.removeEventListener("pointerleave", onLeave);
          setActiveId(null);
        };
      });

      return () => mm.revert();
    },
    { scope: root },
  );

  const active = items.find((item) => item.id === activeId) ?? null;

  return (
    <div ref={root} className={cn("relative", className)}>
      <ul id={listId} className="hairline-t-dark">
        {items.map((item) => (
          <li key={item.id} data-row-id={item.id} className="hairline-b-dark">
            <Row href={item.href}>
              <span className="font-display text-h2 font-normal">{item.label}</span>
              {item.meta !== undefined ? (
                <span data-numeric className="font-mono text-label uppercase text-mist">
                  {item.meta}
                </span>
              ) : null}
            </Row>
          </li>
        ))}
      </ul>

      {/* Decorative: the row label already names the destination. */}
      <div
        data-follower
        aria-hidden="true"
        className="pointer-events-none absolute left-0 top-0 hidden overflow-hidden opacity-0 lg:block"
        style={{ width: WIDTH, height: HEIGHT }}
      >
        {active !== null ? (
          <Image
            src={active.image.src}
            alt=""
            fill
            sizes="320px"
            className="object-cover"
          />
        ) : null}
      </div>
    </div>
  );
}

function Row({ href, children }: { href?: string; children: ReactNode }) {
  const classes =
    "flex items-baseline justify-between gap-6 py-6 transition-colors duration-200 lg:py-8";
  if (href === undefined) {
    return <div className={classes}>{children}</div>;
  }
  return (
    <a href={href} className={cn(classes, "hover:text-bronze focus-visible:text-bronze")}>
      {children}
    </a>
  );
}
