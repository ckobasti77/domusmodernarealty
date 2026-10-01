import { ImageResponse } from "next/og";
import { hasLocale } from "next-intl";
import { getTranslations } from "next-intl/server";
import { mediaImage } from "@/lib/media";
import { asJpeg, BRONZE, INK, IVORY, MIST, OG_SIZE, ogFonts, publicPhoto, Wordmark } from "@/lib/og";
import { getPublicSettings } from "@/lib/page-data";
import { defaultLocale, routing, type Locale } from "@/i18n/routing";

/**
 * The site's default share image (`/sr/opengraph-image`, `/ru/opengraph-image`…),
 * used by every page that has no picture of its own: the hero photograph under
 * an ink wash, the wordmark, and the landing's eyebrow and headline in the
 * visitor's language (Cyrillic on `/ru`).
 *
 * When the admin has uploaded a site-wide share picture (Podešavanja → SEO),
 * that picture replaces the hero photograph; the card is still drawn here so
 * every share preview stays a 1200 × 630 JPEG under the messengers' size limit.
 *
 * A Route Handler at the localized public path for the same reason as the
 * listing card (DECISIONS [07]).
 */

const CACHE = "public, max-age=86400, stale-while-revalidate=604800";

async function backdrop(): Promise<string | null> {
  const settings = await getPublicSettings();
  const uploaded = settings?.seo.ogImageUrl;
  if (uploaded !== undefined) return uploaded;
  const hero = mediaImage("hero-desktop");
  return hero !== null ? await publicPhoto(hero.fallback, OG_SIZE.width, OG_SIZE.height) : null;
}

export async function GET(_request: Request, { params }: RouteContext<"/[locale]/opengraph-image">) {
  const { locale: raw } = await params;
  const locale: Locale = hasLocale(routing.locales, raw) ? raw : defaultLocale;
  const [fonts, photo, t] = await Promise.all([
    ogFonts(),
    backdrop(),
    getTranslations({ locale, namespace: "home" }),
  ]);

  const card = (
    <div style={{ display: "flex", position: "relative", width: "100%", height: "100%", backgroundColor: INK }}>
      {photo !== null ? (
        // Satori renders a plain <img>; next/image does not apply here.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={photo}
          alt=""
          width={OG_SIZE.width}
          height={OG_SIZE.height}
          style={{ position: "absolute", top: 0, left: 0, width: OG_SIZE.width, height: OG_SIZE.height, objectFit: "cover" }}
        />
      ) : null}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: OG_SIZE.width,
          height: OG_SIZE.height,
          backgroundImage: "linear-gradient(90deg, rgba(14,13,11,0.92) 0%, rgba(14,13,11,0.72) 46%, rgba(14,13,11,0.18) 100%)",
        }}
      />
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          position: "relative",
          width: 760,
          height: "100%",
          padding: "64px 72px",
        }}
      >
        <Wordmark />
        <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
          <div style={{ fontFamily: "Sans", fontSize: 22, letterSpacing: 4, color: MIST, textTransform: "uppercase" }}>
            {t("heroEyebrow")}
          </div>
          <div style={{ fontFamily: "Serif", fontSize: 88, lineHeight: 1, color: IVORY }}>{t("heroHeadline")}</div>
          <div style={{ width: 72, height: 1, backgroundColor: BRONZE, marginTop: 6 }} />
        </div>
      </div>
    </div>
  );

  return asJpeg(new ImageResponse(card, { ...OG_SIZE, fonts }), CACHE);
}
