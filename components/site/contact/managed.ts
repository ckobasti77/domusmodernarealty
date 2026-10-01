import type { Locale } from "@/i18n/routing";
import { findBlock, htmlToText, localizedText, type Localized, type PublicPage } from "@/lib/content/pages";
import { fillPlaceholders, type PlaceholderValues } from "@/lib/content/placeholders";
import { pickL10n, pickL10nList } from "@/lib/l10n";

/**
 * Readers for the managed blocks of the sell and contact pages (PRD B10,
 * `pages.sell` / `pages.contact`). Each returns `null` (or an empty list) when
 * the page, the block or its Serbian source is missing, so the caller falls
 * back to its built-in `messages` copy instead of rendering a hole.
 *
 * `lang` is set only when the text is NOT in the page's language (a missing
 * translation fell back to Serbian), which is exactly when the element needs
 * its own `lang` attribute.
 */

type Page = Pick<PublicPage, "blocks"> | null;

/** A text and, when it differs from the page, the language it is in. */
export type PageText = { text: string; lang?: string };

function own(value: Localized, locale: Locale): PageText {
  return value.lang === locale ? { text: value.text } : { text: value.text, lang: value.lang };
}

/** The managed text when there is one, otherwise the built-in copy. */
export function textOr(value: Localized | null, locale: Locale, fallback: string): PageText {
  return value !== null ? own(value, locale) : { text: fallback };
}

export type ManagedIntro = {
  title: PageText | null;
  /** The first paragraph as plain text, for the page band's lede. */
  lead: PageText | null;
  /** Everything after the first paragraph, sanitized later by `RichText`. */
  rest: { html: string; lang?: string } | null;
};

const FIRST_PARAGRAPH = /^\s*<p\b[^>]*>[\s\S]*?<\/p>/i;

/**
 * The `lede` richText block, split so each part can sit where it reads best:
 * the opening paragraph becomes the band's lede (plain text), the rest stays
 * rich text for the body. Placeholders (`{{email}}`…) are filled first.
 */
export function managedIntro(page: Page, locale: Locale, values: PlaceholderValues | null): ManagedIntro | null {
  const block = findBlock(page, "lede", "richText");
  if (block === undefined) return null;
  const title = localizedText(block.title, locale);
  const body = pickL10n(block.body, locale);
  const lang = body.lang === locale ? undefined : body.lang;
  const html = fillPlaceholders(body.text, values).trim();
  const first = FIRST_PARAGRAPH.exec(html);
  const leadText = first !== null ? htmlToText(first[0]) : "";
  const rest = (first !== null ? html.slice(first[0].length) : html).trim();
  return {
    title: title !== null ? own(title, locale) : null,
    lead: leadText.length > 0 ? { text: leadText, ...(lang !== undefined ? { lang } : {}) } : null,
    rest: htmlToText(rest).length > 0 ? { html: rest, ...(lang !== undefined ? { lang } : {}) } : null,
  };
}

export type ManagedList = { title: PageText | null; items: string[]; lang?: string };

/** A `list` block (bullet points), `null` when it holds no items. */
export function managedList(page: Page, key: string, locale: Locale): ManagedList | null {
  const block = findBlock(page, key, "list");
  if (block === undefined) return null;
  const picked = pickL10nList(block.items, locale);
  const items = picked.items.map((item) => item.trim()).filter((item) => item.length > 0);
  if (items.length === 0) return null;
  const title = localizedText(block.title, locale);
  return {
    title: title !== null ? own(title, locale) : null,
    items,
    ...(picked.lang !== locale ? { lang: picked.lang } : {}),
  };
}

export type StepEntry = { title: PageText; body: PageText };
export type ManagedSteps = { title: PageText | null; lede: PageText | null; items: StepEntry[] };

/** A `steps` block; steps with an empty title are skipped. */
export function managedSteps(page: Page, key: string, locale: Locale): ManagedSteps | null {
  const block = findBlock(page, key, "steps");
  if (block === undefined) return null;
  const items: StepEntry[] = [];
  for (const item of block.items) {
    const title = localizedText(item.title, locale);
    if (title === null) continue;
    const body = localizedText(item.body, locale);
    items.push({ title: own(title, locale), body: body !== null ? own(body, locale) : { text: "" } });
  }
  if (items.length === 0) return null;
  const title = localizedText(block.title, locale);
  const lede = localizedText(block.lede, locale);
  return {
    title: title !== null ? own(title, locale) : null,
    lede: lede !== null ? own(lede, locale) : null,
    items,
  };
}

export type FaqEntry = { id: string; question: PageText; answer: PageText };

/** The `faq` block; plain-text answers get their placeholders filled unescaped. */
export function managedFaq(page: Page, locale: Locale, values: PlaceholderValues | null): FaqEntry[] {
  const block = findBlock(page, "faq", "faq");
  if (block === undefined) return [];
  const out: FaqEntry[] = [];
  block.items.forEach((item, index) => {
    const question = localizedText(item.q, locale);
    const answer = localizedText(item.a, locale);
    if (question === null || answer === null) return;
    out.push({
      id: `q${index + 1}`,
      question: own({ text: fillPlaceholders(question.text, values, false), lang: question.lang }, locale),
      answer: own({ text: fillPlaceholders(answer.text, values, false), lang: answer.lang }, locale),
    });
  });
  return out;
}
