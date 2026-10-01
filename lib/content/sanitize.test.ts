// @vitest-environment node
import { afterAll, beforeAll, describe, expect, test, vi } from "vitest";
import { isAllowedHref, isAllowedImageSrc, sanitizePageHtml, sanitizePostHtml } from "./sanitize";

const DEPLOYMENT = "https://youthful-avocet-278.eu-west-1.convex.cloud";
const STORAGE = `${DEPLOYMENT}/api/storage/2f1c0e6a-8a4b-4a39-9d51-0c1f1b3e7a11`;
const OTHER_DEPLOYMENT = "https://other-deploy-1.eu-west-1.convex.cloud/api/storage/2f1c0e6a";
const UNSPLASH = "https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=1600&q=80";

beforeAll(() => {
  vi.stubEnv("NEXT_PUBLIC_CONVEX_URL", DEPLOYMENT);
});

afterAll(() => {
  vi.unstubAllEnvs();
});

describe("sanitizePostHtml", () => {
  test("keeps everything the editor produces", () => {
    const html =
      "<h2>Naslov</h2><h3>Podnaslov</h3><p><strong>Jako</strong>, <em>koso</em>, <u>podvučeno</u>, <s>precrtano</s><br></p>" +
      '<ul><li>Jedan</li></ul><ol><li>Dva</li></ol><ol start="3"><li>Tri</li></ol><blockquote><p>Citat</p></blockquote><hr>' +
      `<img src="${STORAGE}" alt="Dnevna soba" width="1200" height="800">`;
    expect(sanitizePostHtml(html)).toBe(html);
  });

  test("drops script and style elements with their content", () => {
    const out = sanitizePostHtml('<p>Pre</p><script>alert("x")</script><style>p{color:red}</style><p>Posle</p>');
    expect(out).toBe("<p>Pre</p><p>Posle</p>");
  });

  test("strips event handlers, inline styles, classes and data attributes", () => {
    const out = sanitizePostHtml(
      `<p onclick="alert(1)" style="color:red" class="x" data-id="7">Tekst</p><img src="${UNSPLASH}" onerror="alert(1)" alt="">`,
    );
    expect(out).not.toMatch(/onclick|onerror|style=|class=|data-id/);
    expect(out).toContain("<p>Tekst</p>");
    expect(out).toContain("<img");
    expect(sanitizePostHtml('<ol start="x1"><li>a</li></ol>')).toBe("<ol><li>a</li></ol>");
  });

  test("unwraps links with javascript:, data: or off-origin relative targets", () => {
    expect(sanitizePostHtml('<p><a href="javascript:alert(1)">klik</a></p>')).toBe("<p>klik</p>");
    expect(sanitizePostHtml('<p><a href="JaVaScRiPt:alert(1)">klik</a></p>')).toBe("<p>klik</p>");
    expect(sanitizePostHtml('<p><a href="java&#9;script:alert(1)">klik</a></p>')).toBe("<p>klik</p>");
    expect(sanitizePostHtml('<p><a href="data:text/html;base64,PHNjcmlwdD4=">klik</a></p>')).toBe("<p>klik</p>");
    expect(sanitizePostHtml('<p><a href="//evil.example/x">klik</a></p>')).toBe("<p>klik</p>");
    // A tab or a backslash after the slash still lands on another host.
    expect(sanitizePostHtml('<p><a href="/&#9;/evil.example/x">klik</a></p>')).toBe("<p>klik</p>");
    expect(sanitizePostHtml('<p><a href="/\\evil.example/x">klik</a></p>')).toBe("<p>klik</p>");
  });

  test("keeps http(s), mailto, relative and anchor links; new-tab links get rel", () => {
    expect(sanitizePostHtml('<p><a href="https://rgz.gov.rs">RGZ</a></p>')).toBe('<p><a href="https://rgz.gov.rs">RGZ</a></p>');
    expect(sanitizePostHtml('<p><a href="mailto:info@example.rs">pišite</a></p>')).toContain('href="mailto:info@example.rs"');
    expect(sanitizePostHtml('<p><a href="/sr/nekretnine">ponuda</a></p>')).toContain('href="/sr/nekretnine"');
    expect(sanitizePostHtml('<p><a href="#porezi">porezi</a></p>')).toContain('href="#porezi"');

    const blank = sanitizePostHtml('<p><a href="https://example.rs" target="_blank" rel="nofollow">x</a></p>');
    expect(blank).toContain('target="_blank"');
    expect(blank).toMatch(/rel="nofollow noopener noreferrer"/);
    expect(sanitizePostHtml('<p><a href="https://example.rs" target="_top">x</a></p>')).not.toContain("target");
  });

  test("removes images from hosts the site does not serve", () => {
    expect(sanitizePostHtml('<p>a</p><img src="https://evil.example/a.png" alt="x">')).toBe("<p>a</p>");
    expect(sanitizePostHtml('<img src="http://images.unsplash.com/photo-1" alt="x">')).toBe("");
    expect(sanitizePostHtml(`<img src="${DEPLOYMENT}/api/other/1" alt="x">`)).toBe("");
    // Another deployment's storage is not this site's.
    expect(sanitizePostHtml(`<img src="${OTHER_DEPLOYMENT}" alt="x">`)).toBe("");
    expect(sanitizePostHtml('<img src="data:image/png;base64,iVBORw0KGgo=" alt="x">')).toBe("");
    expect(sanitizePostHtml(`<img src="${UNSPLASH}" width="100%" height="80">`)).toBe(
      `<img src="${UNSPLASH.replace("&", "&amp;")}" height="80" alt="">`,
    );
  });

  test("drops elements outside the allowlist but keeps their text", () => {
    expect(sanitizePostHtml('<h1>Veliki</h1><div><span>unutra</span></div><iframe src="https://x"></iframe>')).toBe(
      "Velikiunutra",
    );
    expect(sanitizePostHtml("   ")).toBe("");
  });
});

describe("sanitizePageHtml", () => {
  test("keeps what the legal-page editor writes", () => {
    const html =
      '<h3>Kolačići</h3><p><strong>Važno</strong>: <em>pročitajte</em> <a href="tel:+381111234">pozovite</a>, ' +
      '<a href="/sr/kontakt">pišite</a> ili <a href="https://zzpl.rs" target="_blank" rel="noopener noreferrer">ZZPL</a>.<br></p>' +
      '<ul><li>a</li></ul><ol start="2" type="a"><li>b</li></ol><blockquote><p>c</p></blockquote>';
    expect(sanitizePageHtml(html)).toBe(html);
  });

  test("drops what the page allowlist does not have", () => {
    expect(sanitizePageHtml(`<h2>Veliki</h2><p>a</p><img src="${UNSPLASH}" alt="x"><hr><u>b</u>`)).toBe("Veliki<p>a</p>b");
    expect(sanitizePageHtml('<p title="x" class="y" onclick="alert(1)">t</p>')).toBe("<p>t</p>");
    expect(sanitizePageHtml('<ol type="disc" start="-1"><li>x</li></ol>')).toBe("<ol><li>x</li></ol>");
    expect(sanitizePageHtml('<p><a href="https://x.rs" title="t">x</a></p>')).toBe('<p><a href="https://x.rs">x</a></p>');
    expect(sanitizePageHtml("<script>alert(1)</script><p>ok</p>")).toBe("<p>ok</p>");
  });

  test("unwraps unsafe links", () => {
    expect(sanitizePageHtml('<p><a href="javascript:alert(1)">x</a></p>')).toBe("<p>x</p>");
    expect(sanitizePageHtml('<p><a href="/&#47;evil.example">x</a></p>')).toBe("<p>x</p>");
    expect(sanitizePageHtml('<p><a href="/&#92;evil.example">x</a></p>')).toBe("<p>x</p>");
    expect(sanitizePageHtml('<p><a href="/\t/evil.example">x</a></p>')).toBe("<p>x</p>");
    expect(sanitizePageHtml('<p><a href="/\n/evil.example">x</a></p>')).toBe("<p>x</p>");
  });
});

describe("URL rules shared with the editor", () => {
  test("hrefs", () => {
    expect(isAllowedHref("https://example.rs/a?b=1")).toBe(true);
    expect(isAllowedHref("http://example.rs")).toBe(true);
    expect(isAllowedHref("mailto:a@b.rs")).toBe(true);
    expect(isAllowedHref("/sr/magazin")).toBe(true);
    expect(isAllowedHref("/sr/ma\tgazin")).toBe(true);
    expect(isAllowedHref("#deo")).toBe(true);
    expect(isAllowedHref("javascript:alert(1)")).toBe(false);
    expect(isAllowedHref("java\tscript:alert(1)")).toBe(false);
    expect(isAllowedHref("java\nscript:alert(1)")).toBe(false);
    expect(isAllowedHref("//evil.example")).toBe(false);
    expect(isAllowedHref("/\t/evil.example")).toBe(false);
    expect(isAllowedHref("/\n/evil.example")).toBe(false);
    expect(isAllowedHref("/\r\n\\evil.example")).toBe(false);
    expect(isAllowedHref("ftp://example.rs")).toBe(false);
    expect(isAllowedHref("example.rs")).toBe(false);
    expect(isAllowedHref("#")).toBe(false);
    expect(isAllowedHref("")).toBe(false);
  });

  test("image sources", () => {
    expect(isAllowedImageSrc(STORAGE)).toBe(true);
    expect(isAllowedImageSrc(UNSPLASH)).toBe(true);
    expect(isAllowedImageSrc(OTHER_DEPLOYMENT)).toBe(false);
    expect(isAllowedImageSrc("https://convex.cloud.evil.example/api/storage/1")).toBe(false);
    expect(isAllowedImageSrc("https://images.unsplash.com.evil.example/x")).toBe(false);
  });
});
