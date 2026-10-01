import { readFileSync } from "node:fs";
import nodePath from "node:path";
import { expect, test } from "@playwright/test";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../convex/_generated/api";
import { htmlLang, locales, pathnames, type Locale } from "../../i18n/routing";
import { convexUrl } from "./helpers/admin";

/**
 * Night-run step 10: every content page (PRD A6–A13) answers 200 in all four
 * locales under its LOCALIZED pathname, renders exactly one h1 and declares the
 * right `<html lang>`; unknown slugs answer 404 with the localized not-found
 * page. The dynamic routes use real slugs read from the public Convex queries,
 * so the matrix follows whatever the deployment holds.
 *
 * Plain HTTP requests, no browser: one assertion per route × locale, and the
 * desktop project only (a phone viewport changes nothing about a status code).
 */

type Route = keyof typeof pathnames;

const STATIC_ROUTES = [
  "/valuation",
  "/sell",
  "/locations",
  "/agents",
  "/about",
  "/contact",
  "/journal",
  "/favorites",
  "/compare",
  "/privacy",
  "/terms",
  "/cookies",
] as const satisfies readonly Route[];

const DYNAMIC_ROUTES = ["/locations/[slug]", "/agents/[slug]", "/journal/[slug]"] as const satisfies readonly Route[];

/** `/sr/lokacije/dorcol` from the router's own table, so a renamed segment cannot drift. */
function localizedPath(route: Route, locale: Locale, slug?: string): string {
  const entry = pathnames[route];
  const segment = typeof entry === "string" ? entry : entry[locale];
  const prefix = locale === "sr-Latn" ? "/sr" : `/${locale}`;
  const path = slug === undefined ? segment : segment.replace("[slug]", slug);
  return `${prefix}${path === "/" ? "" : path}`;
}

type Slugs = Record<(typeof DYNAMIC_ROUTES)[number], string>;

async function realSlugs(): Promise<Slugs> {
  const client = new ConvexHttpClient(convexUrl());
  const [tree, agents, posts] = await Promise.all([
    client.query(api.locations.tree, {}),
    client.query(api.agents.list, {}),
    client.query(api.posts.list, { paginationOpts: { numItems: 20, cursor: null } }),
  ]);
  const neighborhood = tree.find((node) => node.kind === "neighborhood" && node.saleCount + node.rentCount > 0);
  const agent = agents[0];
  // Never a post another spec created for itself: it may be deleted mid-run.
  const post = posts.page.find((entry) => !entry.slug.startsWith("e2e-"));
  if (neighborhood === undefined || agent === undefined || post === undefined) {
    throw new Error("the deployment needs a neighborhood with listings, a public agent and a published post");
  }
  return { "/locations/[slug]": neighborhood.slug, "/agents/[slug]": agent.slug, "/journal/[slug]": post.slug };
}

test.describe("content pages in every locale @public", () => {
  let slugs: Slugs;

  test.beforeAll(async ({}, testInfo) => {
    // A status code does not depend on the viewport: the desktop project only.
    test.skip(testInfo.project.name !== "desktop", "Route checks run once, on the desktop project.");
    slugs = await realSlugs();
  });

  for (const locale of locales) {
    for (const route of [...STATIC_ROUTES, ...DYNAMIC_ROUTES]) {
      test(`${route} → 200 in ${locale}`, async ({ request }) => {
        const dynamic = (DYNAMIC_ROUTES as readonly Route[]).includes(route);
        const path = localizedPath(route, locale, dynamic ? slugs[route as keyof Slugs] : undefined);
        const response = await request.get(path, { maxRedirects: 0 });
        expect(response.status(), path).toBe(200);
        const html = await response.text();
        expect(html, `${path} declares its language`).toContain(`<html lang="${htmlLang[locale]}"`);
        expect(html.match(/<h1[\s>]/g)?.length ?? 0, `${path} has exactly one h1`).toBe(1);
      });
    }
  }

  // The `[locale]/[...rest]` catch-all: the 404 speaks the visitor's language
  // (not the bilingual global page) and keeps the site's search box.
  for (const locale of locales) {
    test(`an unknown path → the localized 404 in ${locale}`, async ({ request }) => {
      const path = `${locale === "sr-Latn" ? "/sr" : `/${locale}`}/e2e-nema-ove-strane`;
      const response = await request.get(path, { maxRedirects: 0 });
      expect(response.status(), path).toBe(404);
      const html = await response.text();
      // Next serves a `notFound()` 404 as its error document and paints the
      // boundary from the RSC payload, so the localized proof is the
      // server-rendered <title>, not `<html lang>`.
      const messages = JSON.parse(readFileSync(nodePath.join(process.cwd(), "messages", `${locale}.json`), "utf8")) as {
        errors: { notFoundHeading: string };
        seo: { titleTemplate: string };
      };
      // The brand separator is per locale (German uses a spaced en dash).
      const title = messages.seo.titleTemplate.replace("{title}", messages.errors.notFoundHeading);
      expect(html, `${path} has the localized title`).toContain(`<title>${title}</title>`);
      expect(html, `${path} offers the search`).toContain("notfound-search");
    });
  }

  for (const route of DYNAMIC_ROUTES) {
    test(`${route} with an unknown slug → 404`, async ({ request }) => {
      const path = localizedPath(route, "sr-Latn", "e2e-ne-postoji");
      const response = await request.get(path, { maxRedirects: 0 });
      expect(response.status(), path).toBe(404);
    });
  }
});
