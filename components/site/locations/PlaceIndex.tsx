import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { formatPricePerM2 } from "@/lib/format";
import { cn } from "@/lib/utils";
import { listingTotal, placeName, type LocationNode } from "./data";

/**
 * A typographic index of places (a location page's neighbourhoods and the
 * places beside it): the name in serif, and on the right how many listings it
 * has and its average asking price per square metre. One link per row, at
 * least 44px tall, two columns from tablet up.
 */
export async function PlaceIndex({
  items,
  locale,
  label,
}: {
  items: readonly LocationNode[];
  locale: Locale;
  /** Accessible name of the list (the heading it sits under). */
  label: string;
}) {
  if (items.length === 0) return null;
  const t = await getTranslations({ locale, namespace: "locations" });
  const tUnits = await getTranslations({ locale, namespace: "units" });
  const m2 = tUnits("m2");

  return (
    <ul aria-label={label} className="grid border-t border-hairline-light md:grid-cols-2 md:gap-x-12 lg:gap-x-24">
      {items.map((node) => {
        const name = placeName(node, locale);
        const total = listingTotal(node);
        return (
          <li key={node._id} className="border-b border-hairline-light">
            <Link
              href={{ pathname: "/locations/[slug]", params: { slug: node.slug } }}
              className="group/row flex min-h-11 items-center justify-between gap-6 py-5 focus-visible:outline-offset-4"
            >
              <span
                lang={name.lang}
                className="min-w-0 font-display text-h3 font-normal transition-[color,translate] duration-300 ease-out pointer-fine:group-hover/row:translate-x-1 pointer-fine:group-hover/row:text-bronze-text lg:text-[1.875rem] lg:leading-tight"
              >
                {name.text}
              </span>
              <span className="flex shrink-0 flex-col items-end gap-1 text-right font-mono text-label uppercase">
                <span data-numeric="" className={cn(total > 0 ? "text-ink" : "text-stone-text")}>
                  {total > 0 ? t("count", { count: total }) : t("noOffers")}
                </span>
                {node.avgPricePerM2Sale !== undefined ? (
                  <span data-numeric="" className="normal-case text-stone-text">
                    {formatPricePerM2(node.avgPricePerM2Sale, locale, m2)}
                  </span>
                ) : null}
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
