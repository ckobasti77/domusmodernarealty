import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { invalidInput, notFound } from "./errors";
import type { ImageRef } from "./validators";

/**
 * Upload checks shared by every admin module that links a Convex storage blob
 * to a document (covers, agent photos, the OG image, the terms PDF). The
 * browser checks type and size before uploading, but only these server checks
 * count: `ctx.db.system.get("_storage", id)` reports what was actually stored.
 */

export const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/avif"] as const;
export const MAX_IMAGE_BYTES = 20 * 1024 * 1024;
export const MAX_PDF_BYTES = 15 * 1024 * 1024;

/** Hosts a `{ kind: "url" }` image may point at (the CSP `img-src` list). */
const IMAGE_URL_HOSTS = ["images.unsplash.com"] as const;

function mb(bytes: number): number {
  return Math.round(bytes / 1_048_576);
}

/** Throws unless the blob exists, is a web image and is at most 20 MB. */
export async function assertImageUpload(
  ctx: MutationCtx,
  storageId: Id<"_storage">,
): Promise<void> {
  const meta = await ctx.db.system.get("_storage", storageId);
  if (meta === null) notFound("Fajl");
  if (meta.size > MAX_IMAGE_BYTES) {
    invalidInput(`Slika je prevelika (${mb(meta.size)} MB, dozvoljeno ${mb(MAX_IMAGE_BYTES)} MB).`);
  }
  if (
    meta.contentType === undefined ||
    !(IMAGE_TYPES as readonly string[]).includes(meta.contentType)
  ) {
    invalidInput("Dozvoljeni formati slike su JPEG, PNG, WebP i AVIF.");
  }
}

/** Throws unless the blob exists, is a PDF and is at most 15 MB. */
export async function assertPdfUpload(
  ctx: MutationCtx,
  storageId: Id<"_storage">,
): Promise<void> {
  const meta = await ctx.db.system.get("_storage", storageId);
  if (meta === null) notFound("Fajl");
  if (meta.size > MAX_PDF_BYTES) {
    invalidInput(`PDF je prevelik (${mb(meta.size)} MB, dozvoljeno ${mb(MAX_PDF_BYTES)} MB).`);
  }
  if (meta.contentType !== "application/pdf") {
    invalidInput("Dokument mora biti u PDF formatu.");
  }
}

/**
 * Validates an image reference before it is written: a storage blob must pass
 * `assertImageUpload`; a remote URL must be https on an allowed host (the
 * public CSP would block anything else).
 */
export async function assertImageRef(ctx: MutationCtx, image: ImageRef): Promise<void> {
  if (image.kind === "storage") {
    await assertImageUpload(ctx, image.storageId);
    return;
  }
  let parsed: URL;
  try {
    parsed = new URL(image.url);
  } catch {
    invalidInput("Adresa slike nije ispravna.");
  }
  if (parsed.protocol !== "https:" || !(IMAGE_URL_HOSTS as readonly string[]).includes(parsed.hostname)) {
    invalidInput("Slika sa te adrese nije dozvoljena. Otpremite je sa računara.");
  }
}

/**
 * Deletes the blob a replaced image pointed at, when the new value no longer
 * references it. URL images own no blob.
 */
export async function releaseReplacedImage(
  ctx: MutationCtx,
  before: ImageRef | undefined,
  after: ImageRef | undefined,
): Promise<void> {
  if (before?.kind !== "storage") return;
  if (after?.kind === "storage" && after.storageId === before.storageId) return;
  await ctx.storage.delete(before.storageId);
}
