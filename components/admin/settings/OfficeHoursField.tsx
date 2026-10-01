"use client";

import { Plus, X } from "lucide-react";
import { useId } from "react";
import { useFieldArray, useFormContext } from "react-hook-form";
import { describedBy } from "@/components/admin/common/form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { WEEKDAYS_MON_FIRST } from "@/lib/admin/labels";
import type { SettingsForm } from "./schema";

/**
 * Weekly office hours: one row per weekday (Monday first), each with zero or
 * more time ranges. A day without ranges is closed. Split shifts are two
 * ranges on the same day.
 */
export function OfficeHoursField() {
  const baseId = useId();
  const { control, register, getFieldState, getValues, formState } = useFormContext<SettingsForm>();
  const { fields, append, remove } = useFieldArray({ control, name: "officeHours" });

  return (
    <fieldset className="col-span-full min-w-0" aria-describedby={`${baseId}-hint`}>
      <legend className="sr-only">Radno vreme kancelarije</legend>
      <ul className="divide-y rounded-lg border">
        {WEEKDAYS_MON_FIRST.map((day) => {
          const slots = fields
            .map((field, index) => ({ field, index }))
            .filter(({ field }) => field.weekday === day.weekday);
          const dayId = `${baseId}-d${day.weekday}`;
          return (
            <li
              key={day.weekday}
              role="group"
              aria-labelledby={dayId}
              className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-x-4 gap-y-2 px-3 py-2.5 sm:grid-cols-[6rem_minmax(0,1fr)_auto]"
            >
              <span id={dayId} className="pt-2 text-sm font-medium">
                {day.label}
              </span>
              <div className="col-span-2 row-start-2 flex min-w-0 flex-col gap-2 sm:col-span-1 sm:col-start-2 sm:row-start-1">
                {slots.length === 0 ? (
                  <p className="pt-2 text-sm text-muted-foreground">Zatvoreno</p>
                ) : (
                  slots.map(({ field, index }, position) => {
                    const fromId = `${baseId}-${index}-from`;
                    const toId = `${baseId}-${index}-to`;
                    const fromError = getFieldState(`officeHours.${index}.from`, formState).error?.message;
                    const toError = getFieldState(`officeHours.${index}.to`, formState).error?.message;
                    const error = fromError ?? toError;
                    const errorId = `${baseId}-${index}`;
                    return (
                      <div key={field.id} className="flex flex-col gap-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <label htmlFor={fromId} className="sr-only">
                            {day.label}, termin {position + 1}: od
                          </label>
                          <Input
                            id={fromId}
                            type="time"
                            step={900}
                            className="w-28 shrink-0"
                            {...register(`officeHours.${index}.from`)}
                            aria-invalid={fromError !== undefined || undefined}
                            aria-describedby={describedBy(errorId, false, error !== undefined)}
                          />
                          <span aria-hidden="true" className="text-muted-foreground">
                            –
                          </span>
                          <label htmlFor={toId} className="sr-only">
                            {day.label}, termin {position + 1}: do
                          </label>
                          <Input
                            id={toId}
                            type="time"
                            step={900}
                            className="w-28 shrink-0"
                            {...register(`officeHours.${index}.to`)}
                            aria-invalid={toError !== undefined || undefined}
                            aria-describedby={describedBy(errorId, false, error !== undefined)}
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            aria-label={`Uklonite termin ${position + 1} (${day.label})`}
                            onClick={() => remove(index)}
                          >
                            <X aria-hidden="true" />
                          </Button>
                        </div>
                        {error !== undefined ? (
                          <p id={`${errorId}-error`} className="text-xs font-medium text-destructive">
                            {error}
                          </p>
                        ) : null}
                      </div>
                    );
                  })
                )}
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="col-start-2 row-start-1 shrink-0 justify-self-end sm:col-start-3"
                onClick={() => {
                  const last = slots[slots.length - 1];
                  // A second range starts where the day's last one ends.
                  const lastEnd = last !== undefined ? getValues(`officeHours.${last.index}.to`) : undefined;
                  append(
                    lastEnd !== undefined && lastEnd < "20:00"
                      ? { weekday: day.weekday, from: lastEnd, to: "20:00" }
                      : { weekday: day.weekday, from: "09:00", to: "17:00" },
                    { shouldFocus: true },
                  );
                }}
              >
                <Plus aria-hidden="true" />
                <span>
                  Dodajte termin<span className="sr-only"> ({day.label})</span>
                </span>
              </Button>
            </li>
          );
        })}
      </ul>
      <p id={`${baseId}-hint`} className="mt-2 text-xs text-muted-foreground">
        Dan bez termina prikazuje se kao zatvoren. Za rad sa pauzom dodajte dva termina istog dana.
      </p>
    </fieldset>
  );
}
