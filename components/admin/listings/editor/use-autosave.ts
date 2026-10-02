"use client";

import { useMutation } from "convex/react";
import { useEffect, useState, useSyncExternalStore } from "react";
import type { UseFormReturn } from "react-hook-form";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import type { ListingDoc, ListingForm } from "@/lib/admin/listing-form";
import { AutosaveEngine, type SaveSnapshot } from "./autosave-engine";

/** The RHF error type of messages the autosave puts on fields (server refusals, the contract rule). */
const SAVE_ERROR = "autosave";

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
      setFieldError: (path, message) => {
        if (message !== null) form.setError(path, { type: SAVE_ERROR, message });
        // Only its own message: a schema error the user has since caused stays.
        else if (form.getFieldState(path).error?.type === SAVE_ERROR) form.clearErrors(path);
      },
      update: (patch, unset) => update({ id: listingId, patch, ...(unset.length > 0 ? { unset: [...unset] } : {}) }),
      unset: (field) =>
        field === "videoUrl"
          ? setVideoUrl({ listingId })
          : field === "tour360"
            ? setTour360({ listingId })
            : setWalk3d({ listingId }),
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

  // The leave guard (`AutosaveLeaveGuard`) saves before any navigation it sees;
  // this catches the rest (a route change from code) and says what stayed unsaved.
  useEffect(
    () => () => {
      engine.cancel();
      if (engine.isDiscarded) return;
      void engine.flush().then((result) => {
        if (result.ok && result.pending.length === 0) return;
        toast.error("Neke izmene nekretnine nisu sačuvane.", {
          description: engine.getSnapshot().error ?? "Polja sa greškom nisu sačuvana.",
        });
      });
    },
    [engine],
  );

  return engine;
}

export function useSaveSnapshot(engine: AutosaveEngine): SaveSnapshot {
  return useSyncExternalStore(engine.subscribe, engine.getSnapshot, engine.getSnapshot);
}
