import { fromL10nValue, toL10nValue, type L10nValue } from "@/components/admin/common/L10nInput";
import { L10N_KEYS, type ImageRef, type L10n, type PageBlock, type PageKey } from "@/convex/lib/validators";

/**
 * The site-content editor's form model. Blocks are edited as `BlockForm`s —
 * every localized field a full `{ sr, en, ru, de }` of strings, every list
 * item with a client-side id for React keys — and converted back to the
 * stored `PageBlock` shape on save. Dirty checking compares the converted
 * output, so ids and empty-vs-missing translations never count as edits.
 */

export type ItemForm = { id: string; title: L10nValue; body: L10nValue };
export type QaForm = { id: string; q: L10nValue; a: L10nValue };
export type StatForm = { id: string; value: string; label: L10nValue; isDemo: boolean };

export type BlockForm =
  | { type: "richText"; key: string; title: L10nValue; body: L10nValue }
  | { type: "stats"; key: string; title: L10nValue; items: StatForm[] }
  | { type: "steps"; key: string; title: L10nValue; lede: L10nValue; items: ItemForm[] }
  | { type: "faq"; key: string; items: QaForm[] }
  | {
      type: "cta";
      key: string;
      heading: L10nValue;
      sub: L10nValue;
      note: L10nValue;
      label: L10nValue;
      href: string;
    }
  | { type: "media"; key: string; image: ImageRef | undefined; caption: L10nValue }
  | { type: "list"; key: string; title: L10nValue; items: L10nValue };

/** Which optional fields a block shows: the ones its loaded version has. */
export type BlockShape = {
  title: boolean;
  lede: boolean;
  sub: boolean;
  note: boolean;
};

let nextId = 0;
export function newId(): string {
  nextId += 1;
  return `item-${nextId}`;
}

/** A section key for a new legal-page section, unique enough within a page. */
export function newSectionKey(existing: readonly string[]): string {
  let key = `section-${Date.now().toString(36)}`;
  while (existing.includes(key)) key = `${key}x`;
  return key;
}

/* --------------------------------------------------------- body formats */

const ENTITY: Record<string, string> = { "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&#39;": "'", "&nbsp;": " " };

function decode(text: string): string {
  return text.replace(/&(amp|lt|gt|quot|#39|nbsp);/g, (entity) => ENTITY[entity] ?? entity);
}

function escape(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** `<p>A</p><p>B</p>` → "A\n\nB" — for the landing's plain-text bodies. */
export function htmlToParagraphs(html: string): string {
  return html
    .split(/<\/p>/i)
    .map((part) => decode(part.replace(/<br\s*\/?>/gi, " ").replace(/<[^>]*>/g, "")).replace(/\s+/g, " ").trim())
    .filter((part) => part.length > 0)
    .join("\n\n");
}

/** "A\n\nB" → `<p>A</p><p>B</p>` (a single line break is a space). */
export function paragraphsToHtml(text: string): string {
  return text
    .split(/\n\s*\n/)
    .map((part) => part.replace(/\s*\n\s*/g, " ").trim())
    .filter((part) => part.length > 0)
    .map((part) => `<p>${escape(part)}</p>`)
    .join("");
}

/** Visible text of an HTML body ("" for `<p></p>`). */
export function htmlText(html: string): string {
  return decode(html.replace(/<[^>]*>/g, " ")).replace(/\s+/g, " ").trim();
}

/* ---------------------------------------------------------- conversion */

function mapForm(value: L10nValue, fn: (text: string) => string): L10nValue {
  return { sr: fn(value.sr), en: fn(value.en), ru: fn(value.ru), de: fn(value.de) };
}

function listToForm(items: { sr: string[]; en?: string[]; ru?: string[]; de?: string[] }): L10nValue {
  return {
    sr: items.sr.join("\n"),
    en: (items.en ?? []).join("\n"),
    ru: (items.ru ?? []).join("\n"),
    de: (items.de ?? []).join("\n"),
  };
}

/**
 * `plainBody`: the landing's `richText` bodies are single paragraphs the site
 * renders as text, so they are edited as plain text (blank line = new
 * paragraph) instead of in the rich-text editor.
 */
export function toForm(block: PageBlock, plainBody: boolean): BlockForm {
  switch (block.type) {
    case "richText":
      return {
        type: "richText",
        key: block.key,
        title: toL10nValue(block.title),
        body: plainBody ? mapForm(toL10nValue(block.body), htmlToParagraphs) : toL10nValue(block.body),
      };
    case "stats":
      return {
        type: "stats",
        key: block.key,
        title: toL10nValue(block.title),
        items: block.items.map((item) => ({ id: newId(), value: item.value, label: toL10nValue(item.label), isDemo: item.isDemo })),
      };
    case "steps":
      return {
        type: "steps",
        key: block.key,
        title: toL10nValue(block.title),
        lede: toL10nValue(block.lede),
        items: block.items.map((item) => ({ id: newId(), title: toL10nValue(item.title), body: toL10nValue(item.body) })),
      };
    case "faq":
      return {
        type: "faq",
        key: block.key,
        items: block.items.map((item) => ({ id: newId(), q: toL10nValue(item.q), a: toL10nValue(item.a) })),
      };
    case "cta":
      return {
        type: "cta",
        key: block.key,
        heading: toL10nValue(block.heading),
        sub: toL10nValue(block.sub),
        note: toL10nValue(block.note),
        label: toL10nValue(block.label),
        href: block.href,
      };
    case "media":
      return { type: "media", key: block.key, image: block.image, caption: toL10nValue(block.caption) };
    case "list":
      return { type: "list", key: block.key, title: toL10nValue(block.title), items: listToForm(block.items) };
  }
}

export function shapeOf(block: PageBlock): BlockShape {
  return {
    title: "title" in block && block.title !== undefined,
    lede: block.type === "steps" && block.lede !== undefined,
    sub: block.type === "cta" && block.sub !== undefined,
    note: block.type === "cta" && block.note !== undefined,
  };
}

/** An optional localized field: omitted when nothing is filled in. */
function optional(value: L10nValue): L10n | undefined {
  return L10N_KEYS.some((key) => value[key].trim().length > 0) ? fromL10nValue(value) : undefined;
}

function bodyOut(value: L10nValue, plainBody: boolean): L10n {
  if (!plainBody) {
    const html: L10nValue = { ...value };
    for (const key of L10N_KEYS) if (htmlText(value[key]).length === 0) html[key] = "";
    return fromL10nValue(html);
  }
  return fromL10nValue(mapForm(value, paragraphsToHtml));
}

function listOut(value: L10nValue): { sr: string[]; en?: string[]; ru?: string[]; de?: string[] } {
  const lines = (text: string) =>
    text
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0);
  const out: { sr: string[]; en?: string[]; ru?: string[]; de?: string[] } = { sr: lines(value.sr) };
  for (const key of ["en", "ru", "de"] as const) {
    const items = lines(value[key]);
    if (items.length > 0) out[key] = items;
  }
  return out;
}

function withOptional<T extends object, K extends string>(base: T, key: K, value: L10n | undefined): T & Partial<Record<K, L10n>> {
  return value === undefined ? base : { ...base, [key]: value };
}

export function fromForm(block: BlockForm, plainBody: boolean): PageBlock {
  switch (block.type) {
    case "richText":
      return withOptional(
        { type: "richText" as const, key: block.key, body: bodyOut(block.body, plainBody) },
        "title",
        optional(block.title),
      );
    case "stats":
      return withOptional(
        {
          type: "stats" as const,
          key: block.key,
          items: block.items.map((item) => ({ value: item.value.trim(), label: fromL10nValue(item.label), isDemo: item.isDemo })),
        },
        "title",
        optional(block.title),
      );
    case "steps":
      return withOptional(
        withOptional(
          {
            type: "steps" as const,
            key: block.key,
            items: block.items.map((item) => ({ title: fromL10nValue(item.title), body: fromL10nValue(item.body) })),
          },
          "title",
          optional(block.title),
        ),
        "lede",
        optional(block.lede),
      );
    case "faq":
      return {
        type: "faq",
        key: block.key,
        items: block.items.map((item) => ({ q: fromL10nValue(item.q), a: fromL10nValue(item.a) })),
      };
    case "cta":
      return withOptional(
        withOptional(
          {
            type: "cta" as const,
            key: block.key,
            heading: fromL10nValue(block.heading),
            label: fromL10nValue(block.label),
            href: block.href,
          },
          "sub",
          optional(block.sub),
        ),
        "note",
        optional(block.note),
      );
    case "media": {
      if (block.image === undefined) throw new Error("media block without an image");
      return withOptional({ type: "media" as const, key: block.key, image: block.image }, "caption", optional(block.caption));
    }
    case "list":
      return withOptional({ type: "list" as const, key: block.key, items: listOut(block.items) }, "title", optional(block.title));
  }
}

/**
 * A stable string for dirty checks: the converted blocks (key order is fixed
 * by `fromForm`); a media block still waiting for its image stands as a stub.
 */
export function fingerprint(blocks: readonly BlockForm[], plainBody: boolean): string {
  return JSON.stringify(
    blocks.map((block) =>
      block.type === "media" && block.image === undefined
        ? { type: "media", key: block.key, image: null, caption: optional(block.caption) ?? null }
        : fromForm(block, plainBody),
    ),
  );
}

/* ---------------------------------------------------------- validation */

export type FormErrors = Record<string, string>;

const REQUIRED_SR = "Srpski tekst je obavezan.";

function needsSr(value: L10nValue, html = false): boolean {
  const sr = html ? htmlText(value.sr) : value.sr.trim();
  return sr.length === 0;
}

/** A filled translation without the Serbian source would be dropped on save. */
function orphanTranslation(value: L10nValue): boolean {
  return value.sr.trim().length === 0 && L10N_KEYS.some((key) => key !== "sr" && value[key].trim().length > 0);
}

/**
 * The same rules the server applies (`convex/pagesAdmin.ts`), with messages
 * placed on the field: Serbian required, fields the loaded page had stay
 * required, items need text, a media block needs an image.
 */
export function validate(blocks: readonly BlockForm[], shapes: ReadonlyMap<string, BlockShape>, plainBody: boolean): FormErrors {
  const errors: FormErrors = {};
  const check = (path: string, value: L10nValue, required: boolean, html = false) => {
    if (required ? needsSr(value, html && !plainBody) : orphanTranslation(value)) errors[path] = REQUIRED_SR;
  };

  for (const block of blocks) {
    const shape = shapes.get(block.key) ?? { title: false, lede: false, sub: false, note: false };
    const at = (field: string) => `${block.key}.${field}`;
    switch (block.type) {
      case "richText":
        check(at("title"), block.title, shape.title);
        check(at("body"), block.body, true, true);
        break;
      case "stats":
        check(at("title"), block.title, shape.title);
        block.items.forEach((item, index) => {
          if (item.value.trim().length === 0) errors[at(`items.${index}.value`)] = "Vrednost je obavezna.";
          check(at(`items.${index}.label`), item.label, true);
        });
        break;
      case "steps":
        check(at("title"), block.title, shape.title);
        check(at("lede"), block.lede, shape.lede);
        if (block.items.length === 0) errors[at("items")] = "Dodajte bar jednu stavku.";
        block.items.forEach((item, index) => {
          check(at(`items.${index}.title`), item.title, true);
          check(at(`items.${index}.body`), item.body, true);
        });
        break;
      case "faq":
        if (block.items.length === 0) errors[at("items")] = "Dodajte bar jedno pitanje.";
        block.items.forEach((item, index) => {
          check(at(`items.${index}.q`), item.q, true);
          check(at(`items.${index}.a`), item.a, true);
        });
        break;
      case "cta":
        check(at("heading"), block.heading, true);
        check(at("sub"), block.sub, shape.sub);
        check(at("note"), block.note, shape.note);
        check(at("label"), block.label, true);
        break;
      case "media":
        if (block.image === undefined) errors[at("image")] = "Izaberite sliku.";
        check(at("caption"), block.caption, false);
        break;
      case "list":
        check(at("title"), block.title, shape.title);
        if (block.items.sr.trim().length === 0) errors[at("items")] = "Lista na srpskom mora imati bar jednu stavku.";
        break;
    }
  }
  return errors;
}

/** Public path of each page on the Serbian site, for "Pogledaj na sajtu". */
export const PUBLIC_PATH: Record<PageKey, string> = {
  home: "/sr",
  about: "/sr/o-nama",
  sell: "/sr/prodajte",
  valuation: "/sr/procena",
  contact: "/sr/kontakt",
  privacy: "/sr/privatnost",
  terms: "/sr/uslovi",
  cookies: "/sr/kolacici",
};
