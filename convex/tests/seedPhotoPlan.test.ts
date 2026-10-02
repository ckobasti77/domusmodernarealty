import { describe, expect, test } from "vitest";
import { buildPhotoPlan } from "../seed/media";
import { SEED_LISTINGS } from "../seed/spec";

/**
 * Step 15: two demo penthouses got covers their titles contradict (a lawn and a
 * garden fence on the 24th floor of ME-1049, a lake behind inland ME-1044). A
 * spec can now pin one of the listing's own planned photos as the cover.
 */
describe("seed photo plan", () => {
  const plan = buildPhotoPlan(SEED_LISTINGS);
  const unpinned = buildPhotoPlan(SEED_LISTINGS.map(({ coverPhoto: _pin, ...spec }) => spec));
  const pinnedIndexes = SEED_LISTINGS.flatMap((spec, index) => (spec.coverPhoto === undefined ? [] : [index]));

  test("a pinned cover leads its gallery and the displaced cover goes last", () => {
    expect(pinnedIndexes.length).toBeGreaterThan(0);
    for (const index of pinnedIndexes) {
      expect(plan[index][0]?.url).toBe(SEED_LISTINGS[index].coverPhoto);
      expect(plan[index].at(-1)?.url).toBe(unpinned[index][0]?.url);
      expect([...plan[index]].map((photo) => photo.url).sort()).toEqual(
        [...unpinned[index]].map((photo) => photo.url).sort(),
      );
    }
  });

  test("pinning changes no other listing's photos", () => {
    for (const [index, photos] of plan.entries()) {
      if (pinnedIndexes.includes(index)) continue;
      expect(photos.map((photo) => photo.url)).toEqual(unpinned[index].map((photo) => photo.url));
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
