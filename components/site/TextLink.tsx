import type { AnchorHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

/**
 * Inline link with an underline that draws from the left on hover and focus.
 * The rule is a pseudo-element rather than `text-decoration`, so it can be
 * animated on the compositor and sits on the baseline instead of cutting through
 * descenders.
 *
 * `textLinkClasses` exists so next-intl's `<Link>` can wear the same styling.
 */
export function textLinkClasses(tone: "light" | "dark" = "light", className?: string): string {
  return cn(
    // The rule is present at rest (WCAG 1.4.1: a link must not be identifiable
    // by colour alone) and only gains weight on hover, instead of growing from
    // nothing.
    "relative inline-block transition-colors duration-200 ease-out",
    "after:absolute after:inset-x-0 after:-bottom-0.5 after:h-px after:origin-left",
    "after:opacity-40 after:transition-opacity after:duration-300 after:ease-out",
    "pointer-fine:hover:after:opacity-100 focus-visible:after:opacity-100",
    tone === "dark"
      ? "text-ivory after:bg-bronze pointer-fine:hover:text-bronze"
      : "text-ink after:bg-bronze-text pointer-fine:hover:text-bronze-text",
    className,
  );
}

export type TextLinkProps = AnchorHTMLAttributes<HTMLAnchorElement> & {
  tone?: "light" | "dark";
};

export function TextLink({ tone = "light", className, children, ...rest }: TextLinkProps) {
  return (
    <a className={textLinkClasses(tone, className)} {...rest}>
      {children}
    </a>
  );
}
