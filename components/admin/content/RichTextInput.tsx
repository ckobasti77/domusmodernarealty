"use client";

import { Check, Copy } from "lucide-react";
import dynamic from "next/dynamic";
import { useId } from "react";
import type { L10nValue } from "@/components/admin/common/L10nInput";
import { LOCALE_LANG, LocaleTabs } from "@/components/admin/listings/editor/LocaleTabs";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { L10N_LABEL, L10N_SHORT } from "@/lib/admin/labels";
import { htmlText } from "./model";

/** Tiptap is heavy and client-only: loaded when the first rich field mounts. */
const RichTextEditor = dynamic(() => import("./RichTextEditor").then((mod) => mod.RichTextEditor), {
  ssr: false,
  loading: () => <Skeleton className="h-50 w-full" />,
});

/**
 * `L10nInput`'s rich-text twin: SR / EN / RU / DE tabs, a done mark per
 * filled locale, "Kopiraj iz srpskog" on the foreign tabs, and the formatted
 * editor for the active locale only.
 */
export function RichTextInput({
  label,
  value,
  onChange,
  required = false,
  hint,
  error,
  testId,
}: {
  label: string;
  value: L10nValue;
  onChange: (next: L10nValue) => void;
  required?: boolean;
  hint?: string;
  error?: string;
  testId?: string;
}) {
  const baseId = useId();
  return (
    <div role="group" aria-label={label} className="col-span-full flex min-w-0 flex-col gap-1.5">
      <LocaleTabs
        label={`${label}: jezik`}
        trigger={(locale) => (
          <>
            <span aria-hidden="true">{L10N_SHORT[locale]}</span>
            <span className="sr-only">{L10N_LABEL[locale]}</span>
            {htmlText(value[locale]).length > 0 ? <Check className="size-3 text-success" aria-label="popunjeno" /> : null}
          </>
        )}
      >
        {(locale) => {
          const labelId = `${baseId}-${locale}-label`;
          const hintId = hint !== undefined ? `${baseId}-${locale}-hint` : undefined;
          const errorId = error !== undefined && locale === "sr" ? `${baseId}-${locale}-error` : undefined;
          const describedBy = [hintId, errorId].filter((item) => item !== undefined).join(" ") || undefined;
          return (
            <div className="flex flex-col gap-1.5">
              <div className="flex min-h-7 items-end justify-between gap-2">
                <span id={labelId} className="text-sm leading-snug font-medium">
                  {label} <span className="text-muted-foreground">({L10N_LABEL[locale].toLowerCase()})</span>
                  {required && locale === "sr" ? <span aria-hidden="true"> *</span> : null}
                </span>
                {locale !== "sr" && htmlText(value.sr).length > 0 ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => onChange({ ...value, [locale]: value.sr })}
                  >
                    <Copy aria-hidden="true" />
                    Kopiraj iz srpskog
                  </Button>
                ) : null}
              </div>
              <RichTextEditor
                value={value[locale]}
                onChange={(html) => onChange({ ...value, [locale]: html })}
                labelId={labelId}
                lang={LOCALE_LANG[locale]}
                invalid={errorId !== undefined}
                describedBy={describedBy}
                testId={testId !== undefined ? `${testId}-${locale}` : undefined}
              />
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
