import { expect, test } from "@playwright/test";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../convex/_generated/api";
import { convexUrl } from "./helpers/admin";
import { ORDINARY_LISTING } from "./helpers/routes";

/**
 * Review 14, server-side SEO fixes, asserted against the production build:
 *  - no `Link: …; rel="alternate"` response header from next-intl contradicts
 *    the hreflang set in the HTML (x-default → `/sr/…`, curated queries kept);
 *  - the internal `/sr-Latn` segment is a permanent redirect to `/sr`, not a
 *    redirect to the 404 at `/sr/sr-Latn/…`;
 *  - a listing's generated meta description keeps its title whole, and its
 *    share-image URL is versioned by what the image draws, not by the price.
 */

test.describe("review 14: SEO @public", () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "Server responses do not depend on the viewport.");
  });

  test("responses send no hreflang Link header; the HTML keeps the full set", async ({ request }) => {
    const listingPath = `/sr/nekretnine/${ORDINARY_LISTING}`;
    for (const path of [listingPath, "/sr/nekretnine?type=apartment&sort=price_asc", "/en", "/de/immobilien"]) {
      const response = await request.get(path, { maxRedirects: 0 });
      expect(response.status(), path).toBe(200);
      expect(response.headers().link ?? "", `${path} Link header`).not.toMatch(/rel="?alternate/i);
    }
    const html = await (await request.get(listingPath)).text();
    expect(html, "x-default in the HTML").toMatch(
      new RegExp(`<link(?=[^>]*hreflang="x-default")(?=[^>]*href="[^"]*${listingPath}")[^>]*>`, "i"),
    );
  });

  test("the internal Serbian segment redirects permanently to /sr, query included", async ({ request }) => {
    const cases = [
      ["/sr-Latn/nekretnine", "/sr/nekretnine"],
      ["/sr-latn/nekretnine?type=apartment&sort=price_asc", "/sr/nekretnine?type=apartment&sort=price_asc"],
      ["/SR-LATN", "/sr"],
    ] as const;
    for (const [from, to] of cases) {
      const response = await request.get(from, { maxRedirects: 0 });
      expect([301, 308], from).toContain(response.status());
      const location = new URL(response.headers().location ?? "", "http://localhost");
      expect(`${location.pathname}${location.search}`, from).toBe(to);
    }
    const followed = await request.get("/sr-Latn/nekretnine");
    expect(followed.status()).toBe(200);
    expect(new URL(followed.url()).pathname).toBe("/sr/nekretnine");
  });

  test("a listing's description keeps its title whole; its share image is versioned by the picture", async ({
    browser,
  }, testInfo) => {
    const result = await new ConvexHttpClient(convexUrl()).query(api.listings.bySlug, { slug: ORDINARY_LISTING });
    if (result.kind !== "listing") throw new Error(`${ORDINARY_LISTING} must be a published listing`);
    const listing = result.listing;

    // Server-rendered metadata: no scripts needed, and the attribute values come back decoded.
    const context = await browser.newContext({ javaScriptEnabled: false, baseURL: testInfo.project.use.baseURL });
    try {
      const page = await context.newPage();
      await page.goto(`/sr/nekretnine/${ORDINARY_LISTING}`);
      if (listing.seoDescription === undefined) {
        const description = (await page.locator('meta[name="description"]').getAttribute("content")) ?? "";
        expect(description.startsWith(`${listing.title.sr.replace(/[.\s]+$/u, "")}. `), description).toBe(true);
        expect(description.endsWith(`Šifra ${listing.ref}.`), description).toBe(true);
      }
      const ogImage = new URL((await page.locator('meta[property="og:image"]').getAttribute("content")) ?? "");
      expect(ogImage.pathname).toBe(`/sr/nekretnine/${ORDINARY_LISTING}/opengraph-image`);
      const version = ogImage.searchParams.get("v");
      expect(version).toMatch(/^[0-9a-z]+$/);
      expect(version).not.toBe(String(listing.price));
    } finally {
      await context.close();
    }
  });
});
