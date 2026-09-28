import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";

/**
 * Next 16 renamed `middleware` to `proxy`. Only next-intl runs here: locale
 * detection for `/`, and the localized-pathname rewrites (`/sr` -> `/sr-Latn`,
 * `/de/immobilien` -> `/de/properties`). `/admin` is deliberately excluded —
 * the admin panel is Serbian-only and its security boundary is `requireRole()`
 * inside every Convex function, not this file.
 */
export default createMiddleware(routing);

export const config = {
  matcher: [
    "/((?!api|admin|_next|_vercel|opengraph-image|twitter-image|icon|apple-icon|sitemap|robots|manifest|.*\\..*).*)",
  ],
};
