import { getTranslations } from "next-intl/server";
import { buttonClasses } from "@/components/site/Button";
import { Container } from "@/components/site/Container";
import { SectionHeading } from "@/components/site/SectionHeading";
import { textLinkClasses } from "@/components/site/TextLink";
import type { ListingCard } from "@/convex/lib/dto";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { fixTypography } from "@/lib/format";
import { artImage, mediaImage, mediaVideo } from "@/lib/media";
import { searchQuery } from "@/lib/search-params";
import { headingNode, type HomeCopy } from "./copy";
import { ToursStage } from "./ToursStage";

/**
 * 3D-tours teaser (DESIGN §6.7), on ink. The heading and the two calls to
 * action sit above the stage in normal flow, so they stay readable and
 * clickable whatever the stage is doing; the stage (`ToursStage`) owns the
 * pinned zoom.
 *
 * The primary CTA opens a real listing that has a demo tour — the first
 * featured one with `hasTour` — and disappears if none has, leaving the link
 * to the filtered search.
 */

/** "Warmly lit open-plan living room and kitchen at night with city lights through tall windows". */
const FALLBACK_BACKDROP = "https://images.unsplash.com/photo-1680416124510-5eae1beca412";

export async function ToursTeaser({
  locale,
  listing,
  copy,
}: {
  locale: Locale;
  listing: ListingCard | null;
  copy: HomeCopy["tours"];
}) {
  const t = await getTranslations({ locale, namespace: "home" });

  return (
    <section aria-labelledby="tours-title" className="bg-ink text-ivory">
      <Container className="pb-14 pt-section lg:pb-20 lg:pt-section-lg">
        <div className="grid grid-cols-4 gap-x-6 gap-y-10 lg:grid-cols-12 lg:items-end">
          <SectionHeading
            id="tours-title"
            eyebrow={t("toursEyebrow")}
            title={headingNode(copy.heading)}
            size="display-l"
            tone="dark"
            // Narrow enough that the bound "pre nego što" moves to the second
            // line with its verb, instead of leaving "dođete." alone there.
            className="col-span-4 lg:col-span-7 lg:max-w-[min(45vw,44rem)]"
          />
          <div className="col-span-4 lg:col-span-4 lg:col-start-9 lg:pb-2">
            <p lang={copy.lede.lang} className="max-w-[40ch] text-pretty text-body-l text-mist">
              {fixTypography(copy.lede.text)}
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-x-8 gap-y-5">
              {listing !== null ? (
                <Link
                  href={{ pathname: "/properties/[slug]", params: { slug: listing.slug } }}
                  className={buttonClasses({ variant: "inverse" })}
                >
                  <span>{t("toursCta")}</span>
                </Link>
              ) : null}
              <Link
                href={{ pathname: "/properties", query: searchQuery({ transaction: "sale", hasTour: true }) }}
                prefetch={false}
                className={textLinkClasses("dark", "text-small uppercase tracking-[0.12em]")}
              >
                {t("toursCtaAll")}
              </Link>
            </div>
          </div>
        </div>
      </Container>

      <ToursStage
        backdrop={artImage("tours3d", FALLBACK_BACKDROP)}
        // The alt describes the owner's scan render; the stand-in photo is atmosphere only.
        backdropAlt={mediaImage("tours3d") !== null ? t("toursMediaAlt") : ""}
        film={mediaVideo("walkthrough")}
        cta={listing !== null ? { slug: listing.slug, label: t("toursCta") } : null}
      />
    </section>
  );
}
