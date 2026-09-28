import { ShieldCheck } from "lucide-react";
import { getFormatter, getTranslations } from "next-intl/server";
import type { ListingDetail } from "@/convex/lib/dto";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { fixTypography } from "@/lib/format";
import { pickL10n, type L10nValue } from "@/lib/l10n";

const NBSP = "\u00A0";

/**
 * Legal status (PRD A5, CONTENT "Compliance"): registration, legalization,
 * occupancy permit and encumbrance, the commission text, and the
 * "Verifikovana dokumentacija" statement — shown ONLY when an agent recorded
 * `docsVerifiedAt` (brokerage law Art. 16). Without it the page says the check
 * happens before signing, and claims nothing.
 */
export async function LegalBlock({
  listing,
  locale,
  commission,
}: {
  listing: ListingDetail;
  locale: Locale;
  commission: L10nValue | null;
}) {
  const t = await getTranslations("listing");
  const format = await getFormatter();
  const legal = listing.legal;
  const verified = legal.docsVerifiedAt !== undefined;
  const commissionText = commission !== null ? pickL10n(commission, locale) : null;

  const rows: { label: string; value: string }[] = [
    { label: t("legalBlock.registration"), value: t(`registration.${legal.registration}`) },
    { label: t("legalBlock.legalization"), value: t(`legalization.${legal.legalization}`) },
  ];
  if (legal.occupancyPermit !== undefined) {
    rows.push({
      label: t("legalBlock.occupancyPermit"),
      value: legal.occupancyPermit ? t("facts.yes") : t("facts.no"),
    });
  }
  rows.push({
    label: t("legalBlock.encumbrance"),
    value: legal.encumbrance !== undefined && legal.encumbrance.trim().length > 0 ? legal.encumbrance : t("legalBlock.noEncumbrance"),
  });
  if (legal.ownershipShare !== undefined) {
    rows.push({ label: t("legalBlock.ownershipShare"), value: legal.ownershipShare });
  }

  return (
    <section aria-labelledby="legal-heading">
      <h2 id="legal-heading" className="font-display text-h2">
        {t("legal")}
      </h2>

      <div className="mt-6 flex items-start gap-3 bg-ivory-2 p-5">
        {verified ? (
          <ShieldCheck aria-hidden="true" strokeWidth={1.5} className="mt-0.5 size-5 shrink-0 text-success-text" />
        ) : null}
        <p className="text-small text-ink">
          {verified ? (
            <>
              <strong className="font-medium">{t("verifiedDocs")}.</strong>{" "}
              {fixTypography(
                t("legalBlock.verifiedNote", {
                  // The date sits mid-sentence, so its own spaces must not break
                  // ("8. / septembar"), and no trailing full stop is doubled.
                  date: format
                    .dateTime(new Date(legal.docsVerifiedAt!), { day: "numeric", month: "long", year: "numeric" })
                    .replace(/\s+/g, NBSP),
                }),
              )}
            </>
          ) : (
            t("legalBlock.unverifiedNote")
          )}
        </p>
      </div>

      <dl className="mt-6 grid gap-x-6 sm:grid-cols-2">
        {rows.map((row) => (
          <div key={row.label} className="hairline-t flex flex-col gap-1 py-4">
            <dt className="font-sans text-label uppercase tracking-[0.12em] text-stone-text">{row.label}</dt>
            <dd className="text-body text-ink">{row.value}</dd>
          </div>
        ))}
      </dl>

      {commissionText !== null ? (
        <div className="hairline-t mt-2 pt-4">
          <h3 className="font-sans text-label uppercase tracking-[0.12em] text-stone-text">
            {t("legalBlock.commission")}
          </h3>
          <p lang={commissionText.lang} className="mt-2 max-w-[65ch] text-small text-ink">
            {fixTypography(commissionText.text)}{" "}
            <Link href="/terms" prefetch={false} className="underline decoration-bronze underline-offset-4">
              {t("legalBlock.termsLink")}
            </Link>
          </p>
        </div>
      ) : null}
    </section>
  );
}
