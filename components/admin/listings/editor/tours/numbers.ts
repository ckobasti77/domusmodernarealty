import { formatMb } from "@/components/admin/listings/media/shared";

/**
 * Number helpers for the tour editors. Coordinates and angles are small signed
 * decimals, so unlike prices they have no thousands grouping: "-4,7" and
 * "-4.7" both read as −4.7 (`parseLocaleNumber` would read "4.7" as 47).
 */

const RAD_PER_DEG = Math.PI / 180;

export function toDegrees(radians: number): number {
  return radians / RAD_PER_DEG;
}

export function toRadians(degrees: number): number {
  return degrees * RAD_PER_DEG;
}

/** Empty → `null`; not a number → `NaN` (the schema reports it). Accepts "," or "." and a Unicode minus. */
export function parseDecimal(text: string): number | null {
  const clean = text.trim().replace(/\s/g, "").replace(/−/g, "-").replace(",", ".");
  if (clean === "") return null;
  if (!/^[-+]?(?:\d+\.?\d*|\.\d+)$/.test(clean)) return Number.NaN;
  return Number(clean);
}

/** `-4.7` → "-4,7" with at most `digits` decimals and no trailing zeros. */
export function formatDecimal(value: number, digits = 3): string {
  if (!Number.isFinite(value)) return "";
  const factor = 10 ** digits;
  const rounded = Math.round(value * factor) / factor;
  return String(Object.is(rounded, -0) ? 0 : rounded).replace(".", ",");
}

/** Degrees for display: 2 decimals. */
export function formatDegrees(radians: number): string {
  return formatDecimal(toDegrees(radians), 2);
}

/** Keeps a yaw in (−π, π] so the stored and shown angles stay small. */
export function normalizeYaw(radians: number): number {
  const turn = 2 * Math.PI;
  const wrapped = ((((radians + Math.PI) % turn) + turn) % turn) - Math.PI;
  return wrapped === -Math.PI ? Math.PI : wrapped;
}

/** Rounds a model coordinate to 0.01 units (what the floor editor writes). */
export function roundCoord(value: number): number {
  const rounded = Math.round(value * 100) / 100;
  return Object.is(rounded, -0) ? 0 : rounded;
}

const kbFormat = new Intl.NumberFormat("sr-Latn", { maximumFractionDigits: 0 });

/** 43 087 848 → "41,1 MB" (binary megabytes, as in the media tab). */
export function formatBytes(bytes: number): string {
  return bytes < 1_048_576 ? `${kbFormat.format(Math.max(1, bytes / 1024))} KB` : formatMb(bytes);
}
