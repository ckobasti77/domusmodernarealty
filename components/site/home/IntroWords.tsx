"use client";

import { useRef } from "react";
import { gsap, MOTION_QUERIES, SplitText, useGSAP } from "@/components/motion/gsap";
import { cn } from "@/lib/utils";

/**
 * The intro statement's reveal (DESIGN §6.3).
 *
 *  - Desktop: the paragraph is split into words that rise from 15% to full
 *    opacity, scrubbed to the scroll — reading pace follows the reader.
 *  - Mobile: whole lines fade up once, with no scrub; a thumb flick is too fast
 *    and too coarse to read word by word.
 *  - Reduced motion: the text is simply there.
 *
 * Only opacity and transform are animated. The split uses `aria: "none"`: the
 * words stay real text in reading order, so a screen reader reads the sentence
 * as written, and no `aria-label` lands on the `<p>` (prohibited there).
 */

export function IntroWords({ text, className }: { text: string; className?: string }) {
  const root = useRef<HTMLParagraphElement>(null);

  useGSAP(
    () => {
      const el = root.current;
      if (el === null) return;
      const mm = gsap.matchMedia();

      mm.add(MOTION_QUERIES.desktop, () => {
        const split = SplitText.create(el, {
          type: "words",
          aria: "none",
          reduceWhiteSpace: false,
          autoSplit: true,
          onSplit(self) {
            return gsap.fromTo(
              self.words,
              // Never below 0.5: dimmed ink on ivory still clears 3:1 for this
              // display size (WCAG 1.4.3), so the words read before they light up.
              { opacity: 0.5 },
              {
                opacity: 1,
                ease: "none",
                duration: 0.35,
                stagger: 0.1,
                // Fully lit before the paragraph reaches the middle of the screen.
                scrollTrigger: { trigger: el, start: "top 80%", end: "bottom 70%", scrub: true },
              },
            );
          },
        });
        return () => split.revert();
      });

      mm.add(MOTION_QUERIES.mobile, () => {
        const split = SplitText.create(el, {
          type: "lines",
          aria: "none",
          reduceWhiteSpace: false,
          autoSplit: true,
          onSplit(self) {
            return gsap.from(self.lines, {
              opacity: 0,
              y: 14,
              duration: 0.9,
              stagger: 0.08,
              ease: "estate",
              scrollTrigger: { trigger: el, start: "top 82%", once: true },
            });
          },
        });
        return () => split.revert();
      });

      return () => mm.revert();
    },
    { scope: root },
  );

  return (
    <p ref={root} className={cn(className)}>
      {text}
    </p>
  );
}
