"use client";

import { CalendarDays, CircleDot, MessageSquareText } from "lucide-react";
import { formatDateTime } from "@/lib/admin/format";
import { cn } from "@/lib/utils";
import { timelineLabel, timelineSummary } from "./detail-format";
import type { LeadDetail } from "./shared";

type Item = LeadDetail["timeline"][number];

const ICON = {
  activity: CircleDot,
  note: MessageSquareText,
  viewing: CalendarDays,
} as const;

/**
 * Everything that happened to the lead, newest first: activity (created,
 * stage changes, assignment, response, next step), notes and viewings.
 */
export function LeadTimeline({ items }: { items: readonly Item[] }) {
  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground">Još nema zabeleženih događaja.</p>;
  }
  return (
    <ol data-testid="lead-timeline" className="relative space-y-4 border-l pl-5">
      {items.map((item) => {
        const Icon = ICON[item.kind];
        const summary = timelineSummary(item.action, item.summary, item.start);
        return (
          <li key={item.key} data-action={item.action} className="relative">
            <span
              aria-hidden="true"
              className="absolute top-0.5 -left-[1.6875rem] flex size-4 items-center justify-center rounded-full bg-background text-muted-foreground"
            >
              <Icon className="size-3.5" />
            </span>
            <p className="text-sm font-medium">{timelineLabel(item.action)}</p>
            {summary !== undefined ? (
              <p
                className={cn(
                  "mt-0.5 text-sm text-muted-foreground",
                  item.kind === "note" && "line-clamp-3 whitespace-pre-wrap",
                )}
              >
                {summary}
              </p>
            ) : null}
            <p className="mt-0.5 text-xs text-muted-foreground">
              <time dateTime={new Date(item.at).toISOString()}>{formatDateTime(item.at)}</time>
              {item.byName !== undefined ? ` · ${item.byName}` : null}
            </p>
          </li>
        );
      })}
    </ol>
  );
}
