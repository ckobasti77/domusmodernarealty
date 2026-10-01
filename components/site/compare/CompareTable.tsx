"use client";

import { ArrowUpRight, X } from "lucide-react";
import Image from "next/image";
import { useLocale, useTranslations } from "next-intl";
import { useMemo } from "react";
import { Badge } from "@/components/site/Badge";
import { buttonClasses } from "@/components/site/Button";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { fixTypography } from "@/lib/format";
import { frameLoader } from "@/lib/image-loaders";
import { pickL10n } from "@/lib/l10n";
import { cn } from "@/lib/utils";
import type { CompareItem } from "./compare-item";
import { buildCompareGroups, type CompareCell } from "./rows";

/**
 * The comparison itself: a real `<table>` (caption, `scope="col"` listing
 * headers, `scope="row"` fact headers, one `<tbody>` per group), so a screen
 * reader announces "Kvadratura, Trosoban stan u Neimaru: 86 m²" as it moves.
 *
 * On a phone the table scrolls sideways inside a focusable region and the fact
 * column stays pinned with CSS `position: sticky` (no script). On a desktop
 * the listing titles stick under the header while the rows scroll past.
 *
 * A best value is never colour alone: the cell gets a bronze rule, a diamond
 * marker, a heavier figure AND the words "Najbolja vrednost".
 */

/** Phones scroll; each listing column keeps at least 12rem beside the 7rem fact column. */
const MIN_WIDTH: Record<number, string> = {
  2: "min-w-[31rem]",
  3: "min-w-[43rem]",
  4: "min-w-[55rem]",
};

const STICKY_COLUMN = "sticky left-0 z-10 bg-ivory border-r border-hairline-light lg:border-r-0";
const CELL_X = "px-3 md:px-4 lg:px-5";

export function CompareTable({
  items,
  onRemove,
}: {
  items: readonly CompareItem[];
  onRemove: (item: CompareItem, index: number) => void;
}) {
  const locale = useLocale() as Locale;
  const t = useTranslations("compare");
  const tListing = useTranslations("listing");
  const tUnits = useTranslations("units");

  const groups = useMemo(
    () => buildCompareGroups(items, { compare: t, listing: tListing, units: tUnits }, locale),
    [items, t, tListing, tUnits, locale],
  );

  return (
    <div
      role="region"
      aria-labelledby="compare-caption"
      // Keyboard users scroll the table with the arrow keys once it has focus.
      tabIndex={0}
      className="overflow-x-auto overscroll-x-contain focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-bronze-text lg:overflow-x-visible"
    >
      <table
        data-testid="compare-table"
        className={cn(
          "w-full table-fixed border-separate border-spacing-0 text-left lg:min-w-0",
          MIN_WIDTH[items.length] ?? MIN_WIDTH[4],
        )}
      >
        <caption id="compare-caption" className="sr-only">
          {t("caption", { count: items.length })}
        </caption>
        <colgroup>
          <col className="w-28 md:w-44 lg:w-56" />
          {items.map((item) => (
            <col key={item._id} />
          ))}
        </colgroup>

        <thead>
          {/* Photographs, the remove control and the reference: context, not headers. */}
          <tr>
            <td className={cn(STICKY_COLUMN, "pb-5 pr-3 align-bottom")}>
              <Legend />
            </td>
            {items.map((item, index) => (
              <td key={item._id} className={cn(CELL_X, "pb-5 align-top")}>
                <ColumnMedia item={item} onRemove={() => onRemove(item, index)} />
              </td>
            ))}
          </tr>
          <tr>
            <td aria-hidden="true" className={cn(STICKY_COLUMN, "hairline-b lg:sticky lg:top-(--header-h,85px) lg:z-20")} />
            {items.map((item) => {
              const title = pickL10n(item.title, locale);
              const place = pickL10n(item.locationLabel, locale);
              return (
                <th
                  key={item._id}
                  scope="col"
                  className={cn(
                    CELL_X,
                    "hairline-b bg-ivory pb-5 align-top font-normal",
                    "lg:sticky lg:top-(--header-h,85px) lg:z-20 lg:pt-4",
                  )}
                >
                  <Link
                    href={{ pathname: "/properties/[slug]", params: { slug: item.slug } }}
                    prefetch={false}
                    lang={title.lang === locale ? undefined : title.lang}
                    className="line-clamp-3 font-display text-[1.25rem] leading-snug text-ink transition-colors duration-200 pointer-fine:hover:text-bronze-text lg:text-h3"
                  >
                    {fixTypography(title.text)}
                  </Link>
                  <span
                    lang={place.lang === locale ? undefined : place.lang}
                    className="mt-1.5 block text-small text-stone-text"
                  >
                    {place.text}
                  </span>
                </th>
              );
            })}
          </tr>
        </thead>

        {groups.map((group) => (
          <tbody key={group.key}>
            <tr>
              <th scope="rowgroup" colSpan={items.length + 1} className="pb-3 pt-12 text-left font-normal">
                <span className="eyebrow sticky left-0 inline-block text-bronze-text">{group.label}</span>
              </th>
            </tr>
            {group.rows.map((row) => (
              <tr key={row.key}>
                <th
                  scope="row"
                  className={cn(
                    STICKY_COLUMN,
                    "hairline-t py-4 pr-3 align-top font-sans text-label font-medium uppercase tracking-[0.1em] text-stone-text",
                  )}
                >
                  {row.label}
                </th>
                {row.cells.map((cell, index) => (
                  <ValueCell key={items[index]?._id ?? index} cell={cell} best={row.best.has(index)} />
                ))}
              </tr>
            ))}
          </tbody>
        ))}

        <tfoot>
          <tr>
            <td className={cn(STICKY_COLUMN, "hairline-t")} />
            {items.map((item) => (
              <td key={item._id} className={cn(CELL_X, "hairline-t pt-8 align-top")}>
                <Link
                  href={{ pathname: "/properties/[slug]", params: { slug: item.slug } }}
                  prefetch={false}
                  className={cn(buttonClasses({ variant: "outline", size: "compact" }), "w-full gap-2 px-3")}
                >
                  {t("view")}
                  <ArrowUpRight aria-hidden="true" strokeWidth={1.25} className="size-4 shrink-0" />
                  <span className="sr-only">: {pickL10n(item.title, locale).text}</span>
                </Link>
              </td>
            ))}
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

function Legend() {
  const t = useTranslations("compare");
  return (
    <p className="flex items-start gap-2 font-sans text-label uppercase leading-snug tracking-[0.1em] text-stone-text">
      <BestMarker className="mt-[0.3em]" />
      <span>{t("legend")}</span>
    </p>
  );
}

function BestMarker({ className }: { className?: string }) {
  return <span aria-hidden="true" className={cn("inline-block size-1.5 shrink-0 rotate-45 bg-bronze-text", className)} />;
}

function ValueCell({ cell, best }: { cell: CompareCell | null; best: boolean }) {
  const t = useTranslations("compare");
  return (
    <td
      data-testid={best ? "compare-best" : undefined}
      className={cn(CELL_X, "relative py-4 align-top", best ? "border-t-2 border-bronze" : "hairline-t")}
    >
      {cell === null ? (
        <>
          <span aria-hidden="true" className="text-body text-stone">
            —
          </span>
          <span className="sr-only">{t("notStated")}</span>
        </>
      ) : (
        <>
          <p data-numeric className={cn("flex items-baseline gap-2 text-body text-ink", best && "font-medium")}>
            {best ? <BestMarker className="-translate-y-[0.15em]" /> : null}
            <span className="min-w-0">{cell.text}</span>
          </p>
          {cell.detail !== undefined ? (
            <p data-numeric className="mt-1 text-small text-stone-text">
              {cell.detail}
            </p>
          ) : null}
          {best ? (
            <p className="mt-2 font-sans text-label uppercase tracking-[0.1em] text-bronze-text">{t("bestValue")}</p>
          ) : null}
        </>
      )}
    </td>
  );
}

function ColumnMedia({ item, onRemove }: { item: CompareItem; onRemove: () => void }) {
  const locale = useLocale() as Locale;
  const t = useTranslations("compare");
  const tListing = useTranslations("listing");
  const title = pickL10n(item.title, locale).text;
  const status =
    item.status === "reserved"
      ? tListing("statusReserved")
      : item.status === "sold"
        ? tListing("statusSold")
        : item.status === "rented"
          ? tListing("statusRented")
          : null;

  return (
    <div className="flex flex-col gap-3">
      <div className="relative aspect-[3/2] overflow-hidden bg-ivory-2">
        {item.cover !== undefined ? (
          <Image
            src={item.cover.url}
            loader={frameLoader(item.cover.url, 2 / 3)}
            // The title sits right under the photograph; repeating it here
            // would make every column announce its name twice.
            alt=""
            fill
            sizes="(min-width: 1024px) 22vw, (min-width: 768px) 30vw, 12rem"
            placeholder={item.cover.blurDataURL !== undefined ? "blur" : "empty"}
            blurDataURL={item.cover.blurDataURL}
            className="object-cover"
          />
        ) : null}
        {status !== null ? (
          <div className="absolute left-2 top-2">
            <Badge tone="status">{status}</Badge>
          </div>
        ) : null}
        <button
          type="button"
          onClick={onRemove}
          aria-label={t("trayRemove", { title })}
          data-testid="compare-remove"
          data-remove-id={item._id}
          className="absolute right-0 top-0 inline-flex size-11 items-center justify-center bg-ink/75 text-ivory transition-colors duration-200 pointer-fine:hover:bg-ink focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-bronze"
        >
          <X aria-hidden="true" strokeWidth={1.5} className="size-4" />
        </button>
      </div>
      <p className="flex flex-wrap items-center gap-x-2 gap-y-1 font-sans text-label uppercase tracking-[0.1em] text-stone-text">
        <span>
          {tListing(`propertyType.${item.propertyType}`)} · {tListing(`transaction.${item.transaction}`)}
        </span>
        <span aria-hidden="true">/</span>
        <span className="font-mono">{item.ref}</span>
      </p>
    </div>
  );
}
