"use client";

import { useMutation } from "convex/react";
import { useEffect } from "react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { firstTimeInSession, getSessionKey } from "@/lib/session";

/**
 * Counts one view per listing per browser tab (PRD A5). First-party, no
 * personal data, no cookie — the key is a random `sessionStorage` token — so it
 * runs without analytics consent (IMPLEMENTATION-PLAN §5). The server is
 * idempotent too (`listingViews`), so a double effect in dev cannot double-count.
 */
export function ViewTracker({ listingId }: { listingId: Id<"listings"> }) {
  const trackView = useMutation(api.stats.trackView);

  useEffect(() => {
    if (!firstTimeInSession("view", listingId)) return;
    trackView({ listingId, sessionKey: getSessionKey() }).catch(() => {
      // A lost view is not worth an error on the visitor's screen.
    });
  }, [listingId, trackView]);

  return null;
}
