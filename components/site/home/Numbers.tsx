import { getTranslations } from "next-intl/server";
import { ClipReveal } from "@/components/motion/ClipReveal";
import { Counter } from "@/components/motion/Counter";
import { Container } from "@/components/site/Container";
import { Picture } from "@/components/site/Picture";
import { SectionHeading } from "@/components/site/SectionHeading";
import type { Locale } from "@/i18n/routing";
import { fixTypography } from "@/lib/format";
import { pickL10n } from "@/lib/l10n";
import { artImage, mediaImage } from "@/lib/media";
import { parseStat, type PublicSettings } from "./data";

/**
 * Numbers (DESIGN §6.9), on ivory-2: the four figures the owner keeps in
 * Settings, each counting up once. Nothing here is invented — the values and
 * their labels come from `settings.stats`, and while any of them is still the
 * seeded demo value the section says so in plain words under the figures.
 * With no stats at all the section is left out.
 */

/** "Ornate historic facades and a street lamp in central Belgrade". */
const FALLBACK_IMAGE = "https://images.unsplash.com/photo-1655245934655-bde35a9dae80";

export async function Numbers({ locale, stats }: { locale: Locale; stats: PublicSettings["stats"] }) {
  if (stats.length === 0) return null;
  const t = await getTranslations({ locale, namespace: "home" });
  const anyDemo = stats.some((stat) => stat.isDemo);

  return (
    <section aria-labelledby="numbers-title" className="bg-ivory-2 py-section text-ink lg:py-section-lg">
      <Container>
        <div className="grid grid-cols-4 gap-x-6 gap-y-14 lg:grid-cols-12 lg:items-start">
          <div className="col-span-4 lg:col-span-6">
            <SectionHeading id="numbers-title" title={t("numbersHeading")} />

            <dl className="mt-12 grid grid-cols-2 border-t border-hairline-light lg:mt-16">
              {stats.slice(0, 4).map((stat, index) => {
                const parsed = parseStat(stat.value);
                const label = pickL10n(stat.label, locale);
                return (
                  // `<dt>` first, as the content model requires; the column is
                  // reversed so the figure still reads above its label.
                  <div
                    key={`${stat.value}-${index}`}
                    className="flex flex-col-reverse justify-end gap-3 border-b border-hairline-light py-8 odd:pr-6 even:border-l even:pl-6 lg:py-10 lg:even:pl-10"
                  >
                    <dt lang={label.lang !== locale ? label.lang : undefined} className="min-h-[2lh] max-w-[14ch] font-mono text-label uppercase text-stone-text">
                      {label.text}
                    </dt>
                    <dd className="font-display text-display-xl font-normal leading-none">
                      {parsed !== null ? (
                        <Counter value={parsed.value} prefix={parsed.prefix || undefined} suffix={parsed.suffix || undefined} />
                      ) : (
                        stat.value
                      )}
                    </dd>
                  </div>
                );
              })}
            </dl>

            {anyDemo ? (
              <p className="mt-8 max-w-[52ch] text-pretty text-small text-stone-text">{fixTypography(t("numbersDemo"))}</p>
            ) : null}
          </div>

          {/* On desktop the facade straddles the seam with the section above: the
              one image on the page that breaks its band. */}
          <ClipReveal
            from="top"
            className="relative z-10 col-span-4 aspect-video md:aspect-[16/10] lg:col-span-5 lg:col-start-8 lg:-mt-64 lg:aspect-[4/5]"
          >
            <Picture
              image={artImage("about", FALLBACK_IMAGE)}
              alt={mediaImage("about") !== null ? t("numbersMediaAlt") : ""}
              sizes="(min-width: 1024px) 38vw, 92vw"
              className="absolute inset-0"
              // The carved balconies sit in the right half of the facade.
              imgClassName="object-[70%_50%]"
            />
          </ClipReveal>
        </div>
      </Container>
    </section>
  );
}
