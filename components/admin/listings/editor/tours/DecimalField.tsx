"use client";

import { useState, type ChangeEvent, type ReactNode } from "react";
import { useController } from "react-hook-form";
import { Input } from "@/components/ui/input";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import type { ListingForm } from "@/lib/admin/listing-form";
import { cn } from "@/lib/utils";
import { Field, describedBy, useFieldError, type FieldName } from "../fields";
import { formatDecimal, formatDegrees, parseDecimal, toRadians } from "./numbers";

type DecimalInputProps = {
  id: string;
  /** Radians when `angle` is set (the input shows degrees). `NaN` while the text does not parse. */
  value: number | null;
  onChange: (next: number | null) => void;
  onBlur?: () => void;
  angle?: boolean;
  /** Decimals shown for a value set from outside. */
  digits?: number;
  unit?: string;
  /** Positive-only values get the decimal keypad; signed ones need the minus key. */
  signed?: boolean;
  placeholder?: string;
  invalid?: boolean;
  describedById?: string;
  label?: string;
  className?: string;
  testId?: string;
};

/**
 * A signed decimal typed as text ("-4,7" or "-4.7"). It keeps its own text so
 * a half-typed "-" or "2," survives, and resyncs when the value changes from
 * outside (the floor editor, the panorama preview, a server update).
 */
export function DecimalInput({
  id,
  value,
  onChange,
  onBlur,
  angle = false,
  digits = 3,
  unit,
  signed = true,
  placeholder,
  invalid = false,
  describedById,
  label,
  className,
  testId,
}: DecimalInputProps) {
  const toText = (next: number | null) =>
    next === null || !Number.isFinite(next) ? "" : angle ? formatDegrees(next) : formatDecimal(next, digits);
  const fromText = (text: string) => {
    const parsed = parseDecimal(text);
    return parsed === null || Number.isNaN(parsed) || !angle ? parsed : toRadians(parsed);
  };

  const [draft, setDraft] = useState(() => toText(value));
  const [seen, setSeen] = useState<number | null>(value);
  if (!Object.is(seen, value)) {
    setSeen(value);
    if (!Object.is(fromText(draft), value)) setDraft(toText(value));
  }

  const input = {
    id,
    type: "text",
    inputMode: signed ? undefined : ("decimal" as const),
    autoComplete: "off",
    spellCheck: false,
    placeholder,
    value: draft,
    "aria-label": label,
    "aria-invalid": invalid ? true : undefined,
    "aria-describedby": describedById,
    "data-testid": testId,
    onChange: (event: ChangeEvent<HTMLInputElement>) => {
      const text = event.target.value;
      const next = fromText(text);
      setDraft(text);
      setSeen(next);
      onChange(next);
    },
    onBlur,
  };

  const shownUnit = unit ?? (angle ? "°" : undefined);
  if (shownUnit === undefined) return <Input className={cn("tabular-nums", className)} {...input} />;
  return (
    <InputGroup className={cn("max-md:h-11", className)}>
      <InputGroupInput className="tabular-nums" {...input} />
      <InputGroupAddon align="inline-end">{shownUnit}</InputGroupAddon>
    </InputGroup>
  );
}

/** A `DecimalInput` bound to a listing form field, with label, hint and the schema's error. */
export function DecimalField({
  name,
  id,
  label,
  hint,
  className,
  deps,
  ...rest
}: {
  name: FieldName;
  id: string;
  label: ReactNode;
  hint?: ReactNode;
  className?: string;
  /** Fields validated together with this one (the four start-point values). */
  deps?: FieldName[];
} & Pick<DecimalInputProps, "angle" | "digits" | "unit" | "signed" | "placeholder" | "testId">) {
  const { field } = useController<ListingForm>({ name, rules: deps !== undefined ? { deps } : undefined });
  const error = useFieldError(name);
  const value = typeof field.value === "number" ? field.value : null;
  return (
    <Field id={id} label={label} hint={hint} error={error} className={className}>
      <DecimalInput
        id={id}
        value={value}
        onChange={field.onChange}
        onBlur={field.onBlur}
        invalid={error !== undefined}
        describedById={describedBy(id, hint !== undefined, error !== undefined)}
        {...rest}
      />
    </Field>
  );
}
