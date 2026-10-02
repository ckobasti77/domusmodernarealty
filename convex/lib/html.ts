/**
 * Server-side checks for the rich text staff store as HTML (journal post
 * bodies, legal page sections). The editors only produce a small allowlisted
 * subset; anything else (pasted markup, a crafted request) is refused before
 * it is written. Rendering sanitizes again (`lib/content/sanitize.ts`), so the
 * two layers do not depend on each other.
 *
 * Pure functions, also imported by the browser: no Convex APIs here.
 */

/** Opening or closing tag; group 1 is the name, group 2 the attribute text. */
export const HTML_TAG_RE = /<\/?([a-zA-Z][a-zA-Z0-9]*)\b([^>]*)>/g;
/** `name="value"` — the only attribute form the editors serialize. */
const ATTR_RE = /([a-zA-Z][a-zA-Z0-9-]*)\s*=\s*"([^"]*)"/g;

/** A check on one attribute's raw (still entity-encoded) value. */
export type AttrRule = (raw: string) => boolean;
/** Allowed tags, each with its allowed attributes. */
export type HtmlAllowlist = Readonly<Record<string, Readonly<Record<string, AttrRule>>>>;

const SAME_ORIGIN_BASE = "https://same-origin.invalid";

/**
 * Whether a link target is safe: an absolute URL with one of `schemes`, a
 * site-relative path or an in-page anchor that stays on this origin. Tabs and
 * line breaks are stripped first, as browsers do, so `java\tscript:` and
 * `/\n/evil.example` are judged as what they become.
 */
export function isSafeHref(href: string, schemes: readonly string[]): boolean {
  const value = href.replace(/[\t\n\r]/g, "").trim();
  if (value.length === 0) return false;
  try {
    if (value.startsWith("/") || value.startsWith("#")) {
      if (value === "#") return false;
      return new URL(value, SAME_ORIGIN_BASE).origin === SAME_ORIGIN_BASE;
    }
    return schemes.includes(new URL(value).protocol);
  } catch {
    return false;
  }
}

/**
 * The URL an attribute value names. Only `&amp;` may appear as a character
 * reference: numeric or other named references (`&#47;`, `&colon;`) are how
 * `javascript:` or `//host` get past a naive prefix check, so they make the
 * value unusable (null).
 */
export function decodeUrlAttr(raw: string): string | null {
  if (/&#|&(?!amp;)[a-z][a-z0-9]*;/i.test(raw)) return null;
  return raw.replace(/&amp;/g, "&");
}

/** A URL-valued attribute rule from a check on the decoded URL. */
export function urlAttr(check: (url: string) => boolean): AttrRule {
  return (raw) => {
    const url = decodeUrlAttr(raw);
    return url !== null && check(url);
  };
}

/** Why this HTML may not be stored, or `null` when it is within the allowlist. */
export function htmlProblem(html: string, allowlist: HtmlAllowlist): string | null {
  if (/<!--|<!\[CDATA\[|<!doctype|<\?/i.test(html)) return "komentari i posebne oznake nisu dozvoljeni";
  for (const match of html.matchAll(HTML_TAG_RE)) {
    const tag = match[1].toLowerCase();
    const attributes = Object.hasOwn(allowlist, tag) ? allowlist[tag] : undefined;
    if (attributes === undefined) return `oznaka <${tag}> nije dozvoljena`;
    if (match[0].startsWith("</")) continue;
    const text = match[2].replace(/\/\s*$/, "").trim();
    if (text.length === 0) continue;
    // Anything the attribute pattern does not consume (unquoted values, bare
    // event handlers, stray characters) is refused outright.
    if (text.replace(ATTR_RE, "").trim().length > 0) return `neispravni atributi u oznaci <${tag}>`;
    for (const [, rawName, value] of text.matchAll(ATTR_RE)) {
      const name = rawName.toLowerCase();
      const rule = Object.hasOwn(attributes, name) ? attributes[name] : undefined;
      if (rule === undefined || !rule(value)) return `atribut „${name}” u oznaci <${tag}> nije dozvoljen`;
    }
  }
  if (html.replace(HTML_TAG_RE, "").includes("<")) return "tekst sadrži neispravan HTML";
  return null;
}

/* -------------------------------------------------------------- allowlists */

const NONE: Readonly<Record<string, AttrRule>> = {};
const anyRel: AttrRule = (raw) => /^[a-z ]*$/.test(raw);
const blankTarget: AttrRule = (raw) => raw === "_blank";
/** `<ol start>`: Tiptap writes it when a list starts at another number ("3. "). */
const listStart: AttrRule = (raw) => /^\d{1,3}$/.test(raw);
/** `<ol type>`: the editors keep the numbering style of a pasted list (a, A, i, I). */
const listType: AttrRule = (raw) => /^[1aAiI]$/.test(raw);

/** Link schemes the legal-page editor accepts. */
export const PAGE_LINK_SCHEMES = ["https:", "http:", "mailto:", "tel:"] as const;

/** Legal-page sections (`pagesAdmin`): h3, paragraphs, lists, quotes, links. */
export const PAGE_HTML: HtmlAllowlist = {
  p: NONE,
  h3: NONE,
  ul: NONE,
  ol: { start: listStart, type: listType },
  li: NONE,
  strong: NONE,
  em: NONE,
  a: {
    href: urlAttr((url) => isSafeHref(url, PAGE_LINK_SCHEMES)),
    target: blankTarget,
    rel: anyRel,
  },
  blockquote: NONE,
  br: NONE,
};

/** Link schemes the journal editor accepts. */
export const POST_LINK_SCHEMES = ["https:", "http:", "mailto:"] as const;

/** Remote images a post may show (the CSP `img-src` list, minus storage). */
export function isAllowedRemoteImage(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" && parsed.hostname === "images.unsplash.com";
  } catch {
    return false;
  }
}

/**
 * Journal post bodies (`postsAdmin.upsert`), mirroring the Tiptap editor.
 * Images must be https Unsplash photos or one of this post's own uploads
 * (`inlineUrls`, the storage URLs of `posts.inlineImages`).
 */
export function postHtml(inlineUrls: ReadonlySet<string>): HtmlAllowlist {
  const dimension: AttrRule = (raw) => /^\d{1,4}$/.test(raw);
  return {
    p: NONE,
    h2: NONE,
    h3: NONE,
    strong: NONE,
    em: NONE,
    u: NONE,
    s: NONE,
    a: {
      href: urlAttr((url) => isSafeHref(url, POST_LINK_SCHEMES)),
      title: () => true,
      target: blankTarget,
      rel: anyRel,
    },
    ul: NONE,
    ol: { start: listStart, type: listType },
    li: NONE,
    blockquote: NONE,
    img: {
      src: urlAttr((url) => inlineUrls.has(url) || isAllowedRemoteImage(url)),
      alt: () => true,
      width: dimension,
      height: dimension,
    },
    br: NONE,
    hr: NONE,
  };
}
