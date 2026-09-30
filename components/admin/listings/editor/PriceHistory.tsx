import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { formatDate, formatEur } from "@/lib/admin/format";
import { priceDeltaPct } from "@/lib/format";
import { cn } from "@/lib/utils";

export type PriceChange = { at: number; from: number; to: number };

/**
 * Logged price changes, newest first. The direction is written out
 * ("sniženje", "povećanje"), never shown by colour alone.
 */
export function PriceHistoryList({ items, limit, compact = false }: { items: PriceChange[]; limit?: number; compact?: boolean }) {
  const shown = limit !== undefined ? items.slice(0, limit) : items;
  if (shown.length === 0) {
    return <p className="text-sm text-muted-foreground">Cena još nije menjana.</p>;
  }
  return (
    <ol className="divide-y text-sm">
      {shown.map((item) => {
        const first = item.from <= 0;
        const down = item.to < item.from;
        const pct = Math.abs(priceDeltaPct(item.from, item.to));
        return (
          <li
            key={`${item.at}-${item.to}`}
            className={cn(
              "grid items-baseline gap-x-3 gap-y-0.5 py-2 first:pt-0 last:pb-0",
              compact ? "grid-cols-[auto_1fr]" : "grid-cols-[6.5rem_1fr_auto]",
            )}
          >
            <time dateTime={new Date(item.at).toISOString()} className="text-xs text-muted-foreground tabular-nums">
              {formatDate(item.at)}
            </time>
            <span className="tabular-nums">
              {first ? (
                formatEur(item.to)
              ) : (
                <>
                  <span className="text-muted-foreground line-through decoration-1">{formatEur(item.from)}</span>{" "}
                  <span aria-hidden="true">→</span>
                  <span className="sr-only">na</span> {formatEur(item.to)}
                </>
              )}
            </span>
            <span
              className={cn(
                "inline-flex items-center gap-1 text-xs whitespace-nowrap tabular-nums",
                compact && "col-start-2",
                first
                  ? "text-muted-foreground"
                  : down
                    ? "text-emerald-800 dark:text-emerald-300"
                    : "text-amber-800 dark:text-amber-300",
              )}
            >
              {first ? (
                "prva cena"
              ) : (
                <>
                  {down ? (
                    <ArrowDownRight aria-hidden="true" className="size-3.5" />
                  ) : (
                    <ArrowUpRight aria-hidden="true" className="size-3.5" />
                  )}
                  {down ? "sniženje" : "povećanje"} {pct} %
                </>
              )}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
