import { zipSync } from "fflate";

/**
 * Turns a walkthrough asset into what Spark's `SplatMesh` loads.
 *
 * Spark 2.2's decoder reads SOG only as the bundled `.sog` zip
 * (`SplatFileType.PCSOGSZIP`); an unbundled SuperSplat export is a `meta.json`
 * plus WebP textures next to it. For those we download the listed files and
 * zip them in memory (stored, not recompressed: WebP is already compressed),
 * which also gives us real byte progress and a way to abort.
 */

export type SplatFormat = "spz" | "sog" | "ply" | "splat" | "ksplat" | "glb";

export type SplatSource =
  | { kind: "url"; url: string; fileType: SparkFileType }
  | { kind: "bytes"; bytes: Uint8Array; fileType: SparkFileType };

/** Values of Spark's `SplatFileType` enum (kept as strings to avoid loading Spark early). */
export type SparkFileType = "ply" | "spz" | "splat" | "ksplat" | "pcsogszip";

type Progress = (loaded: number, total: number) => void;

const SOG_KEYS = ["means", "scales", "quats", "sh0", "shN"] as const;

export function isSogMeta(url: string): boolean {
  return /\/meta\.json(\?|#|$)/.test(url);
}

export function sparkFileType(format: SplatFormat, url: string): SparkFileType | null {
  switch (format) {
    case "sog":
      return "pcsogszip";
    case "spz":
    case "ply":
    case "splat":
    case "ksplat":
      return format;
    default:
      // A GLB is a collision mesh, not a splat; a missing extension is guessed from the URL.
      return /\.spz(\?|$)/.test(url) ? "spz" : null;
  }
}

/** The file names a SOG `meta.json` points at, relative to it. */
export function sogFiles(meta: unknown): string[] {
  if (meta === null || typeof meta !== "object") throw new Error("SOG meta.json is not an object");
  const record = meta as Record<string, unknown>;
  const files: string[] = [];
  for (const key of SOG_KEYS) {
    const entry = record[key];
    if (entry === undefined) continue;
    const list = (entry as { files?: unknown }).files;
    if (!Array.isArray(list) || !list.every((name) => typeof name === "string")) {
      throw new Error(`SOG meta.json: "${key}.files" is missing`);
    }
    for (const name of list as string[]) {
      if (name.includes("/") || name.includes("..")) throw new Error(`SOG file "${name}" is not a sibling`);
      files.push(name);
    }
  }
  if (files.length === 0) throw new Error("SOG meta.json lists no files");
  return files;
}

async function fetchBytes(url: string, signal: AbortSignal, onChunk: (bytes: number) => void): Promise<Uint8Array> {
  const response = await fetch(url, { signal, mode: "cors", credentials: "omit" });
  if (!response.ok || response.body === null) throw new Error(`HTTP ${response.status} for ${url}`);
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    length += value.length;
    onChunk(value.length);
  }
  const out = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.length;
  }
  return out;
}

/**
 * Resolves the asset. `expectedBytes` (from the listing data) seeds the
 * progress total until the real one is known.
 */
export async function resolveSplatSource(
  url: string,
  format: SplatFormat,
  signal: AbortSignal,
  onProgress: Progress,
  expectedBytes?: number,
): Promise<SplatSource> {
  const fileType = sparkFileType(format, url);
  if (fileType === null) throw new Error(`Unsupported splat format: ${format}`);
  if (!(format === "sog" && isSogMeta(url))) return { kind: "url", url, fileType };

  const metaBytes = await fetchBytes(url, signal, () => undefined);
  const meta: unknown = JSON.parse(new TextDecoder().decode(metaBytes));
  const names = sogFiles(meta);
  const base = new URL(".", url);

  let loaded = metaBytes.length;
  const total = expectedBytes ?? 0;
  onProgress(loaded, total);
  const parts = await Promise.all(
    names.map((name) =>
      fetchBytes(new URL(name, base).toString(), signal, (bytes) => {
        loaded += bytes;
        onProgress(loaded, Math.max(total, loaded));
      }),
    ),
  );

  const entries: Record<string, Uint8Array> = { "meta.json": metaBytes };
  names.forEach((name, index) => {
    entries[name] = parts[index];
  });
  return { kind: "bytes", bytes: zipSync(entries, { level: 0 }), fileType };
}
