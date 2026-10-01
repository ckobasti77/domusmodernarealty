import type { Metadata } from "next";
import { getPathname } from "@/i18n/navigation";
import { defaultLocale, htmlLang, locales, type Locale } from "@/i18n/routing";

type Href = Parameters<typeof getPathname>[0]["href"];

/** The absolute site origin; `metadataBase` in the root layout uses the same value. */
export function siteOrigin(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");
}

export function absoluteUrl(path: string): string {
  return `${siteOrigin()}${path.startsWith("/") ? path : `/${path}`}`;
}

/**
 * `alternates` for a localized route: a self-referencing canonical plus one
 * hreflang per locale and `x-default` → the Serbian URL (ARCHITECTURE §4, §9).
 * Every URL is built by next-intl, so localized segments (`/nekretnine`,
 * `/immobilien`…) and the `/sr` prefix can never drift from the router.
 */
export function localizedAlternates(href: Href, locale: Locale): NonNullable<Metadata["alternates"]> {
  const languages: Record<string, string> = {};
  for (const target of locales) {
    languages[htmlLang[target]] = absoluteUrl(getPathname({ locale: target, href }));
  }
  languages["x-default"] = absoluteUrl(getPathname({ locale: defaultLocale, href }));
  return {
    canonical: absoluteUrl(getPathname({ locale, href })),
    languages,
  };
}

/**
 * Metadata for a localized content page: title, description, canonical +
 * hreflang, and Open Graph (the root layout's `title.template` adds the brand).
 * `image` is an absolute URL when the page has its own share picture.
 */
export function pageMetadata({
  locale,
  href,
  title,
  description,
  image,
  type = "website",
  publishedTime,
  noindex = false,
}: {
  locale: Locale;
  href: Href;
  title: string;
  description: string;
  image?: string;
  type?: "website" | "article";
  publishedTime?: number;
  /** Visitor-specific pages (favorites, compare) are followed but not indexed. */
  noindex?: boolean;
}): Metadata {
  const alternates = localizedAlternates(href, locale);
  return {
    title,
    description,
    alternates,
    ...(noindex ? { robots: { index: false, follow: true } } : {}),
    openGraph: {
      type,
      url: alternates.canonical as string,
      title,
      description,
      locale: htmlLang[locale],
      siteName: "Mihajlo Estate",
      ...(image !== undefined ? { images: [{ url: image }] } : {}),
      ...(type === "article" && publishedTime !== undefined
        ? { publishedTime: new Date(publishedTime).toISOString() }
        : {}),
    },
  };
}

/** The absolute URL of a localized route (for JSON-LD and share links). */
export function localizedUrl(href: Href, locale: Locale): string {
  return absoluteUrl(getPathname({ locale, href }));
}
