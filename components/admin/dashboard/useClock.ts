"use client";

import { useEffect, useState } from "react";

/**
 * A wall clock that re-renders every `intervalMs`, for "pre 5 minuta" labels
 * and staleness checks. Query arguments keep their own mount-time `now` so
 * their subscriptions do not churn.
 */
export function useClock(intervalMs: number): number {
  const [clock, setClock] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setClock(Date.now()), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);
  return clock;
}
