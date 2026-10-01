import { getTranslations } from "next-intl/server";
import { ClipReveal } from "@/components/motion/ClipReveal";
import { buttonClasses } from "@/components/site/Button";
import { Container } from "@/components/site/Container";
import { Picture } from "@/components/site/Picture";
import { SectionHeading } from "@/components/site/SectionHeading";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { fixTypography } from "@/lib/format";
import { artImage, mediaImage } from "@/lib/media";
import { cn } from "@/lib/utils";
import { headingNode, ledeNode, type HomeCopy } from "./copy";
import { ProcessSteps } from "./ProcessSteps";

/**
 * "Kako prodajemo" (DESIGN §6.8), on ivory: the heading, the seller CTA and
 * the owner's entrance-hall still on the left; the five steps along their
 * drawing hairline on the right (`ProcessSteps`).
 */

/** "Ornate historic facades and a street lamp in central Belgrade". */
const FALLBACK_IMAGE = "https://images.unsplash.com/photo-1655245934655-bde35a9dae80";

export async function Process({ locale, copy }: { locale: Locale; copy: HomeCopy["process"] }) {
  const t = await getTranslations({ locale, namespace: "home" });
  const steps = copy.steps.map((step) => ({
    title: step.title.text,
    body: fixTypography(step.body.text),
    ...(step.title.lang !== undefined ? { titleLang: step.title.lang } : {}),
    ...(step.body.lang !== undefined ? { bodyLang: step.body.lang } : {}),
  }));

  return (
    <section aria-labelledby="process-title" className="bg-ivory py-section text-ink lg:py-section-lg">
      <Container>
        <div className="grid grid-cols-4 gap-x-6 gap-y-16 lg:grid-cols-12">
          {/* Sticky on desktop: the heading, the CTA and the still ride beside
              the steps instead of leaving an empty column under them. */}
          <div className="col-span-4 lg:sticky lg:top-24 lg:col-span-5 lg:self-start">
            <SectionHeading
              id="process-title"
              eyebrow={t("processEyebrow")}
              title={headingNode(copy.heading)}
              lede={ledeNode(copy.lede)}
            />
            <Link href="/sell" className={cn(buttonClasses({ variant: "primary" }), "mt-10")}>
              <span>{t("processCta")}</span>
            </Link>

            <ClipReveal className="mt-14 aspect-[4/3] lg:aspect-[3/2]">
              <Picture
                image={artImage("sell", FALLBACK_IMAGE)}
                alt={mediaImage("sell") !== null ? t("processMediaAlt") : ""}
                sizes="(min-width: 1024px) 38vw, 92vw"
                className="absolute inset-0"
                // The keys lie on the console at the lower left of the render.
                imgClassName="object-[30%_70%]"
              />
            </ClipReveal>
          </div>

          <div className="col-span-4 lg:col-span-6 lg:col-start-7 lg:pt-4">
            <ProcessSteps steps={steps} />
          </div>
        </div>
      </Container>
    </section>
  );
}
