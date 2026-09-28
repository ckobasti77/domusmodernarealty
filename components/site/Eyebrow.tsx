import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * The small tracked label above a section heading. It is a `<p>`, not a heading:
 * an eyebrow is a category, and putting it in the heading outline would make
 * every section announce two titles.
 *
 * `index` turns it into the numbered form used by the services and process
 * lists, where the content genuinely is a sequence.
 */
export type EyebrowProps = {
  children: ReactNode;
  /** Zero-padded sequence number, e.g. 3 renders "03". */
  index?: number;
  /**
   * Surface-aware tone. `accent` is bronze on a LIGHT surface and resolves to
   * `--color-bronze-text` (4.52:1 on ivory-2); `accentDark` is bronze on ink
   * (5.19:1 on ink-3). The raw `--color-bronze` is 2.70:1 on ivory and must
   * never carry text there.
   */
  tone?: "light" | "dark" | "accent" | "accentDark";
  className?: string;
};

const TONE: Record<NonNullable<EyebrowProps["tone"]>, string> = {
  light: "text-stone-text",
  dark: "text-mist",
  accent: "text-bronze-text",
  accentDark: "text-bronze",
};

export function Eyebrow({ children, index, tone = "accent", className }: EyebrowProps) {
  return (
    <p className={cn("eyebrow flex items-center gap-3", TONE[tone], className)}>
      {index !== undefined ? (
        <span data-numeric className="font-mono text-label">
          {String(index).padStart(2, "0")}
        </span>
      ) : null}
      <span>{children}</span>
    </p>
  );
}
