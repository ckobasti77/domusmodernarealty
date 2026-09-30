import type { Id } from "@/convex/_generated/dataModel";
import { ACCEPTED_TYPES, MAX_FILE_BYTES, formatMb } from "./shared";

/** Convex closes an upload POST after two minutes. */
const UPLOAD_TIMEOUT_MS = 120_000;

/** The Serbian reason a file is refused before upload, or null when it may go. */
export function fileProblem(file: File): string | null {
  if (!(ACCEPTED_TYPES as readonly string[]).includes(file.type)) {
    return `Fajl „${file.name}” nije u podržanom formatu (JPEG, PNG, WebP ili AVIF).`;
  }
  if (file.size === 0) {
    return `Fajl „${file.name}” je prazan.`;
  }
  if (file.size > MAX_FILE_BYTES) {
    return `Fajl „${file.name}” je prevelik (${formatMb(file.size)}); najviše 20 MB po fajlu.`;
  }
  return null;
}

/**
 * Natural pixel size, read from the file header through an `<img>` (lighter
 * than `createImageBitmap`, which decodes every pixel). EXIF rotation is
 * already applied by the browser. Null when the browser cannot read the
 * format (e.g. AVIF on an old engine): the upload still goes ahead.
 */
export function readImageSize(file: File): Promise<{ w: number; h: number } | null> {
  return new Promise((resolve) => {
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();
    const finish = (value: { w: number; h: number } | null) => {
      URL.revokeObjectURL(objectUrl);
      resolve(value);
    };
    img.onload = () =>
      finish(
        img.naturalWidth > 0 && img.naturalHeight > 0
          ? { w: img.naturalWidth, h: img.naturalHeight }
          : null,
      );
    img.onerror = () => finish(null);
    img.decoding = "async";
    img.src = objectUrl;
  });
}

export class UploadError extends Error {}

/**
 * POSTs the file body to a fresh Convex upload URL with XMLHttpRequest, the
 * only browser API that reports upload progress. Resolves with the storage id.
 */
export function postFile(
  uploadUrl: string,
  file: File,
  onProgress: (percent: number) => void,
): Promise<Id<"_storage">> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", uploadUrl);
    xhr.setRequestHeader("Content-Type", file.type);
    xhr.timeout = UPLOAD_TIMEOUT_MS;

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && event.total > 0) {
        onProgress(Math.min(99, Math.floor((event.loaded / event.total) * 100)));
      }
    };
    xhr.onload = () => {
      if (xhr.status < 200 || xhr.status >= 300) {
        reject(new UploadError(`Server je odbio fajl (${xhr.status}).`));
        return;
      }
      try {
        const body: unknown = JSON.parse(xhr.responseText);
        const storageId =
          typeof body === "object" && body !== null && "storageId" in body
            ? (body as { storageId: unknown }).storageId
            : undefined;
        if (typeof storageId !== "string" || storageId.length === 0) {
          reject(new UploadError("Server nije vratio oznaku fajla."));
          return;
        }
        // The upload endpoint returns a `_storage` document id as a plain string.
        resolve(storageId as Id<"_storage">);
      } catch {
        reject(new UploadError("Neočekivan odgovor servera."));
      }
    };
    xhr.onerror = () => reject(new UploadError("Veza je prekinuta tokom otpremanja."));
    xhr.ontimeout = () => reject(new UploadError("Otpremanje je trajalo predugo (više od 2 minuta)."));
    xhr.send(file);
  });
}
