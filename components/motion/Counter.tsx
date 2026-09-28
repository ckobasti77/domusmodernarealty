"use client";

import { useLocale } from "next-intl";
import { useRef } from "react";
import type { Locale } from "@/i18n/routing";
import { formatCount } from "@/lib/format";
import { cn } from "@/lib/utils";
import { gsap, MOTION_QUERIES, useGSAP } from "./gsap";

/**
 * Counts from 0 to `value` once, when the figure scrolls in. The digits are
 * tabular (via `data-numeric`), so the box never jitters as the number grows —
 * which is the whole reason this is not a plain CSS animation.
 *
 * The reduced branch writes the final number immediately.
 */

export type CounterProps = {
  value: number;
  /** Rendered before the number, e.g. a currency symbol. */
  prefix?: string;
  /** Rendered after the number, e.g. "+" or "m²". */
  suffix?: string;
  duration?: number;
  className?: string;
};

export function Counter({ value, prefix, suffix, duration = 1.6, className }: CounterProps) {
  const locale = useLocale() as Locale;
  const root = useRef<HTMLSpanElement>(null);

  useGSAP(
    () => {
      const el = root.current;
      if (el === null) return;
      const output = el.querySelector("[data-counter-value]");
      if (output === null) return;

      const write = (n: number) => {
        output.textContent = formatCount(n, locale);
      };

      const mm = gsap.matchMedia();

      mm.add(MOTION_QUERIES.reduced, () => {
        write(value);
      });

      const run = (seconds: number) => {
        const state = { n: 0 };
        write(0);
        gsap.to(state, {
          n: value,
          duration: seconds,
          ease: "power2.out",
          onUpdate: () => write(state.n),
          onComplete: () => write(value),
          scrollTrigger: { trigger: el, start: "top 85%", once: true },
        });
      };

      mm.add(MOTION_QUERIES.mobile, () => run(duration * 0.75));
      mm.add(MOTION_QUERIES.desktop, () => run(duration));

      return () => mm.revert();
    },
    { scope: root, dependencies: [value, duration, locale] },
  );

  return (
    <span ref={root} data-numeric className={cn("inline-flex items-baseline", className)}>
      {prefix !== undefined ? <span aria-hidden="true">{prefix}</span> : null}
      {/* The accessible value is the final number; the ticking text is hidden. */}
      <span className="sr-only">
        {prefix ?? ""}
        {formatCount(value, locale)}
        {suffix ?? ""}
      </span>
      <span data-counter-value aria-hidden="true">
        {formatCount(value, locale)}
      </span>
      {suffix !== undefined ? <span aria-hidden="true">{suffix}</span> : null}
    </span>
  );
}
