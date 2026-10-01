"use client";

import { useRef } from "react";
import { gsap, MOTION_QUERIES, ScrollTrigger, useGSAP } from "@/components/motion/gsap";
import { cn } from "@/lib/utils";

/**
 * The five selling steps along a vertical hairline (DESIGN §6.8). A bronze
 * line draws down the track as the reader scrolls (scrubbed — the one place
 * the section follows the scroll), each marker fills as the line reaches it,
 * and each step's text rises once. Phones get the same line with shorter,
 * lighter entrances; reduced motion gets the finished state.
 *
 * The visible numbers are decoration: the list is an `<ol>`, which already
 * tells assistive technology the order.
 */

/** `titleLang` / `bodyLang`: set only when the text is not in the page's language. */
export type ProcessStep = { title: string; body: string; titleLang?: string; bodyLang?: string };

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

export function ProcessSteps({
  steps,
  titleSize = "h2",
}: {
  steps: readonly ProcessStep[];
  /**
   * `h2` grows the step titles to the h2 token on desktop, under the landing's
   * display-size heading; `h3` keeps them at h3 where the section heading is
   * itself only h2 (sell), so the steps never match it.
   */
  titleSize?: "h2" | "h3";
}) {
  const root = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const el = root.current;
      if (el === null) return;
      const q = gsap.utils.selector(el);
      const [line] = q("[data-process-line]");
      const items = q("[data-process-step]");
      if (line === undefined) return;

      const markers = items
        .map((item) => item.querySelector<HTMLElement>("[data-process-marker]"))
        .filter((marker) => marker !== null);
      const reach = (marker: HTMLElement | null, reached: boolean) => {
        if (marker === null) return;
        if (reached) marker.dataset.reached = "true";
        else delete marker.dataset.reached;
      };

      const mm = gsap.matchMedia();

      const build = (travel: number, duration: number) => {
        gsap.fromTo(
          line,
          { scaleY: 0 },
          {
            scaleY: 1,
            ease: "none",
            scrollTrigger: { trigger: el, start: "top 70%", end: "bottom 70%", scrub: true },
          },
        );

        for (const item of items) {
          const marker = item.querySelector<HTMLElement>("[data-process-marker]");
          const body = item.querySelector("[data-process-body]");
          ScrollTrigger.create({
            trigger: item,
            start: "top 70%",
            onEnter: () => reach(marker, true),
            onLeaveBack: () => reach(marker, false),
          });
          if (body !== null) {
            gsap.from(body, {
              opacity: 0,
              y: travel,
              duration,
              ease: "estate",
              clearProps: "opacity,transform",
              scrollTrigger: { trigger: item, start: "top 82%", once: true },
            });
          }
        }

        return () => {
          for (const marker of markers) reach(marker, false);
        };
      };

      mm.add(MOTION_QUERIES.desktop, () => build(24, 1.1));
      mm.add(MOTION_QUERIES.mobile, () => build(14, 0.9));
      mm.add(MOTION_QUERIES.reduced, () => {
        gsap.set(line, { scaleY: 1 });
        for (const marker of markers) reach(marker, true);
        return () => {
          for (const marker of markers) reach(marker, false);
        };
      });

      return () => mm.revert();
    },
    { scope: root, dependencies: [steps.length] },
  );

  return (
    <div ref={root} className="relative">
      {/* The rail: a quiet track, and the bronze line that draws over it. */}
      <span aria-hidden="true" className="absolute bottom-4 left-[5px] top-4 w-px bg-hairline-light" />
      <span
        data-process-line=""
        aria-hidden="true"
        className="absolute bottom-4 left-[5px] top-4 w-px origin-top bg-bronze"
      />

      <ol className="flex flex-col gap-12 lg:gap-16">
        {steps.map((step, index) => (
          // Editable copy: two steps may share a title, the position never repeats.
          <li key={index} data-process-step="" className="relative grid grid-cols-[11px_1fr] gap-x-6 lg:gap-x-10">
            <span
              data-process-marker=""
              aria-hidden="true"
              className="relative mt-1 size-[11px] border border-stone bg-ivory transition-colors duration-300 ease-out data-[reached=true]:border-bronze data-[reached=true]:bg-bronze"
            />
            <div data-process-body="">
              <p aria-hidden="true" data-numeric="" className="font-mono text-label text-bronze-text">
                {pad(index + 1)}
              </p>
              <h3
                lang={step.titleLang}
                className={cn("mt-3 font-display text-h3 font-normal", titleSize === "h2" && "lg:text-h2")}
              >
                {step.title}
              </h3>
              <p lang={step.bodyLang} className="mt-3 max-w-[48ch] text-pretty text-body text-stone-text">
                {step.body}
              </p>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
