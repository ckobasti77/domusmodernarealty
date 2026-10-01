"use client";

import { Plus, Trash2 } from "lucide-react";
import { useController, useFormContext, useWatch } from "react-hook-form";
import { L10nInput } from "@/components/admin/common/L10nInput";
import { Button } from "@/components/ui/button";
import { TOUR_LIMITS } from "@/convex/lib/tours";
import { HOTSPOT_LABEL_MAX, type ListingForm } from "@/lib/admin/listing-form";
import { useFieldError } from "../fields";
import { DecimalField } from "./DecimalField";
import { roundCoord } from "./numbers";
import type { PlanPoint } from "./plan-geometry";

const DIRTY = { shouldDirty: true, shouldValidate: true } as const;

/**
 * "Prostorije za skok": named spots the visitor can jump to in the walkthrough
 * (position on the floor plus the direction to face). Rows are addressed by
 * index and every control reads the form, so removing a row never leaves a
 * stale value behind in the rows after it.
 */
export function HotspotsField({ center }: { center: PlanPoint }) {
  const { getValues, setValue } = useFormContext<ListingForm>();
  const hotspots = useWatch<ListingForm, "walk3d.hotspots">({ name: "walk3d.hotspots" });
  const listError = useFieldError("walk3d.hotspots");
  const full = hotspots.length >= TOUR_LIMITS.hotspots;

  const add = () => {
    const index = getValues("walk3d.hotspots").length;
    setValue(
      "walk3d.hotspots",
      [
        ...getValues("walk3d.hotspots"),
        { label: { sr: "", en: "", ru: "", de: "" }, x: roundCoord(center.x), z: roundCoord(center.z), yaw: 0 },
      ],
      DIRTY,
    );
    // The new row's name is required; take the user there.
    requestAnimationFrame(() =>
      document.querySelector<HTMLInputElement>(`[data-testid="hotspot-${index}-name-sr"]`)?.focus(),
    );
  };

  return (
    <div className="flex min-w-0 flex-col gap-3" data-testid="walk-hotspots">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <h4 className="text-sm font-medium">
            Prostorije za skok{" "}
            <span className="font-normal text-muted-foreground tabular-nums">
              ({hotspots.length}/{TOUR_LIMITS.hotspots})
            </span>
          </h4>
          <p className="text-xs text-muted-foreground">
            Dugmad u šetnji koja posetioca prebacuju u prostoriju. Novu prostoriju prevucite na tlocrtu.
          </p>
        </div>
        <Button type="button" variant="outline" size="sm" disabled={full} onClick={add}>
          <Plus aria-hidden="true" />
          Dodaj prostoriju
        </Button>
      </div>
      {hotspots.length > 0 ? (
        <ol className="grid gap-3 @2xl:grid-cols-2">
          {hotspots.map((_, index) => (
            <HotspotRow
              key={index}
              index={index}
              onRemove={() =>
                setValue(
                  "walk3d.hotspots",
                  getValues("walk3d.hotspots").filter((__, at) => at !== index),
                  DIRTY,
                )
              }
            />
          ))}
        </ol>
      ) : null}
      {listError !== undefined ? <p className="text-xs font-medium text-destructive">{listError}</p> : null}
    </div>
  );
}

function HotspotRow({ index, onRemove }: { index: number; onRemove: () => void }) {
  const { field } = useController<ListingForm, `walk3d.hotspots.${number}.label`>({
    name: `walk3d.hotspots.${index}.label`,
  });
  const nameError = useFieldError(`walk3d.hotspots.${index}.label.sr`);
  const number = index + 1;
  return (
    <li className="flex min-w-0 flex-col gap-3 rounded-lg border bg-background p-3" data-testid="walk-hotspot">
      <div className="flex items-center justify-between gap-2">
        <span className="inline-flex items-center gap-2 text-sm font-medium">
          <span aria-hidden="true" className="inline-block size-2.5 rotate-45 bg-amber-600" />
          Prostorija {number}
        </span>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={`Ukloni prostoriju ${number}`}
          className="text-muted-foreground pointer-fine:hover:text-destructive"
          onClick={onRemove}
        >
          <Trash2 aria-hidden="true" />
        </Button>
      </div>
      <L10nInput
        label="Naziv"
        value={field.value}
        onChange={(next) => field.onChange(next)}
        required
        maxLength={HOTSPOT_LABEL_MAX}
        error={nameError}
        testId={`hotspot-${index}-name`}
      />
      <div className="grid grid-cols-3 gap-2">
        <DecimalField name={`walk3d.hotspots.${index}.x`} id={`hotspot-${index}-x`} label="x" />
        <DecimalField name={`walk3d.hotspots.${index}.z`} id={`hotspot-${index}-z`} label="z" />
        <DecimalField name={`walk3d.hotspots.${index}.yaw`} id={`hotspot-${index}-yaw`} label="Smer" angle />
      </div>
    </li>
  );
}
