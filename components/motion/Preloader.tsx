"use client";

import { useRef, useState } from "react";
import { Logo } from "@/components/site/Logo";
import { prefersReducedMotion } from "@/hooks/useReducedMotion";
import { gsap, useGSAP } from "./gsap";

/**
 * First-visit preloader (DESIGN §6.1): the wordmark rises behind a mask over a
 * bronze hairline that runs beneath it, then the ink curtain slides up on
 * `expo.inOut` to reveal the hero. Hard-capped at 1.8s.
 *
 * "First visit per session" is `sessionStorage`, so a reload inside the same tab
 * session skips it. Whether it runs is decided synchronously during the first
 * render — mounting it and then removing it would flash a black screen at every
 * repeat visitor.
 */

const KEY = "me.preloaded.v1";

function shouldRun(): boolean {
  if (typeof window === "undefined") return false;
  if (prefersReducedMotion()) return false;
  try {
    return window.sessionStorage.getItem(KEY) === null;
  } catch {
    // No sessionStorage (private mode): play it once per page view.
    return true;
  }
}

export function Preloader() {
  // `useState` with an initialiser runs once on the client and never on the
  // server, so SSR output contains no curtain and hydration stays consistent.
  const [active, setActive] = useState<boolean | null>(null);
  const root = useRef<HTMLDivElement>(null);

  useGSAP(() => {
    if (active === null) {
      setActive(shouldRun());
      return;
    }
    if (!active) return;

    const el = root.current;
    if (el === null) return;

    try {
      window.sessionStorage.setItem(KEY, "1");
    } catch {
      // ignore
    }

    const mark = el.querySelector("[data-preloader-mark]");
    const rule = el.querySelector("[data-preloader-rule]");
    if (mark === null || rule === null) return;

    // Lock the page while the curtain is down so a scroll during the reveal
    // does not land the visitor halfway down the hero.
    const previousOverflow = document.documentElement.style.overflow;
    document.documentElement.style.overflow = "hidden";

    const tl = gsap.timeline({
      onComplete: () => {
        document.documentElement.style.overflow = previousOverflow;
        setActive(false);
      },
    });

    tl.fromTo(mark, { yPercent: 110 }, { yPercent: 0, duration: 0.8, ease: "expo.out" })
      .fromTo(rule, { scaleX: 0 }, { scaleX: 1, duration: 0.7, ease: "none" }, 0.1)
      .to(el, { yPercent: -100, duration: 0.9, ease: "expo.inOut" }, 0.85);

    return () => {
      document.documentElement.style.overflow = previousOverflow;
      tl.kill();
    };
  }, [active]);

  if (active !== true) return null;

  return (
    <div
      ref={root}
      aria-hidden="true"
      className="fixed inset-0 z-(--z-preloader) flex flex-col items-center justify-center bg-ink"
    >
      <div className="w-[min(72vw,520px)] overflow-hidden">
        <div data-preloader-mark>
          <Logo tone="dark" rule={false} title="" />
        </div>
      </div>
      <div
        data-preloader-rule
        className="mt-6 h-px w-[min(72vw,520px)] origin-left bg-bronze"
      />
    </div>
  );
}
