"use client";

import { Info, Trash2 } from "lucide-react";
import { useFormContext, useWatch } from "react-hook-form";
import { Button } from "@/components/ui/button";
import type { Id } from "@/convex/_generated/dataModel";
import { TOUR_LIMITS } from "@/convex/lib/tours";
import { TOUR_PROVIDER_LABEL, type TourProvider } from "@/lib/admin/labels";
import { EMPTY_SPAWN, EMPTY_TOUR360, type ListingForm } from "@/lib/admin/listing-form";
import type { EditorData } from "./editor-context";
import { Group, SelectField, SwitchField, TabPanel, TextField, optionsOf, type FieldName } from "./fields";
import { AssetField, PosterField } from "./tours/AssetField";
import { DecimalField } from "./tours/DecimalField";
import { ExternalTourFields } from "./tours/ExternalTourFields";
import { FloorPlanEditor, usePlanView } from "./tours/FloorPlanEditor";
import { HotspotsField } from "./tours/HotspotsField";
import { viewCenter } from "./tours/plan-geometry";
import { PolygonJson } from "./tours/PolygonJson";
import { ScenesEditor } from "./tours/ScenesEditor";

const DIRTY = { shouldDirty: true, shouldValidate: true } as const;
const PROVIDER_OPTIONS = [{ value: "none", label: "Nema" }, ...optionsOf(TOUR_PROVIDER_LABEL)];
const SPAWN_FIELDS: FieldName[] = ["walk3d.spawn.x", "walk3d.spawn.y", "walk3d.spawn.z", "walk3d.spawn.yaw"];

/** The other three start-point fields, validated together with each one. */
function spawnDeps(name: FieldName): FieldName[] {
  return SPAWN_FIELDS.filter((field) => field !== name);
}

export function ToursTab({ data }: { data: EditorData }) {
  return (
    <TabPanel
      id="panel-3d"
      title="360° / 3D"
      description="Virtuelna tura i 3D šetnja kroz prostor. Nekretnina dobija oznaku „360°” tek kada je bar jedno od ovoga objavljeno."
    >
      <Tour360Group listingId={data.listing._id} />
      <Walk3dModelsGroup />
      <Walk3dMotionGroup />
    </TabPanel>
  );
}

function Tour360Group({ listingId }: { listingId: Id<"listings"> }) {
  const { getValues, setValue } = useFormContext<ListingForm>();
  const [provider, published] = useWatch<ListingForm, ["tour360.provider", "tour360.published"]>({
    name: ["tour360.provider", "tour360.published"],
  });

  const onProvider = (value: string) => {
    if (value === "none") {
      // "Nema" removes the tour (toursAdmin.setTour360 without a tour); scenes stay stored.
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
        hint={
          provider === "none"
            ? "Nekretnina nema virtuelnu turu."
            : provider === "self"
              ? "Panorame koje snimi agencija, sa strelicama između prostorija."
              : "Tura sa spoljnog servisa, ugrađena u stranicu oglasa."
        }
      />
      {provider !== "none" ? (
        <SwitchField
          name="tour360.published"
          id="f-tour360-published"
          label="Objavljeno na sajtu"
          hint="Kada je isključeno, tura se čuva, ali se ne prikazuje posetiocima."
          className="@3xl:col-span-2"
        />
      ) : null}
      {provider === "self" ? (
        <div className="min-w-0 @lg:col-span-2 @3xl:col-span-3">
          <ScenesEditor listingId={listingId} published={published} />
        </div>
      ) : null}
      {provider === "matterport" || provider === "kuula" ? <ExternalTourFields provider={provider} /> : null}
    </Group>
  );
}

function Walk3dModelsGroup() {
  return (
    <Group
      title="3D šetnja (Gaussian splat)"
      description={
        <>
          Formati: SPZ, SOG (zip ili raspakovan, adresa do meta.json), PLY, SPLAT, KSPLAT ili GLB; format se prepoznaje iz
          nastavka. Adrese moraju biti na serveru d28zzqy0iyovbz.cloudfront.net ili storage.googleapis.com. Fajlove veće od
          50 MB postavite na Cloudflare R2 i unesite adresu: otpremanje u Convex prekida se posle 2 minuta.
        </>
      }
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
        hint="Autor ili izvor snimka; kod CC BY licence obavezno sa vezom."
      />
      <div className="flex min-w-0 flex-col gap-3">
        <SwitchField
          name="walk3d.aiGenerated"
          id="f-walk3d-aiGenerated"
          label="Generisano veštačkom inteligencijom"
          hint="Označite ako model nije snimljen u stvarnom prostoru, već je generisan."
        />
        <SwitchField
          name="walk3d.published"
          id="f-walk3d-published"
          label="Objavljeno na sajtu"
          hint="Za objavu je potreban model za računar."
        />
      </div>
    </Group>
  );
}

function Walk3dMotionGroup() {
  const { setValue } = useFormContext<ListingForm>();
  const spawn = useWatch<ListingForm, "walk3d.spawn">({ name: "walk3d.spawn" });
  const hasSpawn = Object.values(spawn).some((value) => value !== null);
  const plan = usePlanView();

  return (
    <Group
      title="Kretanje kroz 3D šetnju"
      layout="stack"
      description={
        <p className="flex items-start gap-2">
          <Info aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" />
          <span>
            Sve vrednosti su u jedinicama modela. Osa Y je uvis, a pod je na visini y početne tačke; x i z leže na podu.
            Ugao 0° gleda ka −Z, a pozitivan ugao okreće ulevo (suprotno kazaljci na satu, gledano odozgo).
          </span>
        </p>
      }
    >
      <div className="grid min-w-0 gap-4 @2xl:grid-cols-[minmax(0,12rem)_minmax(0,1fr)]">
        <DecimalField
          name="walk3d.eyeHeight"
          id="f-walk3d-eyeHeight"
          label="Visina pogleda"
          unit="j."
          signed={false}
          placeholder="npr. 2,77"
          hint={`1,6 m × jedinica po metru modela (npr. 1,73 j/m → 2,77). Od ${TOUR_LIMITS.eyeHeight.min} do ${TOUR_LIMITS.eyeHeight.max}.`}
        />
        <div role="group" aria-labelledby="walk3d-spawn-title" className="flex min-w-0 flex-col gap-2">
          <div className="flex min-h-7 flex-wrap items-center justify-between gap-2">
            <span id="walk3d-spawn-title" className="text-sm font-medium">
              Početna tačka
            </span>
            {hasSpawn ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setValue("walk3d.spawn", { ...EMPTY_SPAWN }, DIRTY)}
              >
                <Trash2 aria-hidden="true" />
                Ukloni početnu tačku
              </Button>
            ) : null}
          </div>
          <div className="grid grid-cols-2 gap-2 @xl:grid-cols-4">
            <DecimalField name="walk3d.spawn.x" id="f-walk3d-spawn-x" label="x" deps={spawnDeps("walk3d.spawn.x")} />
            <DecimalField
              name="walk3d.spawn.y"
              id="f-walk3d-spawn-y"
              label="y (pod)"
              deps={spawnDeps("walk3d.spawn.y")}
            />
            <DecimalField name="walk3d.spawn.z" id="f-walk3d-spawn-z" label="z" deps={spawnDeps("walk3d.spawn.z")} />
            <DecimalField
              name="walk3d.spawn.yaw"
              id="f-walk3d-spawn-yaw"
              label="Smer"
              angle
              deps={spawnDeps("walk3d.spawn.yaw")}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Gde posetilac stoji i kuda gleda kada se šetnja otvori. Tačku i smer možete i da prevučete na tlocrtu.
          </p>
        </div>
      </div>
      <div className="flex min-w-0 flex-col gap-2">
        <h4 className="text-sm font-medium">Tlocrt poda</h4>
        <FloorPlanEditor view={plan.view} onFit={plan.fit} />
      </div>
      <PolygonJson />
      <HotspotsField center={viewCenter(plan.view)} />
    </Group>
  );
}
