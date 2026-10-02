import { ConvexError } from "convex/values";
import type { ErrorCode } from "@/convex/lib/errors";

/**
 * Maps a Convex failure to an `errors.*` message key (IMPLEMENTATION-PLAN §5
 * "Errors"). Raw server messages are Serbian and technical, so they never reach
 * the UI; only the stable `code` does. Typed against the server's `ErrorCode`, so
 * a renamed or removed code fails the build. `UNAUTHENTICATED` and `CONFLICT` are
 * staff-only (the admin shows the server's own Serbian message) and fall back to
 * the generic text here.
 */
const KNOWN: ReadonlySet<string> = new Set<ErrorCode>([
  "FORBIDDEN",
  "NOT_FOUND",
  "RATE_LIMITED",
  "SLOT_TAKEN",
  "ALREADY_REQUESTED",
  "INVALID_INPUT",
  "SPAM",
  "PUBLISH_BLOCKED",
]);

export type ErrorMessageKey = `errors.${string}`;

export function errorCode(error: unknown): string | null {
  if (error instanceof ConvexError) {
    const data: unknown = error.data;
    if (typeof data === "object" && data !== null && "code" in data) {
      const code = (data as { code: unknown }).code;
      if (typeof code === "string") return code;
    }
  }
  return null;
}

/** The message key to show for a failed mutation. */
export function errorMessageKey(error: unknown): ErrorMessageKey {
  const code = errorCode(error);
  if (code !== null && KNOWN.has(code)) return `errors.${code}`;
  if (typeof navigator !== "undefined" && navigator.onLine === false) return "errors.offline";
  return "errors.genericBody";
}
