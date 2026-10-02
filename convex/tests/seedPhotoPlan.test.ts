import { describe, expect, test } from "vitest";
import { buildPhotoPlan } from "../seed/media";
import { SEED_LISTINGS } from "../seed/spec";

/**
 * Step 15: the showcase penthouse (ME-1049, "24. sprat") got a cover looking
 * onto a lawn and a garden fence. A spec can now pin a verified cover photo.
 */
describe("seed photo plan", () => {
  const plan = buildPhotoPlan(SEED_LISTINGS);

  test("a pinned cover is the listing's first photo", () => {
    const pinned = SEED_LISTINGS.flatMap((spec, index) =>
      spec.coverPhoto === undefined ? [] : [{ index, url: spec.coverPhoto }],
    );
    expect(pinned.length).toBeGreaterThan(0);
    for (const { index, url } of pinned) {
      expect(plan[index][0]?.url).toBe(url);
    }
  });

  test("covers stay distinct across the demo listings", () => {
    const covers = plan.map((photos) => photos[0]?.url).filter((url) => url !== undefined);
    expect(new Set(covers).size).toBe(covers.length);
  });

  test("every listing still gets one photo per category slot, without repeats inside a listing", () => {
    for (const [index, spec] of SEED_LISTINGS.entries()) {
      const urls = plan[index].map((photo) => photo.url);
      expect(urls).toHaveLength(spec.photos.length);
      expect(new Set(urls).size).toBe(urls.length);
    }
  });
});
