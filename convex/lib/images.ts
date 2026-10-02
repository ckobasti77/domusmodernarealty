import type { ImageRef } from "./validators";

/**
 * Whether two image references point at the same picture: the same stored
 * blob, or the same URL. Editors use it to re-validate only new or changed
 * images (the upload window would refuse an older, unchanged one).
 */
export function sameImage(a: ImageRef | undefined, b: ImageRef | undefined): boolean {
  if (a === undefined || b === undefined) return a === b;
  if (a.kind === "storage") return b.kind === "storage" && a.storageId === b.storageId;
  return b.kind === "url" && a.url === b.url;
}
