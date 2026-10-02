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

/**
 * A blob may be linked to a document only within this long after it was
 * uploaded. Nothing records which staff member uploaded which blob, so without
 * it anyone who learns an older storage id (e.g. a colleague's photo) could
 * attach it to their own record and then delete it by replacing the image.
 * Six hours covers an editor who uploads, then finishes the form after lunch.
 */
export const UPLOAD_LINK_WINDOW_MS = 6 * 60 * 60 * 1000;

/** Refuses a blob uploaded longer ago than `UPLOAD_LINK_WINDOW_MS`. */
export function assertFresh(uploadedAt: number): void {
  if (uploadedAt < Date.now() - UPLOAD_LINK_WINDOW_MS) {
    invalidInput("Fajl je otpremljen pre više od 6 sati. Otpremite ga ponovo.");
  }
}

/** Hosts a `{ kind: "url" }` image may point at (the CSP `img-src` list). */
export const IMAGE_URL_HOSTS = ["images.unsplash.com"] as const;

/**
 * The rule `assertImageRef` applies to a URL image: https on an allowed host.
 * Pure, so the admin forms check it before anything is sent.
 */
export function isAllowedImageUrl(raw: string): boolean {
  try {
    const url = new URL(raw);
    return url.protocol === "https:" && (IMAGE_URL_HOSTS as readonly string[]).includes(url.hostname);
  } catch {
    return false;
  }
}

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
  assertFresh(meta._creationTime);
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
  assertFresh(meta._creationTime);
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
  if (!isAllowedImageUrl(parsed.href)) {
    invalidInput("Slika sa te adrese nije dozvoljena. Otpremite je sa računara.");
  }
}

/**
 * Deletes the blob a replaced image pointed at, when the new value no longer
 * references it. URL images own no blob. A blob that is already gone (deleted
 * through another record that pointed at it) is skipped, so the record can
 * still change its image.
 */
export async function releaseReplacedImage(
  ctx: MutationCtx,
  before: ImageRef | undefined,
  after: ImageRef | undefined,
): Promise<void> {
  if (before?.kind !== "storage") return;
  if (after?.kind === "storage" && after.storageId === before.storageId) return;
  await deleteBlobIfPresent(ctx, before.storageId);
}

/** `ctx.storage.delete` throws on a missing blob; this does not. */
export async function deleteBlobIfPresent(ctx: MutationCtx, storageId: Id<"_storage">): Promise<void> {
  const meta = await ctx.db.system.get("_storage", storageId);
  if (meta !== null) await ctx.storage.delete(storageId);
}
