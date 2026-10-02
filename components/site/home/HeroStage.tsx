"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { contextSafeFn, gsap, MOTION_QUERIES, SplitText, useGSAP } from "@/components/motion/gsap";
import { isIntroDone, onIntroReveal } from "@/components/motion/intro";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import type { MediaVideo, ResponsiveImage } from "@/lib/media";
import { PORTRAIT } from "./art-direction";

/**
 * The hero stage (DESIGN §6.2): full-bleed media, a scrim that deepens as the
 * page scrolls, and the entrance of the server-rendered copy it wraps.
 *
 * Load order, which is what keeps the poster the LCP element:
 *  1. the poster `<img>` is in the server HTML with `fetchPriority="high"`
 *     (and preloaded by the page), art-directed to the 9:16 render on phones
 *     and upright tablets (`PORTRAIT`);
 *  2. the `<video>` is mounted only after `load`, with `preload="metadata"`,
 *     and cross-fades in once it is actually playing — its first frame is the
 *     poster, so the hand-off is invisible;
 *  3. it pauses whenever the hero leaves the viewport.
 * Portrait viewports, data-saver connections and reduced motion keep the
 * still, which carries the shot on its own with a slow Ken Burns (1.06 → 1.02
 * over 5 s), so a missing `hero.mp4` degrades to exactly the design's fallback.
 *
 * The copy is marked up by the server: `[data-hero-reveal]` elements start
 * transparent (globals.css, only when motion is allowed) and `[data-hero-title]`
 * is the headline that is split into masked lines. The entrance waits for the
 * preloader's curtain (`onIntroReveal`), so the hero is already moving when the
 * curtain lifts.
 *
 * On scroll the headline group (`[data-hero-exit]`: eyebrow, headline, lede)
 * dims out before it reaches the fixed header, so it never slides under the
 * wordmark while the bar is still turning solid on a fast first flick.
 *
 * On a first visit the hero holds the cookie banner's reservation for the
 * rest of the page view (`data-consent-held`, globals.css), so answering the
 * banner moves nothing in it.
 */

/**
 * Seconds the copy waits behind a playing curtain, counted from the lift's
 * start. The 1 s in-out lift in globals.css uncovers the headline from ~0.48 s
 * (its last line) to ~0.55 s (its first) at 390 and 1440 alike; the lines
 * start 0.1 s after this lead, so they rise as the curtain's edge passes them.
 */
const INTRO_LEAD = 0.38;
/** A skipped curtain fades out in 0.2 s instead (Preloader marks `data-intro-skipped`). */
const SKIP_LEAD = 0.1;

/** The fixed header's height, published by the Header as `--header-h`. */
function headerHeight(): number {
  const value = Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--header-h"));
  return Number.isFinite(value) && value > 0 ? value : 80;
}

/** `el`'s top inside `ancestor` from layout alone: no transform (drift, entrance) counts. */
function layoutTop(el: HTMLElement, ancestor: HTMLElement): number {
  let top = 0;
  let node: HTMLElement | null = el;
  while (node !== null && node !== ancestor) {
    top += node.offsetTop;
    node = node.offsetParent instanceof HTMLElement ? node.offsetParent : null;
  }
  return top;
}

export type HeroStageProps = {
  poster: ResponsiveImage;
  /** Portrait art direction below 768px, when one was delivered. */
  posterMobile: ResponsiveImage | null;
  video: MediaVideo | null;
  alt: string;
  children: ReactNode;
};


/** `navigator.connection` is still not in lib.dom. */
type SaveDataConnection = { saveData?: boolean };

function prefersLightPayload(): boolean {
  const connection = (navigator as Navigator & { connection?: SaveDataConnection }).connection;
  return connection?.saveData === true;
}

/** Resolves when the webfonts are in, but never waits longer than `ms`. */
function fontsReady(ms: number): Promise<void> {
  return Promise.race([
    document.fonts.ready.then(() => undefined),
    new Promise<void>((resolve) => window.setTimeout(resolve, ms)),
  ]);
}

export function HeroStage({ poster, posterMobile, video, alt, children }: HeroStageProps) {
  const root = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const reduced = useReducedMotion();
  const [mountVideo, setMountVideo] = useState(false);
  const [videoReady, setVideoReady] = useState(false);

  // The video never competes with the poster for bandwidth: it is mounted only
  // once the page has finished loading, and never in portrait.
  useEffect(() => {
    if (video === null || reduced || prefersLightPayload()) return;
    let timer = 0;
    const schedule = () => {
      if (window.matchMedia(PORTRAIT).matches) return;
      timer = window.setTimeout(() => setMountVideo(true), 200);
    };
    if (document.readyState === "complete") schedule();
    else window.addEventListener("load", schedule, { once: true });
    return () => {
      window.removeEventListener("load", schedule);
      window.clearTimeout(timer);
    };
  }, [reduced, video]);

  // Pause while offscreen: a muted loop still decodes frames and keeps the GPU
  // busy behind ten screens of content.
  useEffect(() => {
    const element = videoRef.current;
    const section = root.current;
    if (element === null || section === null) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry === undefined) return;
        if (entry.isIntersecting) void element.play().catch(() => {});
        else element.pause();
      },
      { threshold: 0.05 },
    );
    observer.observe(section);
    return () => observer.disconnect();
  }, [mountVideo]);

  // Once this hero has painted with the cookie banner's reservation, it keeps
  // it until the page view ends (the node goes away with it). Answering the
  // banner drops the reservation from <html>, which used to drop the whole
  // copy by 112-200px in one frame on the click.
  useEffect(() => {
    const stage = root.current;
    if (stage === null) return;
    const html = document.documentElement;
    const hold = () => {
      if (html.dataset.consent === "pending") stage.setAttribute("data-consent-held", "");
    };
    hold();
    // The banner can also come back mid-visit (the footer's settings link).
    const observer = new MutationObserver(hold);
    observer.observe(html, { attributes: true, attributeFilter: ["data-consent"] });
    return () => observer.disconnect();
  }, []);

  useGSAP(
    () => {
      const section = root.current;
      if (section === null) return;
      const q = gsap.utils.selector(section);
      const [parallax] = q("[data-hero-parallax]");
      const [frame] = q("[data-hero-frame]");
      const [scrim] = q("[data-hero-scrim]");
      const [content] = q("[data-hero-content]");
      const [title] = q("[data-hero-title]");
      const [eyebrow] = q('[data-hero-reveal="eyebrow"]');
      const [lede] = q('[data-hero-reveal="lede"]');
      const [search] = q('[data-hero-reveal="search"]');
      const [cue] = q('[data-hero-reveal="cue"]');
      const [exit] = q("[data-hero-exit]");
      if (parallax === undefined || frame === undefined || scrim === undefined || content === undefined) return;
      const copy = [eyebrow, title, lede, search, cue].filter((el): el is HTMLElement => el !== undefined);

      // Survives a matchMedia branch change: resizing across 1024px must not
      // replay the entrance, only re-create the scroll behaviour.
      let entered = false;
      const mm = gsap.matchMedia();

      mm.add(MOTION_QUERIES.reduced, () => {
        gsap.set(copy, { opacity: 1 });
        gsap.set(scrim, { opacity: 0.45 });
      });

      const build = (
        contextSafe: gsap.ContextSafeFunc | undefined,
        tuning: { drift: number; depth: number; lines: number; stagger: number },
      ) => {
        const stillOnly = video === null || window.matchMedia(PORTRAIT).matches;

        // Scroll: the copy drifts up slower than the page, the media slower
        // still, and the scrim deepens from 0.25 to 0.6.
        gsap.set(scrim, { opacity: 0.25 });
        gsap
          .timeline({
            scrollTrigger: { trigger: section, start: "top top", end: "bottom top", scrub: true },
          })
          .to(scrim, { opacity: 0.6, ease: "none" }, 0)
          .to(content, { yPercent: tuning.drift, ease: "none" }, 0)
          .to(parallax, { yPercent: tuning.depth, ease: "none" }, 0);

        // The headline group dims out on its way to the fixed header and is
        // gone by the scroll at which its top meets the bar, so it never
        // crosses the wordmark, however fast the first flick. Measured from
        // layout on every refresh, so the cookie reservation and each
        // breakpoint get their own range. Its own element, so it never fights
        // the entrance's opacity tweens inside it.
        if (exit !== undefined) {
          const reach = () => Math.max(1, layoutTop(exit, section) - headerHeight());
          gsap.fromTo(
            exit,
            { opacity: 1 },
            {
              opacity: 0,
              ease: "none",
              scrollTrigger: {
                trigger: section,
                start: () => `top+=${Math.round(reach() * 0.3)} top`,
                end: () => `top+=${Math.round(reach())} top`,
                scrub: true,
              },
            },
          );
        }

        if (entered) {
          gsap.set(copy, { opacity: 1 });
          return undefined;
        }

        let split: SplitText | null = null;
        let started = false;
        let disposed = false;

        // The headline waits for the webfont, so it is split in a later task;
        // `contextSafe` keeps that late split and its tween inside this
        // branch's context, so a branch change or an unmount reverts them.
        const enterTitle = contextSafeFn(contextSafe, (tl: gsap.core.Timeline, at: number) => {
          if (title === undefined || disposed) return;
          split = SplitText.create(title, {
            type: "lines",
            mask: "lines",
            linesClass: "split-line",
            reduceWhiteSpace: false,
          });
          gsap.set(title, { opacity: 1 });
          tl.from(
            split.lines,
            {
              yPercent: 130,
              duration: tuning.lines,
              stagger: tuning.stagger,
              // The lines only exist for the entrance. Reverting afterwards
              // hands the headline back to normal text flow, so a later
              // resize re-wraps it instead of stretching frozen lines.
              onComplete: () => {
                split?.revert();
                split = null;
              },
            },
            // A late webfont must not drop the lines in mid-rise.
            Math.max(at, tl.time() + 0.05),
          );
        });

        const play = contextSafeFn(contextSafe, () => {
          if (started || disposed) return;
          started = true;
          entered = true;

          // Paused until a painted frame: a long task at hydration would
          // otherwise make GSAP jump over the first part of the entrance.
          const tl = gsap.timeline({ paused: true, defaults: { ease: "expo.out" } });
          // Behind the curtain the copy waits until the lift has uncovered it,
          // so the headline rises in view.
          const html = document.documentElement;
          const curtain = html.dataset.intro === "play" && !isIntroDone();
          const lead = !curtain ? 0 : html.hasAttribute("data-intro-skipped") ? SKIP_LEAD : INTRO_LEAD;

          // The media moves from the first frame, so the curtain lifts onto movement.
          if (stillOnly) {
            // The first-paint state in globals.css is this "from", so a repeat
            // visit never pops. It ends overscaled (1.02 covers the 0.6% drift)
            // and eases out inside five seconds (WCAG 2.2.2).
            tl.fromTo(
              frame,
              { x: 0, y: 0, scale: 1.06, xPercent: -0.6, yPercent: -0.4 },
              { scale: 1.02, xPercent: 0.6, yPercent: 0.4, duration: 5, ease: "sine.out" },
              0,
            );
          } else {
            tl.fromTo(frame, { x: 0, y: 0, xPercent: 0, yPercent: 0, scale: 1.08 }, { scale: 1, duration: 1.8, ease: "estate" }, 0);
          }

          // Three beats: the photograph, the headline, then the lede and search.
          if (eyebrow !== undefined) {
            tl.fromTo(eyebrow, { opacity: 0, y: 12 }, { opacity: 1, y: 0, duration: 0.8 }, 0.1 + lead);
          }
          if (lede !== undefined) {
            tl.fromTo(lede, { opacity: 0, y: 16 }, { opacity: 1, y: 0, duration: 0.9 }, 0.48 + lead);
          }
          if (search !== undefined) {
            tl.fromTo(search, { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.9 }, 0.6 + lead);
          }
          if (cue !== undefined) {
            tl.fromTo(cue, { opacity: 0 }, { opacity: 1, duration: 0.6, ease: "power2.out" }, 1 + lead);
          }
          requestAnimationFrame(() => requestAnimationFrame(() => tl.play()));

          // Split against the real face: measuring the fallback font would
          // break every line the moment EB Garamond swaps in.
          if (title !== undefined) void fontsReady(700).then(() => enterTitle(tl, 0.1 + lead));
        });

        const unsubscribe = onIntroReveal(play);
        // Belt and braces: if the preloader never signals, enter anyway.
        const fallback = gsap.delayedCall(2.6, play);

        return () => {
          disposed = true;
          unsubscribe();
          fallback.kill();
          split?.revert();
          split = null;
        };
      };

      mm.add(MOTION_QUERIES.mobile, (_context, contextSafe) =>
        // A phone hero is barely taller than its copy: a long drift detaches
        // the headline from the photograph.
        build(contextSafe, { drift: 6, depth: 12, lines: 1, stagger: 0.06 }),
      );

      mm.add(MOTION_QUERIES.desktop, (_context, contextSafe) =>
        build(contextSafe, { drift: 14, depth: 24, lines: 1.2, stagger: 0.08 }),
      );

      return () => mm.revert();
    },
    { scope: root, dependencies: [video] },
  );

  return (
    <div ref={root} className="relative isolate flex min-h-svh flex-col justify-end overflow-clip">
      {/* The media layer is clipped one pixel short of the hero's bottom edge
          (where the scrim is solid ink anyway). Chrome drops an image whose
          visible rect covers the entire viewport as an LCP candidate ("probably
          a background"), which left the late, animated headline as the LCP at
          ~2 s. The clip sits on this layer, not on the image, so the poster
          still qualifies when it paints after the entrance has scaled it up, and
          it is capped at the viewport's height for a first visit whose hero grows
          taller than the screen (a long headline above the cookie banner). */}
      <div
        data-hero-parallax=""
        className="absolute inset-x-0 bottom-px top-0 -z-10 max-h-[calc(100svh-1px)] overflow-clip"
      >
        <div data-hero-frame={video === null ? "still" : "film"} className="absolute inset-0">
          <picture>
            {posterMobile !== null
              ? posterMobile.sources.map((source) => (
                  <source
                    key={`m-${source.type}`}
                    media={PORTRAIT}
                    type={source.type}
                    srcSet={source.srcSet}
                    sizes="100vw"
                  />
                ))
              : null}
            {poster.sources.map((source) => (
              <source key={source.type} type={source.type} srcSet={source.srcSet} sizes="100vw" />
            ))}
            {/* The LCP element. */}
            <img
              src={poster.src}
              srcSet={poster.srcSet}
              sizes={poster.srcSet !== undefined ? "100vw" : undefined}
              alt={alt}
              width={poster.width}
              height={poster.height}
              fetchPriority="high"
              className="size-full object-cover"
            />
          </picture>

          {mountVideo && video !== null ? (
            <video
              ref={videoRef}
              preload="metadata"
              autoPlay
              muted
              loop
              playsInline
              disablePictureInPicture
              disableRemotePlayback
              aria-hidden="true"
              tabIndex={-1}
              onPlaying={() => setVideoReady(true)}
              className={`absolute inset-0 size-full object-cover transition-opacity duration-700 ease-out ${
                videoReady ? "opacity-100" : "opacity-0"
              }`}
            >
              {/* 720p for tablets; the full 1080p only from 1280px up. */}
              {video.mobileSrc !== undefined ? (
                <source src={video.mobileSrc} type="video/mp4" media="(max-width: 1279px)" />
              ) : null}
              {video.sources.map((source) => (
                <source key={source.src} src={source.src} type={source.type} />
              ))}
            </video>
          ) : null}
        </div>
      </div>

      {/* A constant bottom-up gradient that guarantees the copy's contrast, and
          the flat scrim GSAP deepens on scroll (DESIGN §5). */}
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10 bg-linear-to-t from-ink via-ink/60 via-40% to-ink/10"
      />
      {/* Two soft pools of ink exactly where the copy sits on wide screens: the
          headline over the lit skyline and the lede over the river lights
          (DESIGN §5: never text over a busy area without a scrim). */}
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10 hidden bg-[radial-gradient(55%_45%_at_18%_70%,rgb(14_13_11/0.55),transparent_75%),radial-gradient(35%_30%_at_80%_66%,rgb(14_13_11/0.5),transparent_75%)] lg:block"
      />
      <div
        aria-hidden="true"
        className="absolute inset-x-0 top-0 -z-10 h-[45%] bg-linear-to-b from-ink/55 via-ink/10 to-transparent"
      />
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10 hidden bg-[radial-gradient(16%_11%_at_43%_28%,rgb(14_13_11/0.55),transparent)] lg:block"
      />
      <div data-hero-scrim="" aria-hidden="true" className="absolute inset-0 -z-10 bg-ink opacity-25" />

      <div data-hero-content="" className="relative">
        {children}
      </div>
    </div>
  );
}
