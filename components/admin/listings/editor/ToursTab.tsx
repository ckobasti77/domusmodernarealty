"use client";

import { Info, Upload } from "lucide-react";
import type { ChangeEvent } from "react";
import { useFormContext, useWatch } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { TOUR_PROVIDER_LABEL, type TourProvider } from "@/lib/admin/labels";
import {
  ASSET_FORMAT_LABEL,
  EMPTY_TOUR360,
  detectAssetFormat,
  emptyAsset,
  type ListingForm,
} from "@/lib/admin/listing-form";
import type { EditorData } from "./editor-context";
import { Group, SelectField, SwitchField, TabPanel, TextField, optionsOf } from "./fields";

const DIRTY = { shouldDirty: true, shouldValidate: true } as const;
const PROVIDER_OPTIONS = [{ value: "none", label: "Nema" }, ...optionsOf(TOUR_PROVIDER_LABEL)];
const FORMAT_OPTIONS = optionsOf(ASSET_FORMAT_LABEL);

type Slot = "desktop" | "mobile" | "collision";

const SLOT: Record<Slot, { label: string; hint: string }> = {
  desktop: { label: "Model za računar", hint: "Glavni splat. Obavezan za objavu šetnje." },
  mobile: { label: "Model za telefon", hint: "Lakša verzija za mobilne uređaje (opciono)." },
  collision: { label: "Kolizioni model", hint: "Zidovi i pod za kretanje kroz prostor (opciono)." },
};

export function ToursTab({ data }: { data: EditorData }) {
  return (
    <TabPanel
      id="panel-3d"
      title="360° / 3D"
      description="Virtuelna tura i 3D šetnja kroz prostor. Nekretnina dobija oznaku „360°” tek kada je bar jedno od ovoga objavljeno."
    >
      <p className="flex items-start gap-2 rounded-lg border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
        <Info aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" />
        Za sada se izvori unose kao https adrese. Otpremanje fajlova i uređivač scena stižu uskoro.
      </p>
      <Tour360Group sceneCount={data.sceneCount} />
      <Walk3dGroup />
    </TabPanel>
  );
}

function Tour360Group({ sceneCount }: { sceneCount: number }) {
  const { getValues, setValue } = useFormContext<ListingForm>();
  const provider = useWatch<ListingForm, "tour360.provider">({ name: "tour360.provider" });

  const onProvider = (value: string) => {
    if (value === "none") {
      // "Nema" removes the tour (toursAdmin.setTour360 without a tour).
      setValue("tour360", { ...EMPTY_TOUR360 }, DIRTY);
      return;
    }
    const next = (Object.keys(TOUR_PROVIDER_LABEL) as TourProvider[]).find((item) => item === value);
    if (next !== undefined) setValue("tour360", { ...getValues("tour360"), provider: next }, DIRTY);
  };

  return (
    <Group title="360° tura">
      <SelectField
        name="tour360.provider"
        id="f-tour360-provider"
        label="Izvor ture"
        options={PROVIDER_OPTIONS}
        onValueChange={onProvider}
        hint={provider === "none" ? "Nekretnina nema virtuelnu turu." : undefined}
      />
      {provider === "self" ? (
        <div className="flex flex-col justify-center gap-1 rounded-lg border bg-background px-3 py-2.5 text-sm">
          <span className="font-medium tabular-nums">
            {sceneCount} {sceneCount === 1 ? "scena" : sceneCount >= 2 && sceneCount <= 4 ? "scene" : "scena"}
          </span>
          <span className="text-xs text-muted-foreground">Uređivač scena stiže uskoro.</span>
        </div>
      ) : null}
      {provider === "matterport" || provider === "kuula" ? (
        <>
          <TextField
            name="tour360.url"
            id="f-tour360-url"
            label="Adresa ture"
            type="url"
            inputMode="url"
            autoComplete="off"
            spellCheck={false}
            placeholder={provider === "matterport" ? "https://my.matterport.com/show/?m=…" : "https://kuula.co/share/…"}
          />
          <TextField
            name="tour360.externalId"
            id="f-tour360-externalId"
            label="ID ture"
            autoComplete="off"
            spellCheck={false}
            hint="Opciono, radi evidencije."
          />
        </>
      ) : null}
      {provider !== "none" ? (
        <SwitchField
          name="tour360.published"
          id="f-tour360-published"
          label="Objavljeno na sajtu"
          hint="Kada je isključeno, tura se čuva, ali se ne prikazuje posetiocima."
        />
      ) : null}
    </Group>
  );
}

function Walk3dGroup() {
  return (
    <Group
      title="3D šetnja (Gaussian splat)"
      description="Formati: SPZ, SOG, PLY, SPLAT, KSPLAT ili GLB. Format se prepoznaje iz nastavka adrese."
    >
      <AssetField slot="desktop" />
      <AssetField slot="mobile" />
      <AssetField slot="collision" />
      <PosterField />
      <TextField
        name="walk3d.credits"
        id="f-walk3d-credits"
        label="Autor snimka"
        autoComplete="off"
        counter={{ max: 300 }}
        hint="Autor ili izvor snimka."
      />
      <SwitchField
        name="walk3d.aiGenerated"
        id="f-walk3d-aiGenerated"
        label="Generisano veštačkom inteligencijom"
        hint="Označite ako model nije snimljen u stvarnom prostoru, već je generisan."
      />
      <SwitchField name="walk3d.published" id="f-walk3d-published" label="Objavljeno na sajtu" />
    </Group>
  );
}

function AssetField({ slot }: { slot: Slot }) {
  const { getValues, setValue } = useFormContext<ListingForm>();
  const storageId = useWatch<ListingForm, `walk3d.${Slot}.storageId`>({ name: `walk3d.${slot}.storageId` });

  // A new file: its format may differ and its size and splat count are stale.
  // Only the siblings are written, so the caret in the URL input stays put.
  const onUrlChange = (event: ChangeEvent<HTMLInputElement>) => {
    const detected = detectAssetFormat(event.target.value);
    if (detected !== null && detected !== getValues(`walk3d.${slot}.format`)) {
      setValue(`walk3d.${slot}.format`, detected, DIRTY);
    }
    if (getValues(`walk3d.${slot}.bytes`) !== undefined) setValue(`walk3d.${slot}.bytes`, undefined, DIRTY);
    if (getValues(`walk3d.${slot}.splats`) !== undefined) setValue(`walk3d.${slot}.splats`, undefined, DIRTY);
  };

  if (storageId !== undefined) {
    return (
      <div className="flex min-w-0 flex-col gap-1.5 @lg:col-span-2 @3xl:col-span-3">
        <span className="text-sm font-medium">{SLOT[slot].label}</span>
        <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-background px-3 py-2 text-sm">
          <Upload aria-hidden="true" className="size-4 text-muted-foreground" />
          <span className="min-w-0 flex-1">Otpremljen fajl ({ASSET_FORMAT_LABEL[getValues(`walk3d.${slot}.format`)]})</span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setValue(`walk3d.${slot}`, emptyAsset(getValues(`walk3d.${slot}.format`)), DIRTY)}
          >
            Zameni adresom
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_7.5rem] items-start gap-2 @lg:col-span-2 @3xl:col-span-3">
      <TextField
        name={`walk3d.${slot}.url`}
        id={`f-walk3d-${slot}-url`}
        label={SLOT[slot].label}
        type="url"
        inputMode="url"
        autoComplete="off"
        spellCheck={false}
        placeholder="https://…"
        hint={SLOT[slot].hint}
        onChange={onUrlChange}
      />
      <SelectField
        name={`walk3d.${slot}.format`}
        id={`f-walk3d-${slot}-format`}
        label="Format"
        options={FORMAT_OPTIONS}
      />
    </div>
  );
}

function PosterField() {
  const { setValue } = useFormContext<ListingForm>();
  const posterStorageId = useWatch<ListingForm, "walk3d.posterStorageId">({ name: "walk3d.posterStorageId" });
  if (posterStorageId !== undefined) {
    return (
      <div className="flex min-w-0 flex-col gap-1.5">
        <span className="text-sm font-medium">Naslovna slika šetnje</span>
        <div className="flex items-center gap-2 rounded-lg border bg-background px-3 py-2 text-sm">
          <span className="min-w-0 flex-1">Otpremljena slika</span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setValue("walk3d.posterStorageId", undefined, DIRTY)}
          >
            Zameni adresom
          </Button>
        </div>
      </div>
    );
  }
  return (
    <TextField
      name="walk3d.posterUrl"
      id="f-walk3d-posterUrl"
      label="Naslovna slika šetnje"
      type="url"
      inputMode="url"
      autoComplete="off"
      spellCheck={false}
      placeholder="https://…"
      hint="Prikazuje se dok se model učitava."
    />
  );
}
