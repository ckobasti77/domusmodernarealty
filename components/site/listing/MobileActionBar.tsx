"use client";

import { CalendarDays, MessageCircle, Phone } from "lucide-react";
import { useTranslations } from "next-intl";
import { telHref, viberHref, whatsappHref } from "./contact-links";

/**
 * The phone-only action bar (PRD A5: Pozovi · Viber · Zakaži razgledanje). The
 * booking cell is the one ivory block on the ink bar (bronze is never a large
 * fill, DESIGN §1). It
 * sits above the cookie banner via `--consent-h`, respects the home-indicator
 * safe area, and drops "Zakaži" on sold/rented listings, which take no bookings.
 */
export function MobileActionBar({
  phone,
  viber,
  whatsapp,
  canBook,
}: {
  phone?: string;
  viber?: string;
  whatsapp?: string;
  canBook: boolean;
}) {
  const t = useTranslations("listing.actionBar");
  const tCommon = useTranslations("common");

  const item =
    "flex min-h-14 flex-1 flex-col items-center justify-center gap-1 font-sans text-label uppercase tracking-[0.12em] text-ivory transition-colors duration-200 active:bg-ink-3";

  return (
    <nav
      aria-label={t("label")}
      data-testid="mobile-action-bar"
      className="fixed inset-x-0 z-(--z-header) flex border-t border-hairline-dark bg-ink pb-[env(safe-area-inset-bottom)] md:hidden"
      style={{ bottom: "var(--consent-h, 0px)" }}
    >
      {phone !== undefined ? (
        <a href={telHref(phone)} className={item}>
          <Phone aria-hidden="true" strokeWidth={1.25} className="size-5" />
          {t("call")}
        </a>
      ) : null}
      {viber !== undefined ? (
        <a href={viberHref(viber)} className={item}>
          <MessageCircle aria-hidden="true" strokeWidth={1.25} className="size-5" />
          {tCommon("viber")}
        </a>
      ) : null}
      {whatsapp !== undefined ? (
        <a href={whatsappHref(whatsapp)} target="_blank" rel="noopener noreferrer" className={item}>
          <MessageCircle aria-hidden="true" strokeWidth={1.25} className="size-5" />
          {tCommon("whatsapp")}
        </a>
      ) : null}
      {canBook ? (
        <a href="#razgledanje" data-contact-tab="viewing" className={`${item} bg-ivory text-ink active:bg-ivory-2`}>
          <CalendarDays aria-hidden="true" strokeWidth={1.25} className="size-5" />
          {t("book")}
        </a>
      ) : null}
    </nav>
  );
}
