import { fetchQuery } from "convex/nextjs";
import type { FunctionReturnType } from "convex/server";
import { api } from "@/convex/_generated/api";
import type { PageBlock, PageKey } from "@/convex/lib/validators";
import type { Locale } from "@/i18n/routing";
import { type L10nValue, pickL10n } from "@/lib/l10n";

/**
 * Reading the managed site content (PRD B10, `pages` table) on the public
 * site. Pages are read by block `key`; every reader falls back to the
 * built-in copy in `messages/*.json` when a page, a block or a field is
 * missing, so removing the demo content or a half-filled block never breaks
 * a page.
 *
 * Text conventions (enforced by `convex/pagesAdmin.ts`): `richText.body` is
 * HTML (`<p>` paragraphs plus a few inline tags); every other field is plain
 * text. `blockText` hands the landing plain text either way.
 */

export type PublicPage = NonNullable<FunctionReturnType<typeof api.pages.get>>;

/** One page's content, `null` when the page does not exist. Server-side reads only. */
export async function getPage(key: PageKey): Promise<PublicPage | null> {
  return await fetchQuery(api.pages.get, { key });
}

/**
 * The landing's block contract: which block of the `home` page feeds which
 * section, and of what type (the seed in `convex/seed/content/pages.ts` and
 * the admin editor follow the same keys). Eyebrows, alt texts, button labels
 * and links are part of the design and stay in `messages` / code.
 */
export const HOME_BLOCKS = {
  /** `title` = H1, `body` = lede. */
  hero: { key: "hero", type: "richText" },
  /** `body` = the statement. */
  intro: { key: "intro", type: "richText" },
  /** `title` = heading, `body` = lede. */
  neighborhoods: { key: "neighborhoodsIntro", type: "richText" },
  /** `title` = heading, six `items` in the order of the service links. */
  services: { key: "services", type: "steps" },
  /** `title` = heading, `body` = lede. */
  tours: { key: "tours3d", type: "richText" },
  /** `title` = heading, `lede`, five `items`. */
  process: { key: "process", type: "steps" },
  /** `title` = heading, up to four `items` (value, label, isDemo). */
  numbers: { key: "numbers", type: "stats" },
  /** `heading`, `sub` = lede, `note` = the on-site valuation note. */
  valuation: { key: "valuationCta", type: "cta" },
  /** `heading`, `sub` = lede. */
  final: { key: "finalCta", type: "cta" },
} as const satisfies Record<string, { key: string; type: PageBlock["type"] }>;

/** A text and the BCP-47 language it is actually in (Serbian when it fell back). */
export type Localized = { text: string; lang: string };

type BlockOf<T extends PageBlock["type"]> = Extract<PageBlock, { type: T }>;

/** The block stored under `key`, only if it has the expected type. */
export function findBlock<T extends PageBlock["type"]>(
  page: Pick<PublicPage, "blocks"> | null,
  key: string,
  type: T,
): BlockOf<T> | undefined {
  const block = page?.blocks.find((item) => item.key === key);
  if (block === undefined || block.type !== type) return undefined;
  return block as BlockOf<T>;
}

const ENTITIES: Record<string, string> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#39;": "'",
  "&nbsp;": " ",
};

/**
 * Plain text of a `richText` body: paragraphs joined by a space, tags
 * dropped, the entities the editor writes decoded. For headings and ledes the
 * landing renders as text — never for HTML output (that is sanitized and
 * rendered as HTML).
 */
export function htmlToText(html: string): string {
  return html
    .replace(/<\/(p|h3|li|blockquote)>\s*/gi, " ")
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]*>/g, "")
    .replace(/&(amp|lt|gt|quot|#39|nbsp);/g, (entity) => ENTITIES[entity] ?? entity)
    .replace(/[ \t\r\n]+/g, " ")
    .trim();
}

type TextField = "title" | "body" | "lede" | "heading" | "sub" | "note" | "label" | "caption";

function fieldsOf(block: PageBlock): Partial<Record<TextField, L10nValue>> {
  switch (block.type) {
    case "richText":
      return { title: block.title, body: block.body };
    case "steps":
      return { title: block.title, lede: block.lede };
    case "stats":
    case "list":
      return { title: block.title };
    case "cta":
      return { heading: block.heading, sub: block.sub, note: block.note, label: block.label };
    case "media":
      return { caption: block.caption };
    case "faq":
      return {};
  }
}

/** A localized value as text: the locale's translation, else Serbian (like `pickL10n`). */
export function localizedText(value: L10nValue | undefined, locale: Locale, html = false): Localized | null {
  if (value === undefined) return null;
  const picked = pickL10n(value, locale);
  const text = html ? htmlToText(picked.text) : picked.text.trim();
  return text.length > 0 ? { text, lang: picked.lang } : null;
}

/**
 * One text field of a block (`blockText(home, "hero", "title", "en")`), or
 * `null` when the page, the block, the field or its Serbian source is missing
 * — the caller then uses its built-in copy.
 */
export function blockText(
  page: Pick<PublicPage, "blocks"> | null,
  key: string,
  field: TextField,
  locale: Locale,
): Localized | null {
  const block = page?.blocks.find((item) => item.key === key);
  if (block === undefined) return null;
  return localizedText(fieldsOf(block)[field], locale, field === "body");
}
