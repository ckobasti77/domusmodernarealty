import { cva, type VariantProps } from "class-variance-authority";
import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

/**
 * The public-site button. Sharp, 52px tall, and on hover a bronze rule grows
 * from the left while the label shifts 2px (DESIGN §4).
 *
 * Hover is gated behind `pointer-fine` (a custom variant in globals.css) so a
 * tap on a phone does not leave the button stuck in its hover state. `:active`
 * scales to 0.98 — the press feedback that makes a button feel heard.
 *
 * `buttonClasses` is exported separately because localized navigation must go
 * through next-intl's `<Link>`, which needs the classes rather than a wrapper.
 */
export const buttonClasses = cva(
  [
    "group/btn relative inline-flex select-none items-center justify-center gap-3",
    "font-sans font-medium uppercase tracking-[0.12em]",
    "rounded-none transition-[transform,background-color,color,border-color] duration-200 ease-out",
    "focus-visible:outline-2 focus-visible:outline-offset-4 active:scale-[0.98]",
    "disabled:pointer-events-none disabled:opacity-45",
    // The bronze rule. It is a pseudo-element so no extra DOM is needed.
    "after:absolute after:inset-x-0 after:bottom-0 after:h-px after:origin-left after:scale-x-0",
    "after:bg-bronze after:transition-transform after:duration-300 after:ease-out",
    "pointer-fine:hover:after:scale-x-100 focus-visible:after:scale-x-100",
  ],
  {
    variants: {
      variant: {
        /** Ink block on a light surface. */
        primary: "bg-ink text-ivory pointer-fine:hover:bg-ink-2",
        /** Ivory block on a dark surface. */
        inverse: "bg-ivory text-ink pointer-fine:hover:bg-paper",
        /** Hairline outline; inherits the surface's text colour. */
        outline:
          "border border-current bg-transparent pointer-fine:hover:border-bronze pointer-fine:hover:text-bronze-text",
        /** Outline for dark surfaces, where bronze is the AA-safe accent. */
        outlineDark:
          "border border-hairline-dark bg-transparent text-ivory pointer-fine:hover:border-bronze pointer-fine:hover:text-bronze",
        /** No chrome at all; used inside toolbars and cards. */
        ghost: "bg-transparent pointer-fine:hover:text-bronze-text",
      },
      size: {
        /** DESIGN §4: 52px. */
        default: "h-[52px] px-8 text-small",
        /** Still above the 44px touch minimum. */
        compact: "h-11 px-5 text-small",
        /** Square icon button, 44px so it meets WCAG 2.5.8 comfortably. */
        icon: "size-11 px-0",
      },
    },
    defaultVariants: { variant: "primary", size: "default" },
  },
);

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof buttonClasses>;

export function Button({ className, variant, size, type = "button", children, ...rest }: ButtonProps) {
  return (
    <button type={type} className={cn(buttonClasses({ variant, size }), className)} {...rest}>
      {/* The 2px label shift that pairs with the growing rule. */}
      <span className="transition-transform duration-200 ease-out pointer-fine:group-hover/btn:-translate-y-[2px]">
        {children}
      </span>
    </button>
  );
}
