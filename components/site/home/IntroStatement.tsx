import { getTranslations } from "next-intl/server";
import { Container } from "@/components/site/Container";
import type { Locale } from "@/i18n/routing";
import { fixTypography } from "@/lib/format";
import { IntroWords } from "./IntroWords";

/**
 * Intro statement (DESIGN §6.3): one large serif paragraph that the reader's
 * scroll brings up word by word, and the agency's signature under it. It is
 * a statement, not a section with a title, so it carries no heading and no
 * eyebrow — the words are the design.
 */
export async function IntroStatement({ locale }: { locale: Locale }) {
  const t = await getTranslations({ locale, namespace: "home" });

  return (
    <section className="bg-ivory py-section text-ink lg:py-section-lg">
      <Container>
        <div className="grid grid-cols-4 gap-x-6 lg:grid-cols-12">
          <IntroWords
            text={fixTypography(t("introStatement"))}
            className="col-span-4 font-display text-[clamp(2.25rem,5.2vw,4rem)] font-normal leading-[1.14] tracking-[-0.01em] lg:col-span-10 lg:col-start-2"
          />
          <p className="col-span-4 mt-10 flex items-center gap-4 lg:col-span-10 lg:col-start-2 lg:mt-14">
            <span aria-hidden="true" className="block h-px w-12 bg-bronze" />
            <span className="font-mono text-label uppercase text-stone-text">{t("introSignature")}</span>
          </p>
        </div>
      </Container>
    </section>
  );
}
