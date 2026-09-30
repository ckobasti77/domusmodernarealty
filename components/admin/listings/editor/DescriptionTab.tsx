"use client";

import { Copy, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { useController, useFormContext, useWatch } from "react-hook-form";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/admin/common/ConfirmDialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { L10nKey } from "@/convex/lib/validators";
import { L10N_LABEL, L10N_SHORT } from "@/lib/admin/labels";
import {
  DESCRIPTION_MAX,
  DESCRIPTION_MIN_SR,
  HIGHLIGHTS_MAX,
  HIGHLIGHT_MAX,
  TITLE_MAX,
  TITLE_MIN_SR,
  localeCompleteness,
  type Completeness,
  type ListingForm,
} from "@/lib/admin/listing-form";
import { cn } from "@/lib/utils";
import { Group, TabPanel, TextAreaField, TextField, describedBy, useFieldError } from "./fields";
import { LOCALE_LANG, LocaleTabs } from "./LocaleTabs";

const MARK: Record<Completeness, string> = { complete: "●", partial: "◐", empty: "○" };
const MARK_TEXT: Record<Completeness, string> = { complete: "potpuno", partial: "delimično", empty: "prazno" };
const DIRTY = { shouldDirty: true, shouldValidate: true } as const;

type Translated = Exclude<L10nKey, "sr">;

export function DescriptionTab() {
  return (
    <TabPanel
      id="panel-opis"
      title="Opis"
      description="Naslov, opis i istaknute stavke po jeziku. Kada prevod nedostaje, sajt prikazuje srpski tekst."
    >
      <Group
        title="Tekst oglasa"
        layout="stack"
        description={
          <>
            ● potpuno (naslov najmanje {TITLE_MIN_SR} i opis najmanje {DESCRIPTION_MIN_SR} znakova) · ◐ delimično ·
            ○ prazno
          </>
        }
      >
        <LocaleTabs label="Jezik teksta" trigger={(locale) => <CompletenessMark locale={locale} />}>
          {(locale) => <LocalePanel locale={locale} />}
        </LocaleTabs>
      </Group>
    </TabPanel>
  );
}

function CompletenessMark({ locale }: { locale: L10nKey }) {
  const [title, description] = useWatch<ListingForm, [`title.${L10nKey}`, `description.${L10nKey}`]>({
    name: [`title.${locale}`, `description.${locale}`],
  });
  const status = localeCompleteness(title, description);
  return (
    <>
      <span
        aria-hidden="true"
        className={cn(
          "text-[0.8em] leading-none",
          status === "complete" ? "text-primary" : status === "partial" ? "text-foreground/70" : "text-muted-foreground",
        )}
      >
        {MARK[status]}
      </span>
      <span aria-hidden="true">{L10N_SHORT[locale]}</span>
      <span className="sr-only">
        {L10N_LABEL[locale]}: {MARK_TEXT[status]}
      </span>
    </>
  );
}

function LocalePanel({ locale }: { locale: L10nKey }) {
  const sr = locale === "sr";
  const lang = LOCALE_LANG[locale];
  const language = L10N_LABEL[locale].toLowerCase();
  return (
    <div className="flex flex-col gap-4">
      {sr ? null : <TranslationTools locale={locale} />}
      <TextField
        name={`title.${locale}`}
        id={`f-title-${locale}`}
        label={`Naslov — ${language}`}
        lang={lang}
        autoComplete="off"
        counter={{ max: TITLE_MAX, min: sr ? TITLE_MIN_SR : undefined }}
        hint={
          sr
            ? `Uslov za objavu: najmanje ${TITLE_MIN_SR} znakova. Konkretno: struktura, deo grada, glavna odlika.`
            : undefined
        }
      />
      <TextAreaField
        name={`description.${locale}`}
        id={`f-description-${locale}`}
        label={`Opis — ${language}`}
        lang={lang}
        rows={10}
        counter={{ soft: 1500, max: DESCRIPTION_MAX, min: sr ? DESCRIPTION_MIN_SR : undefined }}
        hint={
          sr
            ? `Uslov za objavu: najmanje ${DESCRIPTION_MIN_SR} znakova. Za SEO: 600–1.500 znakova.`
            : "Za SEO: 600–1.500 znakova."
        }
      />
      <HighlightsField locale={locale} />
    </div>
  );
}

/** "Copy from Serbian" and the "not translated" markers of one target locale. */
function TranslationTools({ locale }: { locale: Translated }) {
  const { getValues, setValue } = useFormContext<ListingForm>();
  const [confirming, setConfirming] = useState(false);
  const [srTitle, srDescription, srHighlights, title, description, highlights] = useWatch<
    ListingForm,
    ["title.sr", "description.sr", "highlights.sr", `title.${Translated}`, `description.${Translated}`, `highlights.${Translated}`]
  >({
    name: ["title.sr", "description.sr", "highlights.sr", `title.${locale}`, `description.${locale}`, `highlights.${locale}`],
  });

  const same = (a: string, b: string) => a.trim() !== "" && a.trim() === b.trim();
  const untranslated = [
    same(title, srTitle) ? "naslov" : null,
    same(description, srDescription) ? "opis" : null,
    highlights.length > 0 && highlights.join("\n") === srHighlights.join("\n") ? "istaknute stavke" : null,
  ].filter((item): item is string => item !== null);

  const hasText = title.trim() !== "" || description.trim() !== "" || highlights.some((line) => line.trim() !== "");
  const srEmpty = srTitle.trim() === "" && srDescription.trim() === "" && srHighlights.length === 0;

  const copy = () => {
    setValue(`title.${locale}`, getValues("title.sr"), DIRTY);
    setValue(`description.${locale}`, getValues("description.sr"), DIRTY);
    setValue(`highlights.${locale}`, [...getValues("highlights.sr")], DIRTY);
    toast.success(`Srpski tekst je kopiran u ${L10N_LABEL[locale].toLowerCase()} — prevedite ga pre objave.`);
  };

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border border-dashed bg-muted/30 px-3 py-2">
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={srEmpty}
        onClick={() => (hasText ? setConfirming(true) : copy())}
      >
        <Copy aria-hidden="true" />
        Kopiraj iz srpskog
      </Button>
      <p className="min-w-0 flex-1 text-xs text-muted-foreground">
        Kopira srpski naslov, opis i stavke kao polazište — tekst zatim treba prevesti.
      </p>
      {untranslated.length > 0 ? (
        <Badge variant="outline" className="border-amber-600/40 text-amber-900 dark:text-amber-200">
          nije prevedeno: {untranslated.join(", ")}
        </Badge>
      ) : null}
      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title="Zameniti postojeći tekst?"
        description={`Naslov, opis i istaknute stavke na jeziku „${L10N_LABEL[locale].toLowerCase()}” biće zamenjeni srpskim tekstom.`}
        confirmLabel="Zameni srpskim"
        onConfirm={copy}
      />
    </div>
  );
}

function HighlightsField({ locale }: { locale: L10nKey }) {
  const { field } = useController<ListingForm, `highlights.${L10nKey}`>({ name: `highlights.${locale}` });
  const listError = useFieldError(`highlights.${locale}`);
  const items = field.value;
  const full = items.length >= HIGHLIGHTS_MAX;
  const legendId = `f-highlights-${locale}-legend`;
  return (
    <fieldset className="min-w-0" aria-labelledby={legendId}>
      <div className="mb-1.5 flex items-end justify-between gap-2">
        <legend id={legendId} className="text-sm font-medium">
          Istaknute stavke
        </legend>
        <span className="text-xs text-muted-foreground tabular-nums">
          {items.length} / {HIGHLIGHTS_MAX}
        </span>
      </div>
      <p className="mb-2 text-xs text-muted-foreground">
        Kratke činjenice, najviše {HIGHLIGHT_MAX} znakova, npr. „Dve terase” ili „Pet minuta do metroa”.
      </p>
      {items.length > 0 ? (
        <ol className="mb-2 flex flex-col gap-2">
          {items.map((line, index) => (
            <HighlightRow
              // Lines have no identity of their own; inputs are controlled, so position is enough.
              key={index}
              locale={locale}
              index={index}
              value={line}
              onChange={(next) => field.onChange(items.map((item, i) => (i === index ? next : item)))}
              onRemove={() => field.onChange(items.filter((_, i) => i !== index))}
            />
          ))}
        </ol>
      ) : null}
      <Button type="button" variant="outline" size="sm" disabled={full} onClick={() => field.onChange([...items, ""])}>
        <Plus aria-hidden="true" />
        Dodaj stavku
      </Button>
      {listError !== undefined ? <p className="mt-1.5 text-xs font-medium text-destructive">{listError}</p> : null}
    </fieldset>
  );
}

function HighlightRow({
  locale,
  index,
  value,
  onChange,
  onRemove,
}: {
  locale: L10nKey;
  index: number;
  value: string;
  onChange: (value: string) => void;
  onRemove: () => void;
}) {
  const error = useFieldError(`highlights.${locale}.${index}`);
  const id = `f-highlight-${locale}-${index}`;
  return (
    <li className="flex flex-col gap-1">
      <div className="flex items-center gap-2">
        <span aria-hidden="true" className="w-5 shrink-0 text-right text-xs text-muted-foreground tabular-nums">
          {index + 1}.
        </span>
        <Label htmlFor={id} className="sr-only">
          Stavka {index + 1}
        </Label>
        <Input
          id={id}
          value={value}
          lang={LOCALE_LANG[locale]}
          autoComplete="off"
          aria-invalid={error !== undefined ? true : undefined}
          aria-describedby={describedBy(id, false, error !== undefined)}
          onChange={(event) => onChange(event.target.value)}
        />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="text-muted-foreground hover:text-destructive"
          aria-label={`Ukloni stavku ${index + 1}`}
          onClick={onRemove}
        >
          <Trash2 aria-hidden="true" />
        </Button>
      </div>
      {error !== undefined ? (
        <p id={`${id}-error`} className="pl-7 text-xs font-medium text-destructive">
          {error}
        </p>
      ) : null}
    </li>
  );
}
