#!/usr/bin/env node
// Validates the JSON-LD a public page renders (step 12, ARCHITECTURE §9).
//
// Usage:
//   node scripts/validate-jsonld.mjs [--base http://localhost:3000] [--paths /sr,/en/properties/x]
//
// Without --paths it reads every <loc> from /sitemap.xml. Requires a running server
// (npm run start). For each page it checks that every <script type="application/ld+json">
// parses, carries a schema.org @context and @type, and that each known type has the
// fields Google and the brokerage law need. Exit code 1 when any page has an error.
//
// The checks are importable: `validateJsonLd(html, url)` returns { blocks, types, errors }.

const SCRIPT_RE = /<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g;

function isAbsoluteUrl(value) {
  if (typeof value !== "string") return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

const isNonEmptyString = (value) => typeof value === "string" && value.trim().length > 0;
const isIsoDate = (value) => typeof value === "string" && !Number.isNaN(Date.parse(value)) && /^\d{4}-\d{2}-\d{2}/.test(value);

function typesOf(node) {
  const type = node["@type"];
  return Array.isArray(type) ? type : type === undefined ? [] : [type];
}

/** Field rules per schema.org type: each returns a list of problems. */
const RULES = {
  RealEstateAgent(node) {
    const out = [];
    if (!isNonEmptyString(node.name)) out.push("name missing");
    // The sitewide node carries the legal fields; every other agency node
    // (a listing's seller, an agent's employer, a page's mainEntity) must
    // point at it by @id.
    if (node.legalName === undefined) {
      if (!isNonEmptyString(node["@id"]) || !node["@id"].endsWith("/#agency")) out.push("reference without the sitewide @id");
    } else {
      if (!isNonEmptyString(node["@id"])) out.push("@id missing");
      if (!isNonEmptyString(node.legalName)) out.push("legalName missing");
      if (!isAbsoluteUrl(node.url)) out.push("url not absolute");
      const ids = Array.isArray(node.identifier) ? node.identifier : node.identifier !== undefined ? [node.identifier] : [];
      if (!ids.some((id) => id?.propertyID === "Registar posrednika" && isNonEmptyString(id?.value))) {
        out.push("identifier (Registar posrednika) missing");
      }
      if (node.address?.["@type"] !== "PostalAddress" || !isNonEmptyString(node.address?.streetAddress)) {
        out.push("address.PostalAddress.streetAddress missing");
      }
      if (node.address?.addressCountry !== "RS") out.push("address.addressCountry is not RS");
      if (!isNonEmptyString(node.taxID)) out.push("taxID missing");
      if (!Array.isArray(node.areaServed) || node.areaServed.length === 0) out.push("areaServed missing");
    }
    return out;
  },
  RealEstateListing(node) {
    const out = [];
    if (!isNonEmptyString(node.name)) out.push("name missing");
    if (!isAbsoluteUrl(node.url)) out.push("url not absolute");
    if (!isNonEmptyString(node.description)) out.push("description missing");
    if (node.datePosted !== undefined && !isIsoDate(node.datePosted)) out.push("datePosted not ISO 8601");
    if (node.image !== undefined && !(Array.isArray(node.image) && node.image.every(isAbsoluteUrl))) {
      out.push("image is not a list of absolute URLs");
    }
    const offer = node.offers;
    if (offer?.["@type"] !== "Offer") out.push("offers.Offer missing");
    else {
      const hasPrice = typeof offer.price === "number" && offer.priceCurrency === "EUR";
      const hasSpec = typeof offer.priceSpecification?.price === "number" && offer.priceSpecification?.priceCurrency === "EUR";
      if (!hasPrice && !hasSpec && offer.price !== undefined) out.push("offers price without EUR currency");
      if (offer.seller?.["@type"] !== "RealEstateAgent") out.push("offers.seller is not the RealEstateAgent");
      if (!isNonEmptyString(offer.availability)) out.push("offers.availability missing");
    }
    const about = node.about;
    if (about === undefined) out.push("about (the property) missing");
    else {
      if (typeof about.floorSize?.value !== "number" || about.floorSize?.unitCode !== "MTK") out.push("about.floorSize (m², MTK) missing");
      if (about.address?.["@type"] !== "PostalAddress" || !isNonEmptyString(about.address?.addressLocality)) {
        out.push("about.address.addressLocality missing");
      }
      if (about.geo !== undefined && (typeof about.geo.latitude !== "number" || typeof about.geo.longitude !== "number")) {
        out.push("about.geo not numeric");
      }
    }
    return out;
  },
  BreadcrumbList(node) {
    const out = [];
    const items = node.itemListElement;
    if (!Array.isArray(items) || items.length === 0) return ["itemListElement empty"];
    items.forEach((item, index) => {
      if (item["@type"] !== "ListItem") out.push(`item ${index + 1} is not a ListItem`);
      if (item.position !== index + 1) out.push(`item ${index + 1} has position ${item.position}`);
      if (!isNonEmptyString(item.name)) out.push(`item ${index + 1} has no name`);
      if (!isAbsoluteUrl(item.item)) out.push(`item ${index + 1} item is not an absolute URL`);
    });
    return out;
  },
  Article(node) {
    const out = [];
    if (!isNonEmptyString(node.headline)) out.push("headline missing");
    else if (node.headline.length > 110) out.push("headline over 110 characters");
    if (!isIsoDate(node.datePublished)) out.push("datePublished missing or not ISO 8601");
    if (!isNonEmptyString(node.author?.name)) out.push("author.name missing");
    if (!isNonEmptyString(node.publisher?.name)) out.push("publisher.name missing");
    if (!isAbsoluteUrl(node.publisher?.logo?.url)) out.push("publisher.logo.url missing");
    if (node.image !== undefined && !(Array.isArray(node.image) && node.image.every(isAbsoluteUrl))) out.push("image not absolute");
    if (!isAbsoluteUrl(node.mainEntityOfPage?.["@id"])) out.push("mainEntityOfPage missing");
    return out;
  },
  Place(node) {
    const out = [];
    if (!isNonEmptyString(node.name)) out.push("name missing");
    if (node.geo !== undefined && (typeof node.geo.latitude !== "number" || typeof node.geo.longitude !== "number")) {
      out.push("geo not numeric");
    }
    return out;
  },
  Person(node) {
    const out = [];
    if (!isNonEmptyString(node.name)) out.push("name missing");
    if (!isAbsoluteUrl(node.url)) out.push("url not absolute");
    return out;
  },
};

function walk(node, visit) {
  if (Array.isArray(node)) {
    for (const item of node) walk(item, visit);
    return;
  }
  if (node === null || typeof node !== "object") return;
  visit(node);
  for (const value of Object.values(node)) walk(value, visit);
}

export function validateJsonLd(html) {
  const errors = [];
  const types = [];
  let blocks = 0;
  let fullAgencyNodes = 0;
  for (const match of html.matchAll(SCRIPT_RE)) {
    blocks += 1;
    let data;
    try {
      data = JSON.parse(match[1]);
    } catch (error) {
      errors.push(`block ${blocks}: invalid JSON (${error.message})`);
      continue;
    }
    if (/<\/script/i.test(match[1])) errors.push(`block ${blocks}: unescaped </script`);
    const roots = Array.isArray(data) ? data : [data];
    for (const root of roots) {
      if (root?.["@context"] !== "https://schema.org") errors.push(`block ${blocks}: @context is not https://schema.org`);
      if (typesOf(root).length === 0) errors.push(`block ${blocks}: root without @type`);
      walk(root, (node) => {
        for (const type of typesOf(node)) {
          types.push(type);
          const rule = RULES[type];
          if (rule !== undefined) for (const problem of rule(node)) errors.push(`${type}: ${problem}`);
          if (type === "RealEstateAgent" && node.legalName !== undefined) fullAgencyNodes += 1;
        }
      });
    }
  }
  if (fullAgencyNodes !== 1) errors.push(`expected exactly 1 full RealEstateAgent node, found ${fullAgencyNodes}`);
  return { blocks, types, errors };
}

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? fallback : process.argv[i + 1];
}

async function sitemapPaths(base) {
  const xml = await (await fetch(`${base}/sitemap.xml`)).text();
  return [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => new URL(m[1].replace(/&amp;/g, "&")).pathname);
}

async function main() {
  const base = String(arg("base", "http://localhost:3000")).replace(/\/$/, "");
  const listed = arg("paths", null);
  const paths = listed !== null ? String(listed).split(",").filter(Boolean) : await sitemapPaths(base);
  let failed = 0;
  const typeCounts = new Map();
  for (const path of paths) {
    const res = await fetch(`${base}${path}`, { headers: { "User-Agent": "Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)" } });
    const html = await res.text();
    const { blocks, types, errors } = validateJsonLd(html);
    for (const type of new Set(types)) typeCounts.set(type, (typeCounts.get(type) ?? 0) + 1);
    if (res.status !== 200 || errors.length > 0) {
      failed += 1;
      console.log(`FAIL ${path} (${res.status}, ${blocks} blocks)`);
      for (const error of errors) console.log(`  - ${error}`);
    }
  }
  console.log(`\n${paths.length} pages, ${paths.length - failed} valid, ${failed} with errors`);
  console.log(`types (pages containing): ${[...typeCounts].map(([t, n]) => `${t} ${n}`).join(", ")}`);
  process.exit(failed > 0 ? 1 : 0);
}

// Run only as a CLI; `seo-audit.mjs` imports `validateJsonLd` without crawling.
if (process.argv[1]?.replaceAll("\\", "/").endsWith("scripts/validate-jsonld.mjs")) {
  await main();
}
