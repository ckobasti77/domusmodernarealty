import { ConvexError } from "convex/values";

/**
 * Error codes the client switches on. Keep them stable — `lib/errors.ts` maps the
 * public ones to localized `errors.*` messages; the admin shows `message` as is.
 */
export type ErrorCode =
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "INVALID_INPUT"
  | "PUBLISH_BLOCKED"
  | "RATE_LIMITED"
  | "SLOT_TAKEN"
  | "ALREADY_REQUESTED"
  | "SPAM"
  | "CONFLICT";

export function appError(
  code: ErrorCode,
  message: string,
  extra?: Record<string, string | number | boolean | string[]>,
): never {
  throw new ConvexError({ code, message, ...extra });
}

export function unauthenticated(): never {
  return appError("UNAUTHENTICATED", "Niste prijavljeni.");
}

export function forbidden(what = "ovu radnju"): never {
  return appError("FORBIDDEN", `Nemate dozvolu za ${what}.`);
}

export function notFound(what = "Zapis"): never {
  return appError("NOT_FOUND", `${what} nije pronađen.`);
}

export function invalidInput(message: string): never {
  return appError("INVALID_INPUT", message);
}
