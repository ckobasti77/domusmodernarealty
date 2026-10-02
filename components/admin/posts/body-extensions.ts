import Image from "@tiptap/extension-image";
import Placeholder from "@tiptap/extension-placeholder";
import type { Extensions } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { pasteAllowlist } from "@/components/admin/common/paste-allowlist";
import { postHtml } from "@/convex/lib/html";
import { isAllowedHref } from "@/lib/content/sanitize";

/**
 * The journal body editor's Tiptap extensions: h2/h3, marks, lists, quotes,
 * rules, links and images, exactly what `postsAdmin.upsert` accepts, pasted
 * content included. Its own module so the paste rules are unit-tested on this
 * very configuration (`lib/admin/rich-text.test.ts`).
 */
export function postBodyExtensions(): Extensions {
  return [
    StarterKit.configure({
      heading: { levels: [2, 3] },
      code: false,
      codeBlock: false,
      link: {
        openOnClick: false,
        autolink: true,
        linkOnPaste: true,
        defaultProtocol: "https",
        isAllowedUri: (url) => isAllowedHref(url),
        shouldAutoLink: (url) => isAllowedHref(url),
        HTMLAttributes: { target: null, rel: null, class: null },
      },
    }),
    Image.configure({ inline: false, allowBase64: false }),
    Placeholder.configure({ placeholder: "Počnite da pišete…" }),
    // Attribute rules only: which images a post may show (its own uploads)
    // is for the server to judge.
    pasteAllowlist(postHtml(new Set())),
  ];
}
