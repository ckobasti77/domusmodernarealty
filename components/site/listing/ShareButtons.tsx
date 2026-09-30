"use client";

import { Check, Link2, Mail, MessageCircle } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";

/**
 * Share row (PRD A5): copy link, WhatsApp, Viber, e-mail. The URL is the
 * canonical one from the server, so a visitor on `?utm=…` never forwards it.
 */
export function ShareButtons({ url, title }: { url: string; title: string }) {
  const t = useTranslations("listing.share");
  const tCommon = useTranslations("common");
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2500);
    } catch {
      window.prompt(tCommon("copyLink"), url);
    }
  }

  const text = `${title} — ${url}`;
  const link =
    "inline-flex min-h-11 items-center gap-2 text-small text-ink transition-colors duration-200 pointer-fine:hover:text-bronze-text";

  return (
    <div className="flex flex-col gap-3">
      <p className="eyebrow text-stone-text">{t("heading")}</p>
      <ul className="grid grid-cols-2 gap-x-5 sm:flex sm:flex-wrap">
        <li>
          <button type="button" onClick={copy} className={link}>
            {copied ? (
              <Check aria-hidden="true" strokeWidth={1.5} className="size-4" />
            ) : (
              <Link2 aria-hidden="true" strokeWidth={1.5} className="size-4" />
            )}
            {tCommon("copyLink")}
          </button>
        </li>
        <li>
          <a
            href={`https://wa.me/?text=${encodeURIComponent(text)}`}
            target="_blank"
            rel="noopener noreferrer"
            className={link}
          >
            <MessageCircle aria-hidden="true" strokeWidth={1.5} className="size-4" />
            {tCommon("whatsapp")}
          </a>
        </li>
        <li>
          <a href={`viber://forward?text=${encodeURIComponent(text)}`} className={link}>
            <MessageCircle aria-hidden="true" strokeWidth={1.5} className="size-4" />
            {tCommon("viber")}
          </a>
        </li>
        <li>
          <a
            href={`mailto:?subject=${encodeURIComponent(t("emailSubject", { title }))}&body=${encodeURIComponent(url)}`}
            className={link}
          >
            <Mail aria-hidden="true" strokeWidth={1.5} className="size-4" />
            {t("email")}
          </a>
        </li>
      </ul>
      <p role="status" aria-live="polite" className="min-h-5 text-small text-success-text">
        {copied ? tCommon("copied") : ""}
      </p>
    </div>
  );
}
