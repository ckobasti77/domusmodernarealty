import type { ReactNode } from "react";
import { SplitReveal } from "@/components/motion/SplitReveal";
import { fixTypography, fixWidows } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Eyebrow } from "./Eyebrow";

/**
 * Eyebrow + serif title with the masked line reveal + optional lede
 * (DESIGN §4). The heading level is explicit because a section's rank depends on
 * where it sits on the page, not on how it looks.
 *
 * Note the deliberate absence of `text-balance`: SplitText re-splits on resize
 * and balanced wrapping fights it (CLAUDE.md hard rule). The measure is
 * constrained with `max-w-*` instead.
 */

export type SectionHeadingProps = {
  eyebrow?: ReactNode;
  eyebrowIndex?: number;
  /** Overrides the surface-derived eyebrow tone, e.g. "dark" over a photograph. */
  eyebrowTone?: "light" | "dark" | "accent" | "accentDark";
  title: ReactNode;
  lede?: ReactNode;
  /** 1 only for the page's single main title. */
  level?: 1 | 2 | 3;
  size?: "display-l" | "display-m" | "h2";
  tone?: "light" | "dark";
  /** Trailing link or button, aligned with the title on wide screens. */
  action?: ReactNode;
  id?: string;
  className?: string;
};

const SIZE = {
  "display-l": "text-display-l",
  "display-m": "text-display-m",
  h2: "text-h2",
} as const;

export function SectionHeading({
  eyebrow,
  eyebrowIndex,
  eyebrowTone,
  title,
  lede,
  level = 2,
  size = "display-m",
  tone = "light",
  action,
  id,
  className,
}: SectionHeadingProps) {
  const Heading = `h${level}` as "h1" | "h2" | "h3";

  return (
    <div className={cn("flex flex-col gap-4", className)}>
      {eyebrow !== undefined ? (
        <Eyebrow index={eyebrowIndex} tone={eyebrowTone ?? (tone === "dark" ? "accentDark" : "accent")}>
          {eyebrow}
        </Eyebrow>
      ) : null}

      <div className="flex flex-wrap items-end justify-between gap-x-10 gap-y-6">
        <Heading
          id={id}
          className={cn(
            "max-w-[22ch] font-display font-normal",
            SIZE[size],
            tone === "dark" ? "text-ivory" : "text-ink",
          )}
        >
          <SplitReveal as="span" className="block">
            {typeof title === "string" ? fixWidows(title) : title}
          </SplitReveal>
        </Heading>
        {action !== undefined ? <div className="max-w-full shrink-0 pb-1">{action}</div> : null}
      </div>

      {lede !== undefined ? (
        <p
          className={cn(
            "mt-4 max-w-[56ch] text-pretty text-body-l lg:mt-6",
            tone === "dark" ? "text-mist" : "text-stone-text",
          )}
        >
          {typeof lede === "string" ? fixTypography(lede) : lede}
        </p>
      ) : null}
    </div>
  );
}
