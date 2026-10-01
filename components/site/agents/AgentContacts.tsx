import { Mail, MessageCircle, MessagesSquare, Phone } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { buttonClasses } from "@/components/site/Button";
import { mailHref, telHref, viberHref, whatsappHref } from "@/components/site/listing/contact-links";
import type { AgentPublic } from "@/convex/lib/dto";
import type { Locale } from "@/i18n/routing";
import { cn } from "@/lib/utils";

/**
 * The agent's own channels, on the profile's ink band: only the ones the admin
 * filled in, each a real deep link (tel:, Viber, WhatsApp, mailto:). The phone
 * leads, as the one most visitors use; the reply-time promise sits under them.
 */
export async function AgentContacts({ agent, locale }: { agent: AgentPublic; locale: Locale }) {
  const t = await getTranslations({ locale, namespace: "agents" });
  const tCommon = await getTranslations({ locale, namespace: "common" });
  const icon = "size-4 shrink-0";
  const secondary = cn(buttonClasses({ variant: "outlineDark" }), "px-6");

  const channels = [
    agent.phone !== undefined ? (
      <a key="tel" href={telHref(agent.phone)} className={cn(buttonClasses({ variant: "inverse" }), "px-6")}>
        <Phone aria-hidden="true" strokeWidth={1.25} className={icon} />
        <span>
          <span className="sr-only">{t("call")} </span>
          <span data-numeric="" className="whitespace-nowrap normal-case tracking-normal">
            {agent.phone}
          </span>
        </span>
      </a>
    ) : null,
    agent.viber !== undefined ? (
      <a key="viber" href={viberHref(agent.viber)} className={secondary}>
        <MessagesSquare aria-hidden="true" strokeWidth={1.25} className={icon} />
        {tCommon("viber")}
      </a>
    ) : null,
    agent.whatsapp !== undefined ? (
      <a key="whatsapp" href={whatsappHref(agent.whatsapp)} target="_blank" rel="noopener noreferrer" className={secondary}>
        <MessageCircle aria-hidden="true" strokeWidth={1.25} className={icon} />
        {tCommon("whatsapp")}
      </a>
    ) : null,
    agent.email !== undefined ? (
      <a key="email" href={mailHref(agent.email, t("emailSubject"))} className={secondary}>
        <Mail aria-hidden="true" strokeWidth={1.25} className={icon} />
        {t("email")}
      </a>
    ) : null,
  ].filter((channel) => channel !== null);

  if (channels.length === 0) return null;

  return (
    <div className="mt-4 flex flex-col gap-5">
      <div className="flex flex-wrap gap-3">{channels}</div>
      <p className="max-w-[46ch] text-small text-mist">{t("replyPromise")}</p>
    </div>
  );
}
