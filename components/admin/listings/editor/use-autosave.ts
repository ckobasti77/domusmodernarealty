"use client";

import { useMutation } from "convex/react";
import { useEffect, useState, useSyncExternalStore } from "react";
import type { UseFormReturn } from "react-hook-form";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import type { ListingDoc, ListingForm } from "@/lib/admin/listing-form";
import { AutosaveEngine, type SaveSnapshot } from "./autosave-engine";

/**
 * Wires one `AutosaveEngine` to the form and to Convex. `initial` must be the
 * exact object the form was created with (`docToForm` of the first load).
 */
export function useAutosave(form: UseFormReturn<ListingForm>, listing: ListingDoc, initial: ListingForm) {
  const listingId = listing._id;
  const update = useMutation(api.listingsAdmin.update);
  const setTour360 = useMutation(api.toursAdmin.setTour360);
  const setWalk3d = useMutation(api.toursAdmin.setWalk3d);
  const setVideoUrl = useMutation(api.media.setVideoUrl);
  const [engine] = useState(() => new AutosaveEngine(initial, listing.updatedAt));

  useEffect(() => {
    engine.connect({
      getValues: () => form.getValues(),
      setValue: (key, value) => form.setValue(key, value, { shouldValidate: true }),
      revealErrors: (keys) => void form.trigger(keys),
      update: (patch) => update({ id: listingId, patch }),
      unset: (field) =>
        field === "videoUrl"
          ? setVideoUrl({ listingId })
          : field === "tour360"
            ? setTour360({ listingId })
            : field === "walk3d"
              ? setWalk3d({ listingId })
              : update({ id: listingId, patch: {}, unset: [field] }),
      onVisibilityRefused: (reasons) =>
        toast.error("Vidljivost nije promenjena u „Javna”", {
          description: `Prvo ispunite uslove za objavu: ${reasons.join("; ")}.`,
        }),
      activeElementId: () => (typeof document === "undefined" ? null : (document.activeElement?.id ?? null)),
    });
  }, [engine, form, listingId, update, setTour360, setWalk3d, setVideoUrl]);

  useEffect(
    () => form.subscribe({ formState: { values: true }, callback: () => engine.changed() }),
    [engine, form],
  );

  // Server-side changes (status flips visibility, a colleague's edit, a new slug).
  useEffect(() => {
    engine.rebase(listing);
  }, [engine, listing]);

  // Leaving by any route (⌘K, back button): send what is saveable.
  useEffect(
    () => () => {
      engine.cancel();
      if (!engine.isDiscarded) void engine.flush();
    },
    [engine],
  );

  return engine;
}

export function useSaveSnapshot(engine: AutosaveEngine): SaveSnapshot {
  return useSyncExternalStore(engine.subscribe, engine.getSnapshot, engine.getSnapshot);
}
