import { ArrowRight } from "lucide-react";
import { getTranslations } from "next-intl/server";
import type { ReactNode } from "react";
import { ListingMapLoader } from "@/components/map/ListingMapLoader";
import { Container } from "@/components/site/Container";
import { SectionHeading } from "@/components/site/SectionHeading";
import { textLinkClasses } from "@/components/site/TextLink";
import type { PublicSettings } from "@/components/site/home/data";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { fixTypography } from "@/lib/format";

/**
 * The office and the agency's registered identity (PRD A10): the address with
 * a link to the contact page, the office on the map when its coordinates are
 * set, and the compliance block — business name, seat, the number in the
 * Register of Brokers (Art. 18 of the brokerage law), PIB and MB (Art. 6 of
 * the e-commerce law). Everything comes from Podešavanja; while the settings
 * are the seeded placeholders the block says so.
 */
export async function OfficeSection({
  settings,
  locale,
  index,
}: {
  settings: PublicSettings;
  locale: Locale;
  /** The eyebrow's number in the page's sequence. */
  index: number;
}) {
  const t = await getTranslations({ locale, namespace: "about" });
  const hasMap = settings.officeLat !== undefined && settings.officeLng !== undefined;

  return (
    <section aria-labelledby="office-title" className="bg-ivory-2 py-section text-ink lg:py-section-lg">
      <Container className="grid grid-cols-4 gap-x-6 gap-y-14 lg:grid-cols-12">
        <div className={hasMap ? "col-span-4 lg:col-span-5" : "col-span-4 lg:col-span-7"}>
          <SectionHeading
            id="office-title"
            eyebrow={t("officeEyebrow")}
            eyebrowIndex={index}
            title={t("officeHeading")}
            lede={t("officeLede")}
          />
          <address className="mt-10 border-t border-hairline-light pt-6 not-italic">
            <span className="block font-mono text-label uppercase text-stone-text">{t("addressLabel")}</span>
            <span className="mt-3 block font-display text-h3">{settings.address}</span>
          </address>
          <Link
            href="/contact"
            className={textLinkClasses("light", "group/contact mt-8 inline-flex items-center gap-3 text-small uppercase tracking-[0.12em]")}
          >
            {t("contactLink")}
            <ArrowRight
              aria-hidden="true"
              strokeWidth={1.25}
              className="size-4 transition-transform duration-300 ease-out pointer-fine:group-hover/contact:translate-x-1"
            />
          </Link>
        </div>

        {hasMap && settings.officeLat !== undefined && settings.officeLng !== undefined ? (
          // The hairline keeps the frame visible on ivory-2 while the tiles load
          // (or when they cannot).
          <div className="col-span-4 self-start border border-hairline-light lg:col-span-6 lg:col-start-7">
            <ListingMapLoader lat={settings.officeLat} lng={settings.officeLng} precision="exact" locale={locale} />
          </div>
        ) : null}

        <div className="col-span-4 border-t border-hairline-light pt-14 lg:col-span-12 lg:mt-10 lg:grid lg:grid-cols-12 lg:gap-x-6 lg:pt-20">
          <div className="lg:col-span-5">
            <h2 id="compliance-title" className="font-display text-h2 font-normal">
              {t("complianceHeading")}
            </h2>
            <p className="mt-4 max-w-[46ch] text-pretty text-small text-stone-text">{fixTypography(t("complianceLede"))}</p>
          </div>
          <div className="mt-10 lg:col-span-6 lg:col-start-7 lg:mt-0">
            <dl aria-labelledby="compliance-title" className="border-t border-hairline-light text-body">
              <ComplianceRow label={t("legalName")}>{settings.legalName}</ComplianceRow>
              <ComplianceRow label={t("seat")}>{settings.address}</ComplianceRow>
              <ComplianceRow label={t("registryNo")}>
                <span data-numeric="">{settings.registryNo}</span>
              </ComplianceRow>
              <ComplianceRow label={t("pib")}>
                <span data-numeric="">{settings.pib}</span>
              </ComplianceRow>
              <ComplianceRow label={t("mb")}>
                <span data-numeric="">{settings.mb}</span>
              </ComplianceRow>
            </dl>
            {settings.isDemo ? (
              <p className="mt-6 max-w-[56ch] text-pretty text-small text-stone-text">{fixTypography(t("complianceDemo"))}</p>
            ) : null}
          </div>
        </div>
      </Container>
    </section>
  );
}

function ComplianceRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid gap-1 border-b border-hairline-light py-4 sm:grid-cols-[minmax(0,15rem)_1fr] sm:gap-6">
      <dt className="font-mono text-label uppercase text-stone-text sm:pt-1">{label}</dt>
      <dd className="min-w-0">{children}</dd>
    </div>
  );
}
