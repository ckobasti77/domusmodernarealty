import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import sharp from "sharp";
import { hasLocale } from "next-intl";
import { getTranslations } from "next-intl/server";
import { defaultLocale, routing, type Locale } from "@/i18n/routing";
import { formatArea, formatPrice, formatPricePerM2 } from "@/lib/format";
import { pickL10n } from "@/lib/l10n";
import { getListingBySlug } from "@/lib/listing-data";
import { structureTitle } from "@/lib/listing-text";
import { isUnsplash, unsplashAt } from "@/components/site/listing/media";

/**
 * Per-listing share image (PRD A5): the cover photo, the price, m² and €/m²,
 * the neighbourhood and the wordmark. Satori needs TTF/OTF (not WOFF2), so the
 * two static OFL fonts in `assets/fonts/` — EB Garamond and Manrope, both with
 * Latin-Ext and Cyrillic — are read from disk; together they are under 500 KB.
 *
 * A Route Handler rather than the `opengraph-image.tsx` file convention: the
 * convention writes its own `og:image` URL from the INTERNAL route
 * (`/sr-Latn/properties/…`), which the locale proxy does not serve, and
 * file-based metadata cannot be overridden. Here the image lives at the
 * localized public path (`/sr/nekretnine/<slug>/opengraph-image`, mapped in
 * `i18n/routing.ts`) and the page points `og:image` at exactly that URL.
 *
 * Satori only writes PNG, which for a photograph is ~800 KB. WhatsApp and Viber,
 * the channels Serbian buyers share on, drop the preview above ~300 KB, so the
 * PNG is re-encoded to a ~100 KB progressive JPEG before it is sent.
 */

const size = { width: 1200, height: 630 };
/** Prices change; the page adds `?v=<price>` to the URL, so an hour is enough here. */
const HEADERS = {
  "Content-Type": "image/jpeg",
  "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
};

async function asJpeg(image: ImageResponse): Promise<Response> {
  const png = Buffer.from(await image.arrayBuffer());
  const jpeg = await sharp(png).jpeg({ quality: 82, mozjpeg: true, progressive: true }).toBuffer();
  return new Response(new Uint8Array(jpeg), { headers: HEADERS });
}

const INK = "#0e0d0b";
const IVORY = "#f4efe6";
const MIST = "#b9b0a2";
const BRONZE = "#b08d57";

async function fonts() {
  const dir = join(process.cwd(), "assets", "fonts");
  const [serif, sans] = await Promise.all([
    readFile(join(dir, "EBGaramond-Regular.ttf")),
    readFile(join(dir, "Manrope-Medium.ttf")),
  ]);
  return [
    { name: "Serif", data: serif, weight: 400 as const, style: "normal" as const },
    { name: "Sans", data: sans, weight: 500 as const, style: "normal" as const },
  ];
}

function Wordmark() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ fontFamily: "Serif", fontSize: 26, letterSpacing: 7, color: IVORY }}>MIHAJLO ESTATE</div>
      <div style={{ width: 56, height: 1, backgroundColor: BRONZE }} />
    </div>
  );
}

export async function GET(_request: Request, { params }: RouteContext<"/[locale]/properties/[slug]/opengraph-image">) {
  const { locale: raw, slug } = await params;
  const locale: Locale = hasLocale(routing.locales, raw) ? raw : defaultLocale;
  const [fontList, result] = await Promise.all([fonts(), getListingBySlug(slug)]);

  if (result.kind !== "listing") {
    return asJpeg(
      new ImageResponse(
        (
          <div style={{ display: "flex", width: "100%", height: "100%", backgroundColor: INK, padding: 72, alignItems: "flex-end" }}>
            <Wordmark />
          </div>
        ),
        { ...size, fonts: fontList },
      ),
    );
  }

  const listing = result.listing;
  const t = await getTranslations({ locale, namespace: "listing" });
  const tUnits = await getTranslations({ locale, namespace: "units" });
  const m2 = tUnits("m2");
  const place = pickL10n(listing.locationLabel, locale).text;
  const photo =
    listing.cover !== undefined
      ? isUnsplash(listing.cover.url)
        ? unsplashAt(listing.cover.url, 1200)
        : listing.cover.url
      : null;
  const price =
    listing.priceOnRequest === true
      ? t("priceOnRequest")
      : `${formatPrice(listing.price, locale)}${listing.transaction === "rent" ? ` ${tUnits("perMonth")}` : ""}`;
  const facts = [
    formatArea(listing.areaM2, locale, m2),
    listing.transaction === "sale" && listing.priceOnRequest !== true
      ? formatPricePerM2(listing.pricePerM2, locale, m2)
      : null,
  ]
    .filter((part): part is string => part !== null)
    .join("  ·  ");
  const ribbon =
    listing.status === "sold" ? t("statusSold") : listing.status === "rented" ? t("statusRented") : null;

  const card = (
    <div style={{ display: "flex", width: "100%", height: "100%", backgroundColor: INK }}>
      <div style={{ display: "flex", position: "relative", width: 700, height: "100%" }}>
        {photo !== null ? (
          // Satori renders a plain <img>; next/image does not apply here.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photo} alt="" width={700} height={630} style={{ width: 700, height: 630, objectFit: "cover" }} />
        ) : null}
        {ribbon !== null ? (
          <div
            style={{
              position: "absolute",
              top: 40,
              left: 40,
              padding: "10px 18px",
              backgroundColor: INK,
              color: IVORY,
              fontFamily: "Sans",
              fontSize: 20,
              letterSpacing: 3,
              textTransform: "uppercase",
            }}
          >
            {ribbon}
          </div>
        ) : null}
      </div>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          width: 500,
          height: "100%",
          padding: "56px 52px",
        }}
      >
        <Wordmark />
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div style={{ fontFamily: "Sans", fontSize: 20, letterSpacing: 3, color: MIST, textTransform: "uppercase" }}>
            {structureTitle(t, listing, locale, m2)}
          </div>
          <div style={{ fontFamily: "Serif", fontSize: 60, lineHeight: 1.02, color: IVORY }}>{place}</div>
          <div style={{ width: "100%", height: 1, backgroundColor: "rgba(244,239,230,0.16)", marginTop: 8 }} />
          <div style={{ fontFamily: "Sans", fontSize: 46, color: IVORY }}>{price}</div>
          <div style={{ fontFamily: "Sans", fontSize: 22, color: MIST }}>{facts}</div>
        </div>
      </div>
    </div>
  );

  return asJpeg(new ImageResponse(card, { ...size, fonts: fontList }));
}
