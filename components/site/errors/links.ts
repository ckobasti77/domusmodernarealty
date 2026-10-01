import { getPathname } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import type { ListingTranslator } from "@/lib/listing-text";
import type { ErrorLink } from "./ErrorScreen";

/**
 * "Perhaps you were looking for": the pages a lost visitor most often wants,
 * as localized URLs (`/sr/nekretnine?transaction=rent`, `/de/bewertung`…).
 * Shared by the 404 (server) and the error boundary (client), so both offer
 * the same way out. Labels reuse the search titles and the main navigation.
 */
export function errorLinks(
  locale: Locale,
  t: { search: ListingTranslator; nav: ListingTranslator },
): ErrorLink[] {
  return [
    {
      href: getPathname({ locale, href: "/properties" }),
      label: t.search("title.all", { transaction: "sale" }),
    },
    {
      href: getPathname({ locale, href: { pathname: "/properties", query: { transaction: "rent" } } }),
      label: t.search("title.all", { transaction: "rent" }),
    },
    { href: getPathname({ locale, href: "/locations" }), label: t.nav("locations") },
    { href: getPathname({ locale, href: "/valuation" }), label: t.nav("valuation") },
    { href: getPathname({ locale, href: "/contact" }), label: t.nav("contact") },
    { href: getPathname({ locale, href: "/" }), label: t.nav("home") },
  ];
}
