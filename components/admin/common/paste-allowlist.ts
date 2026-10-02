import { Extension } from "@tiptap/react";
import type { HtmlAllowlist } from "@/convex/lib/html";
import { cleanPastedHtml } from "@/lib/admin/rich-text";

/**
 * A Tiptap extension for the admin's rich-text editors: pasted (or dropped)
 * HTML loses what `allowlist` (the server's, `convex/lib/html.ts`) would
 * refuse before the editor parses it, so a paste from Word, Google Docs or a
 * web page can no longer sink the whole save.
 */
export function pasteAllowlist(allowlist: HtmlAllowlist) {
  return Extension.create({
    name: "pasteAllowlist",
    transformPastedHTML: (html) => cleanPastedHtml(html, allowlist),
  });
}
