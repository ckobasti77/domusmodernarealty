"use client";

import { Tabs as TabsPrimitive } from "radix-ui";
import { useEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import { cn } from "@/lib/utils";

/**
 * Public-site tabs, re-skinned onto Radix so arrow-key navigation, the roving
 * tabindex and the tab/panel wiring come for free. The visual language is the
 * project's: a hairline strip, an uppercase label, and a bronze rule that slides
 * under the active tab.
 *
 * `components/ui/tabs.tsx` stays untouched — that one is the admin's.
 */

export type SiteTab = {
  value: string;
  label: ReactNode;
  content: ReactNode;
};

export function Tabs({
  tabs,
  defaultValue,
  value,
  onValueChange,
  tone = "light",
  ariaLabel,
  className,
}: {
  tabs: readonly SiteTab[];
  defaultValue?: string;
  /** Controlled mode: pass both, e.g. when a URL hash selects the tab. */
  value?: string;
  onValueChange?: (value: string) => void;
  tone?: "light" | "dark";
  /** Names the tab strip; required when the tabs are not preceded by a heading. */
  ariaLabel?: string;
  className?: string;
}) {
  const first = defaultValue ?? tabs[0]?.value;
  const listRef = useRef<HTMLDivElement>(null);
  const clipped = useClippedEnd(listRef);
  if (first === undefined) return null;

  return (
    <TabsPrimitive.Root
      {...(value !== undefined ? { value, onValueChange } : { defaultValue: first })}
      className={cn("w-full", className)}
    >
      <TabsPrimitive.List
        ref={listRef}
        aria-label={ariaLabel}
        // One row that scrolls sideways on phones instead of wrapping. The
        // hairline is a background line, not a border: a scroll container
        // clips its border box, which would cut the active tab's underline.
        // It spans exactly the content column (the focus ring is drawn
        // inside each tab instead of in a negative margin), and while tabs
        // run past the right edge that edge fades, so a cut label reads as
        // "scroll for more" rather than as a rendering fault.
        className={cn(
          "flex gap-x-6 overflow-x-auto pt-1 [scrollbar-width:none] sm:gap-x-8",
          clipped && "[mask-image:linear-gradient(to_right,#000_85%,transparent)]",
          tone === "dark"
            ? "bg-[linear-gradient(to_top,var(--color-hairline-dark)_1px,transparent_1px)]"
            : "bg-[linear-gradient(to_top,var(--color-hairline-light)_1px,transparent_1px)]",
        )}
      >
        {tabs.map((tab) => (
          <TabsPrimitive.Trigger
            key={tab.value}
            value={tab.value}
            className={cn(
              "relative flex min-h-11 shrink-0 items-center whitespace-nowrap pb-3 pt-1 focus-visible:-outline-offset-2",
              "font-sans text-small font-medium uppercase tracking-[0.08em] sm:tracking-[0.12em]",
              "transition-colors duration-200 ease-out",
              "after:absolute after:inset-x-0 after:bottom-0 after:h-px after:origin-left after:scale-x-0",
              "after:transition-transform after:duration-300 after:ease-out",
              "data-[state=active]:after:scale-x-100",
              tone === "dark"
                ? "text-mist after:bg-bronze data-[state=active]:text-ivory pointer-fine:hover:text-ivory"
                : "text-stone-text after:bg-bronze-text data-[state=active]:text-ink pointer-fine:hover:text-ink",
            )}
          >
            {tab.label}
          </TabsPrimitive.Trigger>
        ))}
      </TabsPrimitive.List>

      {tabs.map((tab) => (
        <TabsPrimitive.Content
          key={tab.value}
          value={tab.value}
          className="pt-8 focus-visible:outline-2 focus-visible:outline-offset-4"
        >
          {tab.content}
        </TabsPrimitive.Content>
      ))}
    </TabsPrimitive.Root>
  );
}

/**
 * Whether a horizontal scroller has content past its right edge. Re-checked on
 * scroll and whenever the strip or a tab changes size (a late web font, a
 * rotated phone).
 */
function useClippedEnd(ref: RefObject<HTMLElement | null>): boolean {
  const [clipped, setClipped] = useState(false);
  useEffect(() => {
    const element = ref.current;
    if (element === null) return;
    const update = () => setClipped(element.scrollLeft + element.clientWidth < element.scrollWidth - 1);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(element);
    for (const child of element.children) observer.observe(child);
    element.addEventListener("scroll", update, { passive: true });
    return () => {
      observer.disconnect();
      element.removeEventListener("scroll", update);
    };
  }, [ref]);
  return clipped;
}
