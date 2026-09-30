"use client";

import { useMemo, type JSX } from "react";
import type { Id } from "@/convex/_generated/dataModel";
import type { MediaItem } from "@/convex/lib/validators";
import { MediaSection } from "./MediaSection";
import { sortByOrder } from "./shared";

/**
 * The editor's "Mediji" tab body (PRD B3): the photo gallery and the floor
 * plans, each with multi-upload, drag-and-keyboard reorder, cover, room tag,
 * per-locale alt text and delete. It talks to Convex directly (`media.*`), not
 * through the editor form: the listing query is the single source of truth and
 * re-renders this component with the result of every change.
 */
export function MediaManager({
  listingId,
  media,
  floorPlans,
  mediaUrls,
}: {
  listingId: Id<"listings">;
  /** `listing.media` from `listingsAdmin.get` (reactive server state). */
  media: MediaItem[];
  /** `listing.floorPlans`. */
  floorPlans: MediaItem[];
  /** item.id → display URL, from `listingsAdmin.get`. */
  mediaUrls: Record<string, string>;
}): JSX.Element {
  const gallery = useMemo(() => sortByOrder(media), [media]);
  const plans = useMemo(() => sortByOrder(floorPlans), [floorPlans]);

  return (
    <div className="space-y-6">
      <MediaSection listingId={listingId} target="gallery" items={gallery} urls={mediaUrls} />
      <MediaSection listingId={listingId} target="floorPlans" items={plans} urls={mediaUrls} />
    </div>
  );
}
