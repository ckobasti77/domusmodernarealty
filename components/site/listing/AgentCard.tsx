import { Mail, MessageCircle, Phone } from "lucide-react";
import Image from "next/image";
import { getTranslations } from "next-intl/server";
import type { AgentPublic } from "@/convex/lib/dto";
import type { Locale } from "@/i18n/routing";
import { pickL10n } from "@/lib/l10n";
import { buttonClasses } from "../Button";
import { mailHref, telHref, viberHref, whatsappHref } from "./contact-links";

const INTL_LOCALE: Record<Locale, string> = { "sr-Latn": "sr-Latn", en: "en", ru: "ru", de: "de" };

/** "srpski, engleski i nemački" in the page's own language. */
function languageList(codes: readonly string[], locale: Locale): string {
  const names = new Intl.DisplayNames([INTL_LOCALE[locale]], { type: "language" });
  const list = new Intl.ListFormat(INTL_LOCALE[locale], { style: "long", type: "conjunction" });
  return list.format(codes.map((code) => names.of(code) ?? code));
}

const CHANNEL =
  "flex min-h-11 items-center gap-3 text-small text-ink transition-colors duration-200 pointer-fine:hover:text-bronze-text";

/**
 * The agent card (PRD A5). Sticky beside the content on desktop; on phones the
 * same channels live in `MobileActionBar`. A real photo when one exists,
 * otherwise a monogram — never a stock face (CLAUDE.md).
 */
export async function AgentCard({
  agent,
  locale,
  refCode,
  closed,
}: {
  agent: AgentPublic;
  locale: Locale;
  refCode: string;
  closed: boolean;
}) {
  const t = await getTranslations("listing");
  const tCommon = await getTranslations("common");
  const role = pickL10n(agent.role, locale);

  return (
    <aside aria-labelledby="agent-heading" className="bg-ivory-2 p-6 lg:p-8">
      <p className="eyebrow text-stone-text">{t("agent")}</p>
      <div className="mt-5 flex items-center gap-4">
        {agent.photoUrl !== undefined ? (
          <Image
            src={agent.photoUrl}
            alt={agent.name}
            width={72}
            height={72}
            className="size-[72px] shrink-0 rounded-full object-cover"
          />
        ) : (
          <span
            aria-hidden="true"
            className="flex size-[72px] shrink-0 items-center justify-center rounded-full bg-ink font-serif text-[1.625rem] tracking-[0.06em] text-ivory"
          >
            {agent.monogram}
          </span>
        )}
        <div className="min-w-0">
          <h2 id="agent-heading" className="font-serif text-h3 leading-tight">
            {agent.name}
          </h2>
          <p lang={role.lang} className="text-small text-stone-text">
            {role.text}
          </p>
        </div>
      </div>

      {agent.languages.length > 0 ? (
        <p className="mt-4 text-small text-ink">
          {t("agentCard.languages", { languages: languageList(agent.languages, locale) })}
        </p>
      ) : null}

      <ul className="hairline-t mt-5 flex flex-col pt-3">
        {agent.phone !== undefined ? (
          <li>
            <a href={telHref(agent.phone)} className={CHANNEL}>
              <Phone aria-hidden="true" strokeWidth={1.25} className="size-4" />
              <span>
                {t("agentCard.call")} <span data-numeric className="text-stone-text">{agent.phone}</span>
              </span>
            </a>
          </li>
        ) : null}
        {agent.viber !== undefined ? (
          <li>
            <a href={viberHref(agent.viber)} className={CHANNEL}>
              <MessageCircle aria-hidden="true" strokeWidth={1.25} className="size-4" />
              {tCommon("viber")}
            </a>
          </li>
        ) : null}
        {agent.whatsapp !== undefined ? (
          <li>
            <a href={whatsappHref(agent.whatsapp)} target="_blank" rel="noopener noreferrer" className={CHANNEL}>
              <MessageCircle aria-hidden="true" strokeWidth={1.25} className="size-4" />
              {tCommon("whatsapp")}
            </a>
          </li>
        ) : null}
        {agent.email !== undefined ? (
          <li>
            <a href={mailHref(agent.email, t("refCode", { ref: refCode }))} className={CHANNEL}>
              <Mail aria-hidden="true" strokeWidth={1.25} className="size-4" />
              <span>
                {t("agentCard.email")} <span className="break-all text-stone-text">{agent.email}</span>
              </span>
            </a>
          </li>
        ) : null}
      </ul>

      {closed ? null : (
        <div className="mt-6 flex flex-col gap-3">
          <a href="#kontakt" data-contact-tab="inquiry" className={buttonClasses({ variant: "primary" })}>
            {t("askQuestion")}
          </a>
          <a href="#razgledanje" data-contact-tab="viewing" className={buttonClasses({ variant: "outline" })}>
            {t("bookViewing")}
          </a>
        </div>
      )}
    </aside>
  );
}
