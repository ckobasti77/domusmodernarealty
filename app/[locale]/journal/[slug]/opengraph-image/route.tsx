import { ImageResponse } from "next/og";
import { hasLocale } from "next-intl";
import { getTranslations } from "next-intl/server";
import { getPost, readingMinutes } from "@/components/site/journal/data";
import { formatLongDate } from "@/components/site/journal/shared";
import { isUnsplash, unsplashAt } from "@/components/site/listing/media";
import { defaultLocale, routing, type Locale } from "@/i18n/routing";
import { pickL10n } from "@/lib/l10n";
import { asJpeg, BRONZE, INK, IVORY, MIST, OG_SIZE, ogFonts, Wordmark } from "@/lib/og";

/**
 * Per-article share image (PRD A11): the cover on the right, the category,
 * the headline in the display serif, the date and reading time, and the
 * wordmark. A Route Handler at the localized public path
 * (`/ru/zhurnal/<slug>/opengraph-image`) for the same reason as the listing
 * card (DECISIONS [07]); the article page points `og:image` here unless the
 * editor set a share picture of their own.
 */

const CACHE = "public, max-age=86400, stale-while-revalidate=604800";
const PHOTO_WIDTH = 460;

export async function GET(_request: Request, { params }: RouteContext<"/[locale]/journal/[slug]/opengraph-image">) {
  const { locale: raw, slug } = await params;
  const locale: Locale = hasLocale(routing.locales, raw) ? raw : defaultLocale;
  const [fonts, post, t] = await Promise.all([ogFonts(), getPost(slug), getTranslations({ locale, namespace: "journal" })]);

  if (post === null) {
    return asJpeg(
      new ImageResponse(
        (
          <div style={{ display: "flex", width: "100%", height: "100%", backgroundColor: INK, padding: 72, alignItems: "flex-end" }}>
            <Wordmark />
          </div>
        ),
        { ...OG_SIZE, fonts },
      ),
      CACHE,
    );
  }

  const title = pickL10n(post.title, locale).text;
  const minutes = post.readingMinutes ?? readingMinutes(pickL10n(post.body, locale).text);
  const meta = [
    post.publishedAt !== undefined ? formatLongDate(post.publishedAt, locale) : null,
    t("readingTime", { minutes }),
  ]
    .filter((part): part is string => part !== null)
    .join("  ·  ");
  const photo =
    post.coverUrl !== undefined ? (isUnsplash(post.coverUrl) ? unsplashAt(post.coverUrl, 920) : post.coverUrl) : null;
  // Long Russian and German headlines get a smaller size rather than a fourth line.
  const titleSize = title.length > 80 ? 46 : title.length > 52 ? 54 : 64;

  const card = (
    <div style={{ display: "flex", width: "100%", height: "100%", backgroundColor: INK }}>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          width: OG_SIZE.width - (photo !== null ? PHOTO_WIDTH : 0),
          height: "100%",
          padding: "60px 64px",
        }}
      >
        <Wordmark />
        <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
          <div style={{ fontFamily: "Sans", fontSize: 20, letterSpacing: 4, color: BRONZE, textTransform: "uppercase" }}>
            {t(`categories.${post.category}`)}
          </div>
          <div style={{ fontFamily: "Serif", fontSize: titleSize, lineHeight: 1.05, color: IVORY }}>{title}</div>
          <div style={{ width: "100%", height: 1, backgroundColor: "rgba(244,239,230,0.16)", marginTop: 6 }} />
          <div style={{ fontFamily: "Sans", fontSize: 22, color: MIST }}>{meta}</div>
        </div>
      </div>
      {photo !== null ? (
        // Satori renders a plain <img>; next/image does not apply here.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={photo}
          alt=""
          width={PHOTO_WIDTH}
          height={OG_SIZE.height}
          style={{ width: PHOTO_WIDTH, height: OG_SIZE.height, objectFit: "cover" }}
        />
      ) : null}
    </div>
  );

  return asJpeg(new ImageResponse(card, { ...OG_SIZE, fonts }), CACHE);
}
