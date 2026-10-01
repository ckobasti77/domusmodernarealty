import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Small uppercase label inside a hairline box. Never a filled pill and never a
 * colour on its own — `status` badges carry their own word, so the meaning does
 * not depend on hue (WCAG 1.4.1).
 */

export type BadgeProps = {
  children: ReactNode;
  /**
   * Three tones, deliberately. Five hairline boxes in four near-identical
   * values read as one badge glitching (design-critic, step 04). `accent` is
   * reserved for Ekskluzivno; `status` is the filled ribbon PRD A5 requires for
   * Rezervisano / Prodato / Izdato, which must survive on top of a photograph.
   */
  tone?: "light" | "dark" | "accent" | "status";
  className?: string;
};

const TONE: Record<NonNullable<BadgeProps["tone"]>, string> = {
  light: "border-ink/30 text-ink", // 12% is 1.29:1 on ivory; 30% clears 3:1
  // `dark` sits directly on a photograph, so it carries its own scrim rather
  // than trusting whatever the image happens to be behind it (DESIGN 5). The
  // same ink/70 as the card's carousel chrome; no backdrop blur, which made no
  // visible difference at 2px and left blank bars in long Chromium captures.
  dark: "border-ivory/40 bg-ink/70 text-ivory",
  accent: "border-bronze-text text-bronze-text",
  status: "border-ink bg-ink text-ivory",
};

export function Badge({ children, tone = "light", className }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center border px-2.5 py-1 font-sans text-label font-medium uppercase tracking-[0.12em]",
        TONE[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
