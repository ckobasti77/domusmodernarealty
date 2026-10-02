import { expect, test } from "@playwright/test";

/**
 * Review 14: the search page's server HTML stays light. Each result card
 * arrives with its first photo only (the carousel mounts the others when it
 * is used), and the island's props carry only what the cards draw, in the
 * page's locale.
 */

/** The outer HTML of the `<ul>` whose opening tag carries `marker`. */
function listHtml(html: string, marker: string): string {
  const at = html.indexOf(marker);
  if (at === -1) throw new Error(`no ${marker} in the page`);
  const start = html.lastIndexOf("<ul", at);
  const tags = /<\/?ul\b/g;
  tags.lastIndex = start;
  let depth = 0;
  for (let match = tags.exec(html); match !== null; match = tags.exec(html)) {
    depth += match[0] === "<ul" ? 1 : -1;
    if (depth === 0) return html.slice(start, match.index + "</ul>".length);
  }
  throw new Error(`${marker} is never closed`);
}

test.describe("search — page weight", () => {
  test("the results page is under 450 KB, with at most two photos per card", async ({ request }) => {
    const response = await request.get("/sr/nekretnine");
    expect(response.ok()).toBe(true);
    const body = await response.body();
    expect(body.length).toBeLessThan(450_000);

    const list = listHtml(body.toString("utf8"), 'data-testid="results-list"');
    const cards = list.match(/<article\b/g)?.length ?? 0;
    const images = list.match(/<img\b/g)?.length ?? 0;
    expect(cards).toBeGreaterThan(0);
    expect(cards).toBeLessThanOrEqual(24);
    expect(images).toBeLessThanOrEqual(cards * 2);
  });
});
