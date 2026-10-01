import { DotBadge, type DotTone } from "@/components/admin/common/StatusBadge";
import type { ViewingStatus } from "@/convex/lib/validators";
import { VIEWING_STATUS_LABEL } from "@/lib/admin/labels";

/** Status order for filters and legends: the workflow, then the dead ends. */
export const VIEWING_STATUS_ORDER: readonly ViewingStatus[] = [
  "requested",
  "confirmed",
  "done",
  "no_show",
  "cancelled",
];

const TONE: Record<ViewingStatus, DotTone> = {
  requested: "warning",
  confirmed: "accent",
  done: "success",
  no_show: "danger",
  cancelled: "muted",
};

/** Dot + word; the word carries the meaning. */
export function ViewingStatusBadge({ status, className }: { status: ViewingStatus; className?: string }) {
  return (
    <DotBadge tone={TONE[status]} className={className}>
      {VIEWING_STATUS_LABEL[status]}
    </DotBadge>
  );
}

/**
 * Calendar block surfaces. Text stays `foreground` on a light tint, so
 * contrast holds in both themes; the left rule carries the colour, a dashed
 * outline marks a request that still needs an answer, and a cancelled block
 * has its time struck through. The status word is always printed as well.
 */
export const EVENT_SURFACE: Record<ViewingStatus, string> = {
  requested: "border-warning bg-warning/15 border-dashed text-foreground",
  confirmed: "border-bronze bg-bronze/15 text-foreground",
  done: "border-success bg-success/15 text-foreground",
  no_show: "border-destructive bg-destructive/10 text-foreground",
  cancelled: "border-stone bg-muted text-muted-foreground",
};
