"use client";

import { useMutation } from "convex/react";
import { Loader2 } from "lucide-react";
import { useEffect, useId, useState, type FormEvent } from "react";
import { describedBy } from "@/components/admin/common/form";
import { useStorageUpload } from "@/components/admin/common/ImageField";
import { ACCEPT_ATTR } from "@/components/admin/listings/media/shared";
import { fileProblem, readImageSize } from "@/components/admin/listings/media/upload";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { adminErrorMessage } from "@/lib/admin/errors";

export type InsertedImage =
  | { kind: "new"; src: string; alt: string; width?: number; height?: number }
  | { kind: "alt"; alt: string };

const ALT_MIN = 3;
const ALT_MAX = 200;

/**
 * Uploads a picture into the article (Convex storage, checked again by
 * `postsAdmin.attachImage`, which also returns its URL) with a required alt
 * text. With an image selected in the text (`editAlt` set) it edits the alt.
 */
export function ImageDialog({
  open,
  onOpenChange,
  postId,
  editAlt,
  onApply,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  postId: Id<"posts">;
  editAlt: string | null;
  onApply: (image: InsertedImage) => void;
}) {
  const [busy, setBusy] = useState(false);
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!busy) onOpenChange(next);
      }}
    >
      <DialogContent className="sm:max-w-md">
        {open ? (
          <ImageForm
            postId={postId}
            editAlt={editAlt}
            onApply={onApply}
            onBusy={setBusy}
            onClose={() => onOpenChange(false)}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function ImageForm({
  postId,
  editAlt,
  onApply,
  onBusy,
  onClose,
}: {
  postId: Id<"posts">;
  editAlt: string | null;
  onApply: (image: InsertedImage) => void;
  onBusy: (busy: boolean) => void;
  onClose: () => void;
}) {
  const id = useId();
  const attach = useMutation(api.postsAdmin.attachImage);
  const { upload, progress } = useStorageUpload();
  const [file, setFile] = useState<File | null>(null);
  const [alt, setAlt] = useState(editAlt ?? "");
  const [errors, setErrors] = useState<{ file?: string; alt?: string; server?: string }>({});
  const [pending, setPending] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const editing = editAlt !== null;

  useEffect(
    () => () => {
      if (preview !== null) URL.revokeObjectURL(preview);
    },
    [preview],
  );

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    event.stopPropagation();
    const text = alt.trim();
    const next: typeof errors = {};
    if (text.length < ALT_MIN) next.alt = "Opišite sliku u nekoliko reči (za čitače ekrana i pretragu).";
    if (!editing && file === null) next.file = "Izaberite sliku.";
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    if (editing) {
      onApply({ kind: "alt", alt: text });
      onClose();
      return;
    }
    if (file === null) return;

    setPending(true);
    onBusy(true);
    try {
      const [storageId, size] = await Promise.all([upload(file), readImageSize(file)]);
      if (storageId === null) return;
      const src = await attach({ id: postId, storageId });
      onApply({ kind: "new", src, alt: text, ...(size !== null ? { width: size.w, height: size.h } : {}) });
      onClose();
    } catch (error) {
      setErrors({ server: adminErrorMessage(error, "Slika nije dodata. Pokušajte ponovo.") });
    } finally {
      setPending(false);
      onBusy(false);
    }
  };

  return (
    <form onSubmit={(event) => void submit(event)} noValidate>
      <DialogHeader>
        <DialogTitle>{editing ? "Opis slike" : "Umetnite sliku"}</DialogTitle>
        <DialogDescription>
          {editing
            ? "Opis čitaju čitači ekrana i pretraživači; prikazuje se i kad se slika ne učita."
            : "JPEG, PNG, WebP ili AVIF do 20 MB. Slika se umeće na mesto kursora."}
        </DialogDescription>
      </DialogHeader>
      <div className="my-4 flex flex-col gap-4">
        {editing ? null : (
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`${id}-file`}>Slika</Label>
            <Input
              id={`${id}-file`}
              type="file"
              accept={ACCEPT_ATTR}
              disabled={pending}
              aria-invalid={errors.file !== undefined || undefined}
              aria-describedby={describedBy(`${id}-file`, false, errors.file !== undefined)}
              onChange={(event) => {
                const picked = event.target.files?.[0] ?? null;
                const problem = picked !== null ? fileProblem(picked) : null;
                const accepted = problem === null ? picked : null;
                setErrors((current) => ({ ...current, file: problem ?? undefined, server: undefined }));
                setFile(accepted);
                setPreview(accepted !== null ? URL.createObjectURL(accepted) : null);
              }}
            />
            {errors.file !== undefined ? (
              <p id={`${id}-file-error`} className="text-xs font-medium text-destructive">
                {errors.file}
              </p>
            ) : null}
            {preview !== null && file !== null ? (
              // eslint-disable-next-line @next/next/no-img-element -- local object URL of the picked file
              <img src={preview} alt="" className="mt-1 max-h-40 w-fit rounded-md border object-contain" />
            ) : null}
          </div>
        )}
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`${id}-alt`}>Opis slike (alt tekst)</Label>
          <Input
            id={`${id}-alt`}
            value={alt}
            maxLength={ALT_MAX}
            autoFocus={editing}
            disabled={pending}
            placeholder="npr. Dnevna soba sa pogledom na Savu"
            aria-invalid={errors.alt !== undefined || undefined}
            aria-describedby={describedBy(`${id}-alt`, true, errors.alt !== undefined)}
            onChange={(event) => {
              setAlt(event.target.value);
              setErrors((current) => ({ ...current, alt: undefined }));
            }}
          />
          <p id={`${id}-alt-hint`} className="text-xs text-muted-foreground">
            Opis je na jeziku teksta koji uređujete.
          </p>
          {errors.alt !== undefined ? (
            <p id={`${id}-alt-error`} className="text-xs font-medium text-destructive">
              {errors.alt}
            </p>
          ) : null}
        </div>
        {progress !== null ? <Progress value={progress} aria-label="Otpremanje slike" /> : null}
        <p role="status" aria-live="polite" className="text-xs font-medium text-destructive empty:hidden">
          {errors.server ?? ""}
        </p>
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" disabled={pending} onClick={onClose}>
          Otkaži
        </Button>
        <Button type="submit" disabled={pending}>
          {pending ? <Loader2 className="animate-spin" aria-hidden="true" /> : null}
          {editing ? "Sačuvaj opis" : pending ? "Otpremanje…" : "Umetni sliku"}
        </Button>
      </DialogFooter>
    </form>
  );
}
