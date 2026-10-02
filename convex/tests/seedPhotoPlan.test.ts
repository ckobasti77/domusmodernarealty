import { describe, expect, test } from "vitest";
import { buildPhotoPlan } from "../seed/media";
import { SEED_LISTINGS } from "../seed/spec";

/**
 * Step 15: two demo penthouses got covers their titles contradict (a lawn and a
 * garden fence on the 24th floor of ME-1049, a lake behind inland ME-1044). A
 * spec can now pin one of the listing's own planned photos as the cover; the
 * photo it replaces is left out of the gallery.
 */
describe("seed photo plan", () => {
  const plan = buildPhotoPlan(SEED_LISTINGS);
  const unpinned = buildPhotoPlan(SEED_LISTINGS.map(({ coverPhoto: _pin, ...spec }) => spec));
  const pinnedIndexes = SEED_LISTINGS.flatMap((spec, index) => (spec.coverPhoto === undefined ? [] : [index]));

  test("a pinned cover leads its gallery and the cover it displaces is left out", () => {
    expect(pinnedIndexes.length).toBeGreaterThan(0);
    for (const index of pinnedIndexes) {
      const urls = plan[index].map((photo) => photo.url);
      expect(urls[0]).toBe(SEED_LISTINGS[index].coverPhoto);
      expect(urls).not.toContain(unpinned[index][0]?.url);
      expect([...urls].sort()).toEqual(
        unpinned[index]
          .slice(1)
          .map((photo) => photo.url)
          .sort(),
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

  test("every listing gets one photo per category slot (less a left-out cover), without repeats", () => {
    for (const [index, spec] of SEED_LISTINGS.entries()) {
      const urls = plan[index].map((photo) => photo.url);
      expect(urls).toHaveLength(spec.photos.length - (spec.coverPhoto === undefined ? 0 : 1));
      expect(new Set(urls).size).toBe(urls.length);
    }
  });
});
