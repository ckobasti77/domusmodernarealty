"use client";

import { Plus, X } from "lucide-react";
import { useState, type KeyboardEvent } from "react";
import { useController, useWatch } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FEATURE_KEYS } from "@/convex/lib/validators";
import {
  CONDITION_LABEL,
  CONSTRUCTION_LABEL,
  ENERGY_CLASSES,
  FEATURE_LABEL,
  FLOOR_LABEL,
  FURNISHING_LABEL,
  HEATING_LABEL,
  ORIENTATION_LABEL,
  PARKING_LABEL,
  type FloorLabel,
} from "@/lib/admin/labels";
import { VIEW_TAGS_MAX, structureName, type ListingForm } from "@/lib/admin/listing-form";
import {
  DateField,
  Field,
  Group,
  NumberField,
  SelectField,
  SwitchField,
  TabPanel,
  ToggleGroupField,
  describedBy,
  optionsOf,
  useFieldError,
} from "./fields";

const CONSTRUCTION_OPTIONS = optionsOf(CONSTRUCTION_LABEL);
const CONDITION_OPTIONS = optionsOf(CONDITION_LABEL);
const FURNISHING_OPTIONS = optionsOf(FURNISHING_LABEL);
const HEATING_OPTIONS = optionsOf(HEATING_LABEL);
const PARKING_OPTIONS = optionsOf(PARKING_LABEL);
const ORIENTATION_OPTIONS = optionsOf(ORIENTATION_LABEL);
const ENERGY_OPTIONS = ENERGY_CLASSES.map((value) => ({ value, label: value }));
const FLOOR_LABELS = Object.keys(FLOOR_LABEL) as FloorLabel[];
const FLOOR_NUMBERS = Array.from({ length: 40 }, (_, index) => index + 1);

export function FeaturesTab() {
  const [propertyType, constructionType] = useWatch<ListingForm, ["propertyType", "constructionType"]>({
    name: ["propertyType", "constructionType"],
  });
  const hasPlot = propertyType === "house" || propertyType === "land" || propertyType === "cottage";
  const roomsOptional = propertyType === "land" || propertyType === "garage";

  return (
    <TabPanel
      id="panel-karakteristike"
      title="Karakteristike"
      description="Kvadratura i struktura su obavezne za objavu (čl. 18 Zakona o posredovanju); ostalo pomaže pretrazi i filterima."
    >
      <Group title="Površine">
        <NumberField name="areaM2" id="f-areaM2" label="Kvadratura" unit="m²" hint="Korisna površina koja se oglašava." />
        <NumberField
          name="registeredAreaM2"
          id="f-registeredAreaM2"
          label="Površina u katastru"
          unit="m²"
          hint="Ako se razlikuje od oglašene."
        />
        {hasPlot ? <NumberField name="plotAreaM2" id="f-plotAreaM2" label="Površina placa" unit="m²" /> : null}
        <NumberField
          name="outdoorAreaM2"
          id="f-outdoorAreaM2"
          label="Terase i spoljni prostor"
          unit="m²"
        />
      </Group>

      <Group title="Struktura">
        <NumberField
          name="rooms"
          id="f-rooms"
          label="Broj soba"
          native
          step={0.5}
          min={0}
          max={20}
          hint={<RoomsHint optional={roomsOptional} />}
        />
        <NumberField name="bedrooms" id="f-bedrooms" label="Spavaće sobe" native step={1} min={0} max={50} />
        <NumberField name="bathrooms" id="f-bathrooms" label="Kupatila" native step={1} min={0} max={50} />
      </Group>

      <Group title="Sprat">
        <FloorField />
        <NumberField
          name="totalFloors"
          id="f-totalFloors"
          label="Ukupno spratova"
          native
          step={1}
          min={0}
          max={200}
          deps={["floor"]}
        />
        <SwitchField name="isDuplex" id="f-isDuplex" label="Dupleks" />
        <SwitchField name="isPenthouse" id="f-isPenthouse" label="Penthaus" />
      </Group>

      <Group title="Gradnja">
        <SelectField name="constructionType" id="f-constructionType" label="Vrsta gradnje" options={CONSTRUCTION_OPTIONS} />
        <NumberField
          name="yearBuilt"
          id="f-yearBuilt"
          label="Godina izgradnje"
          native
          step={1}
          min={1800}
          max={2100}
          deps={["renovatedYear"]}
        />
        <NumberField
          name="renovatedYear"
          id="f-renovatedYear"
          label="Godina renoviranja"
          native
          step={1}
          min={1800}
          max={2100}
        />
        {constructionType === "under_construction" ? (
          <DateField name="completionDate" id="f-completionDate" label="Planirani završetak" />
        ) : null}
      </Group>

      <Group title="Stanje i opremljenost">
        <SelectField name="condition" id="f-condition" label="Stanje" options={CONDITION_OPTIONS} />
        <SelectField name="furnishing" id="f-furnishing" label="Nameštenost" options={FURNISHING_OPTIONS} />
        <SelectField
          name="energyClass"
          id="f-energyClass"
          label="Energetski razred"
          options={ENERGY_OPTIONS}
          noneLabel="—"
          hint="Iz energetskog pasoša, ako postoji."
        />
      </Group>

      <Group title="Grejanje, parking i okruženje" layout="stack">
        <ToggleGroupField name="heating" legend="Grejanje" options={HEATING_OPTIONS} />
        <ToggleGroupField name="parking" legend="Parking" options={PARKING_OPTIONS} />
        <ToggleGroupField name="orientation" legend="Orijentacija" options={ORIENTATION_OPTIONS} />
        <ViewTagsField />
      </Group>

      <Group title="Pogodnosti" layout="stack">
        <FeatureChecklist />
      </Group>

      <Group title="Useljenje">
        <DateField
          name="availableFrom"
          id="f-availableFrom"
          label="Useljivo od"
          hint="Ostavite prazno ako je useljivo odmah."
        />
        <SwitchField name="swapPossible" id="f-swapPossible" label="Zamena moguća" hint="Prodavac razmatra zamenu." />
      </Group>
    </TabPanel>
  );
}

function RoomsHint({ optional }: { optional: boolean }) {
  const rooms = useWatch<ListingForm, "rooms">({ name: "rooms" });
  const name = structureName(rooms);
  if (name !== null) return <>Struktura: {name}. Koraci od 0,5 (0,5 = garsonjera).</>;
  return <>{optional ? "Nije obavezno za ovaj tip." : "Koraci od 0,5 (npr. 2,5 = dvoiposoban)."}</>;
}

/** One select for the union: Serbian floor labels, then storeys 1–40. */
function FloorField() {
  const { field } = useController<ListingForm, "floor">({ name: "floor", rules: { deps: ["totalFloors"] } });
  const error = useFieldError("floor");
  const value = String(field.value);
  const extra =
    typeof field.value === "number" && !FLOOR_NUMBERS.includes(field.value) ? [field.value] : [];
  return (
    <Field id="f-floor" label="Sprat" error={error}>
      <Select
        value={value}
        onValueChange={(next) => {
          const label = FLOOR_LABELS.find((item) => item === next);
          field.onChange(label ?? Number(next));
        }}
      >
        <SelectTrigger
          id="f-floor"
          onBlur={field.onBlur}
          className="w-full"
          aria-invalid={error !== undefined ? true : undefined}
          aria-describedby={describedBy("f-floor", false, error !== undefined)}
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent position="popper" className="max-h-80">
          <SelectGroup>
            <SelectLabel>Oznake</SelectLabel>
            {FLOOR_LABELS.map((label) => (
              <SelectItem key={label} value={label}>
                {label} — {FLOOR_LABEL[label]}
              </SelectItem>
            ))}
          </SelectGroup>
          <SelectGroup>
            <SelectLabel>Spratovi</SelectLabel>
            {[...extra, ...FLOOR_NUMBERS].map((floor) => (
              <SelectItem key={floor} value={String(floor)}>
                {floor}. sprat
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
    </Field>
  );
}

function FeatureChecklist() {
  return (
    <fieldset className="min-w-0">
      <legend className="sr-only">Pogodnosti</legend>
      <div className="grid gap-1 @md:grid-cols-2 @2xl:grid-cols-3">
        {FEATURE_KEYS.map((feature) => (
          <FeatureCheckbox key={feature} feature={feature} />
        ))}
      </div>
    </fieldset>
  );
}

function FeatureCheckbox({ feature }: { feature: (typeof FEATURE_KEYS)[number] }) {
  const { field } = useController<ListingForm, `features.${typeof feature}`>({ name: `features.${feature}` });
  const id = `f-feature-${feature}`;
  return (
    <div className="flex items-center gap-2.5 rounded-md px-2 py-1.5 transition-colors duration-150 hover:bg-muted/60">
      <Checkbox
        id={id}
        checked={field.value === true}
        onCheckedChange={(checked) => field.onChange(checked === true)}
        onBlur={field.onBlur}
      />
      <Label htmlFor={id} className="font-normal">
        {FEATURE_LABEL[feature]}
      </Label>
    </div>
  );
}

/** Free-text view tags ("park", "reka"), at most six. */
function ViewTagsField() {
  const { field } = useController<ListingForm, "view">({ name: "view" });
  const error = useFieldError("view");
  const [draft, setDraft] = useState("");
  const tags = field.value;
  const full = tags.length >= VIEW_TAGS_MAX;

  const add = () => {
    const tag = draft.trim().slice(0, 40);
    setDraft("");
    if (tag === "" || full || tags.some((item) => item.toLocaleLowerCase("sr") === tag.toLocaleLowerCase("sr"))) return;
    field.onChange([...tags, tag]);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter" || event.key === ",") {
      event.preventDefault();
      add();
    } else if (event.key === "Backspace" && draft === "" && tags.length > 0) {
      field.onChange(tags.slice(0, -1));
    }
  };

  const hint = `Npr. park, reka, grad. Enter dodaje oznaku; najviše ${VIEW_TAGS_MAX}.`;
  return (
    <Field id="f-view" label="Pogled" hint={hint} error={error}>
      {tags.length > 0 ? (
        <ul className="flex flex-wrap gap-1.5" aria-label="Oznake pogleda">
          {tags.map((tag) => (
            <li
              key={tag}
              className="inline-flex items-center gap-1 rounded-full border bg-muted/60 py-0.5 pr-1 pl-2.5 text-xs"
            >
              {tag}
              <button
                type="button"
                className="inline-flex size-5 items-center justify-center rounded-full text-muted-foreground transition-colors duration-150 hover:bg-background hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
                aria-label={`Ukloni oznaku „${tag}”`}
                onClick={() => field.onChange(tags.filter((item) => item !== tag))}
              >
                <X aria-hidden="true" className="size-3" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      <div className="flex gap-2">
        <Input
          id="f-view"
          value={draft}
          maxLength={40}
          disabled={full}
          placeholder={full ? "Dostignut je najveći broj oznaka" : "Dodajte oznaku"}
          aria-describedby={describedBy("f-view", true, error !== undefined)}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={onKeyDown}
          onBlur={field.onBlur}
        />
        <Button type="button" variant="outline" onClick={add} disabled={full || draft.trim() === ""}>
          <Plus aria-hidden="true" />
          Dodaj
        </Button>
      </div>
    </Field>
  );
}
