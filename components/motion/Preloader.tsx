"use client";

import { useLenis } from "lenis/react";
import { useEffect, useRef } from "react";
import { Logo } from "@/components/site/Logo";
import { CONSENT_KEY } from "@/lib/stores/consent";
import { finishIntro, revealIntro } from "./intro";

/**
 * First-visit preloader (DESIGN §6.1): the wordmark's letters rise one by one
 * behind a mask over a bronze hairline, then the ink curtain lifts on
 * `expo.inOut` to reveal the hero already in motion. 1.8s end to end.
 *
 * The whole sequence is server-rendered and runs on CSS keyframes
 * (`me-preloader-*` in globals.css), not on hydration:
 *  - an inline gate script, parsed before the curtain, decides "play" or "skip"
 *    (first visit in this tab session, motion allowed) and writes it to
 *    `<html data-intro>`, so a repeat visitor never sees a single frame of ink
 *    and a first-time visitor never sees the hero flash before the curtain;
 *  - the curtain lifts at a fixed time after its first paint, so a slow phone
 *    that hydrates late does not keep the visitor staring at ink.
 * The curtain is `position: fixed`, so it never shifts layout.
 *
 * This component only hands the moment of the lift to the hero (`revealIntro`)
 * and holds the scroll still while the curtain is down.
 */

const KEY = "me.preloaded.v1";

/** Mirrors the keyframe timings in globals.css. */
const LIFT_AT_MS = 1000;
const DONE_AT_MS = 1800;

/**
 * Runs during HTML parsing, before the curtain is painted. It decides two
 * things the first paint must already know:
 *  - `data-consent`: "pending" while no cookie decision is stored, so the
 *    hero can hold its copy above the banner from the very first frame (a
 *    reservation made at hydration would shift the whole hero);
 *  - `data-intro`: reduced motion, a repeat visit or blocked storage all mean
 *    "skip".
 */
const GATE_SCRIPT = `(function(){var d=document.documentElement;try{d.setAttribute("data-consent",window.localStorage.getItem("${CONSENT_KEY}")===null?"pending":"decided")}catch(e){d.setAttribute("data-consent","pending")}try{if(window.matchMedia("(prefers-reduced-motion: reduce)").matches||window.sessionStorage.getItem("${KEY}")!==null){d.setAttribute("data-intro","skip");return}window.sessionStorage.setItem("${KEY}","1");d.setAttribute("data-intro","play")}catch(e){d.setAttribute("data-intro","skip")}})();`;

/** Milliseconds since the curtain's keyframes started, from the CSS animation clock. */
function curtainClock(curtain: HTMLElement): number | null {
  if (typeof curtain.getAnimations !== "function") return null;
  for (const animation of curtain.getAnimations()) {
    if (animation instanceof CSSAnimation && animation.animationName === "me-preloader-lift") {
      const time = animation.currentTime;
      return typeof time === "number" ? time : null;
    }
  }
  return null;
}

export function Preloader() {
  const root = useRef<HTMLDivElement>(null);
  /** `performance.now()` until which scrolling stays locked. */
  const lockUntil = useRef(0);
  const lenis = useLenis();

  useEffect(() => {
    const curtain = root.current;
    if (curtain === null || document.documentElement.dataset.intro !== "play") {
      revealIntro();
      finishIntro();
      return;
    }

    const elapsed = curtainClock(curtain);
    if (elapsed === null || elapsed >= DONE_AT_MS) {
      revealIntro();
      finishIntro();
      return;
    }

    const timers: number[] = [];
    if (elapsed >= LIFT_AT_MS) revealIntro();
    else timers.push(window.setTimeout(revealIntro, LIFT_AT_MS - elapsed));
    timers.push(window.setTimeout(finishIntro, DONE_AT_MS - elapsed));

    // Hold the page still while the curtain is down, so a scroll during the
    // reveal does not land the visitor halfway down the hero.
    const html = document.documentElement;
    const previous = html.style.overflow;
    html.style.overflow = "hidden";
    lockUntil.current = performance.now() + (DONE_AT_MS - elapsed);
    timers.push(
      window.setTimeout(() => {
        html.style.overflow = previous;
      }, DONE_AT_MS - elapsed),
    );

    return () => {
      for (const timer of timers) window.clearTimeout(timer);
      html.style.overflow = previous;
      revealIntro();
      finishIntro();
    };
  }, []);

  // Lenis scrolls programmatically, so `overflow: hidden` alone does not stop
  // it. The instance arrives after the first effect pass.
  useEffect(() => {
    if (lenis === undefined) return;
    const remaining = lockUntil.current - performance.now();
    if (remaining <= 0) return;
    lenis.stop();
    const timer = window.setTimeout(() => lenis.start(), remaining);
    return () => {
      window.clearTimeout(timer);
      lenis.start();
    };
  }, [lenis]);

  return (
    <>
      {/* A fixed, first-party string. It has to run inline, before the curtain
          below is parsed, or a repeat visitor would see a frame of ink. */}
      <script dangerouslySetInnerHTML={{ __html: GATE_SCRIPT }} />
      <div
        ref={root}
        data-preloader=""
        aria-hidden="true"
        className="fixed inset-0 z-(--z-preloader) flex-col items-center justify-center bg-ink"
      >
        <div className="w-[min(72vw,520px)] overflow-hidden">
          <div data-preloader-mark="" className="translate-x-[8.25%]">
            <Logo tone="dark" rule={false} title="" />
          </div>
        </div>
        <div data-preloader-rule="" className="mt-6 h-px w-[calc(min(72vw,520px)*0.835)] origin-left bg-bronze" />
      </div>
    </>
  );
}
