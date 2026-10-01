"use client";

import { useMutation } from "convex/react";
import { useCallback } from "react";
import { ACCEPTED_TYPES, formatMb } from "@/components/admin/listings/media/shared";
import { postFile } from "@/components/admin/listings/media/upload";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { detectAssetFormat, type AssetFormat } from "@/lib/admin/listing-form";

/** Mirrors `convex/media.ts`: panoramas up to 40 MB, splat models up to 200 MB. */
export const MAX_PANO_BYTES = 40 * 1024 * 1024;
export const MAX_SPLAT_BYTES = 200 * 1024 * 1024;
/** Above this a Convex upload risks its 2-minute limit; such files belong on R2 behind a URL. */
export const LARGE_SPLAT_BYTES = 50 * 1024 * 1024;

export const PANO_ACCEPT = ACCEPTED_TYPES.join(",");
export const SPLAT_ACCEPT = ".spz,.sog,.zip,.ply,.splat,.ksplat,.glb";

/** The derived panorama sizes (docs/06-3D-TOURS.md): a phone version and a list thumbnail. */
const MOBILE_SIZE = { w: 2048, h: 1024 };
const THUMB_SIZE = { w: 512, h: 256 };

/** One file to Convex storage (`media.generateUploadUrl`, editors only) with XHR progress 0–99. */
export function useStorageUploader(): (file: File, onProgress: (percent: number) => void) => Promise<Id<"_storage">> {
  const generateUploadUrl = useMutation(api.media.generateUploadUrl);
  return useCallback(
    async (file, onProgress) => {
      const url = await generateUploadUrl({});
      return await postFile(url, file, onProgress);
    },
    [generateUploadUrl],
  );
}

/** The Serbian reason a panorama is refused before upload, or null. */
export function panoProblem(file: File): string | null {
  if (!(ACCEPTED_TYPES as readonly string[]).includes(file.type)) {
    return `Fajl „${file.name}” nije u podržanom formatu (JPEG, PNG, WebP ili AVIF).`;
  }
  if (file.size === 0) return `Fajl „${file.name}” je prazan.`;
  if (file.size > MAX_PANO_BYTES) {
    return `Panorama „${file.name}” je prevelika (${formatMb(file.size)}); najviše 40 MB.`;
  }
  return null;
}

/** An equirectangular panorama is twice as wide as it is tall (1 % tolerance). */
export function isTwoToOne(size: { w: number; h: number }): boolean {
  return Math.abs(size.w / size.h - 2) <= 0.02;
}

async function resizeToJpeg(source: File, size: { w: number; h: number }, name: string): Promise<File> {
  // The resize options spare decoding the full 8K frame where the browser supports them;
  // elsewhere they are ignored and `drawImage` scales instead.
  const bitmap = await createImageBitmap(source, {
    resizeWidth: size.w,
    resizeHeight: size.h,
    resizeQuality: "high",
  });
  try {
    const canvas = document.createElement("canvas");
    canvas.width = size.w;
    canvas.height = size.h;
    const context = canvas.getContext("2d");
    if (context === null) throw new Error("2D canvas unavailable");
    context.drawImage(bitmap, 0, 0, size.w, size.h);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.85));
    if (blob === null) throw new Error("JPEG encoding failed");
    return new File([blob], name, { type: "image/jpeg" });
  } finally {
    bitmap.close();
  }
}

/**
 * The phone version (2048×1024, only when the original is larger) and the
 * thumbnail (512×256), as JPEGs made in the browser. Both null when the browser
 * cannot decode the file: then only the original is uploaded.
 */
export async function derivePanoVariants(
  file: File,
  size: { w: number; h: number } | null,
): Promise<{ mobile: File | null; thumb: File | null }> {
  const base = file.name.replace(/\.[^.]+$/, "");
  try {
    const mobile =
      size === null || size.w > MOBILE_SIZE.w ? await resizeToJpeg(file, MOBILE_SIZE, `${base}-2048.jpg`) : null;
    const thumb = await resizeToJpeg(file, THUMB_SIZE, `${base}-thumb.jpg`);
    return { mobile, thumb };
  } catch {
    return { mobile: null, thumb: null };
  }
}

/** The splat format of a chosen file, or the Serbian reason it cannot be uploaded. */
export function splatFileCheck(file: File): { ok: true; format: AssetFormat } | { ok: false; error: string } {
  if (/(?:^|\/)meta\.json$/i.test(file.name)) {
    return {
      ok: false,
      error: "Raspakovan SOG (meta.json sa teksturama) postavite na server i unesite adresu do meta.json.",
    };
  }
  const format = detectAssetFormat(file.name);
  if (format === null) {
    return { ok: false, error: `Fajl „${file.name}” nije podržan model (SPZ, SOG, PLY, SPLAT, KSPLAT ili GLB).` };
  }
  if (file.size === 0) return { ok: false, error: `Fajl „${file.name}” je prazan.` };
  if (file.size > MAX_SPLAT_BYTES) {
    return { ok: false, error: `Model „${file.name}” je prevelik (${formatMb(file.size)}); najviše 200 MB.` };
  }
  return { ok: true, format };
}

/** Browsers know no MIME type for most splat formats; storage gets a sensible one. */
export function withSplatType(file: File, format: AssetFormat): File {
  if (file.type !== "") return file;
  const type = format === "glb" ? "model/gltf-binary" : format === "sog" ? "application/zip" : "application/octet-stream";
  return new File([file], file.name, { type });
}
