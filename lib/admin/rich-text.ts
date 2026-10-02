/**
 * Pasted rich text, cleaned before the admin's Tiptap editors parse it.
 *
 * Tiptap keeps some attributes of pasted elements in its document: a link's
 * `target`, `rel`, `class` and `title`, an image's `alt`, `title`, `width` and
 * `height`, an ordered list's `start` and `type`. Copied from Word, Google
 * Docs or a web page they can carry values the server's allowlist refuses
 * (`convex/lib/html.ts`: `postHtml`, `PAGE_HTML`), which used to sink the
 * whole save. Each such attribute is checked against the allowlist's own rule
 * and dropped when refused. `href` and `src` are left to the link and image
 * parse rules and to the server; every other attribute is ignored by the
 * editors' schemas anyway (`style` must even survive: Tiptap reads a pasted
 * list's numbering style from it).
 */
import type { HtmlAllowlist } from "@/convex/lib/html";

const KEPT_BY_EDITOR: Readonly<Record<string, readonly string[]>> = {
  a: ["target", "rel", "class", "title"],
  img: ["alt", "title", "width", "height"],
  ol: ["start", "type"],
};

/** An attribute value as the editor serializes it, which is what the allowlist rules read. */
function serialized(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/ /g, "&nbsp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/** `html` (a paste or a drop) without the attributes `allowlist` would refuse. Needs a DOM. */
export function cleanPastedHtml(html: string, allowlist: HtmlAllowlist): string {
  const doc = new DOMParser().parseFromString(html, "text/html");
  for (const [tag, names] of Object.entries(KEPT_BY_EDITOR)) {
    const rules = Object.hasOwn(allowlist, tag) ? allowlist[tag] : undefined;
    for (const element of doc.body.querySelectorAll(tag)) {
      for (const name of names) {
        const value = element.getAttribute(name);
        if (value === null) continue;
        const rule = rules !== undefined && Object.hasOwn(rules, name) ? rules[name] : undefined;
        if (rule === undefined || !rule(serialized(value))) element.removeAttribute(name);
      }
    }
  }
  return doc.body.innerHTML;
}
