"use client";

import { Clock } from "lucide-react";
import { DotBadge } from "@/components/admin/common/StatusBadge";
import { formatDuration } from "@/components/admin/dashboard/format";
import type { LeadStatus } from "@/convex/lib/validators";
import { formatDate } from "@/lib/admin/format";
import { LEAD_STATUS_LABEL } from "@/lib/admin/labels";
import { cn } from "@/lib/utils";
import { RESPONSE_DUE_MS, STATUS_TONE, formatWait } from "./shared";

export function LeadStatusBadge({ status, className }: { status: LeadStatus; className?: string }) {
  return (
    <DotBadge tone={STATUS_TONE[status]} className={className}>
      {LEAD_STATUS_LABEL[status]}
    </DotBadge>
  );
}

/**
 * Time to first response (PRD B4). Running: "bez odgovora 3 h", in the warning
 * tone once the 1 h target has passed. Answered: "odgovoreno za 2 h 14 min"
 * (`long`) or nothing in the compact list form.
 */
export function ResponseTimer({
  createdAt,
  firstResponseAt,
  now,
  long = false,
  className,
}: {
  createdAt: number;
  firstResponseAt: number | undefined;
  now: number;
  long?: boolean;
  className?: string;
}) {
  if (firstResponseAt !== undefined) {
    if (!long) return null;
    const minutes = (firstResponseAt - createdAt) / 60_000;
    return (
      <span className={cn("inline-flex items-center gap-1.5 text-xs text-muted-foreground", className)}>
        <Clock className="size-3.5" aria-hidden="true" />
        {minutes < 1 ? "Odgovoreno u prvom minutu" : `Odgovoreno za ${formatDuration(minutes)}`}
      </span>
    );
  }
  const waited = Math.max(0, now - createdAt);
  const late = waited > RESPONSE_DUE_MS;
  return (
    <span
      data-late={late || undefined}
      className={cn(
        "inline-flex items-center gap-1.5 text-xs whitespace-nowrap tabular-nums",
        late ? "font-medium text-warning-text dark:text-warning" : "text-muted-foreground",
        className,
      )}
    >
      <Clock className={cn("size-3.5", late && "text-warning")} aria-hidden="true" />
      {long ? "Bez odgovora već " : "bez odgovora "}
      {formatWait(waited)}
      {late ? <span className="sr-only"> (rok od 1 h je prošao)</span> : null}
    </span>
  );
}

/** The next-action date, flagged when it is today or overdue. */
export function NextActionDate({ at, now }: { at: number | undefined; now: number }) {
  if (at === undefined) return <span className="text-xs text-muted-foreground">—</span>;
  const due = at <= now + 12 * 3_600_000;
  return (
    <span className={cn("text-xs tabular-nums whitespace-nowrap", due ? "font-medium" : "text-muted-foreground")}>
      {formatDate(at)}
      {due ? <span className="sr-only"> (rok je danas ili je prošao)</span> : null}
    </span>
  );
}

export function DemoTag() {
  return (
    <span className="inline-flex h-4 items-center rounded-sm border px-1 text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
      Demo
    </span>
  );
}
