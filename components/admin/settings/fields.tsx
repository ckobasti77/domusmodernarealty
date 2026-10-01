"use client";

import { useId, type ComponentProps, type ReactNode } from "react";
import { useController, useFormContext, type FieldPathByValue } from "react-hook-form";
import { describedBy, FieldShell } from "@/components/admin/common/form";
import { L10nInput, type L10nValue } from "@/components/admin/common/L10nInput";
import { Input } from "@/components/ui/input";
import type { SettingsForm } from "./schema";

type TextPath = FieldPathByValue<SettingsForm, string>;
type L10nPath = FieldPathByValue<SettingsForm, L10nValue>;

/** A registered text input inside `FieldShell`, wired to the field's error. */
export function TextField({
  name,
  label,
  hint,
  testId,
  wide,
  labelAside,
  ...input
}: {
  name: TextPath;
  label: ReactNode;
  hint?: ReactNode;
  testId?: string;
  wide?: boolean;
  labelAside?: ReactNode;
} & Omit<ComponentProps<typeof Input>, "name" | "id" | "value" | "onChange" | "onBlur" | "ref">) {
  const id = useId();
  const { register, getFieldState, formState } = useFormContext<SettingsForm>();
  const error = getFieldState(name, formState).error?.message;
  return (
    <FieldShell id={id} label={label} hint={hint} error={error} wide={wide} labelAside={labelAside}>
      <Input
        id={id}
        {...input}
        {...register(name)}
        aria-invalid={error !== undefined || undefined}
        aria-describedby={describedBy(id, hint !== undefined, error !== undefined)}
        data-testid={testId}
      />
    </FieldShell>
  );
}

/** Characters per locale, for the SEO counters: `SR 48 · EN 52 · RU — · DE —`. */
function lengths(value: L10nValue): string {
  return (["sr", "en", "ru", "de"] as const)
    .map((key) => `${key.toUpperCase()} ${value[key].trim().length > 0 ? value[key].trim().length : "—"}`)
    .join(" · ");
}

/**
 * A localized field (SR/EN/RU/DE tabs). With `counter`, the hint lists the
 * length of every locale against the recommended and maximum length.
 */
export function L10nField({
  name,
  label,
  hint,
  multiline,
  rows,
  maxLength,
  counter,
  testId,
}: {
  name: L10nPath;
  label: string;
  hint?: string;
  multiline?: boolean;
  rows?: number;
  maxLength?: number;
  counter?: { soft: number; max: number };
  testId?: string;
}) {
  const { control, getFieldState, formState } = useFormContext<SettingsForm>();
  const { field } = useController({ control, name });
  const error = getFieldState(`${name}.sr`, formState).error?.message;
  const counterHint =
    counter !== undefined
      ? `Preporuka do ${counter.soft} znakova, najviše ${counter.max}. Dužina: ${lengths(field.value)}.`
      : undefined;
  const fullHint = [hint, counterHint].filter((part) => part !== undefined).join(" ");
  return (
    <L10nInput
      label={label}
      value={field.value}
      onChange={field.onChange}
      multiline={multiline}
      rows={rows}
      required
      maxLength={maxLength}
      hint={fullHint.length > 0 ? fullHint : undefined}
      error={error}
      testId={testId}
    />
  );
}
