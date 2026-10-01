"use client";

import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { useId, type ReactNode } from "react";
import { describedBy, FieldShell } from "@/components/admin/common/form";
import { ImageField } from "@/components/admin/common/ImageField";
import { EMPTY_L10N, L10nInput, type L10nValue } from "@/components/admin/common/L10nInput";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { CTA_TARGET_LABEL, fieldLabel, isHidden, type BlockInfo, type FieldName } from "./labels";
import { newId, type BlockForm, type BlockShape, type FormErrors } from "./model";
import { RichTextInput } from "./RichTextInput";

export type BlockFieldsProps = {
  block: BlockForm;
  onChange: (next: BlockForm) => void;
  info: BlockInfo;
  shape: BlockShape;
  /** Legal-page sections always offer a title. */
  sectionPage: boolean;
  /** The landing: lists keep their length (each item is wired to a slot). */
  fixedItems: boolean;
  /** The landing's bodies are plain text, not the rich editor. */
  plainBody: boolean;
  /** Admin/manager: may take the "demo" flag off a figure (the server checks too). */
  canClearDemo: boolean;
  errors: FormErrors;
  ctaTargets: readonly string[];
  mediaPreview?: string;
};

/** Up / down / remove for one item of a list; keyboard-operable, labelled. */
function ItemControls({
  index,
  count,
  noun,
  onMove,
  onRemove,
}: {
  index: number;
  count: number;
  noun: string;
  onMove: (to: number) => void;
  onRemove: () => void;
}) {
  return (
    <div className="flex items-center gap-1">
      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-label={`Pomeri gore: ${noun} ${index + 1}`}
        disabled={index === 0}
        onClick={() => onMove(index - 1)}
      >
        <ArrowUp aria-hidden="true" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-label={`Pomeri dole: ${noun} ${index + 1}`}
        disabled={index === count - 1}
        onClick={() => onMove(index + 1)}
      >
        <ArrowDown aria-hidden="true" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-label={`Uklonite: ${noun} ${index + 1}`}
        disabled={count <= 1}
        onClick={onRemove}
      >
        <Trash2 aria-hidden="true" />
      </Button>
    </div>
  );
}

function moveItem<T>(items: readonly T[], from: number, to: number): T[] {
  const next = [...items];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

/** A list of item cards with optional add / reorder / remove. */
function ItemList<T extends { id: string }>({
  items,
  onChange,
  noun,
  editable,
  max,
  create,
  error,
  render,
}: {
  items: readonly T[];
  onChange: (next: T[]) => void;
  noun: string;
  editable: boolean;
  max: number;
  create: () => T;
  error?: string;
  render: (item: T, index: number, update: (next: T) => void) => ReactNode;
}) {
  return (
    <div className="col-span-full flex flex-col gap-3">
      <ol className="flex flex-col gap-3">
        {items.map((item, index) => (
          <li key={item.id} className="rounded-lg border bg-background p-3 md:p-4">
            <div className="mb-3 flex min-h-8 items-center justify-between gap-2">
              <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                {noun} {index + 1}
              </p>
              {editable ? (
                <ItemControls
                  index={index}
                  count={items.length}
                  noun={noun.toLowerCase()}
                  onMove={(to) => onChange(moveItem(items, index, to))}
                  onRemove={() => onChange(items.filter((other) => other.id !== item.id))}
                />
              ) : null}
            </div>
            <div className="grid gap-4">
              {render(item, index, (next) => onChange(items.map((other) => (other.id === item.id ? next : other))))}
            </div>
          </li>
        ))}
      </ol>
      {error !== undefined ? <p className="text-xs font-medium text-destructive">{error}</p> : null}
      {editable && items.length < max ? (
        <div>
          <Button type="button" variant="outline" size="sm" onClick={() => onChange([...items, create()])}>
            <Plus aria-hidden="true" />
            Dodajte: {noun.toLowerCase()}
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function StatValueField({
  value,
  onChange,
  error,
  testId,
}: {
  value: string;
  onChange: (next: string) => void;
  error?: string;
  testId: string;
}) {
  const id = useId();
  return (
    <FieldShell id={id} label="Vrednost" hint="Broj kako se prikazuje, npr. 12 ili 300+." error={error}>
      <Input
        id={id}
        value={value}
        maxLength={24}
        onChange={(event) => onChange(event.target.value)}
        aria-invalid={error !== undefined || undefined}
        aria-describedby={describedBy(id, true, error !== undefined)}
        data-testid={testId}
        className="max-w-48"
      />
    </FieldShell>
  );
}

function DemoSwitch({
  checked,
  onChange,
  disabled,
  testId,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  disabled: boolean;
  testId: string;
}) {
  const id = useId();
  return (
    <div className="flex items-start gap-3 rounded-md bg-muted/50 p-3">
      <Switch
        id={id}
        checked={checked}
        onCheckedChange={onChange}
        disabled={disabled}
        aria-describedby={`${id}-hint`}
        data-testid={testId}
      />
      <div className="flex flex-col gap-0.5">
        <Label htmlFor={id}>Demo vrednost</Label>
        <p id={`${id}-hint`} className="text-xs leading-snug text-muted-foreground">
          Dok je bar jedna brojka označena kao demo, sajt ispod brojki prikazuje napomenu da su to demo vrednosti.
          {disabled
            ? " Oznaku menja administrator ili menadžer, kada potvrdi stvaran podatak agencije."
            : " Isključite tek kada upišete stvaran podatak agencije."}
        </p>
      </div>
    </div>
  );
}

function HrefField({
  value,
  onChange,
  targets,
  label,
  testId,
}: {
  value: string;
  onChange: (next: string) => void;
  targets: readonly string[];
  label: string;
  testId: string;
}) {
  const id = useId();
  return (
    <FieldShell id={id} label={label}>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger id={id} className="w-full max-w-72" data-testid={testId}>
          <SelectValue placeholder="Izaberite stranicu" />
        </SelectTrigger>
        <SelectContent>
          {targets.map((target) => (
            <SelectItem key={target} value={target}>
              {CTA_TARGET_LABEL[target] ?? target}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </FieldShell>
  );
}

const MAX_ITEMS = 20;

export function BlockFields({
  block,
  onChange,
  info,
  shape,
  sectionPage,
  fixedItems,
  plainBody,
  canClearDemo,
  errors,
  ctaTargets,
  mediaPreview,
}: BlockFieldsProps) {
  const testId = (field: string) => `block-${block.key}-${field}`;
  const error = (path: string) => errors[`${block.key}.${path}`];
  const label = (field: FieldName) => fieldLabel(info, field);
  const text = (
    field: FieldName,
    value: L10nValue,
    set: (next: L10nValue) => void,
    options: { required: boolean; multiline?: boolean; maxLength?: number; hint?: string },
  ) => (
    <L10nInput
      label={label(field)}
      value={value}
      onChange={set}
      required={options.required}
      multiline={options.multiline}
      rows={3}
      maxLength={options.maxLength}
      hint={options.hint}
      error={error(field)}
      testId={testId(field)}
    />
  );

  switch (block.type) {
    case "richText":
      return (
        <>
          {shape.title || sectionPage
            ? text("title", block.title, (title) => onChange({ ...block, title }), { required: shape.title, maxLength: 200 })
            : null}
          {plainBody ? (
            text("body", block.body, (body) => onChange({ ...block, body }), {
              required: true,
              multiline: true,
              hint: "Običan tekst. Prazan red započinje novi pasus.",
            })
          ) : (
            <RichTextInput
              label={label("body")}
              value={block.body}
              onChange={(body) => onChange({ ...block, body })}
              required
              error={error("body")}
              testId={testId("body")}
            />
          )}
        </>
      );

    case "steps": {
      const noun = label("item");
      return (
        <>
          {shape.title ? text("title", block.title, (title) => onChange({ ...block, title }), { required: true, maxLength: 200 }) : null}
          {shape.lede
            ? text("lede", block.lede, (lede) => onChange({ ...block, lede }), { required: true, multiline: true, maxLength: 600 })
            : null}
          <ItemList
            items={block.items}
            onChange={(items) => onChange({ ...block, items })}
            noun={noun}
            editable={!fixedItems}
            max={MAX_ITEMS}
            error={error("items")}
            create={() => ({ id: newId(), title: EMPTY_L10N, body: EMPTY_L10N })}
            render={(item, index, update) => (
              <>
                <L10nInput
                  label={`${noun}: naslov`}
                  value={item.title}
                  onChange={(title) => update({ ...item, title })}
                  required
                  maxLength={160}
                  error={error(`items.${index}.title`)}
                  testId={testId(`item${index + 1}-title`)}
                />
                <L10nInput
                  label={`${noun}: tekst`}
                  value={item.body}
                  onChange={(body) => update({ ...item, body })}
                  required
                  multiline
                  rows={3}
                  maxLength={2000}
                  error={error(`items.${index}.body`)}
                  testId={testId(`item${index + 1}-body`)}
                />
              </>
            )}
          />
        </>
      );
    }

    case "stats": {
      const noun = label("item");
      return (
        <>
          {shape.title ? text("title", block.title, (title) => onChange({ ...block, title }), { required: true, maxLength: 200 }) : null}
          <ItemList
            items={block.items}
            onChange={(items) => onChange({ ...block, items })}
            noun={noun}
            editable={!fixedItems}
            max={8}
            create={() => ({ id: newId(), value: "", label: EMPTY_L10N, isDemo: false })}
            render={(item, index, update) => (
              <>
                <StatValueField
                  value={item.value}
                  onChange={(value) => update({ ...item, value })}
                  error={error(`items.${index}.value`)}
                  testId={testId(`item${index + 1}-value`)}
                />
                <L10nInput
                  label={`${noun}: opis`}
                  value={item.label}
                  onChange={(next) => update({ ...item, label: next })}
                  required
                  maxLength={80}
                  error={error(`items.${index}.label`)}
                  testId={testId(`item${index + 1}-label`)}
                />
                <DemoSwitch
                  checked={item.isDemo}
                  onChange={(isDemo) => update({ ...item, isDemo })}
                  disabled={!canClearDemo}
                  testId={testId(`item${index + 1}-demo`)}
                />
              </>
            )}
          />
        </>
      );
    }

    case "faq":
      return (
        <ItemList
          items={block.items}
          onChange={(items) => onChange({ ...block, items })}
          noun="Pitanje"
          editable={!fixedItems}
          max={MAX_ITEMS}
          error={error("items")}
          create={() => ({ id: newId(), q: EMPTY_L10N, a: EMPTY_L10N })}
          render={(item, index, update) => (
            <>
              <L10nInput
                label="Pitanje"
                value={item.q}
                onChange={(q) => update({ ...item, q })}
                required
                maxLength={160}
                error={error(`items.${index}.q`)}
                testId={testId(`item${index + 1}-q`)}
              />
              <L10nInput
                label="Odgovor"
                value={item.a}
                onChange={(a) => update({ ...item, a })}
                required
                multiline
                rows={4}
                maxLength={2000}
                error={error(`items.${index}.a`)}
                testId={testId(`item${index + 1}-a`)}
              />
            </>
          )}
        />
      );

    case "cta":
      return (
        <>
          {text("heading", block.heading, (heading) => onChange({ ...block, heading }), { required: true, maxLength: 200 })}
          {shape.sub
            ? text("sub", block.sub, (sub) => onChange({ ...block, sub }), { required: true, multiline: true, maxLength: 600 })
            : null}
          {shape.note
            ? text("note", block.note, (note) => onChange({ ...block, note }), { required: true, multiline: true, maxLength: 600 })
            : null}
          {isHidden(info, "label")
            ? null
            : text("label", block.label, (next) => onChange({ ...block, label: next }), { required: true, maxLength: 60 })}
          {isHidden(info, "href") ? null : (
            <HrefField
              value={block.href}
              onChange={(href) => onChange({ ...block, href })}
              targets={ctaTargets}
              label={label("href")}
              testId={testId("href")}
            />
          )}
        </>
      );

    case "media":
      return (
        <>
          <div className="col-span-full">
            <ImageField
              label="Slika"
              value={block.image}
              previewUrl={mediaPreview}
              onChange={(image) => onChange({ ...block, image })}
              testId={testId("image")}
            />
            {error("image") !== undefined ? (
              <p className="mt-1.5 text-xs font-medium text-destructive">{error("image")}</p>
            ) : null}
          </div>
          {text("caption", block.caption, (caption) => onChange({ ...block, caption }), { required: false, maxLength: 600 })}
        </>
      );

    case "list":
      return (
        <>
          {shape.title ? text("title", block.title, (title) => onChange({ ...block, title }), { required: true, maxLength: 200 }) : null}
          <L10nInput
            label="Stavke"
            value={block.items}
            onChange={(items) => onChange({ ...block, items })}
            required
            multiline
            rows={6}
            hint="Jedna stavka po redu."
            error={error("items")}
            testId={testId("items")}
          />
        </>
      );
  }
}
