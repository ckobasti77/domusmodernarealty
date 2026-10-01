"use client";

import { ExternalLink, FileText, Loader2, Trash2, Upload } from "lucide-react";
import { useId, useRef, useState } from "react";
import { toast } from "sonner";
import { useStorageUpload } from "@/components/admin/common/ImageField";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import type { Id } from "@/convex/_generated/dataModel";

/** Same limit as `convex/lib/storage.ts::MAX_PDF_BYTES`. */
const MAX_PDF_BYTES = 15 * 1024 * 1024;

function formatSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1).replace(".", ",")} MB`;
}

/**
 * The general terms PDF: shows the saved document with a link, uploads a
 * replacement (PDF only, at most 15 MB, checked again by the server on save)
 * or removes it. A new upload is linked to the settings only when the form is
 * saved; the old file is deleted then.
 */
export function PdfField({
  label,
  hint,
  value,
  savedId,
  savedUrl,
  savedBytes,
  onChange,
}: {
  label: string;
  hint?: string;
  value: Id<"_storage"> | null;
  /** The id currently stored in settings (null when none). */
  savedId: Id<"_storage"> | null;
  savedUrl?: string;
  savedBytes?: number;
  onChange: (next: Id<"_storage"> | null) => void;
}) {
  const id = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const { upload, progress } = useStorageUpload();
  const [picked, setPicked] = useState<{ storageId: Id<"_storage">; name: string; size: number } | null>(null);

  const pick = async (file: File | undefined) => {
    if (file === undefined) return;
    if (file.type !== "application/pdf") {
      toast.error(`Fajl „${file.name}” nije PDF.`);
      return;
    }
    if (file.size === 0) {
      toast.error(`Fajl „${file.name}” je prazan.`);
      return;
    }
    if (file.size > MAX_PDF_BYTES) {
      toast.error(`Fajl „${file.name}” je prevelik (${formatSize(file.size)}); najviše 15 MB.`);
      return;
    }
    const storageId = await upload(file);
    if (storageId === null) return;
    setPicked({ storageId, name: file.name, size: file.size });
    onChange(storageId);
  };

  const isSaved = value !== null && value === savedId;
  const isNew = value !== null && picked !== null && picked.storageId === value;
  const busy = progress !== null;

  return (
    <div className="col-span-full flex min-w-0 flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <div className="flex flex-wrap items-center gap-3 rounded-lg border bg-muted/40 px-3 py-2.5" aria-live="polite">
        <FileText className="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
        <div className="min-w-0 flex-1 text-sm">
          {value === null ? (
            <p className="text-muted-foreground">
              {savedId !== null ? "Dokument će biti uklonjen kada sačuvate." : "Nijedan dokument nije otpremljen."}
            </p>
          ) : isNew ? (
            <p>
              <span className="font-medium break-all">{picked.name}</span>{" "}
              <span className="text-muted-foreground">
                ({formatSize(picked.size)}) — {savedId !== null ? "zameniće postojeći" : "biće objavljen"} kada sačuvate.
              </span>
            </p>
          ) : isSaved ? (
            <p className="flex flex-wrap items-center gap-x-2">
              <span className="font-medium">Opšti uslovi poslovanja (PDF)</span>
              {savedBytes !== undefined ? <span className="text-muted-foreground">{formatSize(savedBytes)}</span> : null}
              {savedUrl !== undefined ? (
                <a
                  href={savedUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 rounded-sm text-primary underline underline-offset-2 outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  Otvorite trenutni PDF
                  <ExternalLink className="size-3.5" aria-hidden="true" />
                  <span className="sr-only">(otvara se u novom prozoru)</span>
                </a>
              ) : null}
            </p>
          ) : (
            <p className="text-muted-foreground">Dokument je izabran.</p>
          )}
        </div>
        {busy ? (
          <div className="w-full">
            <Progress value={progress} aria-label="Otpremanje PDF-a" />
          </div>
        ) : null}
      </div>
      <div className="flex flex-wrap gap-2">
        <input
          ref={inputRef}
          id={id}
          type="file"
          accept="application/pdf,.pdf"
          className="sr-only"
          aria-describedby={hint !== undefined ? `${id}-hint` : undefined}
          onChange={(event) => {
            void pick(event.target.files?.[0]);
            event.target.value = "";
          }}
        />
        <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => inputRef.current?.click()}>
          {busy ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Upload aria-hidden="true" />}
          {value === null ? "Otpremite PDF" : "Zamenite PDF"}
        </Button>
        {value !== null ? (
          <Button type="button" variant="ghost" size="sm" disabled={busy} onClick={() => onChange(null)}>
            <Trash2 aria-hidden="true" />
            Uklonite
          </Button>
        ) : savedId !== null ? (
          <Button type="button" variant="ghost" size="sm" disabled={busy} onClick={() => onChange(savedId)}>
            Vratite postojeći
          </Button>
        ) : null}
      </div>
      {hint !== undefined ? (
        <p id={`${id}-hint`} className="text-xs text-muted-foreground">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
