import { HOUR, MINUTE, RateLimiter } from "@convex-dev/rate-limiter";
import { components } from "../_generated/api";
import type { MutationCtx } from "../_generated/server";
import { appError, invalidInput } from "./errors";
import type { Utm } from "./validators";

/**
 * Three layers per public form:
 *  - a per-session token bucket (the session key is minted by the browser, so
 *    it only slows an honest double-click or a naive bot);
 *  - a per-email bucket, which a script cannot mint for free;
 *  - a global fixed window. It is a runaway-flood breaker, set far above any
 *    real agency's volume, NOT the primary control: a low global cap would let
 *    one script with fresh session keys lock every real visitor out for the
 *    hour. A server-verified challenge (Turnstile) is the next layer.
 */
export const rateLimiter = new RateLimiter(components.rateLimiter, {
  leadPerSession: { kind: "token bucket", rate: 5, period: HOUR, capacity: 3 },
  leadPerEmail: { kind: "token bucket", rate: 4, period: HOUR, capacity: 3 },
  leadGlobal: { kind: "fixed window", rate: 1000, period: HOUR },
  viewingPerSession: { kind: "token bucket", rate: 4, period: HOUR, capacity: 2 },
  viewingPerEmail: { kind: "token bucket", rate: 3, period: HOUR, capacity: 2 },
  viewingGlobal: { kind: "fixed window", rate: 600, period: HOUR },
  valuationPerSession: { kind: "token bucket", rate: 4, period: HOUR, capacity: 2 },
  trackViewPerSession: { kind: "token bucket", rate: 60, period: MINUTE, capacity: 30 },
  trackViewGlobal: { kind: "fixed window", rate: 5000, period: HOUR },
  favoritePerSession: { kind: "token bucket", rate: 30, period: HOUR, capacity: 15 },
});

export type PublicFormLimit =
  | "leadPerSession"
  | "viewingPerSession"
  | "valuationPerSession"
  | "trackViewPerSession"
  | "favoritePerSession";

type GlobalLimit = "leadGlobal" | "viewingGlobal" | "trackViewGlobal";

const GLOBAL_FOR: Partial<Record<PublicFormLimit, GlobalLimit>> = {
  leadPerSession: "leadGlobal",
  valuationPerSession: "leadGlobal",
  viewingPerSession: "viewingGlobal",
  // A script can mint a fresh sessionKey per request, so the per-session bucket
  // alone cannot bound view inflation.
  trackViewPerSession: "trackViewGlobal",
  favoritePerSession: "trackViewGlobal",
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

/**
 * One token from the per-email bucket. Call it with the normalized address
 * from `requireEmail`, after the per-session check.
 */
export async function consumeEmailLimit(
  ctx: MutationCtx,
  limit: "leadPerEmail" | "viewingPerEmail",
  email: string,
): Promise<void> {
  const result = await rateLimiter.limit(ctx, limit, { key: email });
  if (!result.ok) {
    appError("RATE_LIMITED", "Previše zahteva. Pokušajte ponovo kasnije.", {
      retryAfter: result.retryAfter,
    });
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

/** RFC 5321 caps a forward path at 254 characters. */
const EMAIL_MAX = 254;

export function requireEmail(value: string): string {
  const email = value.trim().toLowerCase();
  // Length first: the pattern backtracks on long crafted strings.
  if (email.length > EMAIL_MAX || !EMAIL_RE.test(email)) {
    invalidInput("Unesite ispravnu email adresu.");
  }
  return email;
}

const UTM_MAX = 200;

/** Campaign tags arrive from URLs; keep them short and drop empty ones. */
export function cleanUtm(utm: Utm): Utm {
  const out: Utm = {};
  for (const key of ["source", "medium", "campaign", "term", "content"] as const) {
    const value = utm[key]?.trim().slice(0, UTM_MAX);
    if (value !== undefined && value.length > 0) out[key] = value;
  }
  return out;
}

export function optionalPhone(value: string | undefined): string | undefined {
  if (value === undefined || value.trim().length === 0) return undefined;
  const phone = value.trim();
  if (!PHONE_RE.test(phone)) invalidInput("Unesite ispravan broj telefona.");
  return phone;
}
