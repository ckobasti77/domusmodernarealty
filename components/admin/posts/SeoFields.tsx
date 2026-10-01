"use client";

import { useId } from "react";
import type { L10nValue } from "@/components/admin/common/L10nInput";
import { LOCALE_LANG, LocaleTabs } from "@/components/admin/listings/editor/LocaleTabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { META_DESCRIPTION_MAX, META_DESCRIPTION_SOFT, META_TITLE_MAX, META_TITLE_SOFT } from "./form";

/** `42/60`, amber past the length Google shows in full. */
function Counter({ id, length, soft, max }: { id: string; length: number; soft: number; max: number }) {
  return (
    <span
      id={id}
      className={cn(
        "text-xs tabular-nums",
        length > soft ? "font-medium text-amber-700 dark:text-amber-300" : "text-muted-foreground",
      )}
    >
      {length}/{soft}
      <span className="sr-only">
        {` znakova; preporuka do ${soft}, najviše ${max}`}
      </span>
    </span>
  );
}

/**
 * Meta title and description per locale. Empty means the site falls back to
 * the post's title and short description, so both are optional.
 */
export function SeoFields({
  metaTitle,
  metaDescription,
  onChange,
}: {
  metaTitle: L10nValue;
  metaDescription: L10nValue;
  onChange: (next: { metaTitle: L10nValue; metaDescription: L10nValue }) => void;
}) {
  const baseId = useId();
  return (
    <LocaleTabs label="Jezik meta podataka">
      {(locale) => {
        const titleId = `${baseId}-title-${locale}`;
        const descriptionId = `${baseId}-description-${locale}`;
        return (
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <div className="flex items-end justify-between gap-2">
                <Label htmlFor={titleId}>Meta naslov</Label>
                <Counter
                  id={`${titleId}-count`}
                  length={metaTitle[locale].length}
                  soft={META_TITLE_SOFT}
                  max={META_TITLE_MAX}
                />
              </div>
              <Input
                id={titleId}
                lang={LOCALE_LANG[locale]}
                value={metaTitle[locale]}
                maxLength={META_TITLE_MAX}
                autoComplete="off"
                aria-describedby={`${titleId}-count`}
                onChange={(event) =>
                  onChange({ metaTitle: { ...metaTitle, [locale]: event.target.value }, metaDescription })
                }
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <div className="flex items-end justify-between gap-2">
                <Label htmlFor={descriptionId}>Meta opis</Label>
                <Counter
                  id={`${descriptionId}-count`}
                  length={metaDescription[locale].length}
                  soft={META_DESCRIPTION_SOFT}
                  max={META_DESCRIPTION_MAX}
                />
              </div>
              <Textarea
                id={descriptionId}
                lang={LOCALE_LANG[locale]}
                rows={3}
                value={metaDescription[locale]}
                maxLength={META_DESCRIPTION_MAX}
                aria-describedby={`${descriptionId}-count`}
                onChange={(event) =>
                  onChange({ metaTitle, metaDescription: { ...metaDescription, [locale]: event.target.value } })
                }
              />
            </div>
          </div>
        );
      }}
    </LocaleTabs>
  );
}
