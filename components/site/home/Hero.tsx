import { getTranslations } from "next-intl/server";
import { preload } from "react-dom";
import { Container } from "@/components/site/Container";
import { Eyebrow } from "@/components/site/Eyebrow";
import type { Locale } from "@/i18n/routing";
import { fixTypography, fixWidows } from "@/lib/format";
import {
  mediaImage,
  mediaVideo,
  remoteResponsiveImage,
  responsiveImage,
  type ResponsiveImage,
} from "@/lib/media";
import { LANDSCAPE, PORTRAIT } from "./art-direction";
import { HeroSearch } from "./HeroSearch";
import { HeroStage } from "./HeroStage";
import type { LocationOption } from "./types";

/**
 * Hero (DESIGN §6.2). Server-rendered copy inside the client `HeroStage`.
 *
 * Media resolution is manifest-driven (`lib/media-manifest.json`, written by
 * `npm run media:optimize`): the owner's `hero-desktop` render is the poster,
 * `hero-mobile` the 9:16 art direction and `hero` the video. Dropping a new
 * `hero.mp4` into `media-src/` and re-running the script upgrades the hero with
 * no code change. With no render at all, a verified blue-hour Belgrade
 * photograph from `docs/assets/demo-media.json` takes over and the stage gives
 * it the Ken Burns treatment.
 */

/** "Belgrade Waterfront towers and an arched bridge reflected in the Sava at night". */
const FALLBACK_POSTER = "https://images.unsplash.com/photo-1711970908551-6bb1f39377b5";


function heroMedia(): { poster: ResponsiveImage; posterMobile: ResponsiveImage | null } {
  const desktop = mediaImage("hero-desktop");
  const mobile = mediaImage("hero-mobile");
  const video = mediaVideo("hero");

  const poster =
    desktop !== null
      ? responsiveImage(desktop)
      : video !== null
        ? { width: video.width, height: video.height, src: video.poster, sources: [] }
        : remoteResponsiveImage(FALLBACK_POSTER, 1920, 1280);

  return { poster, posterMobile: mobile !== null ? responsiveImage(mobile) : null };
}

/**
 * Preloads the poster variant the `<picture>` will pick, so the LCP request
 * starts with the document instead of after the stylesheet. One hint per
 * art-directed branch, each limited to its own media query.
 */
function preloadPoster(poster: ResponsiveImage, posterMobile: ResponsiveImage | null) {
  const best = (image: ResponsiveImage) => image.sources[0];

  const desktop = best(poster);
  preload(poster.src, {
    as: "image",
    fetchPriority: "high",
    imageSizes: "100vw",
    imageSrcSet: desktop?.srcSet ?? poster.srcSet,
    ...(desktop !== undefined ? { type: desktop.type } : {}),
    ...(posterMobile !== null ? { media: LANDSCAPE } : {}),
  });

  if (posterMobile !== null) {
    const mobile = best(posterMobile);
    preload(posterMobile.src, {
      as: "image",
      fetchPriority: "high",
      imageSizes: "100vw",
      imageSrcSet: mobile?.srcSet ?? posterMobile.srcSet,
      ...(mobile !== undefined ? { type: mobile.type } : {}),
      media: PORTRAIT,
    });
  }
}

export async function Hero({ locale, locations }: { locale: Locale; locations: readonly LocationOption[] }) {
  const t = await getTranslations({ locale, namespace: "home" });
  const { poster, posterMobile } = heroMedia();
  preloadPoster(poster, posterMobile);

  return (
    <section aria-labelledby="hero-title" className="bg-ink text-ivory">
      <HeroStage poster={poster} posterMobile={posterMobile} video={mediaVideo("hero")} alt={t("heroMediaAlt")}>
        {/* Bottom-aligned over the photograph; the top padding clears the fixed
            header. The consent banner is deliberately NOT subtracted here: it can
            only measure itself after hydration, and padding the hero by its height
            then lifted the whole hero copy by 240-300px at ~400ms (CLS 0.15-0.35).
            On a first visit the banner overlays the bottom of the hero instead. */}
        <Container className="pb-10 pt-36 lg:pb-14">
          <div data-hero-reveal="eyebrow">
            {/* Mist, not bronze: a 12px label over a lit photograph needs the
                lighter tone to stay legible. */}
            <Eyebrow tone="dark">{t("heroEyebrow")}</Eyebrow>
          </div>

          <div className="mt-6 grid grid-cols-4 items-end gap-x-6 gap-y-8 lg:mt-8 lg:grid-cols-12">
            <h1
              id="hero-title"
              data-hero-title=""
              data-hero-reveal="title"
              className="col-span-4 max-w-[11ch] font-display text-display-xl font-normal text-ivory lg:col-span-8"
            >
              {/* Display-xl: only a pair this short may be joined, or it would not fit a phone. */}
              {fixWidows(t("heroHeadline"), 10)}
            </h1>
            <p
              data-hero-reveal="lede"
              className="col-span-4 max-w-[40ch] text-pretty text-body-l text-ivory/85 lg:col-span-4 lg:pb-3"
            >
              {fixTypography(t("heroLede"))}
            </p>
          </div>

          {/* On the 12-column grid: the bar spans the columns under the headline
              and stops one gutter short of the lede's column; the scroll cue
              sits on the container's right edge. */}
          <div className="mt-10 flex items-end gap-10 lg:mt-14 lg:grid lg:grid-cols-12 lg:gap-x-6">
            <div data-hero-reveal="search" className="min-w-0 flex-1 lg:col-span-10 xl:col-span-8">
              <HeroSearch locations={locations} />
            </div>

            {/* DESIGN §6.2 scroll cue: a thin line with a travelling segment. */}
            <div
              data-hero-reveal="cue"
              aria-hidden="true"
              className="hidden shrink-0 flex-col items-center gap-3 lg:col-start-12 lg:flex lg:justify-self-end"
            >
              <span className="font-mono text-label uppercase text-mist [writing-mode:vertical-rl]">
                {t("scrollCue")}
              </span>
              <span className="relative block h-16 w-px overflow-hidden bg-ivory/20">
                <span className="scroll-cue-line absolute inset-x-0 top-0 block h-1/2 bg-bronze" />
              </span>
            </div>
          </div>
        </Container>
      </HeroStage>
    </section>
  );
}
