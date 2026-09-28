import { ArrowRight } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { buttonClasses } from "@/components/site/Button";
import { Container } from "@/components/site/Container";
import { Eyebrow } from "@/components/site/Eyebrow";
import { PropertyCard } from "@/components/site/PropertyCard";
import { SectionHeading } from "@/components/site/SectionHeading";
import { textLinkClasses } from "@/components/site/TextLink";
import type { ListingCard } from "@/convex/lib/dto";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { fixOrphans } from "@/lib/format";
import { FeaturedRail } from "./FeaturedRail";

/**
 * Featured listings (DESIGN §6.4). On desktop the section pins and the row of
 * 4:5 cards travels sideways, opening with the section title as its first
 * panel and closing on "Sve nekretnine"; below 1024px it is a native
 * scroll-snap carousel. The choreography lives in `FeaturedRail`.
 *
 * The rail's left and right padding track the 1440px content column, so the
 * first and last panels line up with every other section's text edge.
 */

const EDGE = "lg:px-[max(3rem,calc((100vw-90rem)/2+3rem))]";

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

export async function FeaturedListings({ locale, listings }: { locale: Locale; listings: readonly ListingCard[] }) {
  const t = await getTranslations({ locale, namespace: "home" });
  const total = listings.length;

  if (total === 0) {
    return (
      <section aria-labelledby="featured-title" className="bg-ivory py-section text-ink lg:py-section-lg">
        <Container className="flex flex-col items-start gap-8">
          <SectionHeading id="featured-title" eyebrow={t("featuredEyebrow")} title={t("featuredHeading")} />
          <p className="max-w-[52ch] text-body-l text-stone-text">{fixOrphans(t("featuredEmpty"))}</p>
          <Link href="/contact" prefetch={false} className={buttonClasses({ variant: "primary" })}>
            <span>{t("featuredEmptyCta")}</span>
          </Link>
        </Container>
      </section>
    );
  }

  return (
    <section aria-labelledby="featured-title" className="bg-ivory text-ink">
      <FeaturedRail total={total}>
        <div
          data-featured-pin=""
          className="relative flex flex-col py-section lg:h-svh lg:justify-center lg:py-0 lg:pt-24"
        >
          <div data-featured-viewport="" className="overflow-x-auto [scrollbar-width:none]">
            <div data-featured-track="" className={`flex flex-col lg:w-max lg:flex-row lg:items-center ${EDGE}`}>
              {/* The opening panel. Above the carousel below 1024px. */}
              <header className="px-gutter md:px-gutter-md lg:w-[min(30rem,30vw)] lg:shrink-0 lg:px-0 lg:pr-16">
                <Eyebrow>{t("featuredEyebrow")}</Eyebrow>
                <h2 id="featured-title" className="mt-4 max-w-[12ch] font-display text-display-l font-normal">
                  {fixOrphans(t("featuredHeading"))}
                </h2>
              </header>

              <ul
                data-featured-list=""
                className={[
                  "mt-10 flex snap-x snap-mandatory gap-5 overflow-x-auto px-gutter pb-2 [scrollbar-width:none] md:px-gutter-md",
                  "scroll-px-gutter md:scroll-px-gutter-md",
                  "lg:mt-0 lg:snap-none lg:gap-8 lg:overflow-visible lg:px-0 lg:pb-0",
                ].join(" ")}
              >
                {listings.map((listing) => (
                  <li
                    key={listing._id}
                    data-featured-card=""
                    className="w-[78vw] shrink-0 snap-start sm:w-[46vw] lg:w-[min(24vw,calc((100svh-18rem)*0.5))]"
                  >
                    <PropertyCard
                      listing={listing}
                      ratio="4/5"
                      sizes="(min-width: 1024px) 24vw, (min-width: 640px) 46vw, 78vw"
                    />
                  </li>
                ))}
              </ul>

              {/* The closing panel, desktop only: the journey ends on the CTA. */}
              <div className="hidden lg:flex lg:w-[min(26rem,26vw)] lg:shrink-0 lg:flex-col lg:items-start lg:pl-16">
                <Link
                  href="/properties"
                  prefetch={false}
                  className="group/all flex items-center gap-5 font-display text-display-m font-normal text-ink transition-colors duration-200 pointer-fine:hover:text-bronze-text"
                >
                  <span>{t("featuredAll")}</span>
                  <ArrowRight
                    aria-hidden="true"
                    strokeWidth={1}
                    className="size-10 shrink-0 transition-transform duration-300 ease-out pointer-fine:group-hover/all:translate-x-2"
                  />
                </Link>
              </div>
            </div>
          </div>

          {/* Progress: a bronze hairline and the "01 / 06" counter. */}
          <Container className="mt-8 flex items-center gap-6 lg:absolute lg:inset-x-0 lg:bottom-10 lg:mt-0">
            <p aria-hidden="true" data-numeric="" className="font-mono text-label text-stone-text">
              <span data-featured-index="">01</span> / {pad(total)}
            </p>
            <div className="h-px flex-1 bg-hairline-light">
              <div data-featured-progress="" className="h-px origin-left scale-x-0 bg-bronze-text" />
            </div>
            <Link
              href="/properties"
              prefetch={false}
              className={textLinkClasses("light", "text-small uppercase tracking-[0.12em] lg:hidden")}
            >
              {t("featuredAll")}
            </Link>
          </Container>
        </div>
      </FeaturedRail>
    </section>
  );
}
