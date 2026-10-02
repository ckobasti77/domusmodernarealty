/**
 * Admin error text. Convex admin functions throw `ConvexError({ code, message })`
 * with a Serbian message written for staff (`convex/lib/errors.ts`), so the
 * admin shows that message; the public site maps codes to `messages/*` instead.
 */
import { ConvexError } from "convex/values";

type ErrorData = {
  code?: string;
  message?: string;
  reasons?: string[];
  retryAfter?: number;
};

export function errorData(error: unknown): ErrorData | null {
  if (!(error instanceof ConvexError)) return null;
  const data: unknown = error.data;
  if (typeof data !== "object" || data === null) return null;
  const record = data as Record<string, unknown>;
  const out: ErrorData = {};
  if (typeof record.code === "string") out.code = record.code;
  if (typeof record.message === "string") out.message = record.message;
  if (Array.isArray(record.reasons)) {
    out.reasons = record.reasons.filter((item): item is string => typeof item === "string");
  }
  if (typeof record.retryAfter === "number") out.retryAfter = record.retryAfter;
  return out;
}

const FALLBACK = "Došlo je do greške. Pokušajte ponovo.";

/** One line for a toast or an inline error. */
export function adminErrorMessage(error: unknown, fallback: string = FALLBACK): string {
  const data = errorData(error);
  if (data?.code === "UNAUTHENTICATED") return "Sesija je istekla. Prijavite se ponovo.";
  if (data?.message !== undefined && data.message.length > 0) return data.message;
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    return "Nema internet veze. Izmene će biti sačuvane kad se veza vrati.";
  }
  return fallback;
}

/** Codes meaning the server refused the data itself, so resending it unchanged cannot succeed. */
const REFUSAL_CODES: ReadonlySet<string> = new Set(["INVALID_INPUT", "PUBLISH_BLOCKED", "FORBIDDEN", "NOT_FOUND", "CONFLICT"]);

/** The server refused what was sent (not a lost connection or an expired session). */
export function isRefusal(error: unknown): boolean {
  const code = errorData(error)?.code;
  return code !== undefined && REFUSAL_CODES.has(code);
}

/** A refusal as one line: the server's message, plus any checklist reasons it does not name already. */
export function refusalMessage(error: unknown): string {
  const message = adminErrorMessage(error);
  const missing = (errorData(error)?.reasons ?? []).filter((reason) => !message.includes(reason));
  return missing.length > 0 ? `${message} ${missing.join("; ")}.` : message;
}

/** The failed checklist items of a `PUBLISH_BLOCKED` error, else null. */
export function publishBlockers(error: unknown): string[] | null {
  const data = errorData(error);
  if (data?.code !== "PUBLISH_BLOCKED") return null;
  return data.reasons ?? [];
}

export function isForbidden(error: unknown): boolean {
  return errorData(error)?.code === "FORBIDDEN";
}
