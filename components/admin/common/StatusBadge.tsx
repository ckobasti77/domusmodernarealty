import type { ReactNode } from "react";
import type { ListingStatus } from "@/convex/lib/validators";
import { STATUS_LABEL } from "@/lib/admin/labels";
import { cn } from "@/lib/utils";

/**
 * Listing status as a 6 px dot and a word (no fill, no pill). The word always
 * carries the meaning; the dot only speeds up scanning. Dot colours are the
 * brand state tokens (DESIGN §1), which read on paper and on the dark card.
 */
const TONE: Record<ListingStatus, { dot: string; text: string }> = {
  published: { dot: "bg-success", text: "text-foreground" },
  reserved: { dot: "bg-warning", text: "text-foreground" },
  review: { dot: "bg-bronze", text: "text-foreground" },
  sold: { dot: "bg-foreground", text: "text-foreground" },
  rented: { dot: "bg-foreground", text: "text-foreground" },
  // Out-of-circulation states step back: stone dot, muted text (#6f685c on
  // paper ≈ 5.3:1, #b9b0a2 on the dark card ≈ 8:1).
  draft: { dot: "bg-stone", text: "text-muted-foreground" },
  withdrawn: { dot: "bg-stone", text: "text-muted-foreground" },
  archived: { dot: "bg-stone", text: "text-muted-foreground" },
};

export function StatusBadge({ status, className }: { status: ListingStatus; className?: string }) {
  const tone = TONE[status];
  return (
    <span
      data-status={status}
      className={cn(
        "inline-flex items-center gap-1.5 text-xs leading-none font-medium whitespace-nowrap",
        tone.text,
        className,
      )}
    >
      <span aria-hidden="true" className={cn("size-1.5 shrink-0 rounded-full", tone.dot)} />
      {STATUS_LABEL[status]}
    </span>
  );
}

export type DotTone = "success" | "warning" | "accent" | "strong" | "muted" | "danger";

const DOT_TONE: Record<DotTone, { dot: string; text: string }> = {
  success: { dot: "bg-success", text: "text-foreground" },
  warning: { dot: "bg-warning", text: "text-foreground" },
  accent: { dot: "bg-bronze", text: "text-foreground" },
  strong: { dot: "bg-foreground", text: "text-foreground" },
  muted: { dot: "bg-stone", text: "text-muted-foreground" },
  danger: { dot: "bg-destructive", text: "text-foreground" },
};

/**
 * The same dot + word as `StatusBadge`, for any other status (lead stage,
 * viewing, post, user). The word carries the meaning; the dot aids scanning.
 */
export function DotBadge({ tone, children, className }: { tone: DotTone; children: ReactNode; className?: string }) {
  const style = DOT_TONE[tone];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 text-xs leading-none font-medium whitespace-nowrap",
        style.text,
        className,
      )}
    >
      <span aria-hidden="true" className={cn("size-1.5 shrink-0 rounded-full", style.dot)} />
      {children}
    </span>
  );
}
