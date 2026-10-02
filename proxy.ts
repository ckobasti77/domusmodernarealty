import createMiddleware from "next-intl/middleware";
import { NextResponse, type NextRequest } from "next/server";
import { localePrefixes, routing } from "./i18n/routing";

/**
 * Next 16 renamed `middleware` to `proxy`. next-intl does the work here: locale
 * detection for `/`, and the localized-pathname rewrites (`/sr` -> `/sr-Latn`,
 * `/de/immobilien` -> `/de/properties`); the only addition is the redirect of
 * the internal Serbian segment below. `/admin` is deliberately excluded — the
 * admin panel is Serbian-only and its security boundary is `requireRole()`
 * inside every Convex function, not this file.
 */
const intl = createMiddleware(routing);

/**
 * `sr-Latn` is the INTERNAL segment of the Serbian locale; its public prefix is
 * `/sr`. next-intl reads `/sr-Latn/…` as an unprefixed path and would put a
 * prefix in front of it (`/sr/sr-Latn/nekretnine`, a 404), so the internal
 * segment, in any letter case, is sent to the public URL for good, query
 * included.
 */
const INTERNAL_SERBIAN = /^\/sr-latn(?=\/|$)/i;

export default function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (INTERNAL_SERBIAN.test(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = pathname.replace(INTERNAL_SERBIAN, localePrefixes["sr-Latn"]);
    return NextResponse.redirect(url, 308);
  }
  return intl(request);
}

export const config = {
  matcher: [
    "/((?!api|admin|_next|_vercel|opengraph-image|twitter-image|icon|apple-icon|sitemap|robots|manifest|.*\\..*).*)",
  ],
};
