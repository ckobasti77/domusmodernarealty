import { getTranslations } from "next-intl/server";
import { ClipReveal } from "@/components/motion/ClipReveal";
import { Reveal } from "@/components/motion/Reveal";
import { buttonClasses } from "@/components/site/Button";
import { Container } from "@/components/site/Container";
import { Eyebrow } from "@/components/site/Eyebrow";
import { RichText } from "@/components/site/page/RichText";
import { Picture } from "@/components/site/Picture";
import { SectionHeading } from "@/components/site/SectionHeading";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { fixTypography, fixWidows } from "@/lib/format";
import { artImage, mediaImage } from "@/lib/media";
import type { Copy, ValuationCopy } from "./content";

/**
 * The server-rendered parts of the valuation page around the funnel island:
 * the hero's key facts, the "how we calculate" column beside the funnel and
 * the on-site valuation band (with the owner's "valuation" render). The FAQ is
 * the shared `FaqSection` of the sell and contact pages.
 */

/** "Sunny study with a long desk beneath a row of windows" (docs/assets/demo-media.json), the landing's fallback too. */
export const VALUATION_FALLBACK_IMAGE = "https://images.unsplash.com/photo-1777896193454-8b4863264f0b";

/** A managed text as a heading node: marked with its language when it fell back to Serbian. */
function headingNode(copy: Copy) {
  return copy.lang !== undefined ? <span lang={copy.lang}>{fixWidows(copy.text)}</span> : copy.text;
}

/* ------------------------------------------------------------ hero facts */

const FACTS = ["duration", "cost", "result"] as const;

/**
 * Three facts set like a specification, at the foot of the ink band. On wide
 * screens they skip the first of the hero's five aside columns, so they share
 * a left edge with "how we calculate" (columns 9–12) just below the seam.
 */
export async function HeroFacts({ locale }: { locale: Locale }) {
  const t = await getTranslations({ locale, namespace: "valuation" });
  return (
    // Phones go straight to the funnel; the lede already says the same in a sentence.
    <div className="hidden sm:block lg:grid lg:grid-cols-5 lg:gap-x-6">
      <dl className="hairline-t-dark lg:col-span-4 lg:col-start-2">
        {FACTS.map((fact) => (
          <div key={fact} className="flex items-baseline justify-between gap-6 hairline-b-dark py-4">
            <dt className="shrink-0 font-mono text-label uppercase text-mist">{t(`facts.${fact}Label`)}</dt>
            <dd className="text-balance text-right font-display text-h3 font-normal text-ivory">
              {t(`facts.${fact}Value`)}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

/* -------------------------------------------------- beside the funnel */

export async function HowWeCalculate({ locale, about }: { locale: Locale; about: ValuationCopy["about"] }) {
  const t = await getTranslations({ locale, namespace: "valuation" });
  return (
    <Reveal skipInView className="flex flex-col gap-5">
      <Eyebrow>{t("aboutEyebrow")}</Eyebrow>
      <h2 className="font-display text-h2 font-normal text-ink">{t("aboutHeading")}</h2>
      {about.kind === "html" ? (
        <RichText html={about.html} lang={about.lang} />
      ) : (
        <div className="rich-text">
          {about.paragraphs.map((paragraph) => (
            <p key={paragraph}>{fixTypography(paragraph)}</p>
          ))}
        </div>
      )}
    </Reveal>
  );
}

/** In place of the funnel when no location has an average price yet. */
export async function FunnelUnavailable({ locale }: { locale: Locale }) {
  const t = await getTranslations({ locale, namespace: "valuation" });
  return (
    <div className="flex flex-col items-start gap-5">
      <h2 className="font-display text-h2 font-normal text-ink">{t("unavailable.heading")}</h2>
      <p className="max-w-[56ch] text-pretty text-body text-stone-text">{fixTypography(t("unavailable.body"))}</p>
      <Link href="/contact" className={buttonClasses()}>
        <span>{t("unavailable.cta")}</span>
      </Link>
    </div>
  );
}

/* ------------------------------------------------- on-site valuation */

/** "Lokacija i mikrolokacija — ulica, saobraćaj…": the lead phrase in ivory, the detail in mist. */
function LookAtItem({ text }: { text: string }) {
  const split = text.indexOf(" — ");
  if (split === -1) return <span className="text-ivory">{fixTypography(text)}</span>;
  return (
    <span>
      <span className="text-ivory">{fixTypography(text.slice(0, split))}</span>
      {/* A no-break space before the dash, so a line never starts with it. */}
      <span className="text-mist">{" — "}{fixTypography(text.slice(split + 3))}</span>
    </span>
  );
}

export async function OnsiteSection({
  locale,
  lookAt,
  book,
}: {
  locale: Locale;
  lookAt: ValuationCopy["lookAt"];
  book: ValuationCopy["book"];
}) {
  const t = await getTranslations({ locale, namespace: "valuation" });
  const cta = buttonClasses({ variant: "inverse" });

  return (
    <section aria-labelledby="onsite-title" className="bg-ink text-ivory">
      <Container className="py-section lg:py-section-lg">
        <div className="grid gap-14 lg:grid-cols-12 lg:gap-x-6">
          <ClipReveal className="aspect-[4/5] sm:aspect-[3/2] lg:col-span-5 lg:aspect-auto lg:min-h-[36rem]">
            <Picture
              image={artImage("valuation", VALUATION_FALLBACK_IMAGE)}
              // The fallback is a stand-in photo, not the scene the alt text describes.
              alt={mediaImage("valuation") !== null ? t("mediaAlt") : ""}
              sizes="(min-width: 1024px) 38vw, 100vw"
              className="absolute inset-0"
            />
          </ClipReveal>

          <div className="flex min-w-0 flex-col justify-center lg:col-span-6 lg:col-start-7">
            <SectionHeading
              id="onsite-title"
              eyebrow={t("onsiteSectionEyebrow")}
              title={headingNode(book.heading)}
              size="display-m"
              tone="dark"
            />
            <p lang={book.sub.lang} className="mt-6 max-w-[52ch] text-pretty text-body-l text-mist">
              {fixTypography(book.sub.text)}
            </p>

            <h3 lang={lookAt.title.lang} className="eyebrow mt-14 text-mist">
              {lookAt.title.text}
            </h3>
            <Reveal as="ol" lang={lookAt.lang} stagger={0.06} className="mt-5 hairline-t-dark">
              {lookAt.items.map((item, index) => (
                <li key={item} className="grid grid-cols-[2.25rem_minmax(0,1fr)] items-baseline gap-x-4 hairline-b-dark py-4 text-body">
                  <span data-numeric className="font-mono text-label text-bronze">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <LookAtItem text={item} />
                </li>
              ))}
            </Reveal>

            <div className="mt-12 flex flex-col items-start gap-5 sm:flex-row sm:items-center sm:gap-8">
              {book.target.kind === "internal" ? (
                <Link href={book.target.href} className={cta}>
                  <span lang={book.label.lang}>{book.label.text}</span>
                </Link>
              ) : (
                <a href={book.target.href} className={cta}>
                  <span lang={book.label.lang}>{book.label.text}</span>
                </a>
              )}
              <p className="max-w-[34ch] text-pretty text-small text-mist">{fixTypography(t("replyPromise"))}</p>
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}
