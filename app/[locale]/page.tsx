import { getTranslations } from "next-intl/server";
import { fixOrphans } from "@/lib/format";
import { Counter } from "@/components/motion/Counter";
import { SplitReveal } from "@/components/motion/SplitReveal";
import { ImageReveal } from "@/components/motion/ImageReveal";
import { buttonClasses } from "@/components/site/Button";
import { Container, Grid, Section } from "@/components/site/Container";
import { Divider } from "@/components/site/Divider";
import { Eyebrow } from "@/components/site/Eyebrow";
import { SectionHeading } from "@/components/site/SectionHeading";
import { Link } from "@/i18n/navigation";

/**
 * Foundation placeholder for the landing page. Step 05 replaces it with the 13
 * choreographed sections from docs/03-DESIGN-SYSTEM.md §6.
 *
 * It already runs on the real shell (header, footer, preloader, consent) and
 * carries a glyph specimen, so screenshots of `/ru` and `/de` prove the Cyrillic
 * and Latin-Extended subsets load in both families.
 *
 * No `<main>` here — the locale layout owns it, together with the skip-link
 * target.
 */
export default async function HomePage({ params }: PageProps<"/[locale]">) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "home" });
  const tCommon = await getTranslations({ locale, namespace: "common" });

  return (
    <>
      {/* The consent banner is fixed to the bottom of the viewport, and a
          bottom-aligned full-height hero puts its CTAs and scroll cue exactly
          there. `--consent-h` is published by the banner while it is up. */}
      <Section
        tone="ink"
        className="flex min-h-svh flex-col justify-end pt-32 lg:pt-40"
        style={{ paddingBottom: "calc(4rem + var(--consent-h, 0px))" }}
      >
        <Container>
          <Eyebrow tone="accentDark">{t("heroEyebrow")}</Eyebrow>

          <h1 className="mt-6 max-w-[16ch] font-display text-display-xl font-normal text-ivory">
            <SplitReveal as="span" className="block">
              {t("heroHeadline")}
            </SplitReveal>
          </h1>

          <p className="mt-8 max-w-[52ch] text-body-l text-mist lg:mt-10">{fixOrphans(t("heroLede"))}</p>

          <div className="mt-8 flex flex-wrap items-center gap-4 lg:mt-12">
            <Link href="/properties" prefetch={false} className={buttonClasses({ variant: "inverse" })}>
              <span>{t("heroCta")}</span>
            </Link>
            <Link href="/valuation" prefetch={false} className={buttonClasses({ variant: "outlineDark" })}>
              <span>{t("valuationCta")}</span>
            </Link>
          </div>

          <div className="mt-10 flex items-center gap-4 lg:mt-16">
            {/* The thin line of DESIGN 6.2; `mist` is the muted-on-ink token,
                `stone` is documented as decorative only. */}
            <span aria-hidden="true" className="block h-12 w-px bg-linear-to-b from-bronze to-transparent" />
            <p className="font-mono text-label uppercase text-mist">{t("scrollCue")}</p>
          </div>
        </Container>
      </Section>

      <Section tone="ivory">
        <Container>
          <SectionHeading
            eyebrow={t("featuredEyebrow")}
            title={t("introStatement")}
            lede={t("introSignature")}
            size="display-m"
            action={
              <Link href="/properties" prefetch={false} className={buttonClasses({ variant: "outline", size: "compact" })}>
                <span>{t("featuredAll")}</span>
              </Link>
            }
          />

          <Divider className="mt-16" />

          {/* Glyph specimen: both families, all three scripts. */}
          <Grid className="mt-16">
            <div className="col-span-4 lg:col-span-6">
              <p className="font-mono text-label uppercase text-stone-text">EB Garamond</p>
              <p className="mt-3 font-display text-h2 font-normal">Čačak Ćuprija Šabac Žabalj Đakovica</p>
              <p lang="ru" className="font-display text-h2 font-normal">
                Привет Београд Москва
              </p>
              <p lang="de" className="font-display text-h2 font-normal">
                Grüße Österreich Zürich
              </p>
            </div>
            <div className="col-span-4 lg:col-span-6">
              <p className="font-mono text-label uppercase text-stone-text">Manrope</p>
              <p className="mt-3 text-body-l text-stone-text">Čačak Ćuprija Šabac Žabalj Đakovica</p>
              <p lang="ru" className="text-body-l text-stone-text">
                Привет Београд Москва
              </p>
              <p lang="de" className="text-body-l text-stone-text">
                Grüße Österreich Zürich
              </p>
            </div>
          </Grid>
        </Container>
      </Section>

      <Section tone="ivory-2">
        <Container>
          <Grid>
            <div className="col-span-4 lg:col-span-5">
              <SectionHeading
                eyebrow={t("numbersEyebrow")}
                title={t("numbersHeading")}
                size="h2"
              />
              {/* DESIGN 9 asks for four. The values are placeholders until step 09
                  reads them from `settings.stats`, where each one carries its own
                  `isDemo` flag. */}
              <dl className="mt-10 grid grid-cols-2 gap-x-6 gap-y-10">
                {[
                  { value: 12, label: t("numbersYears") },
                  { value: 248, label: t("numbersSold") },
                  { value: 410, label: t("numbersClients") },
                  { value: 47, label: t("numbersDaysToSell") },
                ].map((item) => (
                  <div key={item.label}>
                    <dd className="font-display text-display-m font-normal">
                      <Counter value={item.value} />
                    </dd>
                    <dt className="mt-2 max-w-[16ch] font-mono text-label uppercase text-stone-text">
                      {item.label}
                    </dt>
                  </div>
                ))}
              </dl>
            </div>

            <div className="col-span-4 lg:col-span-6 lg:col-start-7">
              <ImageReveal
                src="/media/about/about-1280.webp"
                alt={tCommon("tagline")}
                ratio="aspect-[4/5]"
                sizes="(min-width: 1024px) 45vw, 90vw"
              />
            </div>
          </Grid>
        </Container>
      </Section>

      <Section tone="ink">
        <Container className="flex flex-col items-start gap-8 lg:flex-row lg:items-end lg:justify-between">
          <SectionHeading title={t("finalHeading")} lede={t("finalLede")} size="display-l" tone="dark" />
          <Link href="/contact" prefetch={false} className={buttonClasses({ variant: "inverse" })}>
            <span>{tCommon("phone")}</span>
          </Link>
        </Container>
      </Section>
    </>
  );
}
