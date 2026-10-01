"use client";

import { FileBox, ImagePlus, Loader2, Ruler, Trash2, TriangleAlert, Upload } from "lucide-react";
import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { useFormContext, useWatch } from "react-hook-form";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/admin/common/ConfirmDialog";
import { fileProblem, UploadError } from "@/components/admin/listings/media/upload";
import { ACCEPT_ATTR } from "@/components/admin/listings/media/shared";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { isAllowedSplatUrl, isSitePanoPath } from "@/convex/lib/tours";
import { adminErrorMessage } from "@/lib/admin/errors";
import { adminThumb } from "@/lib/admin/images";
import {
  ASSET_FORMAT_LABEL,
  HTTPS_PATTERN,
  detectAssetFormat,
  emptyAsset,
  type AssetFormat,
  type ListingForm,
} from "@/lib/admin/listing-form";
import { SelectField, TextField, optionsOf } from "../fields";
import { MeasureError, measureSplat } from "./measure";
import { formatBytes } from "./numbers";
import { LARGE_SPLAT_BYTES, SPLAT_ACCEPT, splatFileCheck, useStorageUploader, withSplatType } from "./uploads";

const DIRTY = { shouldDirty: true, shouldValidate: true } as const;
const FORMAT_OPTIONS = optionsOf(ASSET_FORMAT_LABEL);
/** docs/06-3D-TOURS.md: phones hold ≤ 15–20 MB of splats before Safari kills the tab. */
const MOBILE_SOFT_BYTES = 20 * 1024 * 1024;

export type Slot = "desktop" | "mobile" | "collision";

const SLOT: Record<Slot, { label: string; hint: string }> = {
  desktop: { label: "Model za računar", hint: "Glavni splat. Obavezan za objavu šetnje." },
  mobile: { label: "Model za telefon", hint: "Lakša verzija za telefone (do 1 milion tačaka, do 15–20 MB). Opciono." },
  collision: { label: "Kolizioni model", hint: "Zidovi i pod za kretanje kroz prostor, obično GLB. Opciono." },
};

/**
 * One splat model of the walkthrough: an https URL on a splat host (measured
 * in the browser) or a file uploaded to Convex storage (≤ 200 MB). Sizes are
 * shown because the public button prints them.
 */
export function AssetField({ slot }: { slot: Slot }) {
  const { getValues, setValue } = useFormContext<ListingForm>();
  const [storageId, url, format, bytes] = useWatch<
    ListingForm,
    [`walk3d.${Slot}.storageId`, `walk3d.${Slot}.url`, `walk3d.${Slot}.format`, `walk3d.${Slot}.bytes`]
  >({ name: [`walk3d.${slot}.storageId`, `walk3d.${slot}.url`, `walk3d.${slot}.format`, `walk3d.${slot}.bytes`] });
  const upload = useStorageUploader();
  const inputRef = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [measuring, setMeasuring] = useState(false);
  const [large, setLarge] = useState<{ file: File; format: AssetFormat; open: boolean } | null>(null);
  const meta = SLOT[slot];
  const busy = progress !== null || measuring;
  const hasUrl = url.trim() !== "";
  const measurable = hasUrl && HTTPS_PATTERN.test(url.trim()) && isAllowedSplatUrl(url);

  // A new address: its format may differ and the size and splat count are stale.
  // Only the siblings are written, so the caret in the URL input stays put.
  const onUrlChange = (event: ChangeEvent<HTMLInputElement>) => {
    const detected = detectAssetFormat(event.target.value);
    if (detected !== null && detected !== getValues(`walk3d.${slot}.format`)) {
      setValue(`walk3d.${slot}.format`, detected, DIRTY);
    }
    if (getValues(`walk3d.${slot}.bytes`) !== undefined) setValue(`walk3d.${slot}.bytes`, undefined, DIRTY);
    if (getValues(`walk3d.${slot}.splats`) !== undefined) setValue(`walk3d.${slot}.splats`, undefined, DIRTY);
  };

  const measure = async () => {
    setMeasuring(true);
    try {
      const size = await measureSplat(url);
      setValue(`walk3d.${slot}.bytes`, size, DIRTY);
      toast.success(`${meta.label}: ${formatBytes(size)}.`);
    } catch (error) {
      toast.error(error instanceof MeasureError ? error.message : "Merenje nije uspelo.");
    } finally {
      setMeasuring(false);
    }
  };

  const send = async (file: File, detected: AssetFormat) => {
    setProgress(0);
    try {
      const id = await upload(withSplatType(file, detected), setProgress);
      setValue(`walk3d.${slot}`, { url: "", storageId: id, format: detected, bytes: file.size }, DIRTY);
      toast.success(`${meta.label} je otpremljen (${formatBytes(file.size)}).`);
    } catch (error) {
      toast.error(error instanceof UploadError ? error.message : adminErrorMessage(error, "Otpremanje nije uspelo."));
    } finally {
      setProgress(null);
    }
  };

  const pick = (file: File | undefined) => {
    if (file === undefined) return;
    const check = splatFileCheck(file);
    if (!check.ok) {
      toast.error(check.error);
      return;
    }
    if (file.size > LARGE_SPLAT_BYTES) setLarge({ file, format: check.format, open: true });
    else void send(file, check.format);
  };

  const sizeNote =
    bytes !== undefined ? (
      <span className="tabular-nums">{formatBytes(bytes)}</span>
    ) : storageId !== undefined || hasUrl ? (
      <span className="text-muted-foreground">Veličina nije izmerena</span>
    ) : null;
  const tooBigForPhones = slot === "mobile" && bytes !== undefined && bytes > MOBILE_SOFT_BYTES;
  const inputId = `f-walk3d-${slot}-file`;

  return (
    <div
      className="flex min-w-0 flex-col gap-3 rounded-lg border bg-background p-3 @lg:col-span-2 @3xl:col-span-3"
      data-testid={`walk-asset-${slot}`}
    >
      {storageId !== undefined ? (
        <div className="flex min-w-0 flex-col gap-1.5">
          <span className="text-sm font-medium">{meta.label}</span>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <FileBox aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
            <span className="min-w-0 flex-1">
              Otpremljen fajl · {ASSET_FORMAT_LABEL[format]} · {sizeNote}
            </span>
          </div>
        </div>
      ) : (
        <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_6.5rem] items-start gap-2 @lg:grid-cols-[minmax(0,1fr)_7.5rem]">
          <TextField
            name={`walk3d.${slot}.url`}
            id={`f-walk3d-${slot}-url`}
            label={meta.label}
            type="url"
            inputMode="url"
            autoComplete="off"
            spellCheck={false}
            placeholder="https://…/meta.json"
            hint={meta.hint}
            onChange={onUrlChange}
          />
          <SelectField name={`walk3d.${slot}.format`} id={`f-walk3d-${slot}-format`} label="Format" options={FORMAT_OPTIONS} />
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {storageId === undefined ? (
          <Button type="button" variant="outline" size="sm" disabled={!measurable || busy} onClick={() => void measure()}>
            {measuring ? <Loader2 aria-hidden="true" className="animate-spin" /> : <Ruler aria-hidden="true" />}
            Izmeri veličinu
          </Button>
        ) : null}
        <input
          ref={inputRef}
          id={inputId}
          type="file"
          accept={SPLAT_ACCEPT}
          className="sr-only"
          tabIndex={-1}
          aria-label={`${meta.label}: otpremi fajl`}
          data-testid={`walk-asset-${slot}-input`}
          onChange={(event) => {
            pick(event.target.files?.[0]);
            event.target.value = "";
          }}
        />
        <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => inputRef.current?.click()}>
          {progress !== null ? <Loader2 aria-hidden="true" className="animate-spin" /> : <Upload aria-hidden="true" />}
          {storageId !== undefined ? "Otpremi drugi fajl" : "Otpremi fajl"}
        </Button>
        {storageId !== undefined || hasUrl ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={busy}
            onClick={() => setValue(`walk3d.${slot}`, emptyAsset(format), DIRTY)}
          >
            <Trash2 aria-hidden="true" />
            {storageId !== undefined ? "Zameni adresom" : "Ukloni"}
          </Button>
        ) : null}
        {storageId === undefined && sizeNote !== null ? <span className="text-xs">{sizeNote}</span> : null}
      </div>

      {progress !== null ? (
        <div className="flex items-center gap-3" role="status" aria-live="polite">
          <Progress value={progress} aria-label={`Otpremanje: ${meta.label}`} className="flex-1" />
          <span className="text-xs tabular-nums text-muted-foreground">{progress} %</span>
        </div>
      ) : null}
      {storageId !== undefined ? <p className="text-xs text-muted-foreground">{meta.hint}</p> : null}
      {tooBigForPhones ? (
        <p className="flex items-start gap-1.5 text-xs text-warning-text dark:text-warning">
          <TriangleAlert aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" />
          Model za telefon je veći od 20 MB; iPhone može da zatvori stranicu bez upozorenja.
        </p>
      ) : null}

      <ConfirmDialog
        open={large?.open === true}
        onOpenChange={(open) => setLarge((current) => (current === null ? null : { ...current, open }))}
        title="Veliki fajl"
        description={
          large !== null
            ? `Fajl „${large.file.name}” ima ${formatBytes(large.file.size)}. Otpremanje u Convex prekida se posle 2 minuta, a ovakvi fajlovi pripadaju Cloudflare R2 skladištu sa javnom adresom. Želite li ipak da ga otpremite?`
            : undefined
        }
        confirmLabel="Ipak otpremi"
        onConfirm={() => {
          if (large !== null) void send(large.file, large.format);
        }}
      />
    </div>
  );
}

/** The image shown while the model loads: an https URL or an uploaded image (≤ 20 MB). */
export function PosterField() {
  const { setValue } = useFormContext<ListingForm>();
  const [storageId, url] = useWatch<ListingForm, ["walk3d.posterStorageId", "walk3d.posterUrl"]>({
    name: ["walk3d.posterStorageId", "walk3d.posterUrl"],
  });
  const upload = useStorageUploader();
  const inputRef = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [local, setLocal] = useState<{ storageId: string; url: string } | null>(null);

  useEffect(
    () => () => {
      if (local !== null) URL.revokeObjectURL(local.url);
    },
    [local],
  );

  const pick = async (file: File | undefined) => {
    if (file === undefined) return;
    const problem = fileProblem(file);
    if (problem !== null) {
      toast.error(problem);
      return;
    }
    setProgress(0);
    try {
      const id = await upload(file, setProgress);
      setLocal({ storageId: id, url: URL.createObjectURL(file) });
      setValue("walk3d.posterStorageId", id, DIRTY);
      setValue("walk3d.posterUrl", "", DIRTY);
    } catch (error) {
      toast.error(error instanceof UploadError ? error.message : adminErrorMessage(error, "Otpremanje nije uspelo."));
    } finally {
      setProgress(null);
    }
  };

  const preview =
    storageId !== undefined
      ? local !== null && local.storageId === storageId
        ? local.url
        : null
      : HTTPS_PATTERN.test(url.trim()) || isSitePanoPath(url.trim())
        ? adminThumb(url.trim(), 640)
        : null;

  return (
    <div className="flex min-w-0 flex-col gap-2" data-testid="walk-poster">
      {storageId !== undefined ? (
        <div className="flex min-w-0 flex-col gap-1.5">
          <span className="text-sm font-medium">Naslovna slika šetnje</span>
          <span className="text-sm text-muted-foreground">Otpremljena slika</span>
        </div>
      ) : (
        <TextField
          name="walk3d.posterUrl"
          id="f-walk3d-posterUrl"
          label="Naslovna slika šetnje"
          type="url"
          inputMode="url"
          autoComplete="off"
          spellCheck={false}
          placeholder="https://…"
          hint="Prikazuje se dok se model učitava. Adresa slike ili otpremljen fajl."
        />
      )}
      {preview !== null ? (
        <div className="aspect-video w-full max-w-64 overflow-hidden rounded-md border bg-muted">
          {/* eslint-disable-next-line @next/next/no-img-element -- admin preview of a local or remote poster; next/image would need every host configured */}
          <img src={preview} alt="" className="size-full object-cover" />
        </div>
      ) : null}
      <div className="flex flex-wrap items-center gap-2">
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT_ATTR}
          className="sr-only"
          tabIndex={-1}
          aria-label="Naslovna slika šetnje: otpremi sliku"
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
          {progress !== null ? <Loader2 aria-hidden="true" className="animate-spin" /> : <ImagePlus aria-hidden="true" />}
          {storageId !== undefined ? "Zameni sliku" : "Otpremi sliku"}
        </Button>
        {storageId !== undefined ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={progress !== null}
            onClick={() => setValue("walk3d.posterStorageId", undefined, DIRTY)}
          >
            <Trash2 aria-hidden="true" />
            Ukloni
          </Button>
        ) : null}
      </div>
      {progress !== null ? <Progress value={progress} aria-label="Otpremanje naslovne slike" /> : null}
    </div>
  );
}
