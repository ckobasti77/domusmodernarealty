import { isAllowedSplatUrl } from "@/convex/lib/tours";

/**
 * Measures a splat model behind a URL in the browser, so the public site can
 * print the download size on the "3D šetnja" button. The admin CSP lets these
 * requests reach only the splat hosts (`lib/csp.ts`), and both hosts answer
 * HEAD with CORS and a Content-Length.
 */

export class MeasureError extends Error {}

/** Parts of an unpacked SOG listed in its meta.json (`splat-transform` v2 layout). */
const SOG_PARTS = ["means", "scales", "quats", "sh0", "shN"] as const;

async function headSize(url: string): Promise<number> {
  if (!isAllowedSplatUrl(url)) {
    throw new MeasureError(`Fajl ${url} nije na dozvoljenom serveru.`);
  }
  let response: Response;
  try {
    response = await fetch(url, { method: "HEAD", cache: "no-store" });
  } catch {
    throw new MeasureError("Server modela nije odgovorio (mreža ili CORS).");
  }
  if (!response.ok) throw new MeasureError(`Server modela je vratio grešku ${response.status}.`);
  const length = Number(response.headers.get("content-length"));
  if (!Number.isFinite(length) || length <= 0) {
    throw new MeasureError("Server nije prijavio veličinu fajla.");
  }
  return length;
}

/** File names a SOG meta.json points at, resolved against the meta.json URL. */
function sogFiles(meta: unknown, metaUrl: string): string[] {
  if (typeof meta !== "object" || meta === null) return [];
  const record = meta as Record<string, unknown>;
  const files: string[] = [];
  for (const part of SOG_PARTS) {
    const entry = record[part];
    if (typeof entry !== "object" || entry === null) continue;
    const list = (entry as { files?: unknown }).files;
    if (!Array.isArray(list)) continue;
    for (const file of list) {
      if (typeof file === "string" && file.length > 0) files.push(new URL(file, metaUrl).href);
    }
  }
  return files;
}

/** Total bytes a visitor downloads: the file itself, or a meta.json plus every texture it lists. */
export async function measureSplat(url: string): Promise<number> {
  const trimmed = url.trim();
  let pathname: string;
  try {
    pathname = new URL(trimmed).pathname.toLowerCase();
  } catch {
    throw new MeasureError("Adresa modela nije ispravna.");
  }
  if (!pathname.endsWith("/meta.json")) return await headSize(trimmed);

  if (!isAllowedSplatUrl(trimmed)) throw new MeasureError("Model nije na dozvoljenom serveru.");
  let text: string;
  try {
    const response = await fetch(trimmed, { cache: "no-store" });
    if (!response.ok) throw new MeasureError(`Server modela je vratio grešku ${response.status}.`);
    text = await response.text();
  } catch (error) {
    throw error instanceof MeasureError ? error : new MeasureError("Server modela nije odgovorio (mreža ili CORS).");
  }
  let meta: unknown;
  try {
    meta = JSON.parse(text);
  } catch {
    throw new MeasureError("meta.json nije ispravan JSON.");
  }
  const files = sogFiles(meta, trimmed);
  if (files.length === 0) throw new MeasureError("meta.json ne navodi nijedan fajl modela.");
  const sizes = await Promise.all(files.map(headSize));
  return new Blob([text]).size + sizes.reduce((sum, size) => sum + size, 0);
}
