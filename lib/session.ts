/**
 * A random, per-tab session key for rate limiting and view de-duplication
 * (IMPLEMENTATION-PLAN §5 "Analytics / consent"). It lives in `sessionStorage`,
 * identifies nobody, and disappears with the tab, so it needs no consent.
 */
const KEY = "me:sk";

function randomKey(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function getSessionKey(): string {
  try {
    const existing = window.sessionStorage.getItem(KEY);
    if (existing !== null && existing.length >= 8 && existing.length <= 64) return existing;
    const created = randomKey();
    window.sessionStorage.setItem(KEY, created);
    return created;
  } catch {
    // Storage blocked (private mode, strict settings): a key per page load still
    // rate-limits correctly; it only loses cross-page de-duplication.
    return randomKey();
  }
}

/** `true` the first time it is called for `id` in this tab. */
export function firstTimeInSession(scope: string, id: string): boolean {
  const flag = `me:${scope}:${id}`;
  try {
    if (window.sessionStorage.getItem(flag) !== null) return false;
    window.sessionStorage.setItem(flag, "1");
    return true;
  } catch {
    return true;
  }
}
