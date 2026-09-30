import type { ListingStatus } from "@/convex/lib/validators";
import { STATUS_LABEL } from "@/lib/admin/labels";
import { cn } from "@/lib/utils";

/**
 * Listing status pill. Colour is never the only signal: the label is always
 * there, and each tone keeps ≥ 4.5:1 text contrast in both themes.
 */
const TONE: Record<ListingStatus, string> = {
  draft: "border-border bg-muted text-muted-foreground",
  review: "border-amber-700/30 bg-amber-100 text-amber-900 dark:border-amber-400/30 dark:bg-amber-400/15 dark:text-amber-200",
  published:
    "border-emerald-700/30 bg-emerald-100 text-emerald-900 dark:border-emerald-400/30 dark:bg-emerald-400/15 dark:text-emerald-200",
  reserved: "border-sky-700/30 bg-sky-100 text-sky-900 dark:border-sky-400/30 dark:bg-sky-400/15 dark:text-sky-200",
  sold: "border-primary/40 bg-primary/10 text-foreground",
  rented: "border-primary/40 bg-primary/10 text-foreground",
  withdrawn: "border-border bg-background text-muted-foreground",
  archived: "border-border bg-background text-muted-foreground line-through decoration-1",
};

export function StatusBadge({ status, className }: { status: ListingStatus; className?: string }) {
  return (
    <span
      data-status={status}
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium whitespace-nowrap",
        TONE[status],
        className,
      )}
    >
      {STATUS_LABEL[status]}
    </span>
  );
}
