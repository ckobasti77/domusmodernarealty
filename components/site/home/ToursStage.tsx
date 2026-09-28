"use client";

import Image from "next/image";
import { useRef } from "react";
import { AmbientVideo } from "@/components/motion/AmbientVideo";
import { gsap, MOTION_QUERIES, useGSAP } from "@/components/motion/gsap";
import { Picture } from "@/components/site/Picture";
import type { MediaVideo, ResponsiveImage } from "@/lib/media";

/**
 * The 3D-tours stage (DESIGN §6.7), a "pinned zoom" in two layers:
 *  - the backdrop is the owner's scan render (an interior dissolving into a
 *    point cloud) under a heavy scrim;
 *  - over it, a window holds the walkthrough film (poster first, then the
 *    muted loop), framed by a hairline.
 *
 * Desktop (≥1024px, motion allowed): the stage pins and the scroll opens the
 * window from 58% to full bleed while the film inside settles from 1.25 → 1
 * and the hairline frame runs ahead of it and dissolves — the visitor steps
 * out of the scan and into the walk. Everything is `transform` and `opacity`;
 * the timeline is scrubbed and has `ease: "none"` so the scroll owns the pace.
 * Below 1024px the window uncovers once with a `clip-path` inset, no pin; with
 * reduced motion it is simply open.
 *
 * All the media is decorative atmosphere (AI-generated, never a real
 * listing), so only the backdrop carries an alt text and the film is hidden
 * from assistive technology.
 */

const START = 0.58;

export type ToursStageProps = {
  backdrop: ResponsiveImage;
  backdropAlt: string;
  film: MediaVideo | null;
};

export function ToursStage({ backdrop, backdropAlt, film }: ToursStageProps) {
  const root = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const stage = root.current;
      if (stage === null) return;
      const q = gsap.utils.selector(stage);
      const [layer] = q("[data-tours-backdrop]");
      const [frame] = q("[data-tours-frame]");
      const [pane] = q("[data-tours-window]");
      const [inner] = q("[data-tours-inner]");
      if (layer === undefined || frame === undefined || pane === undefined || inner === undefined) return;

      const mm = gsap.matchMedia();

      mm.add(MOTION_QUERIES.desktop, () => {
        gsap
          .timeline({
            defaults: { ease: "none" },
            scrollTrigger: {
              trigger: stage,
              start: "top top",
              end: "+=120%",
              pin: true,
              scrub: true,
              invalidateOnRefresh: true,
            },
          })
          .fromTo(pane, { scale: START }, { scale: 1 }, 0)
          .fromTo(inner, { scale: 1.25 }, { scale: 1 }, 0)
          .fromTo(layer, { scale: 1.08 }, { scale: 1 }, 0)
          .fromTo(frame, { scale: START * 1.1, opacity: 1 }, { scale: 1.12, opacity: 0 }, 0);
      });

      mm.add(MOTION_QUERIES.mobile, () => {
        gsap.set(frame, { opacity: 0 });
        gsap
          .timeline({
            defaults: { ease: "estate" },
            scrollTrigger: { trigger: stage, start: "top 78%", once: true },
          })
          .fromTo(pane, { clipPath: "inset(14% 10% 14% 10%)" }, { clipPath: "inset(0% 0% 0% 0%)", duration: 1.2 }, 0)
          .fromTo(inner, { scale: 1.15 }, { scale: 1, duration: 1.6 }, 0);
      });

      mm.add(MOTION_QUERIES.reduced, () => {
        gsap.set(frame, { opacity: 0 });
      });

      return () => mm.revert();
    },
    { scope: root },
  );

  return (
    <div
      ref={root}
      className="relative isolate aspect-[4/5] overflow-clip bg-ink sm:aspect-video lg:aspect-auto lg:h-svh"
    >
      <div data-tours-backdrop="" className="absolute inset-0 -z-10">
        <Picture image={backdrop} alt={backdropAlt} sizes="100vw" className="absolute inset-0" />
        <div aria-hidden="true" className="absolute inset-0 bg-ink/55" />
      </div>

      <div data-tours-window="" className="absolute inset-0 overflow-clip">
        <div data-tours-inner="" className="absolute inset-0">
          {film !== null ? (
            <>
              <Image src={film.poster} alt="" fill sizes="100vw" className="object-cover" />
              <AmbientVideo video={film} />
            </>
          ) : (
            // No film delivered: the window opens onto the still itself.
            <Picture image={backdrop} alt="" sizes="100vw" className="absolute inset-0" />
          )}
        </div>
      </div>

      <div
        data-tours-frame=""
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 hidden border border-ivory/45 lg:block"
      />
    </div>
  );
}
