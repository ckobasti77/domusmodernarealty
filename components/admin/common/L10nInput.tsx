"use client";

import { Check, Copy } from "lucide-react";
import { useId } from "react";
import { LOCALE_LANG, LocaleTabs } from "@/components/admin/listings/editor/LocaleTabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { L10N_KEYS, type L10nKey } from "@/convex/lib/validators";
import { L10N_LABEL, L10N_SHORT } from "@/lib/admin/labels";
import { cn } from "@/lib/utils";

/**
 * Localized text as the editor holds it: every locale a string, "" when
 * missing. Convert at the boundary with `toL10nValue` / `fromL10nValue`
 * (Convex stores `{ sr: string; en?: string; ru?: string; de?: string }`).
 */
export type L10nValue = Record<L10nKey, string>;

export const EMPTY_L10N: L10nValue = { sr: "", en: "", ru: "", de: "" };

export function toL10nValue(stored: Partial<Record<L10nKey, string>> | undefined): L10nValue {
  return {
    sr: stored?.sr ?? "",
    en: stored?.en ?? "",
    ru: stored?.ru ?? "",
    de: stored?.de ?? "",
  };
}

/** Trims and drops empty translations; `sr` is always present (may be ""). */
export function fromL10nValue(value: L10nValue): { sr: string; en?: string; ru?: string; de?: string } {
  const out: { sr: string; en?: string; ru?: string; de?: string } = { sr: value.sr.trim() };
  for (const key of ["en", "ru", "de"] as const) {
    const text = value[key].trim();
    if (text.length > 0) out[key] = text;
  }
  return out;
}

/**
 * One localized field: SR / EN / RU / DE tabs, each with an input (or a
 * textarea), a done mark per filled locale, and "Kopiraj iz srpskog" on the
 * foreign tabs. Serbian is the required source language.
 */
export function L10nInput({
  label,
  value,
  onChange,
  multiline = false,
  rows = 4,
  required = false,
  hint,
  error,
  maxLength,
  className,
  testId,
}: {
  label: string;
  value: L10nValue;
  onChange: (next: L10nValue) => void;
  multiline?: boolean;
  rows?: number;
  required?: boolean;
  hint?: string;
  /** Shown under the field; usually "Srpski tekst je obavezan." */
  error?: string;
  maxLength?: number;
  className?: string;
  /** Put on each control as `${testId}-${locale}`. */
  testId?: string;
}) {
  const baseId = useId();
  return (
    <div role="group" aria-label={label} className={cn("flex min-w-0 flex-col gap-1.5 col-span-full", className)}>
      <LocaleTabs
        label={`${label}: jezik`}
        trigger={(locale) => (
          <>
            <span aria-hidden="true">{L10N_SHORT[locale]}</span>
            <span className="sr-only">{L10N_LABEL[locale]}</span>
            {value[locale].trim().length > 0 ? (
              <Check className="size-3 text-success" aria-label="popunjeno" />
            ) : null}
          </>
        )}
      >
        {(locale) => {
          const id = `${baseId}-${locale}`;
          const hintId = hint !== undefined ? `${id}-hint` : undefined;
          const errorId = error !== undefined && locale === "sr" ? `${id}-error` : undefined;
          const describedBy = [hintId, errorId].filter((item) => item !== undefined).join(" ") || undefined;
          const common = {
            id,
            lang: LOCALE_LANG[locale],
            value: value[locale],
            maxLength,
            "aria-invalid": errorId !== undefined ? true : undefined,
            "aria-describedby": describedBy,
            "data-testid": testId !== undefined ? `${testId}-${locale}` : undefined,
            required: required && locale === "sr",
          };
          const set = (text: string) => onChange({ ...value, [locale]: text });
          return (
            <div className="flex flex-col gap-1.5">
              <div className="flex min-h-7 items-end justify-between gap-2">
                <Label htmlFor={id} className="leading-snug">
                  {label} <span className="text-muted-foreground">({L10N_LABEL[locale].toLowerCase()})</span>
                  {required && locale === "sr" ? <span aria-hidden="true"> *</span> : null}
                </Label>
                {locale !== "sr" && value.sr.trim().length > 0 ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => set(value.sr)}
                  >
                    <Copy aria-hidden="true" />
                    Kopiraj iz srpskog
                  </Button>
                ) : null}
              </div>
              {multiline ? (
                <Textarea rows={rows} {...common} onChange={(event) => set(event.target.value)} />
              ) : (
                <Input {...common} onChange={(event) => set(event.target.value)} />
              )}
              {hint !== undefined ? (
                <p id={hintId} className="text-xs text-muted-foreground">
                  {hint}
                </p>
              ) : null}
              {errorId !== undefined ? (
                <p id={errorId} className="text-xs font-medium text-destructive">
                  {error}
                </p>
              ) : null}
            </div>
          );
        }}
      </LocaleTabs>
    </div>
  );
}

/** How many locales of a value are filled (for list badges: "3/4 jezika"). */
export function l10nCompleteness(value: Partial<Record<L10nKey, string>> | undefined): number {
  return L10N_KEYS.filter((key) => (value?.[key] ?? "").trim().length > 0).length;
}
