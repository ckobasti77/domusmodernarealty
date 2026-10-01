"use client";

import { useLocale, useTranslations } from "next-intl";
import type { FieldErrors, UseFormRegister } from "react-hook-form";
import { SelectField, TextField } from "@/components/site/Field";
import { displayFloor } from "@/components/site/listing/floor";
import type { Locale } from "@/i18n/routing";
import { roomsKey } from "@/lib/listing-text";
import {
  CONDITIONS,
  FLOOR_CHOICES,
  floorFromChoice,
  PROPERTY_TYPES,
  ROOM_CHOICES,
  TOP_FLOOR_CHOICES,
  type PropertyInput,
} from "./schema";
import type { LocationGroup } from "./types";

/**
 * Step 1, "Nekretnina": where, what, how big, which floor, what state. Ten
 * questions in a two-column grid of underline controls; the four optional ones
 * say so in their label. Rooms and floor (and with them the building's top
 * floor and lift) are not asked for a plot or a garage (`layout` false).
 *
 * Floors use the listing pages' words (Suteren, Prizemlje, Potkrovlje…) and
 * their numbering: Russian counts the ground floor as the first, so every
 * numbered option is shown one higher in `ru` (components/site/listing/floor.ts).
 */
export function PropertyFields({
  groups,
  layout,
  register,
  errors,
}: {
  groups: readonly LocationGroup[];
  layout: boolean;
  register: UseFormRegister<PropertyInput>;
  errors: FieldErrors<PropertyInput>;
}) {
  const locale = useLocale() as Locale;
  const t = useTranslations("valuation");
  const tForms = useTranslations("forms");
  const tListing = useTranslations("listing");
  const tUnits = useTranslations("units");
  const optional = (label: string) => `${label} (${tForms("optional")})`;

  const floorLabel = (choice: string) => {
    const floor = floorFromChoice(choice);
    if (floor === undefined) return choice;
    if (typeof floor === "string") return tListing(`floorValue.${floor}`);
    return t("fields.floorNumber", { floor: Number(displayFloor(floor, locale)) });
  };
  const roomLabel = (rooms: number) => {
    const key = roomsKey(rooms);
    return key !== null ? tListing(`structure.${key}`) : tUnits("rooms", { count: rooms });
  };

  return (
    <div className="grid gap-x-8 gap-y-6 sm:grid-cols-2">
      <SelectField label={t("fields.location")} error={errors.locationId?.message} {...register("locationId")}>
        <option value="" disabled>
          {t("fields.locationPlaceholder")}
        </option>
        {groups.map((group) => (
          <optgroup key={group.label} label={group.label} lang={group.lang}>
            {group.options.map((option) => (
              <option key={option.id} value={option.id} disabled={option.disabled} lang={option.lang}>
                {option.label}
              </option>
            ))}
          </optgroup>
        ))}
      </SelectField>

      <SelectField label={t("fields.propertyType")} error={errors.propertyType?.message} {...register("propertyType")}>
        {PROPERTY_TYPES.map((type) => (
          <option key={type} value={type}>
            {tListing(`propertyType.${type}`)}
          </option>
        ))}
      </SelectField>

      <TextField
        label={t("fields.area")}
        inputMode="decimal"
        autoComplete="off"
        error={errors.area?.message}
        {...register("area")}
      />

      {layout ? (
        <SelectField label={t("fields.rooms")} error={errors.rooms?.message} {...register("rooms")}>
          <option value="" disabled>
            {t("fields.roomsPlaceholder")}
          </option>
          {ROOM_CHOICES.map((rooms) => (
            <option key={rooms} value={String(rooms)}>
              {roomLabel(rooms)}
            </option>
          ))}
        </SelectField>
      ) : null}

      {layout ? (
        <SelectField label={t("fields.floor")} error={errors.floor?.message} {...register("floor")}>
          <option value="" disabled>
            {t("fields.floorPlaceholder")}
          </option>
          {FLOOR_CHOICES.map((choice) => (
            <option key={choice} value={choice}>
              {floorLabel(choice)}
            </option>
          ))}
        </SelectField>
      ) : null}

      {layout ? (
        // No "(optional)" on the two optional selects: their "Not specified" default says it.
        <SelectField label={t("fields.totalFloors")} error={errors.totalFloors?.message} {...register("totalFloors")}>
          <option value="">{t("fields.notSpecified")}</option>
          {TOP_FLOOR_CHOICES.map((choice) => (
            <option key={choice} value={choice}>
              {floorLabel(choice === "0" ? "PR" : choice)}
            </option>
          ))}
        </SelectField>
      ) : null}

      {layout ? (
        <SelectField label={t("fields.elevator")} error={errors.elevator?.message} {...register("elevator")}>
          <option value="">{t("fields.notSpecified")}</option>
          <option value="yes">{t("fields.elevatorYes")}</option>
          <option value="no">{t("fields.elevatorNo")}</option>
        </SelectField>
      ) : null}

      <SelectField label={t("fields.condition")} error={errors.condition?.message} {...register("condition")}>
        <option value="" disabled>
          {t("fields.conditionPlaceholder")}
        </option>
        {CONDITIONS.map((condition) => (
          <option key={condition} value={condition}>
            {tListing(`condition.${condition}`)}
          </option>
        ))}
      </SelectField>

      <TextField
        label={optional(t("fields.yearBuilt"))}
        inputMode="numeric"
        autoComplete="off"
        maxLength={4}
        error={errors.yearBuilt?.message}
        {...register("yearBuilt")}
      />

      <TextField
        label={optional(t("fields.addressNote"))}
        hint={t("fields.addressHint")}
        autoComplete="street-address"
        error={errors.addressNote?.message}
        className="sm:col-span-2"
        {...register("addressNote")}
      />
    </div>
  );
}
