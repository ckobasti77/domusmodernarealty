"use client";

import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef } from "react";
import { parseSearchParams, toQueryString, type SearchState } from "@/lib/search-params";

/**
 * How a change reaches the URL:
 *  - `push` — a discrete choice (a chip, a checkbox, a settled range). It gets
 *    its own history entry, so Back undoes the last filter.
 *  - `replace` — a continuous stream (the map viewport while "search as I move
 *    the map" is on). Many small moves must not flood the history.
 *
 * Both go through the native History API, which the App Router observes: the
 * `useSearchParams()` below updates, the Convex subscriptions re-key, and the
 * server page is NOT re-rendered for every filter (the client island already
 * holds everything it needs). The server renders only the first visit and any
 * shared link.
 */
export type NavigateMode = "push" | "replace";

export function useSearchUrl() {
  const params = useSearchParams();
  const query = params.toString();
  const state = useMemo(() => parseSearchParams(new URLSearchParams(query)), [query]);

  const navigate = useCallback((next: SearchState, mode: NavigateMode = "push") => {
    const qs = toQueryString(next);
    const url = `${window.location.pathname}${qs.length > 0 ? `?${qs}` : ""}`;
    if (url === `${window.location.pathname}${window.location.search}`) return;
    if (mode === "push") window.history.pushState(null, "", url);
    else window.history.replaceState(null, "", url);
  }, []);

  return { state, navigate };
}

/**
 * A trailing-edge debounce for range sliders and text: the latest call wins
 * and fires `delay` ms after the input settles. Pending work is dropped on
 * unmount.
 */
export function useDebounced<Args extends unknown[]>(fn: (...args: Args) => void, delay: number) {
  const latest = useRef(fn);
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => {
    latest.current = fn;
  }, [fn]);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  return useCallback(
    (...args: Args) => {
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => latest.current(...args), delay);
    },
    [delay],
  );
}
