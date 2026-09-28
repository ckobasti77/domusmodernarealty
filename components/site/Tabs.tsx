"use client";

import { Tabs as TabsPrimitive } from "radix-ui";
import type { ReactNode } from "react";
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
  if (first === undefined) return null;

  return (
    <TabsPrimitive.Root
      {...(value !== undefined ? { value, onValueChange } : { defaultValue: first })}
      className={cn("w-full", className)}
    >
      <TabsPrimitive.List
        aria-label={ariaLabel}
        className={cn(
          "flex flex-wrap gap-x-8",
          tone === "dark" ? "hairline-b-dark" : "hairline-b",
        )}
      >
        {tabs.map((tab) => (
          <TabsPrimitive.Trigger
            key={tab.value}
            value={tab.value}
            className={cn(
              "relative -mb-px flex min-h-11 items-center pb-3 pt-1",
              "font-sans text-small font-medium uppercase tracking-[0.12em]",
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
