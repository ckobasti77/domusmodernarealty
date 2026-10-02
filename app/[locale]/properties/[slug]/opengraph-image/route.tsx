import { ImageResponse } from "next/og";
import { hasLocale } from "next-intl";
import { getTranslations } from "next-intl/server";
import { defaultLocale, routing, type Locale } from "@/i18n/routing";
import { formatArea, formatPricePerM2 } from "@/lib/format";
import { pickL10n } from "@/lib/l10n";
import { getListingBySlug } from "@/lib/listing-data";
import { priceText, sharePhoto } from "@/lib/listing-meta";
import { structureTitle } from "@/lib/listing-text";
import { asJpeg, INK, IVORY, MIST, OG_SIZE as size, ogFonts as fonts, Wordmark } from "@/lib/og";

/**
 * Per-listing share image (PRD A5): the photograph (the SEO tab's own share
 * picture when the admin set one, else the cover), the price, m² and €/m², the
 * neighbourhood and the wordmark, drawn with the shared share-image kit
 * (`lib/og.tsx`: fonts with Cyrillic, JPEG re-encode, wordmark).
 *
 * A Route Handler rather than the `opengraph-image.tsx` file convention: the
 * convention writes its own `og:image` URL from the INTERNAL route
 * (`/sr-Latn/properties/…`), which the locale proxy does not serve, and
 * file-based metadata cannot be overridden. Here the image lives at the
 * localized public path (`/sr/nekretnine/<slug>/opengraph-image`, mapped in
 * `i18n/routing.ts`) and the page points `og:image` at exactly that URL.
 */

/**
 * The page adds `?v=` to the URL, a fingerprint of everything drawn here
 * (`shareCardVersion`), so an hour is enough for anything it does not cover.
 */
const CACHE = "public, max-age=3600, stale-while-revalidate=86400";

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
      CACHE,
    );
  }

  const listing = result.listing;
  const t = await getTranslations({ locale, namespace: "listing" });
  const tUnits = await getTranslations({ locale, namespace: "units" });
  const m2 = tUnits("m2");
  const place = pickL10n(listing.locationLabel, locale).text;
  const photo = sharePhoto(listing);
  const price = priceText(listing, locale, tUnits);
  const facts = [
    formatArea(listing.areaM2, locale, m2),
    listing.transaction === "sale" ? formatPricePerM2(listing.pricePerM2, locale, m2) : null,
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

  return asJpeg(new ImageResponse(card, { ...size, fonts: fontList }), CACHE);
}
