"use client";

import { useCallback, useSyncExternalStore } from "react";

/**
 * A media query as React state. The server snapshot is `false`, so anything
 * gated on it renders its "no match" branch in the HTML and switches right
 * after hydration; layout itself stays in CSS breakpoints, this only decides
 * what to MOUNT (e.g. the results map on a phone).
 */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const list = window.matchMedia(query);
      list.addEventListener("change", onChange);
      return () => list.removeEventListener("change", onChange);
    },
    [query],
  );
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    () => false,
  );
}
