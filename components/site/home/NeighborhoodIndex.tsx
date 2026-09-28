"use client";

import Image from "next/image";
import { useTranslations } from "next-intl";
import { useRef } from "react";
import { contextSafeFn, gsap, MOTION_QUERIES, ScrollTrigger, useGSAP } from "@/components/motion/gsap";
import { Link } from "@/i18n/navigation";
import type { NeighborhoodItem } from "./types";

/**
 * The neighborhood index (DESIGN §6.5).
 *
 *  - Desktop: a big serif list with the listing count in mono. Rows reveal with
 *    a hairline that draws from the left; hovering a row brings up that
 *    neighborhood's photograph, trailing the pointer to the right of it so it
 *    never covers the name being read.
 *  - Below 1024px: the same links become stacked image cards, two or three to
 *    a row, fading up once.
 *  - Reduced motion: all of it static, and no follower.
 *
 * One list serves every breakpoint, so each destination has exactly one link
 * in the accessibility tree. The follower is decorative (`aria-hidden`); its
 * frames are stacked and cross-faded, so moving between rows never waits on a
 * React render.
 */

const HOVER =
  "(min-width: 1024px) and (hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)";

const FOLLOWER = { width: 280, height: 350, gap: 48 } as const;

export function NeighborhoodIndex({ items }: { items: readonly NeighborhoodItem[] }) {
  const t = useTranslations("home");
  const root = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const el = root.current;
      if (el === null) return;
      const q = gsap.utils.selector(el);
      const rows = q("[data-hood-row]");
      const [follower] = q("[data-hood-follower]");
      const frames = q("[data-hood-frame]");
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

      mm.add(HOVER, (_context, contextSafe) => {
        if (follower === undefined) return;
        const xTo = gsap.quickTo(follower, "x", { duration: 0.55, ease: "power3" });
        const yTo = gsap.quickTo(follower, "y", { duration: 0.55, ease: "power3" });
        let active: string | null = null;

        gsap.set(follower, { opacity: 0, scale: 0.94 });

        const show = contextSafeFn(contextSafe, (id: string) => {
          if (id === active) return;
          active = id;
          for (const frame of frames) {
            gsap.to(frame, {
              opacity: frame.dataset.for === id ? 1 : 0,
              duration: 0.35,
              ease: "power2.out",
              overwrite: true,
            });
          }
          gsap.to(follower, { opacity: 1, scale: 1, duration: 0.45, ease: "estate", overwrite: "auto" });
        });

        const hide = contextSafeFn(contextSafe, () => {
          active = null;
          gsap.to(follower, { opacity: 0, scale: 0.94, duration: 0.3, ease: "power3.out", overwrite: "auto" });
        });

        const onMove = (event: PointerEvent) => {
          const box = el.getBoundingClientRect();
          const x = event.clientX - box.left + FOLLOWER.gap;
          const y = event.clientY - box.top - FOLLOWER.height / 2;
          xTo(Math.min(x, box.width - FOLLOWER.width));
          yTo(Math.min(Math.max(y, -FOLLOWER.height / 3), box.height - FOLLOWER.height / 1.5));
        };

        const onOver = (event: PointerEvent) => {
          const target = event.target instanceof Element ? event.target : null;
          const row = target?.closest<HTMLElement>("[data-hood-row]");
          const id = row?.dataset.id;
          if (id === undefined || !frames.some((frame) => frame.dataset.for === id)) {
            hide();
            return;
          }
          show(id);
        };

        // A stationary pointer fires no `pointermove` while the page scrolls
        // under it, so the photograph would stay parked over the wrong row.
        const onScroll = () => {
          if (active !== null) hide();
        };

        el.addEventListener("pointermove", onMove);
        el.addEventListener("pointerover", onOver);
        el.addEventListener("pointerleave", hide);
        window.addEventListener("scroll", onScroll, { passive: true });
        return () => {
          el.removeEventListener("pointermove", onMove);
          el.removeEventListener("pointerover", onOver);
          el.removeEventListener("pointerleave", hide);
          window.removeEventListener("scroll", onScroll);
        };
      });

      return () => mm.revert();
    },
    { scope: root, dependencies: [items] },
  );

  return (
    <div ref={root} className="relative">
      <ul className="grid grid-cols-2 gap-x-4 gap-y-10 md:grid-cols-3 md:gap-x-6 lg:block lg:border-t lg:border-hairline-dark">
        {items.map((item) => (
          <li key={item.id} data-hood-row="" data-id={item.id} className="relative">
            <Link
              href={{ pathname: "/locations/[slug]", params: { slug: item.slug } }}
              prefetch={false}
              className="group/row block lg:grid lg:grid-cols-12 lg:items-baseline lg:gap-6 lg:py-7"
            >
              {item.image !== undefined ? (
                <span className="relative mb-4 block aspect-[4/5] overflow-hidden bg-ink-2 lg:hidden">
                  <Image
                    src={item.image}
                    alt=""
                    fill
                    sizes="(min-width: 768px) 30vw, 46vw"
                    className="object-cover"
                  />
                </span>
              ) : null}
              <span
                data-hood-label=""
                lang={item.lang}
                className={[
                  "block font-display text-h3 font-normal text-ivory lg:col-span-7",
                  "lg:text-[clamp(2.25rem,3.4vw,3.25rem)] lg:leading-[1.05]",
                  "transition-[color,translate] duration-300 ease-out",
                  "pointer-fine:group-hover/row:translate-x-3 pointer-fine:group-hover/row:text-bronze",
                  "group-focus-visible/row:text-bronze",
                ].join(" ")}
              >
                {item.name}
              </span>
              {item.context !== undefined ? (
                <span className="mt-1.5 block font-mono text-label uppercase text-mist lg:col-span-3 lg:mt-0">
                  {item.context}
                </span>
              ) : (
                <span aria-hidden="true" className="hidden lg:col-span-3 lg:block" />
              )}
              <span
                data-numeric=""
                className="mt-1 block font-mono text-label uppercase text-mist lg:col-span-2 lg:mt-0 lg:text-right"
              >
                {t("neighborhoodsCount", { count: item.count })}
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

      <div
        data-hood-follower=""
        aria-hidden="true"
        className="pointer-events-none absolute left-0 top-0 z-10 hidden overflow-hidden bg-ink-2 opacity-0 lg:block"
        style={{ width: FOLLOWER.width, height: FOLLOWER.height }}
      >
        {items.map((item) =>
          item.image !== undefined ? (
            <div key={item.id} data-hood-frame="" data-for={item.id} className="absolute inset-0 opacity-0">
              <Image src={item.image} alt="" fill sizes={`${FOLLOWER.width}px`} className="object-cover" />
            </div>
          ) : null,
        )}
      </div>
    </div>
  );
}
