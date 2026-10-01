import { describe, expect, test } from "vitest";
import { decodeUrlAttr, htmlProblem, isSafeHref, PAGE_HTML, PAGE_LINK_SCHEMES, postHtml } from "../lib/html";

const OWN = "https://some-deployment.convex.cloud/api/storage/0a1b2c3d";
const POST = postHtml(new Set([OWN]));
const UNSPLASH = "https://images.unsplash.com/photo-1502672260266?w=1600&amp;q=80";

describe("journal post bodies", () => {
  test("accept everything the Tiptap editor writes", () => {
    const html =
      "<h2>Naslov</h2><h3>Podnaslov</h3><p><strong>a</strong> <em>b</em> <u>c</u> <s>d</s><br></p>" +
      '<ul><li><p>x</p></li></ul><ol start="3"><li><p>y</p></li></ol><blockquote><p>z</p></blockquote><hr>' +
      '<p><a href="https://rgz.gov.rs" target="_blank" rel="noopener noreferrer">RGZ</a> <a href="/sr/magazin">M</a> ' +
      '<a href="mailto:info@example.rs" title="Pišite">@</a> <a href="#porezi">#</a></p>' +
      `<img src="${OWN}" alt="Dnevna soba" width="1200" height="800"><img src="${UNSPLASH}" alt="">`;
    expect(htmlProblem(html, POST)).toBeNull();
    expect(htmlProblem("", POST)).toBeNull();
  });

  test("refuse scripts, styles, handlers and markup outside the list", () => {
    expect(htmlProblem("<p>x</p><script>alert(1)</script>", POST)).toMatch(/<script>/);
    expect(htmlProblem('<p style="color:red">x</p>', POST)).toMatch(/style/);
    expect(htmlProblem('<p onclick="alert(1)">x</p>', POST)).toMatch(/onclick/);
    expect(htmlProblem("<p onclick=alert(1)>x</p>", POST)).toMatch(/neispravni atributi/);
    expect(htmlProblem('<img src="x" onerror="alert(1)">', POST)).not.toBeNull();
    expect(htmlProblem("<iframe></iframe>", POST)).toMatch(/<iframe>/);
    expect(htmlProblem("<h1>x</h1>", POST)).toMatch(/<h1>/);
    expect(htmlProblem("<!-- x --><p>y</p>", POST)).toMatch(/komentari/);
    expect(htmlProblem("<p>a < b</p>", POST)).toMatch(/neispravan HTML/);
    expect(htmlProblem('<ol type="a"><li>x</li></ol>', POST)).toMatch(/type/);
  });

  test("refuse javascript:, data: and off-origin links, also when encoded", () => {
    expect(htmlProblem('<a href="javascript:alert(1)">x</a>', POST)).toMatch(/href/);
    expect(htmlProblem('<a href="data:text/html,x">x</a>', POST)).toMatch(/href/);
    expect(htmlProblem('<a href="//evil.example">x</a>', POST)).toMatch(/href/);
    expect(htmlProblem('<a href="/&#47;evil.example">x</a>', POST)).toMatch(/href/);
    expect(htmlProblem('<a href="/&#9;/evil.example">x</a>', POST)).toMatch(/href/);
    expect(htmlProblem('<a href="java&Tab;script:alert(1)">x</a>', POST)).toMatch(/href/);
    expect(htmlProblem('<a href="javascript&colon;alert(1)">x</a>', POST)).toMatch(/href/);
    expect(htmlProblem('<a href="tel:+381111">x</a>', POST)).toMatch(/href/);
    expect(htmlProblem('<a href="https://x.rs" target="_top">x</a>', POST)).toMatch(/target/);
  });

  test("refuse images that are not this post's uploads or Unsplash", () => {
    expect(htmlProblem('<img src="https://evil.example/a.png" alt="">', POST)).toMatch(/src/);
    expect(htmlProblem('<img src="https://other.convex.cloud/api/storage/0a1b2c3d" alt="">', POST)).toMatch(/src/);
    expect(htmlProblem('<img src="http://images.unsplash.com/photo-1" alt="">', POST)).toMatch(/src/);
    expect(htmlProblem('<img src="data:image/png;base64,iVBOR" alt="">', POST)).toMatch(/src/);
    expect(htmlProblem(`<img src="${OWN}" width="100%">`, POST)).toMatch(/width/);
    expect(htmlProblem(`<img src="${OWN}">`, postHtml(new Set()))).toMatch(/src/);
  });
});

describe("legal page sections", () => {
  test("refuse hrefs that leave the origin once decoded", () => {
    for (const href of ["/&#47;evil.example", "/&#92;evil.example", "/\t/evil.example", "/\n/evil.example"]) {
      expect(htmlProblem(`<p><a href="${href}">x</a></p>`, PAGE_HTML)).toMatch(/href/);
      expect(htmlProblem(`<p><a href="${href}">x</a></p>`, POST)).toMatch(/href/);
    }
    expect(htmlProblem('<p><a href="/sr/nekretnine?tip=stan&amp;grad=beograd">x</a></p>', PAGE_HTML)).toBeNull();
  });

  test("keep their own, smaller list", () => {
    expect(
      htmlProblem(
        '<h3>Naslov</h3><p>Tekst <a href="tel:+38111123">poziv</a></p><ol start="2" type="a"><li>x</li></ol>',
        PAGE_HTML,
      ),
    ).toBeNull();
    expect(htmlProblem("<h2>x</h2>", PAGE_HTML)).toMatch(/<h2>/);
    expect(htmlProblem(`<img src="${OWN}">`, PAGE_HTML)).toMatch(/<img>/);
    expect(htmlProblem("<u>x</u>", PAGE_HTML)).toMatch(/<u>/);
    expect(htmlProblem('<a href="javascript:alert(1)">x</a>', PAGE_HTML)).toMatch(/href/);
  });
});

describe("URL helpers", () => {
  test("isSafeHref keeps relative links on this origin", () => {
    expect(isSafeHref("/sr/kontakt", PAGE_LINK_SCHEMES)).toBe(true);
    expect(isSafeHref("/\t/evil.example", PAGE_LINK_SCHEMES)).toBe(false);
    expect(isSafeHref("/\\evil.example", PAGE_LINK_SCHEMES)).toBe(false);
    expect(isSafeHref(" https://example.rs ", PAGE_LINK_SCHEMES)).toBe(true);
  });

  test("decodeUrlAttr only lets &amp; through", () => {
    expect(decodeUrlAttr("https://x.rs/?a=1&amp;b=2")).toBe("https://x.rs/?a=1&b=2");
    expect(decodeUrlAttr("/&#47;evil")).toBeNull();
    expect(decodeUrlAttr("/&#x2F;evil")).toBeNull();
    expect(decodeUrlAttr("javascript&colon;x")).toBeNull();
  });
});
