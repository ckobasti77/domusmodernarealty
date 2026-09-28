"use client";

import { useTranslations } from "next-intl";

/**
 * Localized error boundary for the public tree. `retry` became a stable prop of
 * error files in Next 16.3.
 */
export default function LocaleError({ retry }: { error: Error; retry: () => void }) {
  const t = useTranslations("errors");

  return (
    <main className="flex min-h-svh flex-col items-center justify-center bg-ink px-gutter text-center text-ivory">
      <p className="font-mono text-label uppercase text-bronze">500</p>
      <h1 className="mt-6 font-display text-display-m font-normal">{t("genericHeading")}</h1>
      <p className="mt-5 max-w-[44ch] text-body text-mist">{t("genericBody")}</p>
      <button
        type="button"
        onClick={retry}
        className="mt-10 border-b border-bronze pb-1 font-sans text-small uppercase tracking-[0.18em] text-ivory transition-colors duration-200 hover:text-bronze"
      >
        {t("retry")}
      </button>
    </main>
  );
}
