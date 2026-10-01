import { fetchQuery } from "convex/nextjs";
import { getLocale, getTranslations } from "next-intl/server";
import { unstable_rethrow } from "next/navigation";
import { cache } from "react";
import { api } from "@/convex/_generated/api";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { fixOrphans } from "@/lib/format";
import { pickL10n } from "@/lib/l10n";
import { Container } from "./Container";
import { ConsentSettingsButton } from "./CookieConsent";
import { viberHref, whatsappHref } from "./listing/contact-links";
import { LocaleSwitcher } from "./LocaleSwitcher";
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
  { href: "/about", key: "about" },
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
  } catch (error) {
    // Next's own prerender bail-out must reach Next, or a page could be
    // baked with the "settings missing" footer.
    unstable_rethrow(error);
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
      <Container className="pb-10 pt-section lg:pb-12 lg:pt-28">
        {/* The sections' 12-column grid with 24px column gutters (`Grid`). The
            three lists start on column 7, so on the landing they line up under
            the final CTA's contact list on the same ink surface. */}
        <div className="grid gap-12 lg:grid-cols-12 lg:gap-x-6">
          {/* Legal identity — Art. 18 + e-commerce law — and the commission terms. */}
          <div className="lg:col-span-5">
            <Logo tone="dark" className="w-[230px]" title="" />
            <p className="mt-6 max-w-[34ch] text-small text-mist">{fixOrphans(tCommon("tagline"))}</p>

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
                {/* Art. 18: the registry number must appear in full. The strings
                    carry ICU placeholders, so they MUST be interpolated — printing
                    the raw key leaves `{number}` on the legal line, and the ru/de
                    word order differs. */}
                <div>
                  <dt className="sr-only">{t("legalHeading")}</dt>
                  <dd data-numeric className="text-ivory">
                    {t("registryNumber", { number: settings.registryNo })}
                  </dd>
                </div>
                <div>
                  <dt className="sr-only">{t("legalHeading")}</dt>
                  <dd data-numeric>{t("companyId", { pib: settings.pib, mb: settings.mb })}</dd>
                </div>
                {/* Only when a real policy number is on file. The seeded value
                    is an instruction to the owner and must never be public. */}
                {settings.insurance !== undefined && /\d/.test(settings.insurance) ? (
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

            {/* Plain muted text, not a bronze box: a "registry number not
                entered" notice must not be the loudest thing in the footer. */}
            {settings?.isDemo === true ? (
              <p className="mt-4 max-w-[38ch] text-small text-stone">{fixOrphans(t("demoDataWarning"))}</p>
            ) : null}

            {/* The commission terms sit here, not under the contact channels: a
                paragraph needs a wider measure than a two-column span gives it. */}
            {settings !== null ? (
              <p className="mt-6 max-w-[38ch] text-small text-mist">
                {fixOrphans(pickL10n(settings.commissionText, locale).text)}
              </p>
            ) : null}
          </div>

          <nav aria-labelledby="footer-explore" className="lg:col-span-2 lg:col-start-7">
            <h2 id="footer-explore" className="eyebrow text-bronze">
              {t("exploreHeading")}
            </h2>
            <ul className="mt-5 space-y-2">
              {EXPLORE.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
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
            {/* Hyphenated, so "Datenschutzerklärung" fits the column at 1024px. */}
            <ul className="mt-5 space-y-2 hyphens-auto">
              {LEGAL.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
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

          <div className="lg:col-span-2">
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
                  {/* An address is one long word; it breaks rather than run out of a narrow column. */}
                  <a
                    href={`mailto:${settings.email}`}
                    className="inline-flex min-h-9 items-center text-mist transition-colors duration-200 [overflow-wrap:anywhere] pointer-fine:hover:text-ivory"
                  >
                    {settings.email}
                  </a>
                </li>
                {/* Brand names, the same in every language. */}
                {settings.viber !== undefined ? (
                  <li>
                    <a
                      href={viberHref(settings.viber)}
                      className="inline-flex min-h-9 items-center text-mist transition-colors duration-200 pointer-fine:hover:text-ivory"
                    >
                      Viber
                    </a>
                  </li>
                ) : null}
                {settings.whatsapp !== undefined ? (
                  <li>
                    <a
                      href={whatsappHref(settings.whatsapp)}
                      rel="noopener noreferrer"
                      target="_blank"
                      className="inline-flex min-h-9 items-center text-mist transition-colors duration-200 pointer-fine:hover:text-ivory"
                    >
                      WhatsApp
                    </a>
                  </li>
                ) : null}
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
          </div>
        </div>

        <div className="mt-16 flex flex-wrap items-center justify-between gap-4 border-t border-hairline-dark pt-6 text-small text-stone">
          {/* `rights` is "© {year} {brand}. …" — it owns the whole line. */}
          <p>{t("rights", { year, brand: settings?.companyName ?? tCommon("brand") })}</p>
          <LocaleSwitcher />
          <p>{t("madeIn")}</p>
        </div>
      </Container>
    </footer>
  );
}
