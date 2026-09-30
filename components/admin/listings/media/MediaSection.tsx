"use client";

import { ImagePlus, TriangleAlert, Upload } from "lucide-react";
import { useId, useState, type DragEvent } from "react";
import { buttonVariants } from "@/components/ui/button";
import type { Id } from "@/convex/_generated/dataModel";
import type { MediaItem } from "@/convex/lib/validators";
import { cn } from "@/lib/utils";
import { MediaGrid } from "./MediaGrid";
import { ACCEPT_ATTR, MAX_FILES, MIN_PHOTOS, countNoun, type MediaTarget } from "./shared";
import { UploadList } from "./UploadList";
import { isActiveStatus, useUploadQueue } from "./useUploadQueue";

const RECOMMENDED_PHOTOS = 8;

const COPY: Record<
  MediaTarget,
  { title: string; hint: string; button: string; testId: string; emptyTitle: string; emptyBody: string; more: string }
> = {
  gallery: {
    title: "Fotografije",
    hint: "Najmanje 5 za objavu, preporučeno 8+; prva je naslovna dok ne izaberete drugu.",
    button: "Dodajte fotografije",
    testId: "media-upload-input",
    emptyTitle: "Još nema fotografija",
    emptyBody: "Prevucite fotografije ovde ili ih izaberite sa računara. Za objavu je potrebno najmanje 5.",
    more: "Prevucite još fotografija ovde ili ih izaberite sa računara.",
  },
  floorPlans: {
    title: "Tlocrti",
    hint: "Tlocrt stana ili skica rasporeda prostorija, kao slika.",
    button: "Dodajte tlocrt",
    testId: "floorplan-upload-input",
    emptyTitle: "Još nema tlocrta",
    emptyBody: "Prevucite tlocrt ovde ili ga izaberite sa računara.",
    more: "Prevucite još tlocrta ovde ili ih izaberite sa računara.",
  },
};

function carriesFiles(event: DragEvent<HTMLElement>): boolean {
  return Array.from(event.dataTransfer.types).includes("Files");
}

/** One collection (gallery or floor plans): header, drop zone, upload rows, sortable grid. */
export function MediaSection({
  listingId,
  target,
  items,
  urls,
}: {
  listingId: Id<"listings">;
  target: MediaTarget;
  items: readonly MediaItem[];
  urls: Record<string, string>;
}) {
  const uploads = useUploadQueue(listingId, target);
  const headingId = useId();
  const inputId = useId();
  const formatsId = useId();
  const [dropping, setDropping] = useState(false);

  const copy = COPY[target];
  const count = items.length;
  const pending = uploads.rows.filter((row) => isActiveStatus(row.status)).length;
  const full = count + pending >= MAX_FILES;
  const empty = count === 0 && pending === 0;
  const gallery = target === "gallery";

  const missingAlt = items.filter((item) => item.alt.sr.trim().length === 0).length;
  const hasCover = items.some((item) => item.isCover === true);

  const addFiles = (files: FileList | null) => {
    if (files === null || files.length === 0) return;
    uploads.add(Array.from(files), count);
  };

  const notes: string[] = [];
  if (gallery && count > 0 && count < MIN_PHOTOS) {
    notes.push(`Za objavu nedostaje još ${countNoun(MIN_PHOTOS - count, "gallery")}.`);
  } else if (gallery && count >= MIN_PHOTOS && count < RECOMMENDED_PHOTOS) {
    notes.push(`Preporučeno je ${RECOMMENDED_PHOTOS} ili više fotografija.`);
  }
  if (gallery && count > 0 && !hasCover) {
    notes.push("Nijedna fotografija nije označena kao naslovna — izaberite je zvezdicom.");
  }
  if (missingAlt > 0) {
    notes.push(`Bez opisa na srpskom: ${missingAlt}. Dodajte ga dugmetom za uređivanje (olovka).`);
  }

  return (
    <section aria-labelledby={headingId} className="space-y-4 rounded-xl border bg-card p-4 md:p-5">
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
        <div className="space-y-1">
          <h2 id={headingId} className="text-base font-semibold">
            {copy.title}
          </h2>
          <p className="text-sm text-muted-foreground">{copy.hint}</p>
        </div>
        <p className="text-sm font-medium tabular-nums text-muted-foreground">
          <span aria-hidden="true">
            {count} / {MAX_FILES}
          </span>
          <span className="sr-only">
            {count} od najviše {MAX_FILES}
          </span>
        </p>
      </div>

      {notes.length > 0 ? (
        <ul className="space-y-1">
          {notes.map((note) => (
            <li key={note} className="flex items-start gap-1.5 text-xs text-warning-text dark:text-warning">
              <TriangleAlert aria-hidden="true" className="mt-px size-3.5 shrink-0" />
              {note}
            </li>
          ))}
        </ul>
      ) : null}

      <div
        data-dropping={dropping ? "true" : undefined}
        onDragOver={(event) => {
          if (!carriesFiles(event)) return;
          event.preventDefault();
          event.dataTransfer.dropEffect = full ? "none" : "copy";
          setDropping(true);
        }}
        onDragLeave={(event) => {
          const next = event.relatedTarget;
          if (next instanceof Node && event.currentTarget.contains(next)) return;
          setDropping(false);
        }}
        onDrop={(event) => {
          if (!carriesFiles(event)) return;
          event.preventDefault();
          setDropping(false);
          if (!full) addFiles(event.dataTransfer.files);
        }}
        className={cn(
          "flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed px-4 text-center transition-colors duration-150",
          empty ? "py-10" : "py-4 sm:flex-row sm:justify-between sm:text-left",
          dropping ? "border-primary bg-primary/5" : "border-border bg-muted/30",
        )}
      >
        {empty ? (
          <div className="flex flex-col items-center gap-2">
            <ImagePlus aria-hidden="true" strokeWidth={1.5} className="size-8 text-muted-foreground" />
            <p className="text-sm font-medium">{copy.emptyTitle}</p>
            <p className="max-w-sm text-sm text-muted-foreground">{copy.emptyBody}</p>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            {full
              ? `Dostignut je limit od ${MAX_FILES} fajlova.`
              : copy.more}
          </p>
        )}
        <div className="flex flex-col items-center gap-1.5 sm:items-end">
          <input
            id={inputId}
            type="file"
            multiple
            accept={ACCEPT_ATTR}
            disabled={full}
            data-testid={copy.testId}
            aria-describedby={formatsId}
            className="peer sr-only"
            onChange={(event) => {
              addFiles(event.currentTarget.files);
              // Allow picking the same file again after an error.
              event.currentTarget.value = "";
            }}
          />
          <label
            htmlFor={inputId}
            className={cn(
              buttonVariants({ variant: empty ? "default" : "outline" }),
              "cursor-pointer peer-focus-visible:border-ring peer-focus-visible:ring-3 peer-focus-visible:ring-ring/50 peer-disabled:pointer-events-none peer-disabled:opacity-50",
            )}
          >
            <Upload aria-hidden="true" />
            {copy.button}
          </label>
          <p id={formatsId} className="text-xs text-muted-foreground">
            JPEG, PNG, WebP ili AVIF · do 20 MB po fajlu
          </p>
        </div>
      </div>

      <UploadList
        rows={uploads.rows}
        onRetry={uploads.retry}
        onDismiss={uploads.dismiss}
        onClear={uploads.clearFinished}
      />

      {count > 0 ? <MediaGrid listingId={listingId} target={target} items={items} urls={urls} /> : null}
    </section>
  );
}
