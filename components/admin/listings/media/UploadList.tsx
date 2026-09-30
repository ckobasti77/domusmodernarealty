"use client";

import { CircleAlert, CircleCheck, FileImage, Loader2, RotateCcw, TriangleAlert, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { MIN_LONG_SIDE, isLowRes } from "./shared";
import { isActiveStatus, type UploadRow, type UploadStatus } from "./useUploadQueue";

function statusText(row: UploadRow): string {
  const labels: Record<UploadStatus, string> = {
    queued: "Na čekanju",
    uploading: `${row.progress}%`,
    uploaded: "Čeka dodavanje",
    attaching: "Dodaje se…",
    done: "Dodato",
    failed: "Neuspešno",
    rejected: "Odbijeno",
  };
  return labels[row.status];
}

/** Per-file upload rows: name, progress, low-resolution warning, error + retry. */
export function UploadList({
  rows,
  onRetry,
  onDismiss,
  onClear,
}: {
  rows: readonly UploadRow[];
  onRetry: (key: string) => void;
  onDismiss: (key: string) => void;
  onClear: () => void;
}) {
  if (rows.length === 0) return null;

  const accepted = rows.filter((row) => row.status !== "rejected");
  const finished = accepted.filter((row) => row.status === "done").length;
  const active = rows.some((row) => isActiveStatus(row.status));
  const hasFinished = rows.some((row) => !isActiveStatus(row.status));

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground" aria-live="polite">
          {active
            ? `Otpremanje: ${finished} od ${accepted.length} završeno`
            : "Otpremanje je završeno. Proverite fajlove ispod."}
        </p>
        {hasFinished ? (
          <Button type="button" variant="ghost" size="xs" onClick={onClear}>
            Očisti listu
          </Button>
        ) : null}
      </div>
      <ul className="space-y-1.5">
        {rows.map((row) => {
          const failed = row.status === "failed";
          const rejected = row.status === "rejected";
          const lowRes = row.size !== undefined && isLowRes(row.size.w, row.size.h);
          const messageId = `${row.key}-message`;
          return (
            <li
              key={row.key}
              className={cn(
                "flex items-start gap-3 rounded-lg border bg-background px-3 py-2",
                (failed || rejected) && "border-destructive/40",
              )}
            >
              <span aria-hidden="true" className="mt-0.5 text-muted-foreground">
                {row.status === "done" ? (
                  <CircleCheck className="size-4 text-success-text dark:text-success" />
                ) : failed || rejected ? (
                  <CircleAlert className="size-4 text-destructive" />
                ) : row.status === "attaching" ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <FileImage className="size-4" />
                )}
              </span>
              <div className="min-w-0 flex-1 space-y-1.5">
                <div className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="truncate font-medium" title={row.name}>
                    {row.name}
                  </span>
                  <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{statusText(row)}</span>
                </div>
                {rejected ? null : (
                  <Progress
                    value={row.progress}
                    data-testid="upload-progress"
                    data-status={row.status}
                    aria-label={`Otpremanje fajla ${row.name}`}
                    aria-describedby={row.message !== undefined ? messageId : undefined}
                  />
                )}
                {lowRes && row.size !== undefined ? (
                  <p className="flex items-center gap-1.5 text-xs text-warning-text dark:text-warning">
                    <TriangleAlert aria-hidden="true" className="size-3.5 shrink-0" />
                    Mala rezolucija ({row.size.w} × {row.size.h} px). Preporučeno je najmanje {MIN_LONG_SIDE} px po
                    dužoj strani.
                  </p>
                ) : null}
                {row.message !== undefined ? (
                  <p id={messageId} className="text-xs text-destructive">
                    {row.message}
                  </p>
                ) : null}
              </div>
              {failed ? (
                <Button type="button" variant="outline" size="sm" onClick={() => onRetry(row.key)}>
                  <RotateCcw aria-hidden="true" />
                  Pokušaj ponovo
                </Button>
              ) : null}
              {failed || rejected ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Ukloni „${row.name}” sa liste`}
                  onClick={() => onDismiss(row.key)}
                >
                  <X aria-hidden="true" />
                </Button>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
