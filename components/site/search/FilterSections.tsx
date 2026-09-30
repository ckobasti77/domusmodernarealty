"use client";

import { useLocale, useTranslations } from "next-intl";
import type { Locale } from "@/i18n/routing";
import { formatArea, formatPrice } from "@/lib/format";
import type { LocationIndex } from "@/lib/search-locations";
import {
  ADDED_OPTIONS,
  CONSTRUCTION_OPTIONS,
  FLOOR_OPTIONS,
  HEATING_OPTIONS,
  PROPERTY_TYPES,
  ROOM_OPTIONS,
  TOGGLE_KEYS,
  floorToNum,
  type AddedWithin,
  type FloorValue,
  type SearchState,
  type ToggleKey,
} from "@/lib/search-params";
import { floorText, roomsLong, roomsShort } from "@/lib/search-text";
import { ChipToggle, CheckRow, FilterSection, Segmented } from "./controls";
import { LocationPicker } from "./LocationPicker";
import { RangeField } from "./RangeField";
import { useSearchTranslators } from "./useSearchTranslators";

/**
 * Every PRD A3 filter as a self-contained section. The desktop popovers, the
 * "Svi filteri" drawer and the phone sheet compose the same sections, so a
 * filter behaves identically wherever it appears. Each section receives the
 * current state and reports the next one; the host decides whether that
 * reaches the URL at once (desktop) or waits for "Prikaži" (phone sheet).
 */
export type SectionProps = {
  state: SearchState;
  onChange: (next: SearchState) => void;
};

/** Slider stops: dense where Belgrade prices cluster, sparse above. */
const SALE_PRICE_STOPS = [
  0, 25_000, 50_000, 75_000, 100_000, 125_000, 150_000, 175_000, 200_000, 250_000, 300_000, 350_000, 400_000,
  500_000, 600_000, 750_000, 1_000_000, 1_500_000, 2_000_000, 3_000_000, 5_000_000,
] as const;
const RENT_PRICE_STOPS = [
  0, 200, 300, 400, 500, 600, 700, 800, 1_000, 1_200, 1_500, 2_000, 2_500, 3_000, 4_000, 5_000, 7_500, 10_000,
] as const;
const AREA_STOPS = [0, 20, 30, 40, 50, 60, 70, 80, 90, 100, 120, 150, 200, 250, 300, 400, 500, 1_000] as const;

function toggleIn<T>(list: readonly T[], value: T): T[] {
  return list.includes(value) ? list.filter((item) => item !== value) : [...list, value];
}

export function TransactionSection({ state, onChange, tone = "light" }: SectionProps & { tone?: "light" | "dark" }) {
  const t = useTranslations("filters");
  return (
    <FilterSection legend={t("transaction")}>
      <Segmented
        name="transaction"
        tone={tone}
        value={state.transaction}
        options={[
          { value: "sale", label: t("sale") },
          { value: "rent", label: t("rent") },
        ]}
        // Rent and sale prices differ by three orders of magnitude, so a price
        // range never survives a switch; everything else does.
        onChange={(transaction) => {
          const next: SearchState = { ...state, transaction };
          delete next.priceMin;
          delete next.priceMax;
          onChange(next);
        }}
      />
    </FilterSection>
  );
}

export function LocationSection({ state, onChange, index }: SectionProps & { index: LocationIndex }) {
  const t = useTranslations("filters");
  return (
    <FilterSection legend={t("location")}>
      <LocationPicker
        index={index}
        transaction={state.transaction}
        selected={state.locations}
        onChange={(locations) => onChange({ ...state, locations })}
      />
    </FilterSection>
  );
}

export function TypeSection({ state, onChange }: SectionProps) {
  const t = useTranslations("filters");
  const tListing = useTranslations("listing");
  return (
    <FilterSection legend={t("propertyType")}>
      <div className="flex flex-wrap gap-2">
        {PROPERTY_TYPES.map((type) => (
          <ChipToggle
            key={type}
            pressed={state.types.includes(type)}
            onClick={() => onChange({ ...state, types: toggleIn(state.types, type) })}
            data-testid={`type-${type}`}
          >
            {tListing(`propertyType.${type}`)}
          </ChipToggle>
        ))}
      </div>
    </FilterSection>
  );
}

export function PriceSection({ state, onChange }: SectionProps) {
  const t = useTranslations("filters");
  const tUnits = useTranslations("units");
  const locale = useLocale() as Locale;
  const stops = state.transaction === "rent" ? RENT_PRICE_STOPS : SALE_PRICE_STOPS;
  return (
    <FilterSection legend={t("price")}>
      <RangeField
        testId="price-range"
        labels={{ min: t("priceFrom"), max: t("priceTo"), from: t("from"), to: t("to") }}
        min={state.priceMin}
        max={state.priceMax}
        stops={stops}
        unit={state.transaction === "rent" ? `€ ${tUnits("perMonth")}` : "€"}
        format={(value) => formatPrice(value, locale)}
        onCommit={(priceMin, priceMax) => {
          const next: SearchState = { ...state };
          delete next.priceMin;
          delete next.priceMax;
          onChange({ ...next, ...(priceMin !== undefined ? { priceMin } : {}), ...(priceMax !== undefined ? { priceMax } : {}) });
        }}
      />
    </FilterSection>
  );
}

export function AreaSection({ state, onChange }: SectionProps) {
  const t = useTranslations("filters");
  const tUnits = useTranslations("units");
  const locale = useLocale() as Locale;
  return (
    <FilterSection legend={t("area")}>
      <RangeField
        testId="area-range"
        labels={{ min: t("areaFrom"), max: t("areaTo"), from: t("from"), to: t("to") }}
        min={state.areaMin}
        max={state.areaMax}
        stops={AREA_STOPS}
        unit={tUnits("m2")}
        format={(value) => formatArea(value, locale, tUnits("m2"))}
        onCommit={(areaMin, areaMax) => {
          const next: SearchState = { ...state };
          delete next.areaMin;
          delete next.areaMax;
          onChange({ ...next, ...(areaMin !== undefined ? { areaMin } : {}), ...(areaMax !== undefined ? { areaMax } : {}) });
        }}
      />
    </FilterSection>
  );
}

export function RoomsSection({ state, onChange }: SectionProps) {
  const t = useTranslations("filters");
  const translators = useSearchTranslators();
  const locale = useLocale() as Locale;
  return (
    <FilterSection legend={t("rooms")}>
      <div className="flex flex-wrap gap-2">
        {ROOM_OPTIONS.map((rooms) => (
          <ChipToggle
            key={rooms}
            pressed={state.rooms.includes(rooms)}
            aria-label={roomsLong(translators, rooms)}
            title={roomsLong(translators, rooms)}
            onClick={() => onChange({ ...state, rooms: toggleIn(state.rooms, rooms).sort((a, b) => a - b) })}
            data-testid={`rooms-${rooms}`}
            className="px-3"
          >
            <span data-numeric>{roomsShort(rooms, locale)}</span>
          </ChipToggle>
        ))}
      </div>
    </FilterSection>
  );
}

const SELECT = [
  "h-11 w-full appearance-none border-0 border-b border-stone-text bg-transparent pr-8 font-sans text-body text-ink",
  "focus:border-ink focus-visible:outline-none",
].join(" ");

function FloorSelect({
  label,
  value,
  onChange,
  testId,
}: {
  label: string;
  value?: FloorValue;
  onChange: (value: FloorValue | undefined) => void;
  testId: string;
}) {
  const t = useTranslations("filters");
  const translators = useSearchTranslators();
  const locale = useLocale() as Locale;
  return (
    <label className="relative flex flex-col gap-1">
      <span className="font-sans text-label uppercase tracking-[0.12em] text-stone-text">{label}</span>
      <select
        value={value === undefined ? "" : String(value)}
        onChange={(event) => {
          const raw = event.target.value;
          if (raw.length === 0) return onChange(undefined);
          const numeric = Number(raw);
          onChange(Number.isFinite(numeric) ? numeric : (raw as FloorValue));
        }}
        data-testid={testId}
        className={SELECT}
      >
        <option value="">{t("floorAny")}</option>
        {FLOOR_OPTIONS.map((option) => (
          <option key={option} value={String(option)}>
            {floorText(translators, option, locale)}
          </option>
        ))}
      </select>
      <span
        aria-hidden="true"
        className="pointer-events-none absolute bottom-4 right-1 size-2 rotate-45 border-b border-r border-stone-text"
      />
    </label>
  );
}

export function FloorSection({ state, onChange }: SectionProps) {
  const t = useTranslations("filters");
  const setFloor = (key: "floorMin" | "floorMax", value: FloorValue | undefined) => {
    const next: SearchState = { ...state };
    delete next[key];
    if (value !== undefined) next[key] = value;
    // Keep min ≤ max: moving one past the other drags the other along.
    if (next.floorMin !== undefined && next.floorMax !== undefined && floorToNum(next.floorMin) > floorToNum(next.floorMax)) {
      if (key === "floorMin") next.floorMax = next.floorMin;
      else next.floorMin = next.floorMax;
    }
    onChange(next);
  };
  return (
    <FilterSection legend={t("floor")}>
      <div className="grid grid-cols-2 gap-6">
        <FloorSelect label={t("floorFrom")} value={state.floorMin} onChange={(value) => setFloor("floorMin", value)} testId="floor-min" />
        <FloorSelect label={t("floorTo")} value={state.floorMax} onChange={(value) => setFloor("floorMax", value)} testId="floor-max" />
      </div>
      <div className="mt-3 grid gap-x-6 sm:grid-cols-2">
        <CheckRow
          checked={state.notGround}
          onChange={(notGround) => onChange({ ...state, notGround })}
          label={t("notGround")}
          testId="floor-not-ground"
        />
        <CheckRow
          checked={state.notTop}
          onChange={(notTop) => onChange({ ...state, notTop })}
          label={t("notTop")}
          testId="floor-not-top"
        />
      </div>
    </FilterSection>
  );
}

export function HeatingSection({ state, onChange }: SectionProps) {
  const t = useTranslations("filters");
  const tListing = useTranslations("listing");
  return (
    <FilterSection legend={t("heating")}>
      <div className="flex flex-wrap gap-2">
        {HEATING_OPTIONS.map((heating) => (
          <ChipToggle
            key={heating}
            pressed={state.heating.includes(heating)}
            onClick={() => onChange({ ...state, heating: toggleIn(state.heating, heating) })}
            data-testid={`heating-${heating}`}
          >
            {tListing(`heatingValue.${heating}`)}
          </ChipToggle>
        ))}
      </div>
    </FilterSection>
  );
}

export function ConstructionSection({ state, onChange }: SectionProps) {
  const t = useTranslations("filters");
  const tListing = useTranslations("listing");
  return (
    <FilterSection legend={t("construction")}>
      <div className="flex flex-wrap gap-2">
        {CONSTRUCTION_OPTIONS.map((construction) => (
          <ChipToggle
            key={construction}
            pressed={state.construction.includes(construction)}
            onClick={() => onChange({ ...state, construction: toggleIn(state.construction, construction) })}
            data-testid={`construction-${construction}`}
          >
            {tListing(`construction.${construction}`)}
          </ChipToggle>
        ))}
      </div>
    </FilterSection>
  );
}

export function FeaturesSection({ state, onChange }: SectionProps) {
  const t = useTranslations("filters");
  return (
    <FilterSection legend={t("features")}>
      <div className="grid gap-x-6 sm:grid-cols-2">
        {TOGGLE_KEYS.map((key: ToggleKey) => (
          <CheckRow
            key={key}
            checked={state.toggles.includes(key)}
            onChange={() => onChange({ ...state, toggles: toggleIn(state.toggles, key) })}
            label={t(`toggle.${key}`)}
            testId={`toggle-${key}`}
          />
        ))}
      </div>
    </FilterSection>
  );
}

export function AddedSection({ state, onChange }: SectionProps) {
  const t = useTranslations("filters");
  type Choice = AddedWithin | "any";
  return (
    <FilterSection legend={t("addedWithin")}>
      <Segmented<Choice>
        name="added"
        value={state.added ?? "any"}
        options={[
          { value: "any", label: t("added.any") },
          ...ADDED_OPTIONS.map((value) => ({ value, label: t(`added.${value}`) })),
        ]}
        onChange={(value) => {
          const next: SearchState = { ...state };
          delete next.added;
          onChange(value === "any" ? next : { ...next, added: value });
        }}
        className="[&_span]:normal-case [&_span]:tracking-normal"
      />
    </FilterSection>
  );
}
