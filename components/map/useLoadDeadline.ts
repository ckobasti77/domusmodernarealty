"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * MapLibre reports a style or tile server that refuses the connection, but a
 * request that simply hangs never errors in any useful time. After this long
 * without `load` the map says it is unavailable instead of spinning; if it
 * loads later after all, `ready` wins.
 */
export const MAP_LOAD_DEADLINE_MS = 12_000;

/** `failed` turns true once `waiting` has lasted the deadline, or at once on `fail()`. */
export function useLoadDeadline(waiting: boolean): { failed: boolean; fail: () => void } {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!waiting) return;
    const timer = window.setTimeout(() => setFailed(true), MAP_LOAD_DEADLINE_MS);
    return () => window.clearTimeout(timer);
  }, [waiting]);

  const fail = useCallback(() => setFailed(true), []);
  return { failed, fail };
}
