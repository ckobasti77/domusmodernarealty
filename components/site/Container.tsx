import type { ElementType, ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Layout primitives for the 12-column editorial grid (DESIGN §3): 1440px of
 * content inside 1600px of bleed, gutters 24 / 32 / 48.
 */

export type ContainerProps = {
  children: ReactNode;
  as?: ElementType;
  /** `bleed` widens to 1600px for full-width media. `flush` drops the gutters. */
  width?: "content" | "bleed" | "flush";
  className?: string;
};

export function Container({ children, as: Tag = "div", width = "content", className }: ContainerProps) {
  return (
    <Tag
      className={cn(
        "mx-auto w-full",
        width === "content" && "max-w-content px-gutter md:px-gutter-md lg:px-gutter-lg",
        width === "bleed" && "max-w-bleed px-gutter md:px-gutter-md lg:px-gutter-lg",
        width === "flush" && "max-w-bleed",
        className,
      )}
    >
      {children}
    </Tag>
  );
}

/**
 * The 12-column grid. Column spans are applied by the children with plain
 * `col-span-*` utilities, which keeps the asymmetry explicit at the call site
 * instead of hidden behind props.
 */
export function Grid({
  children,
  as: Tag = "div",
  className,
}: {
  children: ReactNode;
  as?: ElementType;
  className?: string;
}) {
  return (
    <Tag className={cn("grid grid-cols-4 gap-x-gutter gap-y-10 lg:grid-cols-12 lg:gap-x-gutter-lg", className)}>
      {children}
    </Tag>
  );
}

/** A vertical band with the section rhythm from DESIGN §3 (96px / 160px). */
export function Section({
  children,
  as: Tag = "section",
  tone = "ivory",
  className,
  ...rest
}: {
  children: ReactNode;
  as?: ElementType;
  tone?: "ivory" | "ivory-2" | "ink" | "none";
  className?: string;
  id?: string;
  "aria-labelledby"?: string;
}) {
  return (
    <Tag
      className={cn(
        "py-section lg:py-section-lg",
        tone === "ivory" && "bg-ivory text-ink",
        tone === "ivory-2" && "bg-ivory-2 text-ink",
        tone === "ink" && "bg-ink text-ivory",
        className,
      )}
      {...rest}
    >
      {children}
    </Tag>
  );
}
