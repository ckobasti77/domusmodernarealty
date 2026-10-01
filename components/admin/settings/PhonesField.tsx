"use client";

import { Plus, Trash2 } from "lucide-react";
import { useId } from "react";
import { useFieldArray, useFormContext } from "react-hook-form";
import { describedBy } from "@/components/admin/common/form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MAX_PHONES, type SettingsForm } from "./schema";

/** Phone numbers shown in the footer and on the contact page (1–5). */
export function PhonesField() {
  const groupId = useId();
  const { control, register, getFieldState, formState } = useFormContext<SettingsForm>();
  const { fields, append, remove } = useFieldArray({ control, name: "phones" });
  const listError = getFieldState("phones", formState).error;
  const rootMessage = listError?.root?.message ?? listError?.message;

  return (
    <fieldset className="col-span-full flex min-w-0 flex-col gap-2" aria-describedby={`${groupId}-hint`}>
      <legend className="mb-1.5 text-sm leading-snug font-medium">Telefoni</legend>
      <ul className="flex flex-col gap-2">
        {fields.map((field, index) => {
          const id = `${groupId}-${index}`;
          const error = getFieldState(`phones.${index}.value`, formState).error?.message;
          return (
            <li key={field.id} className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <label htmlFor={id} className="sr-only">
                  Telefon {index + 1}
                </label>
                <Input
                  id={id}
                  type="tel"
                  inputMode="tel"
                  autoComplete="off"
                  placeholder="+381 11 123 4567"
                  className="max-w-xs"
                  {...register(`phones.${index}.value`)}
                  aria-invalid={error !== undefined || undefined}
                  aria-describedby={describedBy(id, false, error !== undefined)}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  disabled={fields.length <= 1}
                  aria-label={`Uklonite telefon ${index + 1}`}
                  onClick={() => remove(index)}
                >
                  <Trash2 aria-hidden="true" />
                </Button>
              </div>
              {error !== undefined ? (
                <p id={`${id}-error`} className="text-xs font-medium text-destructive">
                  {error}
                </p>
              ) : null}
            </li>
          );
        })}
      </ul>
      <div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={fields.length >= MAX_PHONES}
          onClick={() => append({ value: "" }, { shouldFocus: true })}
        >
          <Plus aria-hidden="true" />
          Dodajte broj
        </Button>
      </div>
      <p id={`${groupId}-hint`} className="text-xs text-muted-foreground">
        Svi brojevi se prikazuju u podnožju sajta; prvi je glavni broj za pozive sa početne strane. Najviše {MAX_PHONES} brojeva.
      </p>
      {rootMessage !== undefined ? <p className="text-xs font-medium text-destructive">{rootMessage}</p> : null}
    </fieldset>
  );
}
