/**
 * Token generation and hashing, shared by the invite flow and preview links.
 *
 * `crypto.randomUUID()` and `crypto.subtle` are both available in the Convex
 * runtime; `Math.random()` is NOT acceptable here because V8's generator state is
 * recoverable from a handful of outputs.
 */

/** 64 hex-ish chars of CSPRNG output. */
export function randomToken(): string {
  return `${crypto.randomUUID()}${crypto.randomUUID()}`.replace(/-/g, "");
}

/** base64url of the SHA-256 digest — only the hash is ever stored. */
export async function hashToken(token: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(token),
  );
  let binary = "";
  for (const byte of new Uint8Array(digest)) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** The shortest token we will even look up. */
export const MIN_TOKEN_LENGTH = 32;
