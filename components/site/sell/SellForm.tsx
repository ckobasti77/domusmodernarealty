"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "convex/react";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import * as z from "zod/mini";
import { ConsentFields, contactFields, FormError, SuccessPanel, useSuccessFocus } from "@/components/forms/shared";
import { Button } from "@/components/site/Button";
import { SelectField, TextAreaField, TextField } from "@/components/site/Field";
import { hasLayout, PROPERTY_TYPES } from "@/components/site/valuation/schema";
import type { LocationGroup } from "@/components/site/valuation/types";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import type { PropertyType } from "@/convex/lib/validators";
import type { Locale } from "@/i18n/routing";
import { errorMessageKey } from "@/lib/errors";
import { formatInputNumber, parseLocaleNumber } from "@/lib/format";
import { roomsKey } from "@/lib/listing-text";
import { getSessionKey } from "@/lib/session";

/**
 * The seller form (PRD A7) → `leads.createSeller`, a lead of type `seller`.
 * Two fieldsets: the property (type, place, size, rooms, an expected price if
 * the owner has one) and the owner's contact with the shared consent fields.
 * The place is the location select OR a street typed by hand — a village that
 * is not in the tree still gets through. The client repeats the server's
 * bounds so the visitor gets a localized message at once; the server decides.
 */

/** `leads.createSeller` bounds. */
const AREA = { min: 8, max: 20_000 } as const;
const PRICE_MAX = 100_000_000;
/** Halves up to four and a half, then "5 and more" (sent as 5). */
const ROOM_CHOICES = [0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5] as const;

function isPropertyType(value: string): value is PropertyType {
  return (PROPERTY_TYPES as readonly string[]).includes(value);
}

export function SellForm({ groups, phone }: { groups: readonly LocationGroup[]; phone?: string }) {
  const locale = useLocale() as Locale;
  const t = useTranslations("sell.form");
  const tSell = useTranslations("sell");
  const tForms = useTranslations("forms");
  const tListing = useTranslations("listing");
  const tRoot = useTranslations();
  const createSeller = useMutation(api.leads.createSeller);
  const [sent, setSent] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const optional = (label: string) => `${label} (${tForms("optional")})`;
  const roomLabel = (rooms: number) => {
    if (rooms <= 0.5) return t("roomsStudio");
    if (rooms >= 5) return t("roomsFivePlus");
    const key = roomsKey(rooms);
    return key !== null ? tListing(`structure.${key}`) : String(rooms);
  };

  const locationIds = new Set(groups.flatMap((group) => group.options.map((option) => option.id as string)));
  const number = (value: string) => parseLocaleNumber(value, locale);

  const schema = z
    .object({
      // A plain boolean check: a type-guard refine would narrow the form type to `PropertyType`.
      propertyType: z
        .string()
        .check(z.refine((value) => (PROPERTY_TYPES as readonly string[]).includes(value), tForms("requiredField"))),
      locationId: z
        .string()
        .check(z.refine((value) => value.length === 0 || locationIds.has(value), tForms("requiredField"))),
      addressNote: z.string().check(z.trim(), z.maxLength(300, tForms("tooLong", { max: 300 }))),
      area: z.string().check(
        z.trim(),
        z.minLength(1, tForms("requiredField")),
        z.refine(
          (value) => {
            const area = number(value);
            return area !== null && area >= AREA.min && area <= AREA.max;
          },
          t("areaInvalid", {
            min: AREA.min,
            max: formatInputNumber(AREA.max, locale),
          }),
        ),
      ),
      rooms: z.string(),
      price: z.string().check(
        z.trim(),
        z.refine(
          (value) => {
            if (value.length === 0) return true;
            const price = number(value);
            return price !== null && price > 0 && price <= PRICE_MAX;
          },
          t("priceInvalid", { example: formatInputNumber(185_000, locale) }),
        ),
      ),
      message: z.string().check(z.trim(), z.maxLength(2000, tForms("tooLong", { max: 2000 }))),
      ...contactFields(tForms),
    })
    .check(
      z.refine((values) => values.locationId.length > 0 || values.addressNote.length > 0, {
        path: ["locationId"],
        message: t("locationRequired"),
      }),
    );
  type Values = z.infer<typeof schema>;

  const defaults: Values = {
    propertyType: "apartment",
    locationId: "",
    addressNote: "",
    area: "",
    rooms: "",
    price: "",
    message: "",
    name: "",
    email: "",
    phone: "",
    privacy: false,
    marketing: false,
    hp: "",
  };

  const {
    register,
    handleSubmit,
    reset,
    setFocus,
    control,
    formState: { errors, isSubmitting },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: defaults,
  });
  const propertyType = useWatch({ control, name: "propertyType" });
  const layout = isPropertyType(propertyType) && hasLayout(propertyType);

  // The panel replaces a taller form: bring it, and the screen reader, to it.
  const successRef = useSuccessFocus(sent, () => setFocus("propertyType"));

  async function onSubmit(values: Values) {
    setServerError(null);
    if (!isPropertyType(values.propertyType)) return;
    const area = number(values.area);
    if (area === null) return;
    const rooms = layout && values.rooms.length > 0 ? Number(values.rooms) : undefined;
    const price = values.price.length > 0 ? number(values.price) : null;
    try {
      await createSeller({
        sessionKey: getSessionKey(),
        locale,
        contact: {
          name: values.name,
          email: values.email,
          ...(values.phone.length > 0 ? { phone: values.phone } : {}),
        },
        propertyType: values.propertyType,
        areaM2: area,
        ...(values.locationId.length > 0 ? { locationId: values.locationId as Id<"locations"> } : {}),
        ...(rooms !== undefined ? { rooms } : {}),
        ...(price !== null ? { expectedPrice: Math.round(price) } : {}),
        ...(values.addressNote.length > 0 ? { addressNote: values.addressNote } : {}),
        ...(values.message.length > 0 ? { message: values.message } : {}),
        privacy: values.privacy,
        marketing: values.marketing,
        hp: values.hp,
      });
      setSent(true);
    } catch (error) {
      setServerError(tRoot(errorMessageKey(error)));
    }
  }

  if (sent) {
    return (
      <div ref={successRef} tabIndex={-1} className="scroll-mt-28 outline-none">
        <SuccessPanel
          heading={t("successHeading")}
          body={tForms("success")}
          detail={t("successDetail")}
          action={
            <Button
              variant="outline"
              size="compact"
              onClick={() => {
                reset(defaults);
                setSent(false);
              }}
            >
              {t("sendAnother")}
            </Button>
          }
        />
      </div>
    );
  }

  const legend = "mb-6 font-display text-h3 font-normal text-ink";

  return (
    <form
      noValidate
      onSubmit={handleSubmit(onSubmit)}
      className="relative flex flex-col gap-12"
      data-testid="sell-form"
    >
      <fieldset className="min-w-0">
        <legend className={legend}>{t("propertyLegend")}</legend>
        <div className="grid gap-x-8 gap-y-6 sm:grid-cols-2">
          <SelectField label={t("propertyType")} error={errors.propertyType?.message} {...register("propertyType")}>
            {PROPERTY_TYPES.map((type) => (
              <option key={type} value={type}>
                {tListing(`propertyType.${type}`)}
              </option>
            ))}
          </SelectField>

          <SelectField label={t("location")} error={errors.locationId?.message} {...register("locationId")}>
            <option value="">{t("locationNone")}</option>
            {groups.map((group) => (
              <optgroup key={group.label} label={group.label} lang={group.lang}>
                {group.options.map((option) => (
                  <option key={option.id} value={option.id} lang={option.lang}>
                    {option.label}
                  </option>
                ))}
              </optgroup>
            ))}
          </SelectField>

          <TextField
            label={optional(t("address"))}
            hint={t("addressHint")}
            autoComplete="street-address"
            maxLength={300}
            error={errors.addressNote?.message}
            className="sm:col-span-2"
            {...register("addressNote")}
          />

          <TextField
            label={t("area")}
            inputMode="decimal"
            autoComplete="off"
            error={errors.area?.message}
            {...register("area")}
          />

          {layout ? (
            <SelectField
              label={optional(t("rooms"))}
              hint={t("roomsHint")}
              error={errors.rooms?.message}
              {...register("rooms")}
            >
              <option value="">{t("roomsNone")}</option>
              {ROOM_CHOICES.map((rooms) => (
                <option key={rooms} value={String(rooms)}>
                  {roomLabel(rooms)}
                </option>
              ))}
            </SelectField>
          ) : null}

          <TextField
            label={optional(t("price"))}
            hint={t("priceHint")}
            inputMode="numeric"
            autoComplete="off"
            error={errors.price?.message}
            className={layout ? "sm:col-span-2" : undefined}
            {...register("price")}
          />

          <TextAreaField
            label={optional(t("message"))}
            hint={t("messageHint")}
            rows={4}
            maxLength={2000}
            error={errors.message?.message}
            className="sm:col-span-2"
            {...register("message")}
          />
        </div>
      </fieldset>

      <fieldset className="min-w-0">
        <legend className={legend}>{t("contactLegend")}</legend>
        <div className="flex flex-col gap-5">
          <div className="grid gap-x-8 gap-y-5 sm:grid-cols-2">
            <TextField label={tForms("name")} autoComplete="name" error={errors.name?.message} {...register("name")} />
            <TextField
              label={optional(tForms("phone"))}
              type="tel"
              autoComplete="tel"
              error={errors.phone?.message}
              {...register("phone")}
            />
          </div>
          <TextField
            label={tForms("email")}
            type="email"
            autoComplete="email"
            error={errors.email?.message}
            {...register("email")}
          />
          <ConsentFields register={register} errors={errors} />
        </div>
      </fieldset>

      <div className="flex flex-col gap-5">
        <FormError message={serverError} />
        <div className="flex flex-wrap items-center gap-x-8 gap-y-4">
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? tForms("submitting") : t("submit")}
          </Button>
          {phone !== undefined ? (
            <p className="text-small text-stone-text">
              {tSell("formPhonePrompt")}{" "}
              <a
                href={`tel:${phone.replace(/[^\d+]/g, "")}`}
                className="whitespace-nowrap text-ink underline decoration-bronze underline-offset-4"
              >
                {phone}
              </a>
            </p>
          ) : null}
        </div>
      </div>
    </form>
  );
}
