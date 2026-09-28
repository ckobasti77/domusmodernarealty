import { getTranslations } from "next-intl/server";
import { Reveal } from "@/components/motion/Reveal";
import { Container } from "@/components/site/Container";
import { SectionHeading } from "@/components/site/SectionHeading";
import type { Locale } from "@/i18n/routing";
import { fixOrphans } from "@/lib/format";
import { pickL10n } from "@/lib/l10n";
import type { Testimonial } from "./data";

/**
 * Testimonials (DESIGN §6.12). `testimonials.verified` only ever returns
 * entries the owner has marked verified, and until there is at least one the
 * section does not exist — a real-estate site with invented praise is worse
 * than one with none (CLAUDE.md: never fabricate).
 */
export async function Testimonials({ locale, items }: { locale: Locale; items: readonly Testimonial[] }) {
  if (items.length === 0) return null;
  const t = await getTranslations({ locale, namespace: "home" });

  return (
    <section aria-labelledby="testimonials-title" className="bg-ivory-2 py-section text-ink lg:py-section-lg">
      <Container>
        <SectionHeading id="testimonials-title" eyebrow={t("testimonialsEyebrow")} title={t("testimonialsHeading")} />

        <Reveal stagger={0.1} className="mt-14 grid gap-x-6 gap-y-14 lg:mt-20 lg:grid-cols-3">
          {items.slice(0, 3).map((item) => {
            const quote = pickL10n(item.quote, locale);
            const context = item.context !== undefined ? pickL10n(item.context, locale) : null;
            return (
              <figure key={item._id} className="border-t border-hairline-light pt-8">
                <blockquote
                  lang={quote.lang !== locale ? quote.lang : undefined}
                  className="font-display text-h3 font-normal leading-snug"
                >
                  <p>{fixOrphans(quote.text)}</p>
                </blockquote>
                <figcaption className="mt-6 text-small">
                  <span className="block font-medium">{item.author}</span>
                  {context !== null ? (
                    <span lang={context.lang !== locale ? context.lang : undefined} className="block text-stone-text">
                      {context.text}
                    </span>
                  ) : null}
                </figcaption>
              </figure>
            );
          })}
        </Reveal>
      </Container>
    </section>
  );
}
