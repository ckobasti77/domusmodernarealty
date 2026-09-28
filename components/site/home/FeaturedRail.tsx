"use client";

import { useRef, type ReactNode } from "react";
import { contextSafeFn, gsap, MOTION_QUERIES, useGSAP } from "@/components/motion/gsap";

/**
 * Motion for the featured listings (DESIGN §6.4), wrapped around markup the
 * server renders:
 *
 *  - Desktop (≥1024px, motion allowed): the section pins and vertical scroll
 *    drives the track sideways; each card's photograph drifts inside its frame
 *    against the travel (a `containerAnimation` parallax). The hairline and the
 *    "01 / 06" counter follow the progress.
 *  - Below 1024px: the list is a native scroll-snap carousel — no pin, no
 *    hijacked scroll — and the cards rise in once.
 *  - Reduced motion: the same native horizontal scroll at every width.
 *
 * In the pinned mode the cards are translated, not scrolled, so a keyboard user
 * tabbing into a card that is still off to the right would focus something
 * invisible. Focus therefore scrolls the page to the pin position that brings
 * that card into view.
 *
 * Markup contract: `[data-featured-pin]` > `[data-featured-viewport]` >
 * `[data-featured-track]` containing `[data-featured-list]` of
 * `[data-featured-card]`; plus `[data-featured-index]` and
 * `[data-featured-progress]`.
 */

const NOT_PINNED = "(max-width: 1023px), (prefers-reduced-motion: reduce)";

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

export function FeaturedRail({ total, children }: { total: number; children: ReactNode }) {
  const root = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const el = root.current;
      if (el === null || total === 0) return;
      const q = gsap.utils.selector(el);
      const [pin] = q("[data-featured-pin]");
      const [viewport] = q("[data-featured-viewport]");
      const [track] = q("[data-featured-track]");
      const [list] = q("[data-featured-list]");
      const [index] = q("[data-featured-index]");
      const [bar] = q("[data-featured-progress]");
      const cards = q("[data-featured-card]");
      if (pin === undefined || viewport === undefined || track === undefined || list === undefined) return;

      let shown = 1;
      const report = (progress: number) => {
        const clamped = Math.min(1, Math.max(0, progress));
        const next = Math.round(clamped * (total - 1)) + 1;
        if (index !== undefined && next !== shown) {
          shown = next;
          index.textContent = pad(next);
        }
        if (bar !== undefined) gsap.set(bar, { scaleX: clamped });
      };

      const mm = gsap.matchMedia();

      mm.add(MOTION_QUERIES.desktop, (_context, contextSafe) => {
        const distance = () => Math.max(0, track.scrollWidth - viewport.clientWidth);
        // Nothing to travel: three cards on a wide screen simply sit there.
        if (distance() < 48) return;

        gsap.set(viewport, { overflowX: "clip" });

        const travel = gsap.to(track, {
          x: () => -distance(),
          ease: "none",
          scrollTrigger: {
            trigger: pin,
            pin: true,
            start: "top top",
            end: () => `+=${distance()}`,
            scrub: true,
            invalidateOnRefresh: true,
            onUpdate: (self) => report(self.progress),
          },
        });

        for (const card of cards) {
          const image = card.querySelector("[data-card-image]");
          if (image === null) continue;
          // Scaled up so the drift never uncovers the frame's edges.
          gsap.fromTo(
            image,
            { xPercent: -5, scale: 1.14 },
            {
              xPercent: 5,
              scale: 1.14,
              ease: "none",
              scrollTrigger: {
                trigger: card,
                containerAnimation: travel,
                start: "left right",
                end: "right left",
                scrub: true,
              },
            },
          );
        }

        const onFocus = contextSafeFn(contextSafe, (event: Event) => {
          const trigger = travel.scrollTrigger;
          const target = event.target instanceof HTMLElement ? event.target : null;
          const card = target?.closest<HTMLElement>("[data-featured-card]");
          if (trigger === undefined || card === null || card === undefined) return;

          const offset = card.getBoundingClientRect().left - track.getBoundingClientRect().left;
          const wanted = Math.min(distance(), Math.max(0, offset - viewport.clientWidth * 0.25));
          const y = trigger.start + (trigger.end - trigger.start) * (wanted / distance());
          // Lenis adopts a native scroll position when it is not mid-glide.
          window.scrollTo({ top: y, behavior: "instant" });
        });

        track.addEventListener("focusin", onFocus);
        return () => track.removeEventListener("focusin", onFocus);
      });

      // Native horizontal scroll: the list below 1024px, the whole track when a
      // reduced-motion visitor is on a wide screen.
      mm.add(NOT_PINNED, () => {
        const onScroll = (event: Event) => {
          const scroller = event.currentTarget as HTMLElement;
          const room = scroller.scrollWidth - scroller.clientWidth;
          if (room > 0) report(scroller.scrollLeft / room);
        };
        list.addEventListener("scroll", onScroll, { passive: true });
        viewport.addEventListener("scroll", onScroll, { passive: true });
        return () => {
          list.removeEventListener("scroll", onScroll);
          viewport.removeEventListener("scroll", onScroll);
        };
      });

      mm.add(MOTION_QUERIES.mobile, () => {
        gsap.from(cards, {
          opacity: 0,
          y: 24,
          duration: 0.9,
          stagger: 0.08,
          ease: "estate",
          clearProps: "opacity,transform",
          scrollTrigger: { trigger: list, start: "top 85%", once: true },
        });
      });

      return () => mm.revert();
    },
    { scope: root, dependencies: [total] },
  );

  return <div ref={root}>{children}</div>;
}
