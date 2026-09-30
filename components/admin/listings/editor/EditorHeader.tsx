"use client";

import { AlertTriangle, Check, CircleDot, Eye, Loader2, Save } from "lucide-react";
import { useEffect, useState } from "react";
import { useFormState, useWatch } from "react-hook-form";
import { StatusBadge } from "@/components/admin/common/StatusBadge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { formatRelative } from "@/lib/admin/format";
import type { ListingForm } from "@/lib/admin/listing-form";
import { cn } from "@/lib/utils";
import { useEditor, type EditorData } from "./editor-context";
import { countErrors } from "./error-count";
import { isOnSite, openAfterSave, publicPath, usePreviewLink } from "./preview";
import { useSaveSnapshot } from "./use-autosave";

export function EditorHeader({ data, onSave }: { data: EditorData; onSave: () => void }) {
  const listing = data.listing;
  return (
    <header className="sticky top-14 z-10 -mx-4 -mt-6 border-b bg-background/95 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/80 md:-mx-8 md:-mt-8 md:px-8">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <div className="flex min-w-0 flex-1 items-center gap-2.5">
          <span className="shrink-0 font-mono text-xs text-muted-foreground">{listing.ref}</span>
          <h1 className="min-w-0 truncate text-lg font-semibold tracking-tight">
            <LiveTitle />
          </h1>
          <span data-testid="editor-status" data-status={listing.status} className="shrink-0">
            <StatusBadge status={listing.status} />
          </span>
          {listing.isDemo ? (
            <Badge variant="outline" className="shrink-0 border-dashed">
              Demo
            </Badge>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          <SaveIndicator />
          <PreviewButton data={data} />
          <Tooltip>
            <TooltipTrigger asChild>
              <Button type="button" size="sm" data-testid="editor-save" onClick={onSave}>
                <Save aria-hidden="true" />
                Sačuvaj
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              Izmene se čuvaju i same. <kbd className="font-mono">Ctrl</kbd>/<kbd className="font-mono">⌘</kbd>+
              <kbd className="font-mono">S</kbd> čuva odmah.
            </TooltipContent>
          </Tooltip>
        </div>
      </div>
    </header>
  );
}

function LiveTitle() {
  const title = useWatch<ListingForm, "title.sr">({ name: "title.sr" });
  const text = title.trim();
  return text !== "" ? text : <span className="text-muted-foreground">Bez naslova</span>;
}

/** Ticks so "pre 2 minuta" stays true without re-rendering anything else. */
function useNow(intervalMs: number): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

const STATE_TEXT = {
  saved: "Sačuvano",
  saving: "Čuvanje…",
  dirty: "Nesačuvane izmene",
  error: "Greška pri čuvanju — pokušajte ponovo",
} as const;

function SaveIndicator() {
  const { engine } = useEditor();
  const snapshot = useSaveSnapshot(engine);
  const { errors } = useFormState<ListingForm>();
  const invalid = countErrors(errors);
  const now = useNow(30_000);
  const { state } = snapshot;

  return (
    <div
      data-testid="save-state"
      data-state={state}
      className={cn(
        "flex min-w-0 items-center gap-2 text-xs",
        state === "error" ? "text-destructive" : state === "dirty" ? "text-foreground" : "text-muted-foreground",
      )}
    >
      <span role="status" className="inline-flex items-center gap-1.5 whitespace-nowrap">
        {state === "saved" ? (
          <Check aria-hidden="true" className="size-3.5 text-emerald-700 dark:text-emerald-400" />
        ) : state === "saving" ? (
          <Loader2 aria-hidden="true" className="size-3.5 animate-spin" />
        ) : state === "dirty" ? (
          <CircleDot aria-hidden="true" className="size-3.5 text-amber-600 dark:text-amber-400" />
        ) : (
          <AlertTriangle aria-hidden="true" className="size-3.5" />
        )}
        {STATE_TEXT[state]}
        {state === "saved" ? (
          <span className="hidden text-muted-foreground sm:inline">
            · {formatRelative(snapshot.savedAt, Math.max(now, snapshot.savedAt))}
          </span>
        ) : null}
        {state === "error" && snapshot.error !== null ? <span className="sr-only">: {snapshot.error}</span> : null}
      </span>
      {state === "error" ? (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button type="button" variant="outline" size="xs" onClick={() => void engine.flush()}>
              Pokušaj ponovo
            </Button>
          </TooltipTrigger>
          {snapshot.error !== null ? <TooltipContent>{snapshot.error}</TooltipContent> : null}
        </Tooltip>
      ) : null}
      {invalid > 0 ? (
        <span className="font-medium whitespace-nowrap text-destructive">
          · {invalid} {invalid === 1 ? "polje sa greškom" : "polja sa greškom"}
        </span>
      ) : null}
    </div>
  );
}

function PreviewButton({ data }: { data: EditorData }) {
  const { engine } = useEditor();
  const listing = data.listing;
  const preview = usePreviewLink(listing);
  const live = isOnSite(listing);
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      disabled={preview.busy}
      onClick={() =>
        void openAfterSave(engine, async () =>
          live ? publicPath(listing.slug) : (preview.path ?? (await preview.create())),
        )
      }
    >
      <Eye aria-hidden="true" />
      Pregled
      <span className="sr-only">
        {live ? " (oglas na sajtu, nova kartica)" : " (pregled pre objave, nova kartica)"}
      </span>
    </Button>
  );
}
