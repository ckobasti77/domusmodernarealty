import { ArrowRight } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { ParallaxLayer } from "@/components/motion/ParallaxLayer";
import { Container } from "@/components/site/Container";
import { Picture } from "@/components/site/Picture";
import { SectionHeading } from "@/components/site/SectionHeading";
import { textLinkClasses } from "@/components/site/TextLink";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { remoteResponsiveImage } from "@/lib/media";
import { NeighborhoodIndex } from "./NeighborhoodIndex";
import type { NeighborhoodItem } from "./types";

/**
 * Neighborhoods (DESIGN §6.5), on ink. It opens on a wide band of Belgrade
 * under the heading, then the index.
 *
 * The band is a verified photograph of the real city (the Sava, the Belgrade
 * Waterfront towers and Kula Beograd), not the owner's AI aerial: that film
 * renders Budapest's Chain Bridge and Buda Castle, and a Belgrade agency
 * cannot put Budapest under "Poznajemo svaku ulicu". It is atmosphere behind
 * the heading, so it carries no alt text.
 */

/** "Sava river with Belgrade Waterfront residential towers and Belgrade Tower, Savski Venac". */
const BELGRADE_AERIAL = "https://images.unsplash.com/photo-1708253832369-ce7e621df31a";

export async function Neighborhoods({ locale, items }: { locale: Locale; items: readonly NeighborhoodItem[] }) {
  if (items.length === 0) return null;
  const t = await getTranslations({ locale, namespace: "home" });

  return (
    <section aria-labelledby="neighborhoods-title" className="bg-ink text-ivory">
      <div className="relative isolate min-h-[72svh] overflow-clip lg:min-h-[72svh]">
        <ParallaxLayer amount={10} className="absolute inset-0 -z-10">
          <Picture
            image={remoteResponsiveImage(BELGRADE_AERIAL, 1920, 1280)}
            alt=""
            sizes="100vw"
            className="absolute inset-0"
            imgClassName="photo-grade object-[50%_68%]"
          />
        </ParallaxLayer>
        {/* Weighted to the bottom, where the heading sits and the index begins
            on flat ink; the sky above stays light. */}
        <div
          aria-hidden="true"
          className="absolute inset-0 -z-10 bg-linear-to-t from-ink via-ink/55 via-35% to-ink/15"
        />
        <div aria-hidden="true" className="absolute inset-0 -z-10 bg-linear-to-r from-ink/50 to-transparent to-60%" />

        <Container className="flex min-h-[72svh] flex-col justify-end pb-14 pt-section lg:min-h-[72svh] lg:pb-20 lg:pt-section-lg">
          <SectionHeading
            id="neighborhoods-title"
            eyebrowTone="dark"
            eyebrow={t("neighborhoodsEyebrow")}
            title={t("neighborhoodsHeading")}
            lede={t("neighborhoodsLede")}
            size="display-l"
            tone="dark"
          />
        </Container>
      </div>

      <Container className="pb-section lg:pb-section-lg">
        <NeighborhoodIndex items={items} />

        <div className="mt-12 flex justify-end lg:mt-16">
          <Link
            href="/locations"
            prefetch={false}
            className={textLinkClasses("dark", "group/all inline-flex items-center gap-3 text-small uppercase tracking-[0.12em]")}
          >
            {t("neighborhoodsAll")}
            <ArrowRight
              aria-hidden="true"
              strokeWidth={1.25}
              className="size-4 transition-transform duration-300 ease-out pointer-fine:group-hover/all:translate-x-1"
            />
          </Link>
        </div>
      </Container>
    </section>
  );
}
