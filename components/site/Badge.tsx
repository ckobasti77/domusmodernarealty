import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Small uppercase label inside a hairline box. Never a filled pill and never a
 * colour on its own — `status` badges carry their own word, so the meaning does
 * not depend on hue (WCAG 1.4.1).
 */

export type BadgeProps = {
  children: ReactNode;
  /** `accent` is bronze; the status tones are for sold/reserved ribbons. */
  tone?: "light" | "dark" | "accent" | "reserved" | "closed";
  className?: string;
};

const TONE: Record<NonNullable<BadgeProps["tone"]>, string> = {
  light: "border-hairline-light text-ink",
  dark: "border-hairline-dark text-ivory",
  accent: "border-bronze text-bronze-text",
  reserved: "border-warning text-warning-text",
  closed: "border-danger text-danger",
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
