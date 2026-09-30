"use client";

import { useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { Plus, Trash2, TriangleAlert } from "lucide-react";
import { useCallback, useMemo } from "react";
import { useController, useFieldArray, useFormContext, useWatch } from "react-hook-form";
import { LocationPicker } from "@/components/admin/listings/location/LocationPicker";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import type { AddressVisibility } from "@/convex/lib/validators";
import { ADDRESS_VISIBILITY_LABEL, POI_KIND_LABEL } from "@/lib/admin/labels";
import { POI_MAX, type ListingForm } from "@/lib/admin/listing-form";
import type { EditorData } from "./editor-context";
import { Group, NumberField, SelectField, TabPanel, TextField, optionsOf } from "./fields";

type LocationNode = FunctionReturnType<typeof api.locations.tree>[number];

const DIRTY = { shouldDirty: true, shouldValidate: true } as const;
const POI_OPTIONS = optionsOf(POI_KIND_LABEL);

const ADDRESS_VISIBILITY_HINT: Record<AddressVisibility, string> = {
  exact: "Ulica i broj se prikazuju na oglasu, a pin stoji tačno na adresi.",
  street: "Adresa se ne prikazuje; pin se zaokružuje na mrežu od ~100 m, pa se kućni broj ne može odrediti.",
  area: "Adresa se ne prikazuje; pin se zaokružuje na mrežu od ~500 m i pokazuje samo kraj.",
};

function byOrder(a: LocationNode, b: LocationNode): number {
  return a.order - b.order || a.name.sr.localeCompare(b.name.sr, "sr-Latn");
}

/** The pin still sits on a place's centroid: nobody has placed it by hand yet. */
function atCentroid(nodes: readonly LocationNode[], lat: number, lng: number): boolean {
  return nodes.some((node) => Math.abs(node.lat - lat) < 1e-7 && Math.abs(node.lng - lng) < 1e-7);
}

export function LocationTab({ data }: { data: EditorData }) {
  const nodes = useQuery(api.locations.tree, {});
  return (
    <TabPanel
      id="panel-lokacija"
      title="Lokacija"
      description="Mesto, adresa i pin. Adresa služi timu; na sajtu se prikazuje onoliko koliko dozvoljava „Prikaz adrese”."
    >
      <PlaceGroup nodes={nodes} data={data} />
      <AddressGroup />
      <PinGroup nodes={nodes} />
      <PoiGroup />
    </TabPanel>
  );
}

function PlaceGroup({ nodes, data }: { nodes: LocationNode[] | undefined; data: EditorData }) {
  const { getValues, setValue } = useFormContext<ListingForm>();
  const [cityId, municipalityId] = useWatch<ListingForm, ["cityId", "municipalityId"]>({
    name: ["cityId", "municipalityId"],
  });
  const byId = useMemo(() => new Map((nodes ?? []).map((node) => [node._id, node])), [nodes]);
  const list = nodes ?? [];

  const cities = list.filter((node) => node.kind === "city").sort(byOrder);
  const municipalities = list.filter((node) => node.kind === "municipality" && node.parentId === cityId).sort(byOrder);
  const municipalityIds = new Set(municipalities.map((node) => node._id));
  const neighborhoods = list
    .filter(
      (node) =>
        node.kind === "neighborhood" &&
        (municipalityId !== ""
          ? node.parentId === municipalityId
          : node.parentId === cityId || (node.parentId !== undefined && municipalityIds.has(node.parentId))),
    )
    .sort(byOrder);

  const toOptions = (items: LocationNode[]) => items.map((node) => ({ value: node._id, label: node.name.sr }));
  // While the tree loads, keep the stored city selectable so the trigger shows a name.
  const cityOptions = cities.length > 0 ? toOptions(cities) : [{ value: cityId, label: "Učitavanje…" }];

  const movePin = (node: LocationNode, onlyIfUnplaced: boolean) => {
    const location = getValues("location");
    if (onlyIfUnplaced && !atCentroid(list, location.lat, location.lng)) return;
    setValue("location", { ...location, lat: node.lat, lng: node.lng }, DIRTY);
  };

  const onCity = (value: string) => {
    if (value === "" || value === getValues("cityId")) return;
    // Option values come from the tree, so they are location ids.
    setValue("cityId", value as Id<"locations">, DIRTY);
    setValue("municipalityId", "", DIRTY);
    setValue("neighborhoodId", "", DIRTY);
    const node = byId.get(value as Id<"locations">);
    if (node !== undefined) movePin(node, false);
  };

  const onMunicipality = (value: string) => {
    setValue("municipalityId", value === "" ? "" : (value as Id<"locations">), DIRTY);
    const neighborhood = getValues("neighborhoodId");
    if (neighborhood !== "" && byId.get(neighborhood)?.parentId !== value) setValue("neighborhoodId", "", DIRTY);
    const node = value === "" ? undefined : byId.get(value as Id<"locations">);
    if (node !== undefined) movePin(node, true);
  };

  const onNeighborhood = (value: string) => {
    setValue("neighborhoodId", value === "" ? "" : (value as Id<"locations">), DIRTY);
    const node = value === "" ? undefined : byId.get(value as Id<"locations">);
    if (node === undefined) return;
    const parent = node.parentId !== undefined ? byId.get(node.parentId) : undefined;
    if (parent?.kind === "municipality" && getValues("municipalityId") !== parent._id) {
      setValue("municipalityId", parent._id, DIRTY);
    }
    movePin(node, true);
  };

  return (
    <Group
      title="Mesto"
      description="Promena grada postavlja pin u centar grada. Izbor opštine ili naselja pomera pin samo dok ga niste sami postavili."
    >
      <SelectField name="cityId" id="f-cityId" label="Grad" options={cityOptions} onValueChange={onCity} />
      <SelectField
        name="municipalityId"
        id="f-municipalityId"
        label="Opština"
        options={toOptions(municipalities)}
        noneLabel="—"
        onValueChange={onMunicipality}
        disabled={nodes === undefined}
      />
      <SelectField
        name="neighborhoodId"
        id="f-neighborhoodId"
        label="Naselje"
        options={toOptions(neighborhoods)}
        noneLabel="—"
        onValueChange={onNeighborhood}
        disabled={nodes === undefined}
      />
      <StoredPlaceNote
        storedId={data.listing.municipalityId}
        currentId={municipalityId}
        byId={byId}
        message={(name) => `Sačuvana opština „${name}” ostaje zapisana dok ne izaberete drugu.`}
      />
      <StoredNeighborhoodNote storedId={data.listing.neighborhoodId} byId={byId} />
    </Group>
  );
}

/**
 * An optional place id cannot be removed through `update` (Convex drops
 * `undefined`), so an emptied select would silently keep the stored place.
 * Say so, and ask for a replacement instead.
 */
function StoredPlaceNote({
  storedId,
  currentId,
  byId,
  message,
}: {
  storedId: Id<"locations"> | undefined;
  currentId: Id<"locations"> | "";
  byId: Map<Id<"locations">, LocationNode>;
  message: (name: string) => string;
}) {
  if (storedId === undefined || currentId !== "") return null;
  const name = byId.get(storedId)?.name.sr;
  if (name === undefined) return null;
  return (
    <p className="flex items-start gap-2 rounded-lg border border-amber-600/30 bg-amber-50 px-3 py-2 text-xs text-amber-950 @lg:col-span-2 @3xl:col-span-3 dark:bg-amber-400/10 dark:text-amber-100">
      <TriangleAlert aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" />
      <span>{message(name)} Jednom sačuvano, ovo polje ne može ostati prazno.</span>
    </p>
  );
}

function StoredNeighborhoodNote({
  storedId,
  byId,
}: {
  storedId: Id<"locations"> | undefined;
  byId: Map<Id<"locations">, LocationNode>;
}) {
  const current = useWatch<ListingForm, "neighborhoodId">({ name: "neighborhoodId" });
  return (
    <StoredPlaceNote
      storedId={storedId}
      currentId={current}
      byId={byId}
      message={(name) => `Sačuvano naselje „${name}” ostaje zapisano dok ne izaberete drugo.`}
    />
  );
}

function AddressGroup() {
  return (
    <Group title="Adresa">
      <TextField name="location.street" id="f-street" label="Ulica" autoComplete="off" />
      <TextField name="location.streetNo" id="f-streetNo" label="Broj" autoComplete="off" inputClassName="tabular-nums" />
      <TextField
        name="location.postalCode"
        id="f-postalCode"
        label="Poštanski broj"
        inputMode="numeric"
        maxLength={5}
        autoComplete="off"
        inputClassName="tabular-nums"
      />
      <AddressVisibilityField />
    </Group>
  );
}

function AddressVisibilityField() {
  const { field } = useController<ListingForm, "location.addressVisibility">({ name: "location.addressVisibility" });
  const options = Object.keys(ADDRESS_VISIBILITY_LABEL) as AddressVisibility[];
  return (
    <fieldset className="min-w-0 @lg:col-span-2 @3xl:col-span-3">
      <legend className="mb-2 text-sm font-medium">Prikaz adrese na sajtu</legend>
      <RadioGroup
        value={field.value}
        onValueChange={(value) => field.onChange(value)}
        className="grid gap-2 @3xl:grid-cols-3"
      >
        {options.map((value) => (
          <Label
            key={value}
            htmlFor={`f-addressVisibility-${value}`}
            className="flex cursor-pointer items-start gap-3 rounded-lg border bg-background p-3 font-normal transition-colors duration-150 hover:bg-muted/50 has-data-[state=checked]:border-primary/60 has-data-[state=checked]:bg-primary/5"
          >
            <RadioGroupItem id={`f-addressVisibility-${value}`} value={value} className="mt-0.5" />
            <span className="grid gap-1">
              <span className="font-medium">{ADDRESS_VISIBILITY_LABEL[value]}</span>
              <span className="text-xs leading-snug text-muted-foreground">{ADDRESS_VISIBILITY_HINT[value]}</span>
            </span>
          </Label>
        ))}
      </RadioGroup>
    </fieldset>
  );
}

function PinGroup({ nodes }: { nodes: LocationNode[] | undefined }) {
  const { getValues, setValue } = useFormContext<ListingForm>();
  const [lat, lng, precision, street, streetNo, cityId] = useWatch<
    ListingForm,
    [
      "location.lat",
      "location.lng",
      "location.addressVisibility",
      "location.street",
      "location.streetNo",
      "cityId",
    ]
  >({
    name: [
      "location.lat",
      "location.lng",
      "location.addressVisibility",
      "location.street",
      "location.streetNo",
      "cityId",
    ],
  });
  const cityName = nodes?.find((node) => node._id === cityId)?.name.sr ?? "";
  const streetLine = [street.trim(), streetNo.trim()].filter((part) => part !== "").join(" ");
  const addressQuery = [streetLine, cityName].filter((part) => part !== "").join(", ");

  const onChange = useCallback(
    (next: { lat: number; lng: number }) => {
      setValue("location", { ...getValues("location"), lat: next.lat, lng: next.lng }, DIRTY);
    },
    [getValues, setValue],
  );

  const onAddressPick = useCallback(
    (hit: { lat: number; lng: number; street?: string; streetNo?: string; postalCode?: string }) => {
      setValue(
        "location",
        {
          ...getValues("location"),
          lat: hit.lat,
          lng: hit.lng,
          ...(hit.street !== undefined ? { street: hit.street } : {}),
          ...(hit.streetNo !== undefined ? { streetNo: hit.streetNo } : {}),
          ...(hit.postalCode !== undefined && /^\d{5}$/.test(hit.postalCode) ? { postalCode: hit.postalCode } : {}),
        },
        DIRTY,
      );
    },
    [getValues, setValue],
  );

  return (
    <Group
      title="Pin na mapi"
      layout="stack"
      description="Kliknite na mapu ili prevucite pin. Pretraga adrese popunjava ulicu, broj i poštanski broj kada ih pronađe."
    >
      <LocationPicker
        lat={lat}
        lng={lng}
        onChange={onChange}
        precision={precision}
        addressQuery={addressQuery}
        onAddressPick={onAddressPick}
      />
      <p className="text-xs text-muted-foreground tabular-nums">
        Koordinate: {lat.toFixed(6)}, {lng.toFixed(6)}
      </p>
    </Group>
  );
}

function PoiGroup() {
  const { control } = useFormContext<ListingForm>();
  const { fields, append, remove } = useFieldArray({ control, name: "poi" });
  const full = fields.length >= POI_MAX;
  return (
    <Group
      title="Mesta u blizini"
      layout="stack"
      description={`Škole, vrtići, prevoz, parkovi, prodavnice i zdravstvo, sa udaljenošću u metrima. Najviše ${POI_MAX}.`}
      actions={
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={full}
          onClick={() => append({ kind: "transit", name: "", distanceM: null })}
        >
          <Plus aria-hidden="true" />
          Dodaj mesto
        </Button>
      }
    >
      {fields.length === 0 ? (
        <p className="text-sm text-muted-foreground">Još nema unetih mesta.</p>
      ) : (
        <ol className="flex flex-col gap-3">
          {fields.map((item, index) => (
            <li
              key={item.id}
              className="grid items-start gap-3 rounded-lg border bg-background p-3 @xl:grid-cols-[10rem_minmax(0,1fr)_9rem_auto]"
            >
              <SelectField name={`poi.${index}.kind`} id={`f-poi-${index}-kind`} label="Vrsta" options={POI_OPTIONS} />
              <TextField
                name={`poi.${index}.name`}
                id={`f-poi-${index}-name`}
                label="Naziv"
                placeholder="npr. osnovna škola, stanica GSP-a"
                autoComplete="off"
              />
              <NumberField
                name={`poi.${index}.distanceM`}
                id={`f-poi-${index}-distance`}
                label="Udaljenost"
                unit="m"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="self-end text-muted-foreground hover:text-destructive"
                aria-label={`Ukloni mesto ${index + 1}`}
                onClick={() => remove(index)}
              >
                <Trash2 aria-hidden="true" />
              </Button>
            </li>
          ))}
        </ol>
      )}
      {full ? <p className="text-xs text-muted-foreground">Dostignut je najveći broj mesta ({POI_MAX}).</p> : null}
    </Group>
  );
}
