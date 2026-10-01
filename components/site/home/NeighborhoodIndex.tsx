"use client";

import Image from "next/image";
import { useTranslations } from "next-intl";
import { useRef } from "react";
import { contextSafeFn, gsap, MOTION_QUERIES, ScrollTrigger, useGSAP } from "@/components/motion/gsap";
import { Link } from "@/i18n/navigation";
import { frameLoader } from "@/lib/image-loaders";
import { cn } from "@/lib/utils";
import { photoGrade } from "./art-direction";
import type { NeighborhoodItem } from "./types";

/**
 * The neighborhood index (DESIGN §6.5).
 *
 *  - Desktop: a big serif list with the listing count in mono beside a sticky
 *    photograph. The photograph always shows the row at the middle of the
 *    viewport, so the section has a focal point without a pointer; hovering a
 *    row brings that row's photograph up instead, and the picture leans a few
 *    pixels toward the pointer. Rows reveal with a hairline drawn from the left.
 *  - Below 1024px: the same links become stacked image cards, at most six so
 *    the section stays a section on a phone, and an odd last card spans the row.
 *  - Reduced motion: no reveals and no lean; the photograph still follows the
 *    reading position and the pointer, but switches without a fade.
 *
 * One list serves every breakpoint, so each destination has exactly one link in
 * the accessibility tree. The sticky photograph is decorative (`aria-hidden`);
 * its frames are stacked and cross-faded, so switching never waits on a render.
 */

const HOVER = "(min-width: 1024px) and (hover: hover) and (pointer: fine)";
const WIDE = "(min-width: 1024px)";

export function NeighborhoodIndex({ items }: { items: readonly NeighborhoodItem[] }) {
  const t = useTranslations("home");
  const root = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const el = root.current;
      if (el === null) return;
      const q = gsap.utils.selector(el);
      const rows = q("[data-hood-row]");
      const frames = q("[data-hood-frame]");
      const [panel] = q("[data-hood-panel]");
      const [lean] = q("[data-hood-lean]");
      const mm = gsap.matchMedia();

      mm.add(MOTION_QUERIES.desktop, (_context, contextSafe) => {
        const parts = (batch: Element[]) => ({
          rules: batch.map((row) => row.querySelector("[data-hood-rule]")).filter((n) => n !== null),
          labels: batch.map((row) => row.querySelector("[data-hood-label]")).filter((n) => n !== null),
        });
        const all = parts(rows);
        gsap.set(all.rules, { scaleX: 0 });
        gsap.set(all.labels, { opacity: 0, yPercent: 40 });

        ScrollTrigger.batch(rows, {
          start: "top 90%",
          once: true,
          onEnter: contextSafeFn(contextSafe, (batch: Element[]) => {
            const { rules, labels } = parts(batch);
            gsap.to(rules, { scaleX: 1, duration: 1.2, ease: "expo.out", stagger: 0.08 });
            gsap.to(labels, { opacity: 1, yPercent: 0, duration: 1, ease: "estate", stagger: 0.08 });
          }),
        });
      });

      mm.add(MOTION_QUERIES.mobile, (_context, contextSafe) => {
        gsap.set(rows, { opacity: 0, y: 24 });
        ScrollTrigger.batch(rows, {
          start: "top 90%",
          once: true,
          onEnter: contextSafeFn(contextSafe, (batch: Element[]) => {
            gsap.to(batch, { opacity: 1, y: 0, duration: 0.9, ease: "estate", stagger: 0.08 });
          }),
        });
      });

      // The sticky photograph: the row at the middle of the viewport, unless
      // the pointer is on a row.
      mm.add(
        { wide: WIDE, hover: HOVER, reduced: MOTION_QUERIES.reduced },
        (context, contextSafe) => {
          const { wide, hover, reduced } = context.conditions ?? {};
          if (wide !== true || panel === undefined || frames.length === 0) return;

          let shown: string | null = null;
          let scrolled: string | null = null;
          let hovered: string | null = null;

          // The incoming photograph rises over the outgoing one, which stays
          // put until it is covered. Fading both at once dipped every switch
          // about a quarter of the way to ink.
          const show = contextSafeFn(contextSafe, (id: string | null) => {
            const next = frames.find((frame) => frame.dataset.for === id);
            if (id === null || id === shown || next === undefined) return;
            const previous = shown;
            shown = id;
            const rest = frames.filter((frame) => frame !== next);
            for (const frame of frames) {
              gsap.set(frame, { zIndex: frame === next ? 2 : frame.dataset.for === previous ? 1 : 0 });
            }
            if (reduced === true) {
              gsap.set(next, { opacity: 1 });
              gsap.set(rest, { opacity: 0 });
              return;
            }
            gsap.to(next, {
              opacity: 1,
              duration: 0.35,
              ease: "power2.out",
              overwrite: true,
              onComplete: () => {
                if (shown === id) gsap.set(rest, { opacity: 0 });
              },
            });
          });

          gsap.set(frames, { opacity: 0 });
          show(frames[0]?.dataset.for ?? null);

          for (const row of rows) {
            ScrollTrigger.create({
              trigger: row,
              start: "top center",
              end: "bottom center",
              onToggle: (self) => {
                if (!self.isActive) return;
                scrolled = row.dataset.id ?? null;
                if (hovered === null) show(scrolled);
              },
            });
          }

          if (hover !== true) return;

          const list = el.querySelector("[data-hood-list]");
          const xTo = lean !== undefined && reduced !== true ? gsap.quickTo(lean, "x", { duration: 0.6, ease: "power3" }) : null;
          const yTo = lean !== undefined && reduced !== true ? gsap.quickTo(lean, "y", { duration: 0.6, ease: "power3" }) : null;

          const onOver = (event: Event) => {
            const target = event.target instanceof Element ? event.target : null;
            const id = target?.closest<HTMLElement>("[data-hood-row]")?.dataset.id ?? null;
            if (id === null) return;
            hovered = id;
            show(id);
          };
          const onMove = (event: PointerEvent) => {
            if (xTo === null || yTo === null) return;
            const box = el.getBoundingClientRect();
            xTo(gsap.utils.clamp(-1, 1, (event.clientX - box.left) / box.width - 0.5) * 16);
            yTo(gsap.utils.clamp(-1, 1, (event.clientY - box.top) / box.height - 0.5) * 16);
          };
          const onLeave = () => {
            hovered = null;
            show(scrolled);
            xTo?.(0);
            yTo?.(0);
          };
          // A pointer resting on a row while the page scrolls under it fires no
          // pointer event, so without this the picture stays on the old row.
          const onScroll = () => {
            if (hovered !== null) onLeave();
          };

          list?.addEventListener("pointerover", onOver);
          list?.addEventListener("pointermove", onMove as EventListener);
          list?.addEventListener("pointerleave", onLeave);
          window.addEventListener("scroll", onScroll, { passive: true });
          return () => {
            window.removeEventListener("scroll", onScroll);
            list?.removeEventListener("pointerover", onOver);
            list?.removeEventListener("pointermove", onMove as EventListener);
            list?.removeEventListener("pointerleave", onLeave);
          };
        },
      );

      return () => mm.revert();
    },
    { scope: root, dependencies: [items] },
  );

  const pictured = items.filter((item) => item.image !== undefined);

  return (
    <div ref={root} className="lg:grid lg:grid-cols-12 lg:gap-x-6">
      <ul
        data-hood-list=""
        className={cn(
          "grid grid-cols-2 gap-x-4 gap-y-10 md:grid-cols-3 md:gap-x-6",
          // Below 1024px only the places marked for phones (six at most, the
          // busiest ones) are shown.
          "max-lg:[&>li[data-phone=false]]:hidden",
          "lg:col-span-8 lg:block lg:border-t lg:border-hairline-dark",
        )}
      >
        {items.map((item) => (
          <li key={item.id} data-hood-row="" data-id={item.id} data-phone={item.onPhone} className="relative">
            <Link
              href={{ pathname: "/locations/[slug]", params: { slug: item.slug } }}
              className="group/row block lg:grid lg:grid-cols-8 lg:items-baseline lg:gap-6 lg:py-5"
            >
              {item.image !== undefined ? (
                <span className="relative mb-4 block aspect-[4/5] overflow-hidden bg-ink-2 lg:hidden">
                  <Image
                    src={item.image}
                    loader={frameLoader(item.image, 1.25)}
                    alt=""
                    fill
                    sizes="(min-width: 768px) 30vw, 46vw"
                    className={cn(photoGrade(item.image), "object-cover")}
                  />
                </span>
              ) : null}
              <span
                data-hood-label=""
                lang={item.lang}
                className={cn(
                  "block font-display text-h3 font-normal text-ivory lg:col-span-6",
                  "lg:text-[clamp(2.75rem,4.2vw,4.75rem)] lg:leading-[0.95]",
                  "transition-[color,translate] duration-300 ease-out",
                  "pointer-fine:group-hover/row:translate-x-3 pointer-fine:group-hover/row:text-bronze",
                  "group-focus-visible/row:text-bronze",
                )}
              >
                {item.name}
              </span>
              {/* The district over the count, right-aligned on one line each. A
                  place without a district (a city) keeps the empty line, so every
                  count sits at the same height. */}
              <span className="mt-1.5 flex flex-col gap-1 whitespace-nowrap font-mono text-label uppercase text-mist lg:col-span-2 lg:mt-0 lg:items-end lg:text-right">
                {item.context !== undefined ? (
                  <span>{item.context}</span>
                ) : (
                  <span aria-hidden="true">{"\u00a0"}</span>
                )}
                <span data-numeric="">{t("neighborhoodsCount", { count: item.count })}</span>
              </span>
            </Link>
            <span
              data-hood-rule=""
              aria-hidden="true"
              className="absolute inset-x-0 bottom-0 hidden h-px origin-left bg-hairline-dark lg:block"
            />
          </li>
        ))}
      </ul>

      {pictured.length > 0 ? (
        <div aria-hidden="true" className="hidden lg:col-span-4 lg:col-start-9 lg:block">
          <div data-hood-panel="" className="sticky top-28 aspect-[4/5] overflow-hidden bg-ink-2">
            {/* Slightly larger than the frame, so the lean never shows an edge. */}
            <div data-hood-lean="" className="absolute -inset-4">
              {pictured.map((item, index) => (
                <div
                  key={item.id}
                  data-hood-frame=""
                  data-for={item.id}
                  className={cn("absolute inset-0", index === 0 ? "opacity-100" : "opacity-0")}
                >
                  <Image
                    src={item.image ?? ""}
                    loader={frameLoader(item.image ?? "", 1.25)}
                    alt=""
                    fill
                    // The frame plus the 16px lean margin on each side.
                    sizes="(min-width: 1440px) 470px, 34vw"
                    className={cn(photoGrade(item.image ?? ""), "object-cover")}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
