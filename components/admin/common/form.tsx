"use client";

import { Loader2 } from "lucide-react";
import { useId, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

/**
 * Form layout shared by the CRM and content editors (team profile, location,
 * post, site content, settings). Field state is the caller's business —
 * react-hook-form or plain state — these only draw the frame, so labels,
 * hints and errors look and announce the same everywhere.
 */

/** A card of related fields. Two columns from `@lg` of the card's own width. */
export function FormSection({
  title,
  description,
  actions,
  children,
  columns = 2,
  className,
}: {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  columns?: 1 | 2 | 3;
  className?: string;
}) {
  const headingId = useId();
  return (
    <section aria-labelledby={headingId} className={cn("@container rounded-xl border bg-card p-4 md:p-5", className)}>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 id={headingId} className="text-sm font-semibold">
            {title}
          </h2>
          {description !== undefined ? (
            <div className="mt-1 max-w-3xl text-xs leading-relaxed text-muted-foreground">{description}</div>
          ) : null}
        </div>
        {actions}
      </div>
      <div
        className={cn(
          "grid gap-4",
          columns === 2 && "@lg:grid-cols-2",
          columns === 3 && "@lg:grid-cols-2 @3xl:grid-cols-3",
        )}
      >
        {children}
      </div>
    </section>
  );
}

/** `aria-describedby` for a control with an optional hint and error. */
export function describedBy(id: string, hint: boolean, error: boolean): string | undefined {
  const ids = [hint ? `${id}-hint` : null, error ? `${id}-error` : null].filter((value) => value !== null);
  return ids.length > 0 ? ids.join(" ") : undefined;
}

/**
 * Label + control + hint + error. Give the control `id={id}`,
 * `aria-invalid={error !== undefined || undefined}` and
 * `aria-describedby={describedBy(id, hint !== undefined, error !== undefined)}`.
 */
export function FieldShell({
  id,
  label,
  hint,
  error,
  children,
  className,
  labelAside,
  wide = false,
}: {
  id: string;
  label: ReactNode;
  hint?: ReactNode;
  error?: string;
  children: ReactNode;
  className?: string;
  labelAside?: ReactNode;
  /** Span every column of the section grid. */
  wide?: boolean;
}) {
  return (
    <div className={cn("flex min-w-0 flex-col gap-1.5", wide && "col-span-full", className)}>
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

/**
 * The save row at the bottom of an editor. Sticky, so a long form never hides
 * its save button; says whether there are unsaved changes.
 */
export function SaveBar({
  dirty,
  saving,
  onReset,
  submitLabel = "Sačuvaj",
  extra,
  form,
}: {
  dirty: boolean;
  saving: boolean;
  onReset?: () => void;
  submitLabel?: string;
  /** Anything left of the buttons (e.g. "Poslednja izmena …"). */
  extra?: ReactNode;
  /** The `id` of the `<form>` when the bar is rendered outside it. */
  form?: string;
}) {
  return (
    <div
      className="sticky bottom-0 z-10 -mx-4 mt-6 flex flex-wrap items-center justify-end gap-2 border-t bg-background/95 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/80 md:-mx-6 md:px-6"
      data-testid="save-bar"
    >
      <p className="mr-auto text-xs text-muted-foreground" aria-live="polite">
        {saving ? "Čuvanje…" : dirty ? "Imate nesačuvane izmene." : extra ?? "Sve izmene su sačuvane."}
      </p>
      {onReset !== undefined ? (
        <Button type="button" variant="ghost" disabled={!dirty || saving} onClick={onReset}>
          Poništi izmene
        </Button>
      ) : null}
      <Button type="submit" form={form} disabled={!dirty || saving} data-testid="save-button">
        {saving ? <Loader2 className="animate-spin" aria-hidden="true" /> : null}
        {submitLabel}
      </Button>
    </div>
  );
}
