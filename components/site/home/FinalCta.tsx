import { ArrowUpRight } from "lucide-react";
import { getTranslations } from "next-intl/server";
import type { ReactNode } from "react";
import { MagneticButton } from "@/components/motion/MagneticButton";
import { SplitReveal } from "@/components/motion/SplitReveal";
import { buttonClasses } from "@/components/site/Button";
import { Container } from "@/components/site/Container";
import { Eyebrow } from "@/components/site/Eyebrow";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { fixTypography } from "@/lib/format";
import type { HomeCopy } from "./copy";
import type { PublicSettings } from "./data";

/**
 * Final CTA (DESIGN §6.13), on ink, flowing into the footer: the big serif
 * "Razgovarajmo.", the one reply-time promise, and every channel the agency
 * publishes in Settings — phone, Viber, WhatsApp, e-mail — as real links. A
 * channel that is not set is not shown; with no settings at all only the
 * contact-page CTA remains.
 */

/** `+381 11 000 0010` → `+381110000010`. */
function dialable(phone: string): string {
  return phone.replace(/[^\d+]/g, "");
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <li className="flex flex-col items-start gap-2 border-b border-hairline-dark py-6 sm:flex-row sm:flex-wrap sm:items-baseline sm:justify-between sm:gap-x-8">
      <span className="font-mono text-label uppercase text-mist">{label}</span>
      <span className="flex flex-wrap items-baseline gap-x-8 gap-y-2">{children}</span>
    </li>
  );
}

function Channel({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a
      href={href}
      className="group/ch inline-flex min-w-0 items-baseline gap-2 font-display text-h3 font-normal text-ivory transition-colors duration-200 sm:text-h2 pointer-fine:hover:text-bronze"
    >
      {/* An e-mail address is one long word; let it break rather than overflow a phone. */}
      <span className="min-w-0 [overflow-wrap:anywhere]">{children}</span>
      <ArrowUpRight
        aria-hidden="true"
        strokeWidth={1.25}
        className="size-5 self-center text-mist transition-[translate,color] duration-200 pointer-fine:group-hover/ch:-translate-y-0.5 pointer-fine:group-hover/ch:translate-x-0.5 pointer-fine:group-hover/ch:text-bronze"
      />
    </a>
  );
}

export async function FinalCta({
  locale,
  settings,
  copy,
}: {
  locale: Locale;
  settings: PublicSettings | null;
  copy: HomeCopy["final"];
}) {
  const t = await getTranslations({ locale, namespace: "home" });
  const tCommon = await getTranslations({ locale, namespace: "common" });

  const phone = settings?.phones[0];
  const viber = settings?.viber;
  const whatsapp = settings?.whatsapp;
  const email = settings?.email;

  return (
    <section aria-labelledby="final-title" className="bg-ink text-ivory">
      <Container className="pt-section lg:pt-section-lg">
        <div className="border-b border-hairline-dark pb-section lg:pb-32">
          <Eyebrow tone="accentDark">{t("finalEyebrow")}</Eyebrow>
          <h2 id="final-title" lang={copy.heading.lang} className="mt-6 font-display text-display-xl font-normal text-ivory">
            <SplitReveal as="span" className="block">
              {copy.heading.text}
            </SplitReveal>
          </h2>

          <div className="mt-12 grid grid-cols-4 gap-x-6 gap-y-14 lg:mt-16 lg:grid-cols-12 lg:items-end">
            <div className="col-span-4 lg:col-span-5">
              <p lang={copy.lede.lang} className="max-w-[44ch] text-pretty text-body-l text-mist">
                {fixTypography(copy.lede.text)}
              </p>
              <MagneticButton className="mt-10">
                <Link href="/contact" prefetch={false} className={buttonClasses({ variant: "inverse" })}>
                  <span>{t("finalCta")}</span>
                </Link>
              </MagneticButton>
            </div>

            {/* The block closes on its own hairline, so the last row does not add one. */}
            {phone !== undefined || viber !== undefined || whatsapp !== undefined || email !== undefined ? (
              <ul className="col-span-4 border-t border-hairline-dark lg:col-span-6 lg:col-start-7 [&>li:last-child]:border-b-0">
                {phone !== undefined ? (
                  <Row label={tCommon("phone")}>
                    <Channel href={`tel:${dialable(phone)}`}>{phone}</Channel>
                  </Row>
                ) : null}
                {viber !== undefined || whatsapp !== undefined ? (
                  <Row label={t("finalMessages")}>
                    {viber !== undefined ? (
                      <Channel href={`viber://chat?number=${encodeURIComponent(dialable(viber))}`}>
                        {tCommon("viber")}
                      </Channel>
                    ) : null}
                    {whatsapp !== undefined ? (
                      <Channel href={`https://wa.me/${dialable(whatsapp).replace("+", "")}`}>
                        {tCommon("whatsapp")}
                      </Channel>
                    ) : null}
                  </Row>
                ) : null}
                {email !== undefined ? (
                  <Row label={tCommon("email")}>
                    <Channel href={`mailto:${email}`}>{email}</Channel>
                  </Row>
                ) : null}
              </ul>
            ) : null}
          </div>
        </div>
      </Container>
    </section>
  );
}
