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
import type { HomeCopy } from "./copy";
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

export async function Hero({
  locale,
  locations,
  copy,
}: {
  locale: Locale;
  locations: readonly LocationOption[];
  /** Headline and lede, managed in the admin (`home` → `hero`). */
  copy: HomeCopy["hero"];
}) {
  const t = await getTranslations({ locale, namespace: "home" });
  const scrollCue = t("scrollCue");
  const { poster, posterMobile } = heroMedia();
  preloadPoster(poster, posterMobile);

  return (
    <section aria-labelledby="hero-title" className="bg-ink text-ivory">
      <HeroStage poster={poster} posterMobile={posterMobile} video={mediaVideo("hero")} alt={t("heroMediaAlt")}>
        {/* Bottom-aligned over the photograph; the top padding clears the fixed
            header. The bottom padding holds the copy above the cookie banner on a
            first visit: `--consent-reserve` is set by the pre-paint gate, so it is
            already in the first frame, and HeroStage keeps it for the rest of the
            page view, so the click that answers the banner moves nothing here.
            (Padding by the banner's own measured height, known only after
            hydration, lifted the whole hero copy by 240-300px at ~400ms: CLS
            0.15-0.35.) */}
        {/* Short screens (a 360x740 phone, a 1280x800 laptop) tighten the top
            padding, the gaps and, on a laptop, the headline, so a three-line
            German or Russian headline still clears the banner. */}
        <Container className="pb-[calc(2.5rem+var(--consent-reserve,0px))] pt-28 max-lg:[@media(max-height:47rem)]:pt-24 lg:pb-[calc(3.5rem+var(--consent-reserve,0px))] lg:pt-36 lg:[@media(max-height:51rem)]:pt-28">
          {/* The headline group, which HeroStage dims out on its way under the
              fixed header. A plain block: it changes no spacing. */}
          <div data-hero-exit="">
            <div data-hero-reveal="eyebrow" className="[text-shadow:0_0_1.5rem_rgb(14_13_11/0.7)]">
              {/* Mist, not bronze: a 12px label over a lit photograph needs the
                  lighter tone to stay legible. */}
              <Eyebrow tone="dark">{t("heroEyebrow")}</Eyebrow>
            </div>

            <div className="mt-6 grid grid-cols-4 items-end gap-x-6 gap-y-8 lg:mt-8 lg:grid-cols-12">
              <h1
                id="hero-title"
                lang={copy.headline.lang}
                data-testid="hero-headline"
                data-hero-title=""
                data-hero-reveal="title"
                className="col-span-4 max-w-[14ch] font-display text-display-xl font-normal text-ivory max-lg:[@media(max-height:47rem)]:text-[3rem] md:max-lg:portrait:text-[11.5vw] lg:col-span-8 lg:[@media(max-height:51rem)]:text-[min(9vw,12svh)]"
              >
                {/* Display-xl: only a pair this short may be joined, or it would not fit a phone. */}
                {fixWidows(copy.headline.text, 10)}
              </h1>
              <p
                lang={copy.lede.lang}
                data-hero-reveal="lede"
                className="col-span-4 max-w-[40ch] text-pretty text-body-l text-ivory/85 lg:col-span-4 lg:pb-3"
              >
                {fixTypography(copy.lede.text)}
              </p>
            </div>
          </div>

          {/* On the 12-column grid: from 1440px the bar spans the columns under
              the headline and stops one gutter short of the lede's column; below
              that it takes ten, so no select cuts its value. The scroll cue sits
              on the container's right edge. */}
          <div className="mt-10 flex items-end gap-10 max-lg:[@media(max-height:47rem)]:mt-6 lg:mt-14 lg:grid lg:grid-cols-12 lg:gap-x-6 lg:[@media(max-height:51rem)]:mt-10">
            <div data-hero-reveal="search" className="min-w-0 flex-1 lg:col-span-10 min-[90rem]:col-span-8">
              <HeroSearch locations={locations} />
            </div>

            {/* DESIGN §6.2 scroll cue: a thin line with a travelling segment.
                It is the tallest thing in this row, so its label's length sets
                where all the copy above it sits. JetBrains Mono is not preloaded
                and its fallback set the word ~40% longer, so the headline dropped
                28px when the face arrived. The label is sized to the mono face's
                own metrics instead (0.6em advance + 0.08em tracking a letter). */}
            <div
              data-hero-reveal="cue"
              aria-hidden="true"
              className="hidden shrink-0 flex-col items-center gap-3 lg:col-start-12 lg:flex lg:justify-self-end"
            >
              <span
                className="whitespace-nowrap font-mono text-label uppercase text-mist [writing-mode:vertical-rl]"
                style={{ height: `${(Array.from(scrollCue).length * 0.68).toFixed(2)}em` }}
              >
                {scrollCue}
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
