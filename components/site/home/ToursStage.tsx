"use client";

import Image from "next/image";
import { useRef } from "react";
import { AmbientVideo } from "@/components/motion/AmbientVideo";
import { gsap, MOTION_QUERIES, useGSAP } from "@/components/motion/gsap";
import { buttonClasses } from "@/components/site/Button";
import { Picture } from "@/components/site/Picture";
import { Link } from "@/i18n/navigation";
import type { MediaVideo, ResponsiveImage } from "@/lib/media";

/**
 * The 3D-tours stage (DESIGN §6.7), a "pinned zoom" in two layers:
 *  - the backdrop is the owner's scan render (an interior dissolving into a
 *    point cloud) under a heavy scrim;
 *  - over it, a window holds the walkthrough film (poster first, then the
 *    muted loop), framed by a hairline.
 *
 * Desktop (≥1024px, motion allowed): the stage pins and the scroll opens the
 * window from 58% to full bleed while the film inside settles from 1.25 → 1.
 * The frame is four 1px lines kept exactly 40px outside the window, so it
 * stays a crisp hairline at every size (a scaled border would thin to a soft
 * 0.6px), and it dissolves as the window reaches the edges. In the last beat
 * the call to action rises over the film. Everything is `transform` and
 * `opacity`; the timeline is scrubbed with `ease: "none"`, so the scroll owns
 * the pace. Below 1024px the window uncovers once with a `clip-path`; with
 * reduced motion it is simply open.
 *
 * All the media is decorative atmosphere (AI-generated, never a real listing),
 * so only the backdrop carries an alt text and the film is hidden from
 * assistive technology.
 */

const START = 0.58;
/** Frame-to-window distance in px. */
const GUTTER = 40;

export type ToursStageProps = {
  backdrop: ResponsiveImage;
  backdropAlt: string;
  film: MediaVideo | null;
  /** The end-beat link to a listing with a tour; the heading above always has one too. */
  cta: { slug: string; label: string } | null;
};

export function ToursStage({ backdrop, backdropAlt, film, cta }: ToursStageProps) {
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
      const [end] = q("[data-tours-end]");
      const [top, bottom, left, right] = q("[data-tours-line]");
      if (layer === undefined || frame === undefined || pane === undefined || inner === undefined) return;

      const mm = gsap.matchMedia();

      mm.add(MOTION_QUERIES.desktop, () => {
        // Draws the frame around a window at scale `s`: each line moves out
        // from the centre and stretches along its own axis only.
        const draw = (s: number) => {
          if (top === undefined || bottom === undefined || left === undefined || right === undefined) return;
          const w = stage.clientWidth;
          const h = stage.clientHeight;
          const dx = (s * w) / 2 + GUTTER;
          const dy = (s * h) / 2 + GUTTER;
          gsap.set([top, bottom], { scaleX: (s * w + 2 * GUTTER) / w });
          gsap.set(top, { y: -dy });
          gsap.set(bottom, { y: dy });
          gsap.set([left, right], { scaleY: (s * h + 2 * GUTTER) / h });
          gsap.set(left, { x: -dx });
          gsap.set(right, { x: dx });
        };
        const zoom = { s: START };
        draw(START);
        if (end !== undefined) gsap.set(end, { autoAlpha: 0 });

        const tl = gsap
          .timeline({
            defaults: { ease: "none" },
            scrollTrigger: {
              trigger: stage,
              start: "top top",
              end: "+=120%",
              pin: true,
              scrub: true,
              invalidateOnRefresh: true,
              onRefresh: () => draw(zoom.s),
            },
          })
          .fromTo(pane, { scale: START }, { scale: 1, duration: 1 }, 0)
          .fromTo(inner, { scale: 1.25 }, { scale: 1, duration: 1 }, 0)
          .fromTo(layer, { scale: 1.08 }, { scale: 1, duration: 1 }, 0)
          .fromTo(zoom, { s: START }, { s: 1, duration: 1, onUpdate: () => draw(zoom.s) }, 0)
          .fromTo(frame, { opacity: 1 }, { opacity: 0, duration: 0.45 }, 0.55);
        if (end !== undefined) tl.to(end, { autoAlpha: 1, duration: 0.15 }, 0.85);
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

      {/* Invisible until the desktop timeline draws it; otherwise the four lines
          would sit as a cross in the middle of the stage. */}
      <div data-tours-frame="" aria-hidden="true" className="pointer-events-none absolute inset-0 hidden opacity-0 lg:block">
        <span data-tours-line="" className="absolute inset-x-0 top-1/2 h-px bg-ivory/50" />
        <span data-tours-line="" className="absolute inset-x-0 top-1/2 h-px bg-ivory/50" />
        <span data-tours-line="" className="absolute inset-y-0 left-1/2 w-px bg-ivory/50" />
        <span data-tours-line="" className="absolute inset-y-0 left-1/2 w-px bg-ivory/50" />
      </div>

      {cta !== null ? (
        <div
          data-tours-end=""
          className="invisible absolute inset-x-0 bottom-0 hidden bg-linear-to-t from-ink/85 via-ink/40 to-transparent px-gutter-lg pb-14 pt-40 lg:block"
        >
          <div className="mx-auto max-w-content">
            <Link
              href={{ pathname: "/properties/[slug]", params: { slug: cta.slug } }}
              className={buttonClasses({ variant: "inverse" })}
            >
              <span>{cta.label}</span>
            </Link>
          </div>
        </div>
      ) : null}
    </div>
  );
}
