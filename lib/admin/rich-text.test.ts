// @vitest-environment jsdom
import { Editor } from "@tiptap/react";
import { afterEach, describe, expect, it } from "vitest";
import { pageSectionExtensions } from "@/components/admin/content/section-extensions";
import { postBodyExtensions } from "@/components/admin/posts/body-extensions";
import { htmlProblem, PAGE_HTML, postHtml } from "@/convex/lib/html";
import { cleanPastedHtml } from "./rich-text";

/** The allowlist `postsAdmin.upsert` applies to a post with no uploads of its own. */
const POST = postHtml(new Set());

const editors: Editor[] = [];

afterEach(() => {
  for (const editor of editors.splice(0)) editor.destroy();
});

/** Pastes `html` into an empty editor (the clipboard path: `transformPastedHTML`) and returns what it would save. */
function paste(kind: "post" | "page", html: string): string {
  const editor = new Editor({ extensions: kind === "post" ? postBodyExtensions() : pageSectionExtensions(), content: "" });
  editors.push(editor);
  // jsdom has no ClipboardEvent; the paste handlers only read the HTML.
  editor.view.pasteHTML(html, new Event("paste") as ClipboardEvent);
  return editor.getHTML();
}

describe("pasting into the journal post editor", () => {
  it("keeps a lettered list from Word or Google Docs, which the server now accepts", () => {
    const html = paste("post", '<ol style="list-style-type: lower-alpha"><li><p>Prvi korak</p></li><li><p>Drugi</p></li></ol>');
    expect(html).toContain('<ol type="a">');
    expect(htmlProblem(html, POST)).toBeNull();
  });

  it("drops an image title and a width the server refuses", () => {
    const html = paste(
      "post",
      '<img src="https://images.unsplash.com/photo-1?w=1600" alt="Dnevna soba" title="Dnevna soba" width="100%" height="800">',
    );
    expect(html).not.toContain("title=");
    expect(html).not.toContain('width="100%"');
    expect(html).toContain('alt="Dnevna soba"');
    expect(html).toContain('height="800"');
    expect(htmlProblem(html, POST)).toBeNull();
  });

  it("drops a pasted link's class and a target other than a new tab, keeping its title", () => {
    const html = paste(
      "post",
      '<p>Vidi <a href="https://www.rgz.gov.rs/" class="nav-link" title="RGZ" target="_top" rel="Noopener">RGZ</a></p>',
    );
    expect(html).toContain('href="https://www.rgz.gov.rs/"');
    expect(html).toContain('title="RGZ"');
    expect(html).not.toMatch(/class=|target=|rel=/);
    expect(htmlProblem(html, POST)).toBeNull();
  });

  it("keeps what the editor's own link dialog writes", () => {
    const html = paste(
      "post",
      '<p><a href="https://www.rgz.gov.rs/" target="_blank" rel="noopener noreferrer">RGZ</a></p>',
    );
    expect(html).toContain('target="_blank"');
    expect(html).toContain('rel="noopener noreferrer"');
    expect(htmlProblem(html, POST)).toBeNull();
  });
});

describe("pasting into a legal page section", () => {
  it("drops a link's class and title, which the page allowlist refuses", () => {
    const html = paste("page", '<p>Vidi <a href="https://www.rgz.gov.rs/" class="nav-link" title="RGZ">RGZ</a></p>');
    expect(html).not.toMatch(/class=|title=/);
    expect(htmlProblem(html, PAGE_HTML)).toBeNull();
  });

  it("keeps a valid list style and start, and drops invalid ones", () => {
    expect(paste("page", '<ol type="I" start="4"><li><p>Član</p></li></ol>')).toContain('<ol start="4" type="I">');
    const html = paste("page", '<ol type="disc" start="-2"><li><p>x</p></li></ol>');
    expect(html).toContain("<ol>");
    expect(htmlProblem(html, PAGE_HTML)).toBeNull();
  });
});

describe("cleanPastedHtml", () => {
  it("judges each attribute by the allowlist's own rule and leaves everything else alone", () => {
    const pasted =
      '<meta charset="utf-8"><p data-pm-slice="1 1 []" style="margin:0">a <a href="/sr/kontakt" class="x" target="_blank">b</a></p>' +
      '<ol start="1000" type="a" style="list-style-type: upper-roman"><li>c</li></ol>';
    const cleaned = cleanPastedHtml(pasted, PAGE_HTML);
    expect(cleaned).toContain('data-pm-slice="1 1 []"');
    expect(cleaned).toContain('style="margin:0"');
    expect(cleaned).toContain('<a href="/sr/kontakt" target="_blank">');
    expect(cleaned).toContain('<ol type="a" style="list-style-type: upper-roman">');
  });
});
