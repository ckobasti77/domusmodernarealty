import { ArrowRight } from "lucide-react";
import Image from "next/image";
import { getTranslations } from "next-intl/server";
import { AmbientVideo } from "@/components/motion/AmbientVideo";
import { ParallaxLayer } from "@/components/motion/ParallaxLayer";
import { Container } from "@/components/site/Container";
import { SectionHeading } from "@/components/site/SectionHeading";
import { textLinkClasses } from "@/components/site/TextLink";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { mediaVideo } from "@/lib/media";
import { cn } from "@/lib/utils";
import { NeighborhoodIndex } from "./NeighborhoodIndex";
import type { NeighborhoodItem } from "./types";

/**
 * Neighborhoods (DESIGN §6.5), on ink. It opens on the owner's golden-hour
 * aerial (`city.mp4`) as a wide band under the heading, then the index.
 *
 * The aerial is an AI-generated mood film of "a river city" — it is shown as
 * atmosphere under a heavy scrim and never captioned as a real place.
 */
export async function Neighborhoods({ locale, items }: { locale: Locale; items: readonly NeighborhoodItem[] }) {
  if (items.length === 0) return null;
  const t = await getTranslations({ locale, namespace: "home" });
  const film = mediaVideo("city");

  return (
    <section aria-labelledby="neighborhoods-title" className="bg-ink text-ivory">
      <div className={cn("relative isolate overflow-clip", film !== null ? "min-h-[72svh] lg:min-h-[86svh]" : "")}>
        {film !== null ? (
          <ParallaxLayer amount={10} className="absolute inset-0 -z-10">
            <Image
              src={film.poster}
              alt={t("cityFilmAlt")}
              fill
              sizes="100vw"
              className="object-cover"
            />
            <AmbientVideo video={film} />
          </ParallaxLayer>
        ) : null}
        {/* Heavy on purpose: the film is atmosphere behind the heading, and the
            index below starts on flat ink without a seam. */}
        <div
          aria-hidden="true"
          className="absolute inset-0 -z-10 bg-linear-to-t from-ink via-ink/70 via-35% to-ink/35"
        />

        <Container
          className={cn(
            "flex flex-col justify-end pt-section lg:pt-section-lg",
            film !== null ? "min-h-[72svh] pb-14 lg:min-h-[86svh] lg:pb-20" : "",
          )}
        >
          <SectionHeading
            id="neighborhoods-title"
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

