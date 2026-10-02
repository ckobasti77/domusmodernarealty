import type { Metadata } from "next";
import { getPathname } from "@/i18n/navigation";
import { defaultLocale, htmlLang, locales, type Locale } from "@/i18n/routing";
import { pickL10n, type L10nValue } from "@/lib/l10n";

type Href = Parameters<typeof getPathname>[0]["href"];

/**
 * The absolute site origin; `metadataBase` in the root layout uses the same
 * value. NEXT_PUBLIC_SITE_URL wins; a Vercel deployment without it falls back
 * to the project's production domain, so canonical, hreflang, sitemap and
 * share-image URLs never point at localhost, and a production deployment with
 * neither fails loudly instead. Everything else (`next dev`, a local
 * `next build && next start`, the e2e suite) gets http://localhost:3000.
 */
export function siteOrigin(): string {
  const configured = process.env.NEXT_PUBLIC_SITE_URL;
  if (configured !== undefined && configured.length > 0) return configured.replace(/\/$/, "");
  const vercelDomain = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  if (vercelDomain !== undefined && vercelDomain.length > 0) return `https://${vercelDomain}`;
  if (process.env.VERCEL_ENV === "production") {
    throw new Error(
      "NEXT_PUBLIC_SITE_URL is not set: canonical, hreflang, sitemap and share-image URLs need the public origin (e.g. https://mihajlo-estate.rs).",
    );
  }
  return "http://localhost:3000";
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

/**
 * A title or description in `locale`: the first of `sources` that has text
 * (its translation, else its Serbian source, as `pickL10n` reads it), else
 * `builtIn`. Callers pass the page's own SEO field first, then the admin's
 * sitewide default (Podešavanja → Podrazumevani SEO); `builtIn` is the copy
 * in `messages`.
 */
export function seoText(locale: Locale, builtIn: string, ...sources: ReadonlyArray<L10nValue | undefined>): string {
  for (const source of sources) {
    if (source === undefined) continue;
    const text = pickL10n(source, locale).text.trim();
    if (text.length > 0) return text;
  }
  return builtIn;
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
 * `og:locale` takes Open Graph's language_TERRITORY form, not a BCP-47 tag.
 * The territories match the `Intl` locales in `lib/format.ts` (en is en-GB).
 */
const OG_LOCALE: Record<Locale, string> = {
  "sr-Latn": "sr_RS",
  en: "en_GB",
  ru: "ru_RU",
  de: "de_DE",
};

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
      locale: OG_LOCALE[locale],
      alternateLocale: locales.filter((other) => other !== locale).map((other) => OG_LOCALE[other]),
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
