#!/usr/bin/env node
// SEO audit of the public site (step 12). Fetches every URL in /sitemap.xml plus the
// visitor-specific pages (favorites, compare) from a running server and checks, per page:
//   status 200 · <html lang> · <title> length · meta description length · self canonical ·
//   hreflang set (sr-Latn/en/ru/de + x-default) and reciprocity · exactly one <h1> ·
//   Open Graph + Twitter card · robots meta · JSON-LD (scripts/validate-jsonld.mjs) ·
//   og:image answers 200 with an image.
// It also validates /sitemap.xml (well-formed XML, namespaces, hreflang alternates, lastmod)
// and /robots.txt. The report goes to docs/reports/seo-audit.md.
//
// Usage: node scripts/seo-audit.mjs [--base http://localhost:3000] [--out docs/reports/seo-audit.md]
// Requires `npm run build && npm run start` (audit the production build, not `next dev`).
// Exit code 1 when any page has an error (warnings do not fail).
import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { SaxesParser } from "saxes";
import { validateJsonLd } from "./validate-jsonld.mjs";

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? fallback : process.argv[i + 1];
}

const base = String(arg("base", "http://localhost:3000")).replace(/\/$/, "");
const out = String(arg("out", "docs/reports/seo-audit.md"));

const LOCALES = { sr: "sr-Latn", en: "en", ru: "ru", de: "de" };
/**
 * Next 16 streams metadata into <body> for browsers and for crawlers that run
 * JavaScript (Googlebot), and renders it blocking in <head> for the
 * "HTML-limited" bots in its default `htmlLimitedBots` list (Bingbot, Yandex,
 * facebookexternalhit, Twitterbot, WhatsApp, LinkedIn…). The audit reads the
 * page as Bingbot, i.e. the strictest reader: everything must be in <head>.
 */
const CRAWLER_UA = "Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)";
const headers = { "User-Agent": CRAWLER_UA };
const HREFLANGS = ["sr-Latn", "en", "ru", "de", "x-default"];
const TITLE = { min: 10, max: 70, warn: 65 };
const DESCRIPTION = { min: 50, max: 230, warn: 170 };

/** Second path segment → route name, for grouping the report. */
const SEGMENTS = {
  listing: ["nekretnine", "properties", "nedvizhimost", "immobilien"],
  location: ["lokacije", "locations", "lokacii", "lagen"],
  valuation: ["procena", "valuation", "ocenka", "bewertung"],
  sell: ["prodajte", "sell", "prodat", "verkaufen"],
  agent: ["agenti", "agents", "agenty", "makler"],
  about: ["o-nama", "about", "o-nas", "ueber-uns"],
  contact: ["kontakt", "contact", "kontakty"],
  journal: ["magazin", "journal", "zhurnal"],
  favorites: ["omiljeno", "favorites", "izbrannoe", "favoriten"],
  compare: ["uporedi", "compare", "sravnit", "vergleich"],
  privacy: ["privatnost", "privacy", "konfidencialnost", "datenschutz"],
  terms: ["uslovi", "terms", "usloviya", "agb"],
  cookies: ["kolacici", "cookies"],
};
const NOINDEX_ROUTES = new Set(["favorites", "compare"]);

function routeOf(path) {
  const parts = path.split("/").filter(Boolean);
  if (parts.length === 1) return "home";
  const name = Object.entries(SEGMENTS).find(([, segs]) => segs.includes(parts[1]))?.[0] ?? `?${parts[1]}`;
  if (parts.length === 2) return name === "listing" ? "search" : name === "location" ? "locations" : name === "agent" ? "agents" : name;
  return `${name} detail`;
}

const decode = (text) =>
  text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;|&#39;|&apos;/g, "'");

function attr(tag, name) {
  const m = new RegExp(`\\s${name}="([^"]*)"`, "i").exec(tag);
  return m === null ? undefined : decode(m[1]);
}

function metaContent(html, key, value) {
  for (const m of html.matchAll(/<meta\b[^>]*>/gi)) {
    if (attr(m[0], key) === value) return attr(m[0], "content");
  }
  return undefined;
}

function parsePage(html) {
  const head = html.slice(0, html.indexOf("</head>") > 0 ? html.indexOf("</head>") : html.length);
  const titles = [...head.matchAll(/<title[^>]*>([\s\S]*?)<\/title>/gi)].map((m) => decode(m[1]).trim());
  const links = [...head.matchAll(/<link\b[^>]*>/gi)].map((m) => m[0]);
  const canonical = links.filter((l) => attr(l, "rel") === "canonical").map((l) => attr(l, "href"));
  const alternates = new Map(
    links.filter((l) => attr(l, "rel") === "alternate" && attr(l, "hreflang") !== undefined).map((l) => [attr(l, "hreflang"), attr(l, "href")]),
  );
  // <h1> in the server HTML only (what a crawler reads before scripts run).
  const body = html.slice(html.indexOf("<body"));
  const visible = body.replace(/<script[\s\S]*?<\/script>/gi, "").replace(/<template[\s\S]*?<\/template>/gi, "");
  return {
    lang: /<html[^>]*\slang="([^"]+)"/i.exec(html)?.[1],
    titles,
    description: metaContent(head, "name", "description"),
    robots: metaContent(head, "name", "robots"),
    viewport: metaContent(head, "name", "viewport"),
    canonical,
    alternates,
    h1: (visible.match(/<h1[\s>]/gi) ?? []).length,
    og: {
      title: metaContent(head, "property", "og:title"),
      description: metaContent(head, "property", "og:description"),
      url: metaContent(head, "property", "og:url"),
      image: metaContent(head, "property", "og:image"),
      locale: metaContent(head, "property", "og:locale"),
    },
    twitter: { card: metaContent(head, "name", "twitter:card"), image: metaContent(head, "name", "twitter:image") },
  };
}

async function pool(items, size, fn) {
  const results = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: size }, async () => {
      while (next < items.length) {
        const index = next++;
        results[index] = await fn(items[index], index);
      }
    }),
  );
  return results;
}

// ---------------------------------------------------------------- sitemap + robots

async function auditSitemap() {
  const res = await fetch(`${base}/sitemap.xml`, { headers });
  const xml = await res.text();
  const errors = [];
  const urls = [];
  const parser = new SaxesParser({ xmlns: true });
  let current = null;
  let text = "";
  const roots = [];
  parser.on("error", (error) => errors.push(`XML: ${error.message}`));
  parser.on("opentag", (node) => {
    text = "";
    if (roots.length === 0) roots.push(node);
    if (node.local === "url") current = { loc: "", lastmod: undefined, alternates: new Map(), images: 0 };
    if (node.local === "link" && current !== null) {
      current.alternates.set(node.attributes.hreflang?.value, node.attributes.href?.value);
    }
    if (node.local === "image" && node.uri === "http://www.google.com/schemas/sitemap-image/1.1" && current !== null) current.images += 1;
  });
  parser.on("text", (t) => {
    text += t;
  });
  parser.on("closetag", (node) => {
    if (current === null) return;
    if (node.local === "loc" && node.uri === "http://www.sitemaps.org/schemas/sitemap/0.9") current.loc = text.trim();
    if (node.local === "lastmod") current.lastmod = text.trim();
    if (node.local === "url") {
      urls.push(current);
      current = null;
    }
  });
  try {
    parser.write(xml).close();
  } catch (error) {
    errors.push(`XML: ${error.message}`);
  }
  const root = roots[0];
  if (res.status !== 200) errors.push(`status ${res.status}`);
  if (!/xml/.test(res.headers.get("content-type") ?? "")) errors.push(`content-type ${res.headers.get("content-type")}`);
  if (root?.local !== "urlset" || root?.uri !== "http://www.sitemaps.org/schemas/sitemap/0.9") errors.push("root is not sitemaps.org <urlset>");
  if (urls.length === 0) errors.push("no <url> entries");
  if (urls.length > 50000) errors.push(`${urls.length} URLs (limit 50,000)`);
  if (Buffer.byteLength(xml) > 50 * 1024 * 1024) errors.push("over 50 MB");
  const locs = new Set();
  for (const url of urls) {
    let parsed;
    try {
      parsed = new URL(url.loc);
    } catch {
      errors.push(`loc not absolute: ${url.loc}`);
      continue;
    }
    if (parsed.origin !== new URL(base).origin && !process.env.NEXT_PUBLIC_SITE_URL) errors.push(`loc on another origin: ${url.loc}`);
    if (locs.has(url.loc)) errors.push(`duplicate loc: ${url.loc}`);
    locs.add(url.loc);
    if (url.lastmod !== undefined && Number.isNaN(Date.parse(url.lastmod))) errors.push(`bad lastmod ${url.lastmod} on ${url.loc}`);
    const langs = [...url.alternates.keys()].sort().join(",");
    if (langs !== [...HREFLANGS].sort().join(",")) errors.push(`alternates ${langs} on ${url.loc}`);
    if (![...url.alternates.values()].includes(url.loc)) errors.push(`alternates do not include the loc itself: ${url.loc}`);
  }
  // Every alternate must itself be a <loc> (sitemap hreflang reciprocity).
  for (const url of urls) {
    for (const [lang, href] of url.alternates) if (lang !== "x-default" && !locs.has(href)) errors.push(`alternate ${href} is not a <loc>`);
  }
  return {
    errors,
    urls,
    stats: {
      urls: urls.length,
      withLastmod: urls.filter((u) => u.lastmod !== undefined).length,
      withImages: urls.filter((u) => u.images > 0).length,
      images: urls.reduce((sum, u) => sum + u.images, 0),
      bytes: Buffer.byteLength(xml),
    },
  };
}

async function auditRobots() {
  const res = await fetch(`${base}/robots.txt`, { headers });
  const body = await res.text();
  const errors = [];
  if (res.status !== 200) errors.push(`status ${res.status}`);
  const lines = body.split(/\r?\n/).map((l) => l.trim());
  for (const rule of ["Disallow: /admin", "Disallow: /api", "Disallow: /*/styleguide", "User-Agent: *"]) {
    if (!lines.some((l) => l.toLowerCase() === rule.toLowerCase())) errors.push(`missing "${rule}"`);
  }
  const sitemapLine = lines.find((l) => /^sitemap:/i.test(l));
  if (sitemapLine === undefined || !/^sitemap:\s*https?:\/\/\S+\/sitemap\.xml$/i.test(sitemapLine)) errors.push("Sitemap: line missing or not absolute");
  if (lines.some((l) => /^disallow:\s*\/\s*$/i.test(l))) errors.push("disallows the whole site");
  return { errors, body };
}

// ---------------------------------------------------------------- pages

async function fetchPage(path) {
  const res = await fetch(`${base}${path}`, { redirect: "manual", headers });
  return { status: res.status, location: res.headers.get("location"), html: res.status === 200 ? await res.text() : "" };
}

function expectedLang(path) {
  return LOCALES[path.split("/")[1]];
}

const pathOf = (url) => {
  const parsed = new URL(url);
  return `${parsed.pathname}${parsed.search}`;
};

async function main() {
  const [sitemap, robots] = await Promise.all([auditSitemap(), auditRobots()]);
  const paths = sitemap.urls.map((u) => pathOf(u.loc));
  for (const prefix of Object.keys(LOCALES)) {
    for (const seg of [SEGMENTS.favorites, SEGMENTS.compare]) {
      const index = Object.keys(LOCALES).indexOf(prefix);
      paths.push(`/${prefix}/${seg[index] ?? seg[0]}`);
    }
  }

  const pages = await pool(paths, 6, async (path) => {
    const res = await fetchPage(path);
    return { path, route: routeOf(path), ...res, meta: res.status === 200 ? parsePage(res.html) : null };
  });
  const byUrl = new Map(pages.map((p) => [`${base}${p.path}`, p]));
  const origin = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ?? base;
  const toLocal = (url) => (url?.startsWith(origin) ? `${base}${url.slice(origin.length)}` : url);

  const ogImages = new Map();
  for (const page of pages) {
    const errors = [];
    const warnings = [];
    page.errors = errors;
    page.warnings = warnings;
    if (page.status !== 200) {
      errors.push(`status ${page.status}${page.location ? ` → ${page.location}` : ""}`);
      continue;
    }
    const m = page.meta;
    const noindexExpected = NOINDEX_ROUTES.has(page.route);
    if (m.lang !== expectedLang(page.path)) errors.push(`html lang "${m.lang}" (expected ${expectedLang(page.path)})`);
    if (m.viewport === undefined) errors.push("no viewport meta");
    if (m.titles.length !== 1) errors.push(`${m.titles.length} <title> elements`);
    const title = m.titles[0] ?? "";
    if (title.length < TITLE.min || title.length > TITLE.max) errors.push(`title length ${title.length}: "${title}"`);
    else if (title.length > TITLE.warn) warnings.push(`title ${title.length} chars (may truncate): "${title}"`);
    const description = m.description ?? "";
    if (description.length < DESCRIPTION.min || description.length > DESCRIPTION.max) errors.push(`description length ${description.length}`);
    else if (description.length > DESCRIPTION.warn) warnings.push(`description ${description.length} chars (snippet may cut)`);
    if (m.h1 !== 1) errors.push(`${m.h1} <h1> in the server HTML`);
    if (m.og.title === undefined || m.og.description === undefined || m.og.image === undefined) errors.push("Open Graph title/description/image missing");
    if (m.twitter.card !== "summary_large_image" || m.twitter.image === undefined) errors.push("Twitter card missing");
    if (m.og.image !== undefined) ogImages.set(m.og.image, [...(ogImages.get(m.og.image) ?? []), page.path]);

    const noindex = /noindex/i.test(m.robots ?? "");
    if (noindexExpected && !noindex) errors.push("visitor-specific page is indexable");
    if (!noindexExpected && noindex) errors.push(`indexable page has robots "${m.robots}"`);

    if (m.canonical.length !== 1) errors.push(`${m.canonical.length} canonical links`);
    const canonical = m.canonical[0];
    const self = `${origin}${page.path}`;
    if (canonical !== undefined && canonical !== self) errors.push(`canonical ${canonical} is not this URL`);
    if (m.og.url !== undefined && m.og.url !== canonical) errors.push(`og:url ${m.og.url} differs from canonical`);

    const langs = [...m.alternates.keys()].sort().join(",");
    if (langs !== [...HREFLANGS].sort().join(",")) errors.push(`hreflang set ${langs || "(none)"}`);
    else {
      if (m.alternates.get(m.lang) !== canonical) errors.push(`hreflang ${m.lang} does not point at this page`);
      if (m.alternates.get("x-default") !== m.alternates.get("sr-Latn")) errors.push("x-default is not the sr-Latn URL");
      for (const [lang, href] of m.alternates) {
        if (lang === "x-default" || href === canonical) continue;
        const other = byUrl.get(toLocal(href));
        if (other === undefined) {
          errors.push(`hreflang ${lang} → ${href} was not crawled`);
          continue;
        }
        if (other.status !== 200) errors.push(`hreflang ${lang} → ${href} answers ${other.status}`);
        else if (other.meta.alternates.get(m.lang) !== canonical) errors.push(`hreflang ${lang} → ${href} does not link back (reciprocity)`);
      }
    }

    const jsonld = validateJsonLd(page.html);
    page.jsonldTypes = [...new Set(jsonld.types)];
    for (const error of jsonld.errors) errors.push(`JSON-LD ${error}`);
    page.html = "";
  }

  // Each distinct share image is fetched once.
  const imageResults = await pool([...ogImages.keys()], 4, async (url) => {
    const res = await fetch(toLocal(url), { headers });
    const type = res.headers.get("content-type") ?? "";
    const size = (await res.arrayBuffer()).byteLength;
    return { url, ok: res.status === 200 && type.startsWith("image/"), status: res.status, type, size };
  });
  for (const image of imageResults) {
    if (image.ok) continue;
    for (const path of ogImages.get(image.url)) pages.find((p) => p.path === path).errors.push(`og:image ${image.url} → ${image.status} ${image.type}`);
  }

  // ------------------------------------------------------------ report
  const routes = [...new Set(pages.map((p) => p.route))];
  const failed = pages.filter((p) => p.errors.length > 0);
  const lines = [];
  lines.push("# SEO audit", "");
  lines.push(`Generated ${new Date().toISOString()} by \`node scripts/seo-audit.mjs\` against \`${base}\` (production build, \`npm run start\`), crawling as Bingbot: Next 16 renders metadata blocking in \`<head>\` for HTML-limited crawlers (Bing, Yandex, Facebook, X, WhatsApp, LinkedIn…) and streams it into \`<body>\` for browsers and Googlebot, which renders JavaScript.`, "");
  lines.push(
    `**${pages.length} pages** (every \`<loc>\` in the sitemap + favorites/compare in 4 locales): **${pages.length - failed.length} pass**, **${failed.length} with errors**, ${pages.reduce((n, p) => n + p.warnings.length, 0)} warnings.`,
    "",
  );
  lines.push("Checks per page: status 200 · `<html lang>` = locale · one `<title>` of 10–70 chars (warning above 65) · meta description 50–230 chars (warning above 170) · exactly one `<h1>` in the server HTML · one self-referencing canonical · hreflang sr-Latn/en/ru/de + x-default (= sr-Latn), each alternate crawled and linking back · `og:title/description/image/url` (url = canonical) · `twitter:card` = summary_large_image · `noindex` only on favorites/compare · JSON-LD valid (`scripts/validate-jsonld.mjs`, exactly one full `RealEstateAgent` per page) · every distinct `og:image` answers 200 with an image.", "");
  lines.push("## Pages by route", "", "| Route | sr | en | ru | de | Title chars (min–max) | Description chars (min–max) | JSON-LD types |", "|---|---|---|---|---|---|---|---|");
  for (const route of routes) {
    const group = pages.filter((p) => p.route === route);
    const cell = (prefix) => {
      const inLocale = group.filter((p) => p.path.startsWith(`/${prefix}/`) || p.path === `/${prefix}`);
      if (inLocale.length === 0) return "—";
      const bad = inLocale.filter((p) => p.errors.length > 0).length;
      return bad === 0 ? `✅ ${inLocale.length}` : `❌ ${bad}/${inLocale.length}`;
    };
    const tl = group.filter((p) => p.meta).map((p) => (p.meta.titles[0] ?? "").length);
    const dl = group.filter((p) => p.meta).map((p) => (p.meta.description ?? "").length);
    const types = [...new Set(group.flatMap((p) => p.jsonldTypes ?? []))].filter((t) => !["ListItem", "PropertyValue", "PostalAddress", "GeoCoordinates", "OpeningHoursSpecification", "QuantitativeValue", "City", "Country", "ImageObject", "UnitPriceSpecification", "WebPage"].includes(t));
    lines.push(`| ${route} | ${cell("sr")} | ${cell("en")} | ${cell("ru")} | ${cell("de")} | ${Math.min(...tl)}–${Math.max(...tl)} | ${Math.min(...dl)}–${Math.max(...dl)} | ${types.join(", ")} |`);
  }
  lines.push("", "## Errors", "");
  if (failed.length === 0) lines.push("None.");
  for (const page of failed) lines.push(`- \`${page.path}\`: ${page.errors.join("; ")}`);
  lines.push("", "## Warnings", "");
  const warned = pages.filter((p) => p.warnings.length > 0);
  if (warned.length === 0) lines.push("None.");
  for (const page of warned) lines.push(`- \`${page.path}\`: ${page.warnings.join("; ")}`);
  lines.push("", "## Sitemap (`/sitemap.xml`)", "");
  lines.push(`${sitemap.stats.urls} URLs, ${sitemap.stats.withLastmod} with \`<lastmod>\`, ${sitemap.stats.withImages} with images (${sitemap.stats.images} \`<image:image>\`), ${(sitemap.stats.bytes / 1024).toFixed(1)} KB. Parsed with \`saxes\` (namespace-aware, well-formedness errors fail the audit); every \`<url>\` must carry the 5 hreflang alternates including itself, and every alternate must itself be a \`<loc>\`.`, "");
  lines.push(sitemap.errors.length === 0 ? "**Valid.**" : sitemap.errors.map((e) => `- ${e}`).join("\n"));
  lines.push("", "## robots.txt", "", "```", robots.body.trim(), "```", "", robots.errors.length === 0 ? "**Valid.**" : robots.errors.map((e) => `- ${e}`).join("\n"));
  lines.push("", "## Share images", "", "| og:image | Status | Type | KB | Pages |", "|---|---|---|---|---|");
  const sample = imageResults.filter((r, i, all) => !r.ok || i < 12 || all.findIndex((x) => x.url.replace(/\/[^/]+\/opengraph-image.*$/, "") === r.url.replace(/\/[^/]+\/opengraph-image.*$/, "")) === i);
  for (const image of sample) {
    lines.push(`| \`${pathOf(image.url)}\` | ${image.status} | ${image.type} | ${(image.size / 1024).toFixed(0)} | ${ogImages.get(image.url).length} |`);
  }
  lines.push("", `${imageResults.length} distinct share images fetched, ${imageResults.filter((r) => !r.ok).length} failed; the table shows the first ones and every failure.`);

  await mkdir(dirname(out), { recursive: true });
  await writeFile(out, `${lines.join("\n")}\n`);
  console.log(`${pages.length} pages: ${pages.length - failed.length} pass, ${failed.length} with errors. Sitemap: ${sitemap.errors.length} errors. robots: ${robots.errors.length} errors. → ${out}`);
  for (const page of failed.slice(0, 40)) console.log(`  ${page.path}: ${page.errors.join("; ")}`);
  process.exit(failed.length > 0 || sitemap.errors.length > 0 || robots.errors.length > 0 ? 1 : 0);
}

await main();
