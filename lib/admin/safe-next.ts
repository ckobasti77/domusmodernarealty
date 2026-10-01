const ADMIN_BASE = "https://admin.invalid";

/**
 * Only same-section paths are accepted as a post-login target. The value is
 * resolved as a URL first: a raw prefix check would let `/admin/..//evil.example`
 * through, which the router normalizes to the protocol-relative `//evil.example`.
 */
export function safeNext(next: string | null): string {
  if (next === null || next.includes("\\")) return "/admin";
  let url: URL;
  try {
    url = new URL(next, ADMIN_BASE);
  } catch {
    return "/admin";
  }
  if (
    url.origin !== ADMIN_BASE ||
    !/^\/admin(\/|$)/.test(url.pathname) ||
    url.pathname.startsWith("/admin/login") ||
    url.pathname.includes("//")
  ) {
    return "/admin";
  }
  return `${url.pathname}${url.search}${url.hash}`;
}
