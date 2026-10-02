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
 * This component only hands the moment of the lift to the hero (`revealIntro`),
 * holds the scroll still while the curtain is down, and lets the visitor skip
 * it: any key, click, tap or wheel fades the curtain out at once (PRD A2).
 */

const KEY = "me.preloaded.v1";

/** Mirrors the keyframe timings in globals.css. */
const LIFT_AT_MS = 1000;
const DONE_AT_MS = 1800;
/** A skipped curtain fades instead of lifting (a UI response, so <= 300 ms). */
const SKIP_FADE_MS = 200;
const SKIP_EVENTS = ["keydown", "pointerdown", "wheel", "touchstart"] as const;

/**
 * Runs during HTML parsing, before the curtain is painted. It decides two
 * things the first paint must already know:
 *  - `data-consent`: "pending" while no cookie decision is stored, so the
 *    hero can hold its copy above the banner from the very first frame (a
 *    reservation made at hydration would shift the whole hero);
 *  - `data-intro`: reduced motion, a repeat visit or blocked storage all mean
 *    "skip". While it plays, the first key, click, tap or wheel before React
 *    has hydrated flips it to "skip" (the curtain's CSS needs "play"); once the
 *    component is up it sets `data-intro-ready` and handles the skip itself,
 *    with a short fade.
 */
const GATE_SCRIPT = `(function(){var d=document.documentElement;try{d.setAttribute("data-consent",window.localStorage.getItem("${CONSENT_KEY}")===null?"pending":"decided")}catch(e){d.setAttribute("data-consent","pending")}try{if(window.matchMedia("(prefers-reduced-motion: reduce)").matches||window.sessionStorage.getItem("${KEY}")!==null){d.setAttribute("data-intro","skip");return}window.sessionStorage.setItem("${KEY}","1");d.setAttribute("data-intro","play");var t=["keydown","pointerdown","wheel","touchstart"],o=function(){t.forEach(function(n){window.removeEventListener(n,s,true)})},s=function(){if(d.hasAttribute("data-intro-ready"))return o();d.setAttribute("data-intro","skip");o()};t.forEach(function(n){window.addEventListener(n,s,{capture:true,passive:true})});setTimeout(o,${DONE_AT_MS})}catch(e){d.setAttribute("data-intro","skip")}})();`;

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
  const lenisRef = useRef(lenis);
  useEffect(() => {
    lenisRef.current = lenis;
  }, [lenis]);

  useEffect(() => {
    const curtain = root.current;
    // From here on this effect owns the skip; the gate script's listener stands down.
    document.documentElement.setAttribute("data-intro-ready", "");
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
    // The lift's own start, not a timer: at hydration the CSS animation can
    // still be pending, and a timer would then reveal the hero 150-250 ms
    // before the curtain moves. The timer stays as a late fallback.
    const onLift = (event: AnimationEvent) => {
      if (event.target === curtain && event.animationName === "me-preloader-lift") revealIntro();
    };
    if (elapsed >= LIFT_AT_MS) revealIntro();
    else {
      curtain.addEventListener("animationstart", onLift);
      timers.push(window.setTimeout(revealIntro, LIFT_AT_MS - elapsed + 250));
    }
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

    let skipped = false;
    const skip = () => {
      if (skipped) return;
      skipped = true;
      for (const type of SKIP_EVENTS) window.removeEventListener(type, skip, true);
      for (const timer of timers) window.clearTimeout(timer);
      revealIntro();
      html.style.overflow = previous;
      lockUntil.current = 0;
      lenisRef.current?.start();
      const fade = curtain.animate([{ opacity: 1 }, { opacity: 0 }], {
        duration: SKIP_FADE_MS,
        easing: "ease-out",
        fill: "forwards",
      });
      void fade.finished
        .catch(() => undefined)
        .then(() => {
          // "skip" is the state a repeat visit starts in: the curtain is gone.
          html.dataset.intro = "skip";
          finishIntro();
        });
    };
    for (const type of SKIP_EVENTS) window.addEventListener(type, skip, { capture: true, passive: true });
    timers.push(
      window.setTimeout(() => {
        for (const type of SKIP_EVENTS) window.removeEventListener(type, skip, true);
      }, DONE_AT_MS - elapsed),
    );

    return () => {
      curtain.removeEventListener("animationstart", onLift);
      for (const type of SKIP_EVENTS) window.removeEventListener(type, skip, true);
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
