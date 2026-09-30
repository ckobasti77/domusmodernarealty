"use client";

import { useMutation } from "convex/react";
import { ImagePlus, Loader2, Trash2 } from "lucide-react";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { toast } from "sonner";
import { fileProblem, postFile, UploadError } from "@/components/admin/listings/media/upload";
import { ACCEPT_ATTR } from "@/components/admin/listings/media/shared";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import type { ImageRef } from "@/convex/lib/validators";
import { adminErrorMessage } from "@/lib/admin/errors";
import { adminThumb } from "@/lib/admin/images";
import { cn } from "@/lib/utils";

/**
 * Uploads one file to Convex storage through `uploads.generateUploadUrl` (any
 * signed-in staff member) with progress. The mutation that finally stores the
 * id re-validates the blob server-side (`convex/lib/storage.ts`).
 */
export function useStorageUpload(): {
  upload: (file: File) => Promise<Id<"_storage"> | null>;
  progress: number | null;
} {
  const generateUploadUrl = useMutation(api.uploads.generateUploadUrl);
  const [progress, setProgress] = useState<number | null>(null);

  const upload = useCallback(
    async (file: File): Promise<Id<"_storage"> | null> => {
      setProgress(0);
      try {
        const url = await generateUploadUrl({});
        return await postFile(url, file, setProgress);
      } catch (error) {
        toast.error(error instanceof UploadError ? error.message : adminErrorMessage(error));
        return null;
      } finally {
        setProgress(null);
      }
    },
    [generateUploadUrl],
  );

  return { upload, progress };
}

/**
 * A single image (cover, agent photo, OG image): preview, replace, remove.
 * `value` is what the form will save; `previewUrl` is the URL the server
 * resolved for the stored value (storage ids have no URL on the client).
 * A freshly uploaded file previews from a local object URL until saved.
 */
export function ImageField({
  label,
  value,
  previewUrl,
  onChange,
  hint,
  aspect = "video",
  alt = "",
  className,
  testId,
}: {
  label: string;
  value: ImageRef | undefined;
  previewUrl?: string;
  onChange: (next: ImageRef | undefined) => void;
  hint?: string;
  aspect?: "video" | "square" | "portrait" | "og";
  /** Alt text for the preview; decorative by default (the label names it). */
  alt?: string;
  className?: string;
  testId?: string;
}) {
  const id = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const { upload, progress } = useStorageUpload();
  const [localUrl, setLocalUrl] = useState<{ storageId: string; url: string } | null>(null);

  useEffect(
    () => () => {
      if (localUrl !== null) URL.revokeObjectURL(localUrl.url);
    },
    [localUrl],
  );

  const shown =
    value === undefined
      ? null
      : value.kind === "url"
        ? adminThumb(value.url, 800)
        : localUrl !== null && localUrl.storageId === value.storageId
          ? localUrl.url
          : (previewUrl ?? null);

  const pick = async (file: File | undefined) => {
    if (file === undefined) return;
    const problem = fileProblem(file);
    if (problem !== null) {
      toast.error(problem);
      return;
    }
    const storageId = await upload(file);
    if (storageId === null) return;
    setLocalUrl({ storageId, url: URL.createObjectURL(file) });
    onChange({ kind: "storage", storageId });
  };

  return (
    <div className={cn("flex min-w-0 flex-col gap-1.5", className)} data-testid={testId}>
      <Label htmlFor={id}>{label}</Label>
      <div
        className={cn(
          "relative overflow-hidden rounded-lg border bg-muted",
          aspect === "video" && "aspect-video",
          aspect === "square" && "aspect-square max-w-48",
          aspect === "portrait" && "aspect-[4/5] max-w-48",
          aspect === "og" && "aspect-[1200/630]",
        )}
      >
        {shown !== null ? (
          // eslint-disable-next-line @next/next/no-img-element -- admin preview of storage/remote URLs; next/image would need every Convex host configured
          <img src={shown} alt={alt} className="size-full object-cover" />
        ) : (
          <div className="flex size-full items-center justify-center text-xs text-muted-foreground">Nema slike</div>
        )}
        {progress !== null ? (
          <div className="absolute inset-x-3 bottom-3 rounded-md bg-background/90 p-2">
            <Progress value={progress} aria-label="Otpremanje slike" />
          </div>
        ) : null}
      </div>
      <div className="flex flex-wrap gap-2">
        <input
          ref={inputRef}
          id={id}
          type="file"
          accept={ACCEPT_ATTR}
          className="sr-only"
          aria-describedby={hint !== undefined ? `${id}-hint` : undefined}
          onChange={(event) => {
            void pick(event.target.files?.[0]);
            event.target.value = "";
          }}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={progress !== null}
          onClick={() => inputRef.current?.click()}
        >
          {progress !== null ? <Loader2 className="animate-spin" aria-hidden="true" /> : <ImagePlus aria-hidden="true" />}
          {value === undefined ? "Otpremite sliku" : "Zamenite sliku"}
        </Button>
        {value !== undefined ? (
          <Button type="button" variant="ghost" size="sm" disabled={progress !== null} onClick={() => onChange(undefined)}>
            <Trash2 aria-hidden="true" />
            Uklonite
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
