import { getTranslations } from "next-intl/server";
import { textLinkClasses } from "@/components/site/TextLink";
import type { Locale } from "@/i18n/routing";
import { fixTypography } from "@/lib/format";
import { officeHoursRows, type OfficeSlot } from "./hours";

/**
 * The office as a visitor plans a visit: the address (with a directions link
 * when the pin is set) and the opening hours, Monday first, closed days
 * stated rather than left out.
 */
export async function OfficeDetails({
  locale,
  address,
  hours,
  geo,
}: {
  locale: Locale;
  address: string;
  hours: readonly OfficeSlot[];
  geo?: { lat: number; lng: number };
}) {
  const t = await getTranslations({ locale, namespace: "contact" });
  const rows = officeHoursRows(hours, locale);

  return (
    <div className="flex flex-col gap-12">
      <div>
        <h3 className="font-mono text-label uppercase text-stone-text">{t("addressLabel")}</h3>
        <address className="mt-4 font-display text-h3 font-normal not-italic text-ink lg:text-h2">{address}</address>
        {geo !== undefined ? (
          <a
            href={`https://www.google.com/maps/search/?api=1&query=${geo.lat},${geo.lng}`}
            className={textLinkClasses("light", "mt-5 text-small")}
          >
            {t("directions")}
          </a>
        ) : null}
      </div>

      {rows.length > 0 ? (
        <div>
          <h3 className="font-mono text-label uppercase text-stone-text">{t("hoursHeading")}</h3>
          <dl className="mt-4 hairline-t">
            {rows.map((row) => (
              <div key={row.key} className="flex items-baseline justify-between gap-6 py-3.5 hairline-b">
                <dt className="text-body text-ink">{row.days}</dt>
                <dd data-numeric className={row.hours === null ? "text-body text-stone-text" : "text-body text-ink"}>
                  {row.hours ?? t("closed")}
                </dd>
              </div>
            ))}
          </dl>
          <p className="mt-5 max-w-[44ch] text-small text-stone-text">{fixTypography(t("hoursNote"))}</p>
        </div>
      ) : null}
    </div>
  );
}
