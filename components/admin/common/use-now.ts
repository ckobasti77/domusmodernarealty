"use client";

import { useEffect, useState } from "react";

/**
 * The current time, refreshed every `tickMs`, for "pre 5 minuta" labels
 * (renders stay pure: `formatRelative` takes `now` as an argument). A
 * timestamp that is a little ahead of this clock (a save that just landed)
 * should be clamped by the caller so it never reads as "za 1 minut".
 */
export function useNow(tickMs: number): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), tickMs);
    return () => window.clearInterval(timer);
  }, [tickMs]);
  return now;
}
