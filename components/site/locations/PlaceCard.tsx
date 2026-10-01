import { getTranslations } from "next-intl/server";
import { ImageReveal } from "@/components/motion/ImageReveal";
import { photoGrade } from "@/components/site/home/art-direction";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { formatCount, formatPricePerM2 } from "@/lib/format";
import { cn } from "@/lib/utils";
import { formatCoordinates, listingTotal, placeName, type LocationNode } from "./data";
import { PlacePlate } from "./PlacePlate";

/**
 * One place on the locations index (PRD A8): its photograph (or a plate when
 * it has none), name, how many listings it has right now, the average asking
 * price per square metre for sale and rent, and its own neighbourhoods as
 * links. The heading's link is stretched over the picture and the title row,
 * so the card has one tab stop for its page; the neighbourhood links sit
 * below it, outside the stretched area.
 */
export async function PlaceCard({
  node,
  locale,
  areas = [],
  origin,
  surface = "ivory",
}: {
  node: LocationNode;
  locale: Locale;
  /** The place's own children, listed under the card. */
  areas?: readonly LocationNode[];
  /** The parent's centroid, for the plate of a place without a photograph. */
  origin?: { lat: number; lng: number };
  surface?: "ivory" | "ivory-2";
}) {
  const t = await getTranslations({ locale, namespace: "locations" });
  const tUnits = await getTranslations({ locale, namespace: "units" });
  const name = placeName(node, locale);
  const total = listingTotal(node);
  const m2 = tUnits("m2");

  return (
    <article data-testid="location-card" className="group/place flex flex-col">
      <div className="relative">
        <div className="overflow-hidden">
          {node.coverUrl !== undefined ? (
            <ImageReveal
              src={node.coverUrl}
              alt=""
              ratio="aspect-[3/2]"
              crop={2 / 3}
              sizes="(min-width: 1024px) 30vw, (min-width: 640px) 45vw, 92vw"
              className={cn(
                "transition-[scale] duration-300 ease-out pointer-fine:group-hover/place:scale-[1.03]",
                surface === "ivory-2" && "bg-ivory",
              )}
              imageClassName={photoGrade(node.coverUrl)}
            />
          ) : (
            <div className="aspect-[3/2]">
              <PlacePlate
                kind={node.kind}
                kindLabel={t(`kind.${node.kind}`)}
                lat={node.lat}
                lng={node.lng}
                coordinates={formatCoordinates(node.lat, node.lng, locale, tUnits)}
                surface={surface}
                {...(origin !== undefined ? { origin } : {})}
              />
            </div>
          )}
        </div>

        <div className="mt-5 flex items-baseline justify-between gap-4">
          <h3 lang={name.lang} className="min-w-0 font-display text-h2 font-normal">
            <Link
              href={{ pathname: "/locations/[slug]", params: { slug: node.slug } }}
              className={cn(
                "transition-colors duration-200 ease-out pointer-fine:group-hover/place:text-bronze-text",
                "after:absolute after:inset-0 after:content-['']",
                "focus-visible:outline-none focus-visible:after:outline-2 focus-visible:after:outline-offset-4 focus-visible:after:outline-bronze-text",
              )}
            >
              {name.text}
            </Link>
          </h3>
          <p
            data-numeric=""
            className={cn(
              "shrink-0 text-right font-mono text-label uppercase",
              total > 0 ? "text-ink" : "text-stone-text",
            )}
          >
            {total > 0 ? t("count", { count: total }) : t("noOffers")}
          </p>
        </div>
      </div>

      {node.avgPricePerM2Sale !== undefined || node.avgPricePerM2Rent !== undefined ? (
        <dl className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-small">
          {node.avgPricePerM2Sale !== undefined ? (
            <div className="flex gap-2">
              <dt className="text-stone-text">{t("sale")}</dt>
              <dd data-numeric="" className="whitespace-nowrap">
                {formatPricePerM2(node.avgPricePerM2Sale, locale, m2)}
              </dd>
            </div>
          ) : null}
          {node.avgPricePerM2Rent !== undefined ? (
            <div className="flex gap-2">
              <dt className="text-stone-text">{t("rent")}</dt>
              <dd data-numeric="" className="whitespace-nowrap">
                {formatPricePerM2(node.avgPricePerM2Rent, locale, m2)} {tUnits("perMonth")}
              </dd>
            </div>
          ) : null}
        </dl>
      ) : null}

      {areas.length > 0 ? (
        <ul aria-label={t("areasOf", { name: name.text })} className="mt-5 border-t border-hairline-light">
          {areas.map((area) => {
            const areaName = placeName(area, locale);
            const areaTotal = listingTotal(area);
            return (
              <li key={area._id} className="border-b border-hairline-light">
                <Link
                  href={{ pathname: "/locations/[slug]", params: { slug: area.slug } }}
                  className="group/area flex min-h-11 items-center justify-between gap-4 py-2 text-small transition-colors duration-200 pointer-fine:hover:text-bronze-text focus-visible:text-bronze-text"
                >
                  <span lang={areaName.lang}>{areaName.text}</span>
                  {/* An empty place shows a dash, not a bare "0" that reads as missing data. */}
                  <span
                    data-numeric=""
                    aria-hidden="true"
                    className={cn("font-mono text-label", areaTotal > 0 ? "text-ink" : "text-stone-text")}
                  >
                    {areaTotal > 0 ? formatCount(areaTotal, locale) : "—"}
                  </span>
                  <span className="sr-only">
                    {areaTotal > 0 ? t("count", { count: areaTotal }) : t("noOffers")}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      ) : null}
    </article>
  );
}
