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
 * The layout's template appends " — Mihajlo Estate" (17 characters). A title
 * that would end past ~67 characters with it drops the suffix instead of
 * having search results cut it mid-word; the brand is still in `og:site_name`
 * and in the sitewide JSON-LD.
 */
const MAX_TEMPLATED_TITLE = 50;

export function documentTitle(title: string): NonNullable<Metadata["title"]> {
  return title.length > MAX_TEMPLATED_TITLE ? { absolute: title } : title;
}

/** A share picture for `og:image` / `twitter:image`. */
export type ShareImage = { url: string; width?: number; height?: number; alt?: string };

/**
 * The site's default share card for `locale` (`app/[locale]/opengraph-image`),
 * used by every page without a picture of its own.
 */
export function defaultShareImage(locale: Locale): ShareImage {
  return {
    url: absoluteUrl(getPathname({ locale, href: "/opengraph-image" })),
    width: 1200,
    height: 630,
    alt: "Mihajlo Estate",
  };
}

/**
 * Open Graph + Twitter card for one localized URL. Every public page gets
 * both, so a link pasted into Viber, WhatsApp, Facebook, LinkedIn or X always
 * unfurls with a title, a description and a picture.
 */
export function socialMetadata({
  locale,
  url,
  title,
  description,
  image,
  type = "website",
  publishedTime,
}: {
  locale: Locale;
  url: string;
  title: string;
  description: string;
  image?: string | ShareImage;
  type?: "website" | "article";
  publishedTime?: number;
}): Pick<Metadata, "openGraph" | "twitter"> {
  const picture: ShareImage =
    image === undefined ? defaultShareImage(locale) : typeof image === "string" ? { url: image } : image;
  return {
    openGraph: {
      type,
      url,
      title,
      description,
      locale: htmlLang[locale],
      alternateLocale: locales.filter((other) => other !== locale).map((other) => htmlLang[other]),
      siteName: "Mihajlo Estate",
      images: [picture],
      ...(type === "article" && publishedTime !== undefined
        ? { publishedTime: new Date(publishedTime).toISOString() }
        : {}),
    },
    twitter: { card: "summary_large_image", title, description, images: [picture.url] },
  };
}

/**
 * Metadata for a localized content page: title, description, canonical +
 * hreflang, Open Graph and the Twitter card (the root layout's
 * `title.template` adds the brand). `image` is an absolute URL when the page
 * has its own share picture; otherwise the site's default card is used.
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
  image?: string | ShareImage;
  type?: "website" | "article";
  publishedTime?: number;
  /** Visitor-specific pages (favorites, compare) are followed but not indexed. */
  noindex?: boolean;
}): Metadata {
  const alternates = localizedAlternates(href, locale);
  return {
    title: documentTitle(title),
    description,
    alternates,
    ...(noindex ? { robots: { index: false, follow: true } } : {}),
    ...socialMetadata({
      locale,
      url: alternates.canonical as string,
      title,
      description,
      ...(image !== undefined ? { image } : {}),
      type,
      ...(publishedTime !== undefined ? { publishedTime } : {}),
    }),
  };
}

/** The absolute URL of a localized route (for JSON-LD and share links). */
export function localizedUrl(href: Href, locale: Locale): string {
  return absoluteUrl(getPathname({ locale, href }));
}
