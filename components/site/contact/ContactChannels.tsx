import { ArrowUpRight } from "lucide-react";
import { getTranslations } from "next-intl/server";
import type { ReactNode } from "react";
import { telHref, viberHref, whatsappHref } from "@/components/site/listing/contact-links";
import type { Locale } from "@/i18n/routing";

/**
 * Every channel the agency publishes in Settings, on ink: phones as `tel:`
 * links, Viber and WhatsApp deep links, the e-mail as `mailto:`. A channel
 * that is not set is not shown. The link text is always the readable number
 * or address (or the app's name), never "click here".
 */

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <li className="grid gap-1 border-b border-hairline-dark py-5 sm:grid-cols-[9rem_minmax(0,1fr)] sm:items-baseline sm:gap-x-6">
      <span className="font-mono text-label uppercase text-mist">{label}</span>
      <span className="flex min-w-0 flex-wrap items-baseline gap-x-8">{children}</span>
    </li>
  );
}

function Channel({ href, numeric = false, children }: { href: string; numeric?: boolean; children: ReactNode }) {
  return (
    <a
      href={href}
      data-numeric={numeric ? "" : undefined}
      className="group/ch inline-flex min-h-11 min-w-0 items-center gap-2 font-display text-h3 font-normal text-ivory transition-colors duration-200 pointer-fine:hover:text-bronze"
    >
      {/* An e-mail address is one long word; let it break rather than overflow a phone. */}
      <span className="min-w-0 [overflow-wrap:anywhere]">{children}</span>
      <ArrowUpRight
        aria-hidden="true"
        strokeWidth={1.25}
        className="size-4 shrink-0 text-mist transition-[translate,color] duration-200 pointer-fine:group-hover/ch:-translate-y-0.5 pointer-fine:group-hover/ch:translate-x-0.5 pointer-fine:group-hover/ch:text-bronze"
      />
    </a>
  );
}

export async function ContactChannels({
  locale,
  phones,
  viber,
  whatsapp,
  email,
}: {
  locale: Locale;
  phones: readonly string[];
  viber?: string;
  whatsapp?: string;
  email: string;
}) {
  const t = await getTranslations({ locale, namespace: "contact" });
  const tCommon = await getTranslations({ locale, namespace: "common" });

  return (
    <ul aria-label={t("channelsLabel")} className="border-t border-hairline-dark">
      {phones.length > 0 ? (
        <Row label={t("channelPhone")}>
          {phones.map((phone) => (
            <Channel key={phone} href={telHref(phone)} numeric>
              {phone}
            </Channel>
          ))}
        </Row>
      ) : null}
      {viber !== undefined || whatsapp !== undefined ? (
        <Row label={t("channelMessaging")}>
          {viber !== undefined ? <Channel href={viberHref(viber)}>{tCommon("viber")}</Channel> : null}
          {whatsapp !== undefined ? <Channel href={whatsappHref(whatsapp)}>{tCommon("whatsapp")}</Channel> : null}
        </Row>
      ) : null}
      {email.length > 0 ? (
        <Row label={t("channelEmail")}>
          <Channel href={`mailto:${email}`}>{email}</Channel>
        </Row>
      ) : null}
    </ul>
  );
}
