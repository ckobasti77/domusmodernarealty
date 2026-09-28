import { locale as localeRootParam } from "next/root-params";
import { hasLocale } from "next-intl";
import { getRequestConfig } from "next-intl/server";
import { defaultLocale, routing } from "./routing";

/**
 * Resolves the active locale from `next/root-params`. The getter is typed
 * `string | undefined` because `app/admin` is a second root layout without a
 * `[locale]` segment, so it can legitimately be missing.
 */
export default getRequestConfig(async ({ locale: override }) => {
  const candidate = override ?? (await localeRootParam());
  const locale = hasLocale(routing.locales, candidate) ? candidate : defaultLocale;

  return {
    locale,
    timeZone: "Europe/Belgrade",
    messages: (await import(`../messages/${locale}.json`)).default,
  };
});
