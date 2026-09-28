import { HOUR, MINUTE, RateLimiter } from "@convex-dev/rate-limiter";
import { components } from "../_generated/api";
import type { MutationCtx } from "../_generated/server";
import { appError, invalidInput } from "./errors";

/**
 * Per-session token buckets plus a global fixed window per form, so one abusive
 * client cannot exhaust the site-wide budget and a burst of real traffic still
 * gets through.
 */
export const rateLimiter = new RateLimiter(components.rateLimiter, {
  leadPerSession: { kind: "token bucket", rate: 5, period: HOUR, capacity: 3 },
  leadGlobal: { kind: "fixed window", rate: 200, period: HOUR },
  viewingPerSession: { kind: "token bucket", rate: 4, period: HOUR, capacity: 2 },
  viewingGlobal: { kind: "fixed window", rate: 120, period: HOUR },
  valuationPerSession: { kind: "token bucket", rate: 4, period: HOUR, capacity: 2 },
  trackViewPerSession: { kind: "token bucket", rate: 60, period: MINUTE, capacity: 30 },
});

export type PublicFormLimit =
  | "leadPerSession"
  | "viewingPerSession"
  | "valuationPerSession"
  | "trackViewPerSession";

const GLOBAL_FOR: Partial<Record<PublicFormLimit, "leadGlobal" | "viewingGlobal">> = {
  leadPerSession: "leadGlobal",
  valuationPerSession: "leadGlobal",
  viewingPerSession: "viewingGlobal",
};

/** Session keys come from the browser; keep them short and opaque. */
export function assertSessionKey(sessionKey: string): void {
  if (sessionKey.length < 8 || sessionKey.length > 64) {
    invalidInput("Nevažeći ključ sesije.");
  }
}

/**
 * Consumes one token for `limit`, then one for its global window. Throws
 * `RATE_LIMITED` with `retryAfter` (ms) so the form can show a friendly message.
 */
export async function consumeLimit(
  ctx: MutationCtx,
  limit: PublicFormLimit,
  sessionKey: string,
): Promise<void> {
  assertSessionKey(sessionKey);

  const perSession = await rateLimiter.limit(ctx, limit, { key: sessionKey });
  if (!perSession.ok) {
    appError("RATE_LIMITED", "Previše zahteva. Pokušajte ponovo kasnije.", {
      retryAfter: perSession.retryAfter,
    });
  }

  const globalName = GLOBAL_FOR[limit];
  if (globalName !== undefined) {
    const global = await rateLimiter.limit(ctx, globalName);
    if (!global.ok) {
      appError("RATE_LIMITED", "Previše zahteva. Pokušajte ponovo kasnije.", {
        retryAfter: global.retryAfter,
      });
    }
  }
}

/** The honeypot field must arrive empty; bots fill it. */
export function assertHoneypotEmpty(hp: string | undefined): void {
  if (hp !== undefined && hp.trim().length > 0) {
    appError("SPAM", "Zahtev je odbijen.");
  }
}

/** Trims and length-checks a required free-text field. */
export function requireText(
  value: string,
  label: string,
  max: number,
  min = 1,
): string {
  const trimmed = value.trim();
  if (trimmed.length < min) invalidInput(`${label} je obavezno polje.`);
  if (trimmed.length > max) {
    invalidInput(`${label} može imati najviše ${max} znakova.`);
  }
  return trimmed;
}

/** Trims and length-checks an optional free-text field. */
export function optionalText(
  value: string | undefined,
  label: string,
  max: number,
): string | undefined {
  if (value === undefined) return undefined;
  const trimmed = value.trim();
  if (trimmed.length === 0) return undefined;
  if (trimmed.length > max) {
    invalidInput(`${label} može imati najviše ${max} znakova.`);
  }
  return trimmed;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PHONE_RE = /^[+()\-\s\d]{6,24}$/;

export function requireEmail(value: string): string {
  const email = value.trim().toLowerCase();
  if (!EMAIL_RE.test(email)) invalidInput("Unesite ispravnu email adresu.");
  return email;
}

export function optionalPhone(value: string | undefined): string | undefined {
  if (value === undefined || value.trim().length === 0) return undefined;
  const phone = value.trim();
  if (!PHONE_RE.test(phone)) invalidInput("Unesite ispravan broj telefona.");
  return phone;
}
