"use client";

/**
 * The hand-off between the first-visit preloader and the landing hero.
 *
 * DESIGN §6.1 has the curtain lift "revealing the hero already in motion", so
 * the hero's entrance must start at the moment the curtain starts to move, not
 * at hydration and not after the curtain is gone. The preloader calls
 * `revealIntro()` at that moment (or immediately when it does not play), and the
 * hero subscribes with `onIntroReveal()`.
 *
 * The flag is module state on purpose: the preloader lives in the locale layout
 * and runs once per full page load, so a client-side navigation back to the
 * landing finds the intro already revealed and plays the hero at once.
 */

type Listener = () => void;

let revealed = false;
const listeners = new Set<Listener>();

export function revealIntro(): void {
  if (revealed) return;
  revealed = true;
  for (const listener of listeners) listener();
  listeners.clear();
}

/** Runs `listener` once the intro is revealed — synchronously if it already is. */
export function onIntroReveal(listener: Listener): () => void {
  if (revealed) {
    listener();
    return () => {};
  }
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
