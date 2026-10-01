"use client";

import type { ReactNode } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { L10N_KEYS, type L10nKey } from "@/convex/lib/validators";
import { L10N_LABEL, L10N_SHORT } from "@/lib/admin/labels";
import { cn } from "@/lib/utils";

/** `lang` for inputs holding each stored locale (`sr` is stored for sr-Latn). */
export const LOCALE_LANG: Record<L10nKey, string> = { sr: "sr-Latn", en: "en", ru: "ru", de: "de" };

/**
 * SR / EN / RU / DE switcher for localized content. Uncontrolled unless
 * `value` is passed. `trigger` replaces the short code (e.g. with a
 * completeness mark); it must keep the language name readable.
 */
export function LocaleTabs({
  label,
  children,
  trigger,
  value,
  onValueChange,
  className,
}: {
  label: string;
  children: (locale: L10nKey) => ReactNode;
  trigger?: (locale: L10nKey) => ReactNode;
  value?: L10nKey;
  onValueChange?: (locale: L10nKey) => void;
  className?: string;
}) {
  return (
    <Tabs
      defaultValue={value === undefined ? "sr" : undefined}
      value={value}
      onValueChange={(next) => {
        const locale = L10N_KEYS.find((key) => key === next);
        if (locale !== undefined) onValueChange?.(locale);
      }}
      className={cn("gap-3", className)}
    >
      <TabsList aria-label={label} className="h-9 max-md:h-11">
        {L10N_KEYS.map((locale) => (
          <TabsTrigger key={locale} value={locale} className="gap-1.5 px-3">
            {trigger !== undefined ? (
              trigger(locale)
            ) : (
              <>
                <span aria-hidden="true">{L10N_SHORT[locale]}</span>
                <span className="sr-only">{L10N_LABEL[locale]}</span>
              </>
            )}
          </TabsTrigger>
        ))}
      </TabsList>
      {L10N_KEYS.map((locale) => (
        <TabsContent key={locale} value={locale}>
          {children(locale)}
        </TabsContent>
      ))}
    </Tabs>
  );
}
