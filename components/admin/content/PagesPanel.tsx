"use client";

import { useQuery } from "convex/react";
import { useCallback, useState } from "react";
import { ConfirmDialog } from "@/components/admin/common/ConfirmDialog";
import { DotBadge } from "@/components/admin/common/StatusBadge";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/convex/_generated/api";
import type { PageKey } from "@/convex/lib/validators";
import { formatRelative } from "@/lib/admin/format";
import { PAGE_KEY_LABEL } from "@/lib/admin/labels";
import { cn } from "@/lib/utils";
import { PageEditor } from "./PageEditor";
import { useNow } from "./use-now";

/**
 * Page picker + block editor. The picker is a vertical list beside the
 * editor on a desktop and a horizontally scrolling row above it on a phone
 * (the same buttons, so each page has one control). Leaving a page with
 * unsaved changes asks first.
 */
export function PagesPanel({
  selected,
  onSelect,
  onDirtyChange,
}: {
  selected: PageKey;
  onSelect: (key: PageKey) => void;
  onDirtyChange: (dirty: boolean) => void;
}) {
  const pages = useQuery(api.pagesAdmin.listKeys, {});
  const [dirty, setDirty] = useState(false);
  const [pending, setPending] = useState<PageKey | null>(null);
  const now = useNow(60_000);

  // Stable: the editor reports through it from an effect.
  const markDirty = useCallback(
    (next: boolean) => {
      setDirty(next);
      onDirtyChange(next);
    },
    [onDirtyChange],
  );

  const choose = (key: PageKey) => {
    if (key === selected) return;
    if (dirty) setPending(key);
    else onSelect(key);
  };

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[14rem_minmax(0,1fr)] lg:items-start">
      {/* An explicit min-0 track on phones: the nowrap page strip scrolls instead of widening the page. */}
      <nav aria-label="Stranice sajta" className="min-w-0 lg:sticky lg:top-20">
        {pages === undefined ? (
          <div className="flex gap-2 lg:flex-col" aria-busy="true" aria-label="Učitavanje stranica">
            {Array.from({ length: 8 }, (_unused, index) => (
              <Skeleton key={index} className="h-11 w-32 shrink-0 lg:w-full" />
            ))}
          </div>
        ) : (
          <ul className="-mx-4 flex gap-1 overflow-x-auto px-4 pb-1 lg:mx-0 lg:flex-col lg:overflow-visible lg:px-0 lg:pb-0">
            {pages.map((page) => {
              const active = page.key === selected;
              return (
                <li key={page.key} className="shrink-0">
                  <button
                    type="button"
                    onClick={() => choose(page.key)}
                    aria-current={active ? "page" : undefined}
                    data-testid={`content-page-${page.key}`}
                    className={cn(
                      "flex min-h-11 w-full flex-col items-start justify-center gap-0.5 rounded-md px-3 py-2 text-left transition-colors duration-150",
                      "hover:bg-muted",
                      active ? "bg-muted font-medium text-foreground" : "text-muted-foreground",
                    )}
                  >
                    <span className="text-sm whitespace-nowrap">{PAGE_KEY_LABEL[page.key]}</span>
                    <span className="hidden text-xs font-normal lg:block">
                      {page.isDemo ? (
                        <DotBadge tone="warning">Demo</DotBadge>
                      ) : page.updatedAt !== null ? (
                        `Izmenjeno ${formatRelative(Math.min(page.updatedAt, now), now)}`
                      ) : (
                        "Nije sačuvana"
                      )}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </nav>

      <PageEditor pageKey={selected} onDirtyChange={markDirty} />

      <ConfirmDialog
        open={pending !== null}
        onOpenChange={(open) => {
          if (!open) setPending(null);
        }}
        title="Napustiti stranicu bez čuvanja?"
        description="Izmene na ovoj stranici nisu sačuvane i biće izgubljene."
        confirmLabel="Napusti bez čuvanja"
        cancelLabel="Ostani"
        destructive
        onConfirm={() => {
          if (pending !== null) {
            markDirty(false);
            onSelect(pending);
          }
          setPending(null);
        }}
      />
    </div>
  );
}
