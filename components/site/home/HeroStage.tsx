"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { gsap, MOTION_QUERIES, useGSAP } from "@/components/motion/gsap";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import type { MediaImage, MediaVideo } from "@/lib/media";
import { mediaSrcSet } from "@/lib/media";

/**
 * The hero stage (DESIGN §6.2): full-bleed media behind the headline, a scrim
 * that deepens as the page scrolls, and content that drifts up slower than the
 * background.
 *
 * Performance shape, in the order the browser sees it:
 *  1. the poster `<img>` is server-rendered with `fetchPriority="high"` and is
 *     the LCP element (the parent server component also calls `preload()`);
 *  2. nothing else is requested until `load` has fired — only then is the
 *     `<video>` mounted, with `preload="metadata"`, and it cross-fades in when
 *     it can actually play, so a slow connection simply keeps the still;
 *  3. the video is paused whenever the hero leaves the viewport.
 *
 * If no hero video was delivered, the poster gets the Ken Burns treatment
 * instead (scale 1.12 → 1 over 12s with a small drift) — so dropping
 * `hero.mp4` into `media-src/` and re-running `npm run media:optimize` upgrades
 * the hero with no code change.
 */

export type HeroStageProps = {
  /** Landscape poster. Also the LCP element. */
  poster: MediaImage;
  /** 9:16 art-directed poster for phones, when one was delivered. */
  posterMobile: MediaImage | null;
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

export function HeroStage({ poster, posterMobile, video, alt, children }: HeroStageProps) {
  const root = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const reduced = useReducedMotion();
  const [mountVideo, setMountVideo] = useState(false);
  const [videoReady, setVideoReady] = useState(false);

  // Mount the video only after the page has finished loading, so it never
  // competes with the LCP image for bandwidth.
  useEffect(() => {
    if (video === null || reduced) return;
    if (prefersLightPayload()) return;

    let idle = 0;
    const schedule = () => {
      idle = window.setTimeout(() => setMountVideo(true), 200);
    };

    if (document.readyState === "complete") {
      schedule();
      return () => window.clearTimeout(idle);
    }

    window.addEventListener("load", schedule, { once: true });
    return () => {
      window.removeEventListener("load", schedule);
      window.clearTimeout(idle);
    };
  }, [reduced, video]);

  // Pause while offscreen. A muted looping video still decodes frames and keeps
  // the GPU busy behind ten screens of content.
  useEffect(() => {
    const element = videoRef.current;
    if (element === null) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry === undefined) return;
        if (entry.isIntersecting) void element.play().catch(() => {});
        else element.pause();
      },
      { threshold: 0.05 },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [mountVideo]);

  useGSAP(
    () => {
      const section = root.current;
      if (section === null) return;
      const frame = section.querySelector<HTMLElement>("[data-hero-frame]");
      const scrim = section.querySelector<HTMLElement>("[data-hero-scrim]");
      const content = section.querySelector<HTMLElement>("[data-hero-content]");
      if (frame === null || scrim === null || content === null) return;

      const mm = gsap.matchMedia();

      mm.add(MOTION_QUERIES.reduced, () => {
        gsap.set(frame, { scale: 1, xPercent: 0, yPercent: 0 });
        gsap.set(scrim, { opacity: 0.45 });
      });

      const settle = () => {
        // With a video the poster only has to hand over cleanly, so the media
        // settles from 1.08. Without one, the still carries the whole shot and
        // gets the slow Ken Burns pass from DESIGN §6 "Hero motion fallback".
        if (video !== null) {
          return gsap.fromTo(
            frame,
            { scale: 1.08 },
            { scale: 1, duration: 1.8, ease: "estate", clearProps: "willChange" },
          );
        }
        return gsap.fromTo(
          frame,
          { scale: 1.12, xPercent: -1.2, yPercent: -0.8 },
          { scale: 1, xPercent: 1.2, yPercent: 0.8, duration: 12, ease: "none" },
        );
      };

      const scrub = (drift: number) => {
        gsap.set(scrim, { opacity: 0.25 });
        gsap
          .timeline({
            scrollTrigger: {
              trigger: section,
              start: "top top",
              end: "bottom top",
              scrub: true,
            },
          })
          .to(scrim, { opacity: 0.6, ease: "none" }, 0)
          .to(content, { yPercent: drift, ease: "none" }, 0)
          .to(frame, { yPercent: drift / -2.2, ease: "none" }, 0);
      };

      mm.add(MOTION_QUERIES.mobile, () => {
        gsap.set(frame, { willChange: "transform" });
        settle();
        // A phone hero is barely taller than the content, so a long drift
        // detaches the headline from the photograph. Half the travel.
        scrub(-8);
      });

      mm.add(MOTION_QUERIES.desktop, () => {
        gsap.set(frame, { willChange: "transform" });
        settle();
        scrub(-18);
      });

      return () => mm.revert();
    },
    { scope: root, dependencies: [video] },
  );

  const sources = video?.sources ?? [];

  return (
    <div ref={root} className="absolute inset-0 overflow-clip">
      <div data-hero-frame className="absolute inset-0">
        <picture>
          {posterMobile !== null ? (
            <>
              <source
                media="(max-width: 767px)"
                type="image/avif"
                srcSet={mediaSrcSet(posterMobile, "avif")}
                sizes="100vw"
              />
              <source
                media="(max-width: 767px)"
                type="image/webp"
                srcSet={mediaSrcSet(posterMobile, "webp")}
                sizes="100vw"
              />
            </>
          ) : null}
          <source type="image/avif" srcSet={mediaSrcSet(poster, "avif")} sizes="100vw" />
          <source type="image/webp" srcSet={mediaSrcSet(poster, "webp")} sizes="100vw" />
          <img
            src={poster.fallback}
            alt={alt}
            width={poster.width}
            height={poster.height}
            fetchPriority="high"
            decoding="async"
            className="size-full object-cover"
          />
        </picture>

        {mountVideo && video !== null ? (
          <video
            ref={videoRef}
            poster={video.poster}
            preload="metadata"
            autoPlay
            muted
            loop
            playsInline
            aria-hidden="true"
            tabIndex={-1}
            onCanPlay={() => setVideoReady(true)}
            className={`absolute inset-0 size-full object-cover transition-opacity duration-700 ease-out ${
              videoReady ? "opacity-100" : "opacity-0"
            }`}
          >
            {/* The 720p MP4 first for phones: one `media` hint saves ~9 MB. */}
            {video.mobileSrc !== undefined ? (
              <source src={video.mobileSrc} type="video/mp4" media="(max-width: 767px)" />
            ) : null}
            {sources.map((source) => (
              <source key={source.src} src={source.src} type={source.type} />
            ))}
          </video>
        ) : null}
      </div>

      {/* Two layers: a constant bottom-up gradient that guarantees contrast for
          the headline, and the flat scrim GSAP deepens with scroll. */}
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-linear-to-t from-ink via-ink/55 via-45% to-ink/15"
      />
      <div data-hero-scrim aria-hidden="true" className="absolute inset-0 bg-ink opacity-45" />

      <div data-hero-content className="relative flex size-full flex-col justify-end">
        {children}
      </div>
    </div>
  );
}
