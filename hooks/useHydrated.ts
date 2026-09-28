"use client";

import { useSyncExternalStore } from "react";

const noop = () => () => {};

/**
 * `false` during SSR and the hydration render, `true` from the first
 * client-only render on.
 *
 * Use it for UI whose visibility depends on `localStorage` (the cookie banner)
 * so the server output and the hydration render agree, without the
 * `useState` + `useEffect` dance — the project's eslint config rejects calling
 * `setState` inside an effect, and this is correct on the first render anyway.
 */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    noop,
    () => true,
    () => false,
  );
}
