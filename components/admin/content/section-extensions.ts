import type { Extensions } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { pasteAllowlist } from "@/components/admin/common/paste-allowlist";
import { PAGE_HTML } from "@/convex/lib/html";

/** Page-section links: http(s), mailto, tel, site-relative paths and anchors (the server's rule). */
export const PAGE_SAFE_HREF = /^(https?:\/\/|mailto:|tel:|\/(?![/\\])|#.)/i;

/**
 * A legal-page section editor's Tiptap extensions: h3, bold, italic, lists,
 * quotes and links, exactly what `pagesAdmin.upsert` accepts, pasted content
 * included. Its own module so the paste rules are unit-tested on this very
 * configuration (`lib/admin/rich-text.test.ts`).
 */
export function pageSectionExtensions(): Extensions {
  return [
    StarterKit.configure({
      heading: { levels: [3] },
      code: false,
      codeBlock: false,
      horizontalRule: false,
      strike: false,
      underline: false,
      link: {
        openOnClick: false,
        autolink: true,
        linkOnPaste: true,
        defaultProtocol: "https",
        isAllowedUri: (url) => PAGE_SAFE_HREF.test(url),
        shouldAutoLink: (url) => PAGE_SAFE_HREF.test(url),
        HTMLAttributes: { target: null, rel: null, class: null },
      },
    }),
    pasteAllowlist(PAGE_HTML),
  ];
}
