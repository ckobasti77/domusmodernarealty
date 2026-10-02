"use client";

import { Check } from "lucide-react";
import { useId, useState, type ChangeEvent, type ComponentProps, type ReactNode } from "react";
import { get, useController, useFormContext, useFormState, useWatch, type FieldPath } from "react-hook-form";
import { Input } from "@/components/ui/input";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { fromNumberInput, toNumberInput } from "@/lib/admin/format";
import type { ListingForm } from "@/lib/admin/listing-form";
import { cn } from "@/lib/utils";

export type FieldName = FieldPath<ListingForm>;
export type Option = { value: string; label: string; disabled?: boolean };

/** Options from a label map, in its declaration order. */
export function optionsOf<K extends string>(labels: Record<K, string>): Option[] {
  return (Object.keys(labels) as K[]).map((value) => ({ value, label: labels[value] }));
}

/* ------------------------------------------------------------- layout */

/** One editor tab: a titled `<section>`. */
export function TabPanel({
  id,
  title,
  description,
  children,
}: {
  id: string;
  title: string;
  description?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section aria-labelledby={`${id}-title`} className="flex flex-col gap-4">
      <header>
        <h2 id={`${id}-title`} className="text-lg font-semibold tracking-tight">
          {title}
        </h2>
        {description !== undefined ? <p className="mt-0.5 max-w-3xl text-sm text-muted-foreground">{description}</p> : null}
      </header>
      {children}
    </section>
  );
}

/** A card of related fields in a responsive grid (container queries: the column is narrow next to the aside). */
export function Group({
  title,
  description,
  children,
  className,
  layout = "grid",
  important = false,
  actions,
}: {
  title: string;
  description?: ReactNode;
  children: ReactNode;
  className?: string;
  layout?: "grid" | "stack";
  important?: boolean;
  actions?: ReactNode;
}) {
  const headingId = useId();
  return (
    <div
      role="group"
      aria-labelledby={headingId}
      className={cn(
        "@container rounded-xl border bg-card p-4 md:p-5",
        important && "border-primary/45 bg-primary/[0.03] ring-1 ring-primary/15",
        className,
      )}
    >
      <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 id={headingId} className="text-sm font-semibold">
            {title}
          </h3>
          {description !== undefined ? (
            <div className="mt-1 max-w-3xl text-xs leading-relaxed text-muted-foreground">{description}</div>
          ) : null}
        </div>
        {actions}
      </div>
      <div
        className={
          layout === "grid" ? "grid gap-x-4 gap-y-4 @lg:grid-cols-2 @3xl:grid-cols-3" : "flex flex-col gap-4"
        }
      >
        {children}
      </div>
    </div>
  );
}

/* --------------------------------------------------------- field shell */

function messageOf(error: unknown): string | undefined {
  if (typeof error !== "object" || error === null) return undefined;
  const record = error as { message?: unknown; root?: { message?: unknown } };
  if (typeof record.message === "string" && record.message.length > 0) return record.message;
  if (typeof record.root?.message === "string") return record.root.message;
  return undefined;
}

/** The validation message of one field, subscribed to that field only. */
export function useFieldError(name: FieldName): string | undefined {
  const { errors } = useFormState<ListingForm>({ name, exact: true });
  return messageOf(get(errors, name));
}

export function describedBy(id: string, hint: boolean, error: boolean): string | undefined {
  const ids = [hint ? `${id}-hint` : null, error ? `${id}-error` : null].filter((value) => value !== null);
  return ids.length > 0 ? ids.join(" ") : undefined;
}

export function Field({
  id,
  label,
  hint,
  error,
  children,
  className,
  labelAside,
}: {
  id: string;
  label: ReactNode;
  hint?: ReactNode;
  error?: string;
  children: ReactNode;
  className?: string;
  labelAside?: ReactNode;
}) {
  return (
    <div className={cn("flex min-w-0 flex-col gap-1.5", className)}>
      <div className="flex min-h-4 items-end justify-between gap-2">
        <Label htmlFor={id} className="leading-snug">
          {label}
        </Label>
        {labelAside}
      </div>
      {children}
      {hint !== undefined ? (
        <p id={`${id}-hint`} className="text-xs leading-snug text-muted-foreground">
          {hint}
        </p>
      ) : null}
      {error !== undefined ? (
        <p id={`${id}-error`} className="text-xs leading-snug font-medium text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}

/** `12 / 60`, amber past the soft limit and red past the hard one. */
export function CharCount({ name, soft, max, min }: { name: FieldName; soft?: number; max: number; min?: number }) {
  const value = useWatch<ListingForm>({ name });
  const length = typeof value === "string" ? value.trim().length : 0;
  const tone =
    length > max
      ? "text-destructive"
      : (soft !== undefined && length > soft) || (min !== undefined && length > 0 && length < min)
        ? "text-amber-700 dark:text-amber-400"
        : "text-muted-foreground";
  const limit = soft ?? max;
  return (
    <span className={cn("shrink-0 text-xs tabular-nums", tone)}>
      {length}
      {min !== undefined && length < min ? ` (min. ${min})` : ` / ${limit}`}
    </span>
  );
}

/* ------------------------------------------------------------ inputs */

type TextFieldProps = {
  name: FieldName;
  id: string;
  label: ReactNode;
  hint?: ReactNode;
  className?: string;
  inputClassName?: string;
  counter?: { soft?: number; max: number; min?: number };
  prefix?: ReactNode;
} & Omit<ComponentProps<"input">, "name" | "id" | "className" | "prefix">;

export function TextField({
  name,
  id,
  label,
  hint,
  className,
  inputClassName,
  counter,
  prefix,
  onBlur,
  onChange,
  ...input
}: TextFieldProps) {
  const { register } = useFormContext<ListingForm>();
  const error = useFieldError(name);
  const a11y = {
    "aria-invalid": error !== undefined ? true : undefined,
    "aria-describedby": describedBy(id, hint !== undefined, error !== undefined),
  };
  // Extra handlers run after RHF has stored the value.
  const registered = register(name, {
    ...(onBlur !== undefined ? { onBlur } : {}),
    ...(onChange !== undefined ? { onChange } : {}),
  });
  return (
    <Field
      id={id}
      label={label}
      hint={hint}
      error={error}
      className={className}
      labelAside={counter !== undefined ? <CharCount name={name} {...counter} /> : undefined}
    >
      {prefix !== undefined ? (
        <InputGroup>
          <InputGroupAddon className="font-mono text-xs">{prefix}</InputGroupAddon>
          <InputGroupInput id={id} className={inputClassName} {...a11y} {...input} {...registered} />
        </InputGroup>
      ) : (
        <Input id={id} className={inputClassName} {...a11y} {...input} {...registered} />
      )}
    </Field>
  );
}

export function TextAreaField({
  name,
  id,
  label,
  hint,
  className,
  counter,
  ...textarea
}: {
  name: FieldName;
  id: string;
  label: ReactNode;
  hint?: ReactNode;
  className?: string;
  counter?: { soft?: number; max: number; min?: number };
} & Omit<ComponentProps<"textarea">, "name" | "id" | "className">) {
  const { register } = useFormContext<ListingForm>();
  const error = useFieldError(name);
  return (
    <Field
      id={id}
      label={label}
      hint={hint}
      error={error}
      className={className}
      labelAside={counter !== undefined ? <CharCount name={name} {...counter} /> : undefined}
    >
      <Textarea
        id={id}
        aria-invalid={error !== undefined ? true : undefined}
        aria-describedby={describedBy(id, hint !== undefined, error !== undefined)}
        // The textarea grows with its content (field-sizing); `rows` sets where it starts.
        style={{ minHeight: `calc(${textarea.rows ?? 3} * 1.5em + 1rem)` }}
        {...textarea}
        {...register(name)}
      />
    </Field>
  );
}

/**
 * A number held as a number in the form. Always a text input: a native
 * `type="number"` drops the decimal comma in Chromium, so "1,5" rooms arrived
 * as 15. The input keeps its own text so half-typed values ("2,", "285.")
 * survive, and resyncs when the value changes from outside (a server update,
 * rent/price sync).
 */
export function NumberField({
  name,
  id,
  label,
  hint,
  unit,
  className,
  deps,
  onBlur,
  placeholder,
  labelAside,
}: {
  name: FieldName;
  id: string;
  label: ReactNode;
  hint?: ReactNode;
  unit?: string;
  className?: string;
  deps?: FieldName[];
  onBlur?: () => void;
  placeholder?: string;
  labelAside?: ReactNode;
}) {
  const { field } = useController<ListingForm>({ name, rules: deps !== undefined ? { deps } : undefined });
  const error = useFieldError(name);
  const value: unknown = field.value;
  const [draft, setDraft] = useState(() => toNumberInput(value));
  const [seen, setSeen] = useState<unknown>(value);
  if (!Object.is(seen, value)) {
    setSeen(value);
    if (!Object.is(fromNumberInput(draft), value)) setDraft(toNumberInput(value));
  }

  const inputProps = {
    id,
    name: field.name,
    type: "text",
    inputMode: "decimal" as const,
    autoComplete: "off",
    placeholder,
    value: draft,
    "aria-invalid": error !== undefined ? true : undefined,
    "aria-describedby": describedBy(id, hint !== undefined, error !== undefined),
    onChange: (event: ChangeEvent<HTMLInputElement>) => {
      const text = event.target.value;
      const next = fromNumberInput(text);
      setDraft(text);
      setSeen(next);
      field.onChange(next);
    },
    onBlur: () => {
      field.onBlur();
      onBlur?.();
    },
  };

  return (
    <Field id={id} label={label} hint={hint} error={error} className={className} labelAside={labelAside}>
      {unit !== undefined ? (
        <InputGroup>
          <InputGroupInput className="tabular-nums" {...inputProps} />
          <InputGroupAddon align="inline-end">{unit}</InputGroupAddon>
        </InputGroup>
      ) : (
        <Input className="tabular-nums" {...inputProps} />
      )}
    </Field>
  );
}

const NONE = "__none";

export function SelectField({
  name,
  id,
  label,
  hint,
  options,
  noneLabel,
  placeholder = "Izaberite…",
  disabled,
  className,
  onValueChange,
}: {
  name: FieldName;
  id: string;
  label: ReactNode;
  hint?: ReactNode;
  options: readonly Option[];
  /** Adds a first "none" option that maps to `""`. */
  noneLabel?: string;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  /** Replaces the plain `onChange` (cascading selects set several fields). */
  onValueChange?: (value: string) => void;
}) {
  const { field } = useController<ListingForm>({ name });
  const error = useFieldError(name);
  const raw = typeof field.value === "string" ? field.value : "";
  const selected = raw === "" ? (noneLabel !== undefined ? NONE : "") : raw;
  return (
    <Field id={id} label={label} hint={hint} error={error} className={className}>
      <Select
        value={selected}
        disabled={disabled}
        onValueChange={(next) => {
          const value = next === NONE ? "" : next;
          if (onValueChange !== undefined) onValueChange(value);
          else field.onChange(value);
        }}
      >
        <SelectTrigger
          id={id}
          onBlur={field.onBlur}
          className="w-full"
          aria-invalid={error !== undefined ? true : undefined}
          aria-describedby={describedBy(id, hint !== undefined, error !== undefined)}
        >
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent position="popper" className="max-h-80">
          {noneLabel !== undefined ? <SelectItem value={NONE}>{noneLabel}</SelectItem> : null}
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value} disabled={option.disabled}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </Field>
  );
}

/** A yes / no / not stated choice for flags the site prints either way ("Ne" is a claim). */
export function TriStateField({
  name,
  id,
  label,
  hint,
  yesLabel = "Da",
  noLabel = "Ne",
  unsetLabel = "Nije navedeno",
  className,
}: {
  name: FieldName;
  id: string;
  label: ReactNode;
  hint?: ReactNode;
  yesLabel?: string;
  noLabel?: string;
  unsetLabel?: string;
  className?: string;
}) {
  const { field } = useController<ListingForm>({ name });
  const value = field.value === true ? "yes" : field.value === false ? "no" : "unset";
  return (
    <Field id={id} label={label} hint={hint} className={className}>
      <Select
        value={value}
        onValueChange={(next) => field.onChange(next === "yes" ? true : next === "no" ? false : null)}
      >
        <SelectTrigger
          id={id}
          onBlur={field.onBlur}
          className="w-full"
          aria-describedby={hint !== undefined ? `${id}-hint` : undefined}
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent position="popper">
          <SelectItem value="unset">{unsetLabel}</SelectItem>
          <SelectItem value="yes">{yesLabel}</SelectItem>
          <SelectItem value="no">{noLabel}</SelectItem>
        </SelectContent>
      </Select>
    </Field>
  );
}

export function SwitchField({
  name,
  id,
  label,
  hint,
  disabled,
  className,
}: {
  name: FieldName;
  id: string;
  label: ReactNode;
  hint?: ReactNode;
  disabled?: boolean;
  className?: string;
}) {
  const { field } = useController<ListingForm>({ name });
  return (
    <div className={cn("flex items-start gap-3 rounded-lg border bg-background px-3 py-2.5", className)}>
      <Switch
        id={id}
        checked={field.value === true}
        onCheckedChange={(checked) => field.onChange(checked)}
        onBlur={field.onBlur}
        disabled={disabled}
        aria-describedby={hint !== undefined ? `${id}-hint` : undefined}
        className="mt-0.5"
      />
      <div className="grid min-w-0 gap-1">
        <Label htmlFor={id} className="leading-snug">
          {label}
        </Label>
        {hint !== undefined ? (
          <p id={`${id}-hint`} className="text-xs leading-snug text-muted-foreground">
            {hint}
          </p>
        ) : null}
      </div>
    </div>
  );
}

/** A native date input holding `yyyy-mm-dd` (converted with toDateInput/fromDateInput). */
export function DateField({
  name,
  id,
  label,
  hint,
  className,
  deps,
  labelAside,
}: {
  name: FieldName;
  id: string;
  label: ReactNode;
  hint?: ReactNode;
  className?: string;
  deps?: FieldName[];
  labelAside?: ReactNode;
}) {
  const { register } = useFormContext<ListingForm>();
  const error = useFieldError(name);
  return (
    <Field id={id} label={label} hint={hint} error={error} className={className} labelAside={labelAside}>
      <Input
        id={id}
        type="date"
        min="1800-01-01"
        max="2100-12-31"
        className="tabular-nums"
        aria-invalid={error !== undefined ? true : undefined}
        aria-describedby={describedBy(id, hint !== undefined, error !== undefined)}
        {...register(name, deps !== undefined ? { deps } : undefined)}
      />
    </Field>
  );
}

/** Multi-select chips (heating, parking, orientation). Order follows `options`. */
export function ToggleGroupField({
  name,
  legend,
  options,
  hint,
  className,
}: {
  name: FieldName;
  legend: string;
  options: readonly Option[];
  hint?: ReactNode;
  className?: string;
}) {
  const { field } = useController<ListingForm>({ name });
  const hintId = useId();
  const value = Array.isArray(field.value) ? field.value.filter((item): item is string => typeof item === "string") : [];
  return (
    <fieldset className={cn("min-w-0", className)} aria-describedby={hint !== undefined ? hintId : undefined}>
      <legend className="mb-1.5 text-sm font-medium">{legend}</legend>
      <ToggleGroup
        type="multiple"
        variant="outline"
        size="sm"
        spacing={1}
        value={value}
        onValueChange={(next) => field.onChange(options.map((option) => option.value).filter((item) => next.includes(item)))}
        className="flex-wrap"
      >
        {options.map((option) => (
          <ToggleGroupItem
            key={option.value}
            value={option.value}
            className="data-[state=on]:border-primary/60 data-[state=on]:bg-primary/10 data-[state=on]:text-foreground"
          >
            <Check aria-hidden="true" className="hidden group-data-[state=on]/toggle:block" />
            {option.label}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
      {hint !== undefined ? (
        <p id={hintId} className="mt-1.5 text-xs text-muted-foreground">
          {hint}
        </p>
      ) : null}
    </fieldset>
  );
}
