import { getTranslations } from "next-intl/server";
import { ClipReveal } from "@/components/motion/ClipReveal";
import { Picture } from "@/components/site/Picture";
import { SectionHeading } from "@/components/site/SectionHeading";
import type { Locale } from "@/i18n/routing";
import { fixTypography } from "@/lib/format";
import { artImage, mediaImage } from "@/lib/media";
import { headingNode, ledeNode, type HomeCopy } from "./copy";
import type { LocationOption } from "./types";
import { ValuationForm } from "./ValuationForm";

/**
 * Valuation CTA (DESIGN §6.10), on ink, split: the owner's floor-plan still
 * life bleeds off the left edge; the question, the mini-form and the note on
 * the free on-site valuation sit on the right.
 *
 * Copy rule (owner decision, 2026-09-28): the instant estimate is described
 * as indicative, from average prices in the area; only the on-site valuation
 * by an agent may mention real transactions. The lede and the note keep the
 * two apart.
 */

/** "Sunny study with a long desk beneath a row of windows and built-in bookshelves". */
const FALLBACK_IMAGE = "https://images.unsplash.com/photo-1777896193454-8b4863264f0b";

export async function ValuationCta({
  locale,
  locations,
  copy,
}: {
  locale: Locale;
  locations: readonly LocationOption[];
  copy: HomeCopy["valuation"];
}) {
  const t = await getTranslations({ locale, namespace: "home" });

  return (
    <section aria-labelledby="valuation-title" className="bg-ink text-ivory">
      <div className="grid lg:grid-cols-2">
        <ClipReveal from="left" className="aspect-[4/3] lg:aspect-auto lg:min-h-[46rem]">
          <Picture
            image={artImage("valuation", FALLBACK_IMAGE)}
            alt={mediaImage("valuation") !== null ? t("valuationMediaAlt") : ""}
            sizes="(min-width: 1024px) 50vw, 100vw"
            className="absolute inset-0"
          />
        </ClipReveal>

        {/* One measure for the heading, the form and the note: a single right edge. */}
        <div className="flex flex-col justify-center px-gutter py-section md:px-gutter-md lg:px-16 lg:py-section-lg xl:px-24 [&>*]:max-w-[34rem]">
          <SectionHeading
            id="valuation-title"
            eyebrow={t("valuationEyebrow")}
            title={headingNode(copy.heading)}
            lede={ledeNode(copy.lede)}
            size="display-l"
            tone="dark"
          />
          <ValuationForm locations={locations} />
          <p
            lang={copy.note.lang}
            className="mt-8 w-full border-t border-hairline-dark pt-6 text-pretty text-small text-mist"
          >
            {fixTypography(copy.note.text)}
          </p>
        </div>
      </div>
    </section>
  );
}
