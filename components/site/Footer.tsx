import { fetchQuery } from "convex/nextjs";
import { getLocale, getTranslations } from "next-intl/server";
import { cache } from "react";
import { api } from "@/convex/_generated/api";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { pickL10n } from "@/lib/l10n";
import { Container } from "./Container";
import { ConsentSettingsButton } from "./CookieConsent";
import { Logo } from "./Logo";

/**
 * Site footer. Everything in the first column is a legal requirement, not
 * decoration: Serbian brokerage law Art. 18 wants the agency name and its
 * broker-registry number on every page that advertises property, and the
 * e-commerce law wants the legal name, address, PIB and MB.
 *
 * The settings read is wrapped in `cache()` so a page that also reads settings
 * shares the round trip, and in try/catch so an unreachable dev deployment
 * degrades to a visible warning instead of failing the build.
 */

const EXPLORE = [
  { href: "/properties", key: "properties" },
  { href: "/locations", key: "locations" },
  { href: "/valuation", key: "valuation" },
  { href: "/sell", key: "sell" },
  { href: "/agents", key: "agents" },
  { href: "/journal", key: "journal" },
] as const;

const LEGAL = [
  { href: "/privacy", key: "privacyHeading" },
  { href: "/terms", key: "termsHeading" },
  { href: "/cookies", key: "cookiesHeading" },
] as const;

/** Only the networks the owner actually filled in, in a stable order. */
function socialLinks(socials: {
  instagram?: string;
  facebook?: string;
  linkedin?: string;
  youtube?: string;
}): { name: string; href: string }[] {
  const order: readonly (keyof typeof socials)[] = ["instagram", "facebook", "linkedin", "youtube"];
  const out: { name: string; href: string }[] = [];
  for (const name of order) {
    const href = socials[name];
    if (href !== undefined) out.push({ name, href });
  }
  return out;
}

export const getPublicSettings = cache(async () => {
  try {
    return await fetchQuery(api.settings.publicSettings, {});
  } catch {
    return null;
  }
});

export async function Footer() {
  const locale = (await getLocale()) as Locale;
  const t = await getTranslations("footer");
  const tNav = await getTranslations("nav");
  const tLegal = await getTranslations("legal");
  const tCommon = await getTranslations("common");
  const settings = await getPublicSettings();

  const year = new Date().getFullYear();

  return (
    <footer className="bg-ink text-ivory">
      <Container className="py-section lg:py-section-lg">
        <div className="grid gap-12 lg:grid-cols-12 lg:gap-x-gutter-lg">
          {/* Legal identity — Art. 18 + e-commerce law. */}
          <div className="lg:col-span-4">
            <Logo tone="dark" className="w-[230px]" title="" />
            <p className="mt-6 max-w-[34ch] text-small text-mist">{tCommon("tagline")}</p>

            {settings !== null ? (
              <dl className="mt-8 space-y-1 text-small text-mist">
                <div>
                  <dt className="sr-only">{t("aboutHeading")}</dt>
                  <dd className="text-ivory">{settings.legalName}</dd>
                </div>
                <div>
                  <dt className="sr-only">{tCommon("brand")}</dt>
                  <dd>{settings.address}</dd>
                </div>
                <div className="flex gap-2">
                  <dt>{t("registryNumber")}:</dt>
                  <dd data-numeric className="text-ivory">
                    {settings.registryNo}
                  </dd>
                </div>
                <div className="flex gap-2">
                  <dt>{t("companyId")}:</dt>
                  <dd data-numeric>
                    PIB {settings.pib} · MB {settings.mb}
                  </dd>
                </div>
                {settings.insurance !== undefined ? (
                  <div>
                    <dt className="sr-only">{t("legalHeading")}</dt>
                    <dd>{settings.insurance}</dd>
                  </div>
                ) : null}
              </dl>
            ) : (
              <p className="mt-8 border border-warning px-3 py-2 text-small text-warning-text">
                {t("settingsMissing")}
              </p>
            )}

            {settings?.isDemo === true ? (
              <p className="mt-4 border border-warning px-3 py-2 text-small text-warning">
                {t("demoDataWarning")}
              </p>
            ) : null}
          </div>

          <nav aria-labelledby="footer-explore" className="lg:col-span-3">
            <h2 id="footer-explore" className="eyebrow text-bronze">
              {t("exploreHeading")}
            </h2>
            <ul className="mt-5 space-y-2">
              {EXPLORE.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    prefetch={false}
                    className="inline-flex min-h-9 items-center text-small text-mist transition-colors duration-200 pointer-fine:hover:text-ivory"
                  >
                    {tNav(item.key)}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <nav aria-labelledby="footer-legal" className="lg:col-span-2">
            <h2 id="footer-legal" className="eyebrow text-bronze">
              {t("legalHeading")}
            </h2>
            <ul className="mt-5 space-y-2">
              {LEGAL.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    prefetch={false}
                    className="inline-flex min-h-9 items-center text-small text-mist transition-colors duration-200 pointer-fine:hover:text-ivory"
                  >
                    {tLegal(item.key)}
                  </Link>
                </li>
              ))}
              <li>
                <ConsentSettingsButton />
              </li>
            </ul>
          </nav>

          <div className="lg:col-span-3">
            <h2 id="footer-contact" className="eyebrow text-bronze">
              {t("contactHeading")}
            </h2>
            {settings !== null ? (
              <ul className="mt-5 space-y-2 text-small">
                {settings.phones.map((phone) => (
                  <li key={phone}>
                    <a
                      href={`tel:${phone.replace(/[^+\d]/g, "")}`}
                      data-numeric
                      className="inline-flex min-h-9 items-center text-mist transition-colors duration-200 pointer-fine:hover:text-ivory"
                    >
                      {phone}
                    </a>
                  </li>
                ))}
                <li>
                  <a
                    href={`mailto:${settings.email}`}
                    className="inline-flex min-h-9 items-center text-mist transition-colors duration-200 pointer-fine:hover:text-ivory"
                  >
                    {settings.email}
                  </a>
                </li>
              </ul>
            ) : null}

            {settings !== null ? (
              <ul className="mt-6 flex flex-wrap gap-x-5 gap-y-1">
                {socialLinks(settings.socials).map(({ name, href }) => (
                    <li key={name}>
                      <a
                        href={href}
                        rel="noopener noreferrer me"
                        target="_blank"
                        className="inline-flex min-h-9 items-center font-mono text-label uppercase text-mist transition-colors duration-200 pointer-fine:hover:text-bronze"
                      >
                        {name}
                      </a>
                    </li>
                  ))}
              </ul>
            ) : null}

            {settings !== null ? (
              <p className="mt-6 max-w-[34ch] text-small text-mist">
                {pickL10n(settings.commissionText, locale).text}
              </p>
            ) : null}
          </div>
        </div>

        <div className="mt-16 flex flex-wrap items-center justify-between gap-4 border-t border-hairline-dark pt-6 text-small text-stone">
          <p>
            © {year} {settings?.companyName ?? tCommon("brand")}. {t("rights")}
          </p>
          <p>{t("madeIn")}</p>
        </div>
      </Container>
    </footer>
  );
}
