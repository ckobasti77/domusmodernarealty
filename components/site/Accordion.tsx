"use client";

import { Plus } from "lucide-react";
import { useId, useState, type ReactNode } from "react";
import { fixOrphans } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * Hairline accordion. Built on buttons and a `hidden` panel rather than
 * `<details>` so the open height can transition — `<details>` snaps.
 *
 * `grid-template-rows: 0fr → 1fr` is what makes the panel animate to its own
 * content height without measuring it in JS. The transition is 260ms, inside the
 * 300ms UI budget, and the whole thing is skipped under reduced motion by the
 * global rule in globals.css.
 */

export type AccordionItem = {
  id: string;
  question: ReactNode;
  answer: ReactNode;
};

export function Accordion({
  items,
  /** Index open on first render; omit to start fully closed. */
  defaultOpen,
  tone = "light",
  className,
}: {
  items: readonly AccordionItem[];
  defaultOpen?: number;
  tone?: "light" | "dark";
  className?: string;
}) {
  const baseId = useId();
  const [open, setOpen] = useState<string | null>(
    defaultOpen !== undefined ? (items[defaultOpen]?.id ?? null) : null,
  );

  return (
    <div className={cn(tone === "dark" ? "hairline-t-dark" : "hairline-t", className)}>
      {items.map((item) => {
        const isOpen = open === item.id;
        const panelId = `${baseId}-${item.id}-panel`;
        const buttonId = `${baseId}-${item.id}-button`;

        return (
          <div key={item.id} className={tone === "dark" ? "hairline-b-dark" : "hairline-b"}>
            <h3>
              <button
                type="button"
                id={buttonId}
                aria-expanded={isOpen}
                aria-controls={panelId}
                onClick={() => setOpen(isOpen ? null : item.id)}
                className={cn(
                  "flex w-full items-center justify-between gap-6 py-5 text-left",
                  "font-display text-h3 font-normal transition-colors duration-200 ease-out",
                  tone === "dark"
                    ? "text-ivory pointer-fine:hover:text-bronze"
                    : "text-ink pointer-fine:hover:text-bronze-text",
                )}
              >
                <span>
                  {typeof item.question === "string" ? fixOrphans(item.question) : item.question}
                </span>
                <Plus
                  aria-hidden="true"
                  strokeWidth={1.25}
                  className={cn(
                    "size-5 shrink-0 transition-transform duration-260 ease-out",
                    isOpen && "rotate-45",
                  )}
                />
              </button>
            </h3>

            <div
              id={panelId}
              role="region"
              aria-labelledby={buttonId}
              // `hidden` until open keeps the answer out of the tab order and
              // out of the accessibility tree entirely.
              hidden={!isOpen}
              className={cn(
                "grid transition-[grid-template-rows] duration-260 ease-out",
                isOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
              )}
            >
              <div className="overflow-hidden">
                <div
                  className={cn(
                    "max-w-[62ch] pb-6 text-body",
                    tone === "dark" ? "text-mist" : "text-stone-text",
                  )}
                >
                  {item.answer}
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
