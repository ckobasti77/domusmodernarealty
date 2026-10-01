"use client";

import { Table2 } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { formatShortDay } from "@/lib/admin/format";
import { cn } from "@/lib/utils";

const percentFmt = new Intl.NumberFormat("sr-Latn-RS", { style: "percent", maximumFractionDigits: 1 });

/** `12,5 %`, or `—` when there is nothing to divide by. */
export function formatShare(part: number, whole: number): string {
  return whole > 0 ? percentFmt.format(part / whole) : "—";
}

export type Period = 30 | 90;
export const PERIODS: readonly Period[] = [30, 90];

export function isPeriod(value: number): value is Period {
  return value === 30 || value === 90;
}

/** `22. sep – 28. sep`; the running week reads `od 29. sep (u toku)`. */
export function weekLabel(week: { start: number; end: number; partial: boolean }): string {
  if (week.partial) return `od ${formatShortDay(week.start)} (u toku)`;
  return `${formatShortDay(week.start)} – ${formatShortDay(week.end - 1)}`;
}

/** Rendered width of an element, tracked with ResizeObserver. */
export function useWidth(node: HTMLElement | null): number {
  const [width, setWidth] = useState(0);
  useEffect(() => {
    if (node === null) return;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry !== undefined) setWidth(Math.floor(entry.contentRect.width));
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, [node]);
  return width;
}

/**
 * Every chart carries its numbers as a table: visually hidden by default (so
 * screen readers always have it), shown for everyone with the "Tabela" toggle.
 */
export function useTableToggle(): { shown: boolean; toggle: ReactNode } {
  const [shown, setShown] = useState(false);
  return {
    shown,
    toggle: (
      <Button
        type="button"
        variant={shown ? "secondary" : "ghost"}
        size="sm"
        aria-pressed={shown}
        onClick={() => setShown((value) => !value)}
      >
        <Table2 aria-hidden="true" />
        Tabela
      </Button>
    ),
  };
}

export function tableClass(shown: boolean): string {
  // Hidden tables sit in an sr-only wrapper: `sr-only` on a <table> box does not clip it.
  return cn(shown ? "mt-4 w-full text-sm" : "w-full text-sm");
}

/** A note under a card when the server stopped reading at its cap. */
export function CappedNote({ children }: { children: ReactNode }) {
  return (
    <p className="mt-3 rounded-md border border-dashed px-3 py-2 text-xs text-muted-foreground" role="note">
      {children}
    </p>
  );
}
