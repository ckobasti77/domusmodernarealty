import { getTranslations } from "next-intl/server";
import { LocaleSwitcher } from "@/components/site/LocaleSwitcher";

/**
 * Foundation placeholder for the landing page. Step 05 replaces it with the 13
 * choreographed sections from docs/03-DESIGN-SYSTEM.md 6. It is intentionally
 * on-brand and includes a glyph specimen so screenshots of `/ru` and `/de`
 * prove the Cyrillic and Latin-Extended subsets load in both families.
 */
export default async function HomePage({ params }: PageProps<"/[locale]">) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "home" });
  const tCommon = await getTranslations({ locale, namespace: "common" });

  return (
    <main className="min-h-svh bg-ink text-ivory">
      <header className="mx-auto flex max-w-content items-baseline justify-between px-gutter py-8 lg:px-gutter-lg">
        <p className="font-display text-base font-medium uppercase tracking-[0.24em] text-ivory">
          {tCommon("brand")}
        </p>
        <LocaleSwitcher />
      </header>

      <div className="mx-auto max-w-content px-gutter pb-section lg:px-gutter-lg lg:pb-section-lg">
        <p className="eyebrow mt-24 text-bronze lg:mt-40">{t("heroEyebrow")}</p>

        <h1 className="mt-6 max-w-[16ch] font-display text-display-xl font-light text-ivory">
          {t("heroHeadline")}
        </h1>

        <p className="mt-10 max-w-[52ch] text-body-l text-mist">{t("heroLede")}</p>

        <div className="mt-16 border-t border-hairline-dark pt-10">
          <p className="font-mono text-label uppercase text-stone">
            {tCommon("brand")} · {tCommon("tagline")}
          </p>

          <dl className="mt-8 grid gap-8 sm:grid-cols-2">
            <div>
              <dt className="font-mono text-label uppercase text-stone">Cormorant Garamond</dt>
              <dd className="mt-3 font-display text-h2 font-light text-ivory">
                Čačak Ćuprija Šabac Žabalj Đakovica
              </dd>
              <dd className="font-display text-h2 font-light text-ivory">Привет Београд Москва</dd>
              <dd className="font-display text-h2 font-light text-ivory">Grüße Österreich Zürich</dd>
            </div>
            <div>
              <dt className="font-mono text-label uppercase text-stone">Manrope</dt>
              <dd className="mt-3 text-body-l text-mist">Čačak Ćuprija Šabac Žabalj Đakovica</dd>
              <dd className="text-body-l text-mist">Привет Београд Москва</dd>
              <dd className="text-body-l text-mist">Grüße Österreich Zürich</dd>
            </div>
          </dl>
        </div>
      </div>
    </main>
  );
}
