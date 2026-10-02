/// <reference types="vite/client" />
import { ConvexError } from "convex/values";
import { afterEach, describe, expect, test, vi } from "vitest";
import { api } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { LISTING_TEXT_LIMITS } from "../lib/validators";
import { testApp } from "../../tests/unit/convex-harness";
import { makeAgent, makeListing, makeLocation, makeUser } from "./fixtures";

/**
 * Review 14: what `listingsAdmin.update`, `publish` and `media.remove` accept.
 * A public listing stays within the publish checklist through every edit,
 * numbers are finite, text is capped, and the "price reduced" badge only
 * reflects prices the public saw.
 */

const DAY = 86_400_000;
const HOUR = 3_600_000;
const PAGE = { cursor: null, numItems: 20 };

type Refusal = { code?: string; message?: string; reasons?: string[] };

/** The `ConvexError` data a refused call carries. */
async function refusal(call: Promise<unknown>): Promise<Refusal> {
  try {
    await call;
  } catch (error) {
    if (error instanceof ConvexError) return error.data as Refusal;
    throw error;
  }
  throw new Error("the call was not refused");
}

type RunCtx = Parameters<Parameters<ReturnType<typeof testApp>["run"]>[0]>[0];

/** convex-test records no content type; production storage does. */
async function storeTyped(ctx: RunCtx, contentType: string): Promise<Id<"_storage">> {
  const id = await ctx.storage.store(new Blob([new Uint8Array([255, 216, 255, 224])], { type: contentType }));
  await (ctx.db as unknown as { patch: (id: Id<"_storage">, value: { contentType: string }) => Promise<void> }).patch(
    id,
    { contentType },
  );
  return id;
}

async function setup() {
  const t = testApp();
  const ids = await t.run(async (ctx) => {
    const city = await makeLocation(ctx, "beograd");
    const agent = await makeAgent(ctx, "agent-a");
    const admin = await makeUser(ctx, "admin");
    const agentUser = await makeUser(ctx, "agent", agent);
    const live = await makeListing(ctx, 1, city, agent);
    const draft = await makeListing(ctx, 2, city, agent, { status: "draft" });
    await ctx.db.patch("listings", draft, { visibility: "private", publishedAt: undefined });
    return { city, agent, admin, agentUser, live, draft };
  });
  return {
    t,
    ids,
    asAdmin: t.withIdentity({ subject: ids.admin }),
    asAgent: t.withIdentity({ subject: ids.agentUser }),
  };
}

afterEach(() => {
  vi.useRealTimers();
});

describe("a public listing keeps the publish checklist", () => {
  test("an edit that would take it below is refused with the reasons, and nothing is stored", async () => {
    const { t, ids, asAdmin } = await setup();
    const refused = await refusal(
      asAdmin.mutation(api.listingsAdmin.update, {
        id: ids.live,
        patch: { price: 0, areaM2: 0, rooms: 0, title: { sr: "" } },
      }),
    );
    expect(refused.code).toBe("PUBLISH_BLOCKED");
    expect(refused.reasons).toEqual([
      "Cena je uneta",
      "Kvadratura je uneta",
      "Struktura (broj soba) je uneta",
      "Naslov na srpskom (najmanje 10 znakova)",
    ]);

    const stored = await t.run((ctx) => ctx.db.get("listings", ids.live));
    expect(stored).toMatchObject({ price: 200_000, areaM2: 60, rooms: 2, title: { sr: "Testni stan broj 1 u Vračaru" } });
    const search = await t.query(api.listings.search, { filters: { transaction: "sale" }, sort: "newest", paginationOpts: PAGE });
    expect(search.page.find((card) => card._id === ids.live)?.price).toBe(200_000);
  });

  test("an agent can neither blank the contract number nor end the contract in the past", async () => {
    const { t, ids, asAgent } = await setup();
    const now = Date.now();
    for (const mandate of [
      { number: "   ", type: "open" as const, start: now - 10 * DAY, end: now + 300 * DAY },
      { number: "UP-1", type: "open" as const, start: now - 300 * DAY, end: now - 2 * DAY },
    ]) {
      const refused = await refusal(asAgent.mutation(api.listingsAdmin.update, { id: ids.live, patch: { mandate } }));
      expect(refused).toMatchObject({ code: "PUBLISH_BLOCKED", reasons: ["Ugovor o posredovanju je unet i važi"] });
    }
    const stored = await t.run((ctx) => ctx.db.get("listings", ids.live));
    expect(stored?.mandate?.number).toBe("UP-1");
    expect(stored?.mandateEnd).toBeGreaterThan(now);
  });

  test("autosave-style patches that keep it valid still go through", async () => {
    const { t, ids, asAgent } = await setup();
    const now = Date.now();
    await asAgent.mutation(api.listingsAdmin.update, { id: ids.live, patch: {} });
    await asAgent.mutation(api.listingsAdmin.update, { id: ids.live, patch: { price: 195_000 } });
    await asAgent.mutation(api.listingsAdmin.update, { id: ids.live, patch: { title: { sr: "Svetao dvosoban stan na Vračaru" } } });
    await asAgent.mutation(api.listingsAdmin.update, {
      id: ids.live,
      patch: { mandate: { number: "UP-1/2027", type: "exclusive", start: now - DAY, end: now + 365 * DAY } },
    });
    const stored = await t.run((ctx) => ctx.db.get("listings", ids.live));
    expect(stored).toMatchObject({ price: 195_000, title: { sr: "Svetao dvosoban stan na Vračaru" }, status: "published" });
    expect(stored?.mandate?.number).toBe("UP-1/2027");
  });

  test("a listing on the market with a lapsed contract only saves the renewal; a sold one stays editable", async () => {
    const { t, ids, asAdmin } = await setup();
    const now = Date.now();
    const lapsed = { number: "UP-9", type: "open" as const, start: now - 200 * DAY, end: now - 30 * DAY };
    const sold = await t.run(async (ctx) => {
      const id = await makeListing(ctx, 3, ids.city, ids.agent, { status: "sold" });
      await ctx.db.patch("listings", id, { mandate: lapsed, mandateEnd: lapsed.end });
      await ctx.db.patch("listings", ids.live, { mandate: lapsed, mandateEnd: lapsed.end });
      return id;
    });
    const description = { sr: "Prodato. Svetao stan u mirnoj ulici, renoviran, sa terasom i pogledom na park, blizu škole i prevoza." };

    // Sold: the contract has done its job, the Art. 18 facts still count.
    await asAdmin.mutation(api.listingsAdmin.update, { id: sold, patch: { description } });
    expect((await t.run((ctx) => ctx.db.get("listings", sold)))?.description).toEqual(description);
    expect(await refusal(asAdmin.mutation(api.listingsAdmin.update, { id: sold, patch: { price: 0 } }))).toMatchObject({
      code: "PUBLISH_BLOCKED",
      reasons: ["Cena je uneta"],
    });

    // On the market: refused until the contract is renewed.
    expect(
      await refusal(asAdmin.mutation(api.listingsAdmin.update, { id: ids.live, patch: { description } })),
    ).toMatchObject({ code: "PUBLISH_BLOCKED", reasons: ["Ugovor o posredovanju je unet i važi"] });
    await asAdmin.mutation(api.listingsAdmin.update, {
      id: ids.live,
      patch: { description, mandate: { ...lapsed, end: now + 180 * DAY } },
    });
  });

  test("flipping visibility to public clears the same bar", async () => {
    const { t, ids, asAdmin } = await setup();
    const hidden = await t.run(async (ctx) => {
      const id = await makeListing(ctx, 3, ids.city, ids.agent, { status: "reserved", price: 0 });
      await ctx.db.patch("listings", id, { visibility: "private", scope: "hidden:sale" });
      return id;
    });
    expect(
      await refusal(asAdmin.mutation(api.listingsAdmin.update, { id: hidden, patch: { visibility: "public" } })),
    ).toMatchObject({ code: "PUBLISH_BLOCKED", reasons: ["Cena je uneta"] });
    await asAdmin.mutation(api.listingsAdmin.update, { id: hidden, patch: { visibility: "public", price: 99_000 } });
    expect((await t.run((ctx) => ctx.db.get("listings", hidden)))?.scope).toBe("listed:sale");
  });

  test("media.remove keeps the photo minimum and a cover on a public listing", async () => {
    const { t, ids, asAdmin } = await setup();
    const five = await t.run((ctx) => makeListing(ctx, 3, ids.city, ids.agent, { mediaCount: 5 }));
    const refused = await refusal(
      asAdmin.mutation(api.media.remove, { listingId: five, target: "gallery", itemId: "m3-4" }),
    );
    expect(refused).toMatchObject({ code: "PUBLISH_BLOCKED", reasons: ["Najmanje 5 fotografija"] });
    expect((await t.run((ctx) => ctx.db.get("listings", five)))?.media).toHaveLength(5);

    // Six photos: removing the cover leaves five and passes the cover on.
    await asAdmin.mutation(api.media.remove, { listingId: ids.live, target: "gallery", itemId: "m1-0" });
    const live = await t.run((ctx) => ctx.db.get("listings", ids.live));
    expect(live?.media).toHaveLength(5);
    expect(live?.media.filter((item) => item.isCover === true)).toHaveLength(1);

    // A draft's gallery is free.
    for (const itemId of ["m2-0", "m2-1", "m2-2"]) {
      await asAdmin.mutation(api.media.remove, { listingId: ids.draft, target: "gallery", itemId });
    }
    expect((await t.run((ctx) => ctx.db.get("listings", ids.draft)))?.media).toHaveLength(3);
  });
});

describe("number rules", () => {
  test("NaN and Infinity are refused in every status, nested ones too", async () => {
    const { t, ids, asAdmin } = await setup();
    const patches = [
      { id: ids.draft, patch: { price: Number.NaN } },
      { id: ids.draft, patch: { costs: { infostan: Number.POSITIVE_INFINITY } } },
      { id: ids.live, patch: { areaM2: Number.POSITIVE_INFINITY } },
      { id: ids.live, patch: { price: Number.NaN, areaM2: Number.POSITIVE_INFINITY } },
    ];
    for (const { id, patch } of patches) {
      expect(await refusal(asAdmin.mutation(api.listingsAdmin.update, { id, patch }))).toMatchObject({
        code: "INVALID_INPUT",
      });
    }
    const [draft, live] = await t.run(async (ctx) => [
      await ctx.db.get("listings", ids.draft),
      await ctx.db.get("listings", ids.live),
    ]);
    expect(draft?.price).toBe(200_000);
    expect(draft?.costs).toBeUndefined();
    expect(live).toMatchObject({ price: 200_000, areaM2: 60, pricePerM2: 3333.33 });
  });

  test("a draft stays free: zeros and an empty title are fine, negatives and broken values are not", async () => {
    const { t, ids, asAdmin } = await setup();
    await asAdmin.mutation(api.listingsAdmin.update, {
      id: ids.draft,
      patch: { price: 0, areaM2: 0, rooms: 0, title: { sr: "" } },
    });
    expect(await t.run((ctx) => ctx.db.get("listings", ids.draft))).toMatchObject({ price: 0, areaM2: 0, rooms: 0 });

    const now = Date.now();
    for (const patch of [
      { price: -1 },
      { bathrooms: -2 },
      { rooms: 2.3 },
      { location: { lat: 95, lng: 20.4, addressVisibility: "area" as const } },
      { mandate: { number: "UP-2", type: "open" as const, start: now, end: now - DAY } },
    ]) {
      expect(await refusal(asAdmin.mutation(api.listingsAdmin.update, { id: ids.draft, patch }))).toMatchObject({
        code: "INVALID_INPUT",
      });
    }
  });

  test("past the draft stage the Art. 18 figures a patch sets must be real", async () => {
    const { t, ids, asAdmin } = await setup();
    const { withdrawn, land } = await t.run(async (ctx) => ({
      withdrawn: await makeListing(ctx, 3, ids.city, ids.agent, { status: "withdrawn" }),
      land: await makeListing(ctx, 4, ids.city, ids.agent, { status: "review", propertyType: "land", rooms: 0 }),
    }));
    for (const patch of [{ price: 0 }, { areaM2: 0 }, { rooms: 0 }]) {
      expect(await refusal(asAdmin.mutation(api.listingsAdmin.update, { id: withdrawn, patch }))).toMatchObject({
        code: "INVALID_INPUT",
      });
    }
    // Land has no room structure to state.
    await asAdmin.mutation(api.listingsAdmin.update, { id: land, patch: { rooms: 0, price: 90_000 } });
  });

  test("without an area there is no price per m²", async () => {
    const { t, ids, asAdmin } = await setup();
    await asAdmin.mutation(api.listingsAdmin.update, { id: ids.draft, patch: { price: 180_000, areaM2: 0 } });
    expect((await t.run((ctx) => ctx.db.get("listings", ids.draft)))?.pricePerM2).toBe(0);
  });
});

describe("the price reduced badge", () => {
  test("a correction before the first publication never shows as a reduction", async () => {
    const { t, ids, asAdmin } = await setup();
    await asAdmin.mutation(api.listingsAdmin.update, { id: ids.draft, patch: { price: 250_000 } });
    await asAdmin.mutation(api.listingsAdmin.update, { id: ids.draft, patch: { price: 230_000 } });
    const { slug } = await asAdmin.mutation(api.listingsAdmin.publish, { id: ids.draft });

    expect((await t.run((ctx) => ctx.db.get("listings", ids.draft)))?.previousPrice).toBeUndefined();
    const detail = await t.query(api.listings.bySlug, { slug });
    if (detail.kind !== "listing") throw new Error("the published listing is not public");
    expect(detail.listing.price).toBe(230_000);
    expect(detail.listing.previousPrice).toBeUndefined();
  });

  test("the first publication clears a stale badge, by the button and in bulk", async () => {
    const { t, ids, asAdmin } = await setup();
    const other = await t.run(async (ctx) => {
      const id = await makeListing(ctx, 3, ids.city, ids.agent, { status: "draft" });
      await ctx.db.patch("listings", id, { visibility: "private", publishedAt: undefined, previousPrice: 260_000 });
      await ctx.db.patch("listings", ids.draft, { previousPrice: 260_000 });
      return id;
    });
    await asAdmin.mutation(api.listingsAdmin.publish, { id: ids.draft });
    const bulk = await asAdmin.mutation(api.listingsAdmin.bulk, { ids: [other], action: "publish" });
    expect(bulk.done).toBe(1);
    const [first, second] = await t.run(async (ctx) => [
      await ctx.db.get("listings", ids.draft),
      await ctx.db.get("listings", other),
    ]);
    expect(first?.previousPrice).toBeUndefined();
    expect(second?.previousPrice).toBeUndefined();
  });

  test("while public a cut sets the badge and a rise clears it; a hidden re-price leaves it alone", async () => {
    const { t, ids, asAdmin } = await setup();
    await asAdmin.mutation(api.listingsAdmin.update, { id: ids.live, patch: { price: 180_000 } });
    expect((await t.run((ctx) => ctx.db.get("listings", ids.live)))?.previousPrice).toBe(200_000);
    await asAdmin.mutation(api.listingsAdmin.update, { id: ids.live, patch: { price: 210_000 } });
    expect((await t.run((ctx) => ctx.db.get("listings", ids.live)))?.previousPrice).toBeUndefined();

    await asAdmin.mutation(api.listingsAdmin.unpublish, { id: ids.live });
    await asAdmin.mutation(api.listingsAdmin.update, { id: ids.live, patch: { price: 150_000 } });
    expect((await t.run((ctx) => ctx.db.get("listings", ids.live)))?.previousPrice).toBeUndefined();
  });
});

describe("the share image", () => {
  test("a new or changed OG image follows the image rules; the listing's own photos and unchanged values pass", async () => {
    vi.useFakeTimers();
    const start = Date.now();
    const { t, ids, asAdmin } = await setup();
    const { oldGalleryBlob, oldLooseBlob } = await t.run(async (ctx) => ({
      oldGalleryBlob: await storeTyped(ctx, "image/jpeg"),
      oldLooseBlob: await storeTyped(ctx, "image/jpeg"),
    }));
    await t.run(async (ctx) => {
      const doc = await ctx.db.get("listings", ids.live);
      if (doc === null) throw new Error("fixture missing");
      await ctx.db.patch("listings", ids.live, {
        media: [...doc.media, { id: "up-1", image: { kind: "storage", storageId: oldGalleryBlob }, alt: { sr: "Dnevna soba" }, order: doc.media.length }],
      });
    });
    // Both blobs are now older than the 6-hour link window.
    vi.setSystemTime(start + 7 * HOUR);
    const html = await t.run((ctx) => storeTyped(ctx, "text/html"));

    const ogImage = (image: { kind: "url"; url: string } | { kind: "storage"; storageId: Id<"_storage"> }) =>
      asAdmin.mutation(api.listingsAdmin.update, { id: ids.live, patch: { seo: { ogImage: image } } });
    for (const image of [
      { kind: "url" as const, url: "https://evil.example/share.jpg" },
      { kind: "url" as const, url: "http://images.unsplash.com/photo-1" },
      { kind: "storage" as const, storageId: oldLooseBlob },
      { kind: "storage" as const, storageId: html },
    ]) {
      expect(await refusal(ogImage(image))).toMatchObject({ code: "INVALID_INPUT" });
    }
    expect((await t.run((ctx) => ctx.db.get("listings", ids.live)))?.seo).toBeUndefined();

    // The listing's own gallery photos, uploaded long ago or by URL.
    await ogImage({ kind: "storage", storageId: oldGalleryBlob });
    await ogImage({ kind: "url", url: "https://images.example/1-2.jpg" });
    await ogImage({ kind: "url", url: "https://images.unsplash.com/photo-1" });
    // A stored value saves again unchanged, even from a host added before the rule.
    await t.run((ctx) =>
      ctx.db.patch("listings", ids.live, { seo: { ogImage: { kind: "url", url: "https://legacy.example/og.jpg" } } }),
    );
    await ogImage({ kind: "url", url: "https://legacy.example/og.jpg" });
  });
});

describe("contract dates", () => {
  test("a contract counts from the start of its first Belgrade day to the end of its last", async () => {
    vi.useFakeTimers();
    // 06:00 UTC on 2 Oct 2026 is 08:00 in Belgrade.
    vi.setSystemTime(Date.UTC(2026, 9, 2, 6));
    const { t, ids, asAdmin } = await setup();
    const atNoon = (y: number, m: number, d: number) => Date.UTC(y, m, d, 10);
    const contract = (start: number, end: number) =>
      t.run((ctx) =>
        ctx.db.patch("listings", ids.draft, { mandate: { number: "UP-5", type: "open", start, end }, mandateEnd: end }),
      );

    // Starting later: not in force yet.
    await contract(atNoon(2026, 10, 1), atNoon(2027, 4, 1));
    expect(
      await refusal(asAdmin.mutation(api.listingsAdmin.publish, { id: ids.draft })),
    ).toMatchObject({ code: "PUBLISH_BLOCKED", reasons: ["Ugovor o posredovanju je unet i važi"] });

    // Starting today (stored at noon): in force since midnight.
    await contract(atNoon(2026, 9, 2), atNoon(2027, 3, 2));
    await asAdmin.mutation(api.listingsAdmin.publish, { id: ids.draft });

    // Ending today: still in force at 23:30 Belgrade time, gone at midnight.
    await contract(atNoon(2026, 3, 2), atNoon(2026, 9, 2));
    vi.setSystemTime(Date.UTC(2026, 9, 2, 21, 30));
    const late = await asAdmin.query(api.listingsAdmin.get, { id: ids.draft, now: Date.now() });
    expect(late?.checklist.find((item) => item.code === "mandate")?.ok).toBe(true);
    const midnight = await asAdmin.query(api.listingsAdmin.get, { id: ids.draft, now: Date.UTC(2026, 9, 2, 22) });
    expect(midnight?.checklist.find((item) => item.code === "mandate")?.ok).toBe(false);
  });
});

describe("slugs", () => {
  test("a rename that resolves back to the current slug leaves no redirect behind", async () => {
    const { t, ids, asAdmin } = await setup();
    const slugOf = async (id: Id<"listings">) => (await t.run((ctx) => ctx.db.get("listings", id)))?.slug ?? "";
    const base = await slugOf(ids.live);
    // Another listing holds the slug the title produces; this one has its "-2" twin.
    await t.run(async (ctx) => {
      await ctx.db.patch("listings", ids.draft, { slug: base });
      await ctx.db.patch("listings", ids.live, { slug: `${base}-2` });
    });

    expect(await asAdmin.mutation(api.listingsAdmin.regenerateSlug, { id: ids.live })).toEqual({ slug: `${base}-2` });
    await asAdmin.mutation(api.listingsAdmin.update, { id: ids.live, patch: { slug: base } });
    expect(await slugOf(ids.live)).toBe(`${base}-2`);
    const redirects = await t.run((ctx) =>
      ctx.db.query("slugRedirects").withIndex("by_listingId", (q) => q.eq("listingId", ids.live)).take(10),
    );
    expect(redirects).toEqual([]);
  });
});

describe("text limits", () => {
  const L = LISTING_TEXT_LIMITS;

  test("each capped field is refused one character (or item) over, naming the field", async () => {
    const { ids, asAdmin } = await setup();
    const cases = [
      { name: /Naslov/, patch: { title: { sr: "x".repeat(L.title + 1) } } },
      { name: /Naslov/, patch: { title: { sr: "Stan na Vračaru", de: "x".repeat(L.title + 1) } } },
      { name: /Opis/, patch: { description: { sr: "x".repeat(L.description + 1) } } },
      { name: /Istaknute stavke/, patch: { highlights: { sr: Array.from({ length: L.highlightItems + 1 }, () => "Lift") } } },
      { name: /Istaknute stavke/, patch: { highlights: { sr: ["x".repeat(L.highlightLength + 1)] } } },
      { name: /Oznake pogleda/, patch: { view: Array.from({ length: L.viewTags + 1 }, () => "park") } },
      { name: /Oznaka pogleda/, patch: { view: ["x".repeat(L.viewTagLength + 1)] } },
      {
        name: /Mesta u blizini/,
        patch: { poi: Array.from({ length: L.poiCount + 1 }, () => ({ kind: "park" as const, name: "Park", distanceM: 100 })) },
      },
      { name: /mesta u blizini/, patch: { poi: [{ kind: "park" as const, name: "x".repeat(L.poiName + 1), distanceM: 100 }] } },
      { name: /Meta naslov/, patch: { seo: { metaTitle: { sr: "x".repeat(L.metaTitle + 1) } } } },
      { name: /Meta opis/, patch: { seo: { metaDescription: { sr: "x".repeat(L.metaDescription + 1) } } } },
      { name: /Tekst o proviziji/, patch: { commissionText: { sr: "x".repeat(L.commissionText + 1) } } },
      {
        name: /Ulica/,
        patch: { location: { street: "x".repeat(L.street + 1), lat: 44.8, lng: 20.45, addressVisibility: "area" as const } },
      },
      { name: /Broj ugovora/, patch: { mandate: { number: "x".repeat(L.mandateNumber + 1), type: "open" as const, start: 1, end: 2 } } },
      {
        name: /Teret/,
        patch: { legal: { registration: "registered" as const, legalization: "legal" as const, encumbrance: "x".repeat(L.encumbrance + 1) } },
      },
    ];
    for (const { name, patch } of cases) {
      const refused = await refusal(asAdmin.mutation(api.listingsAdmin.update, { id: ids.draft, patch }));
      expect(refused.code).toBe("INVALID_INPUT");
      expect(refused.message).toMatch(name);
    }
  });

  test("text at the limits is stored", async () => {
    const { t, ids, asAdmin } = await setup();
    await asAdmin.mutation(api.listingsAdmin.update, {
      id: ids.draft,
      patch: {
        title: { sr: "x".repeat(L.title) },
        description: { sr: "x".repeat(L.description) },
        highlights: { sr: Array.from({ length: L.highlightItems }, () => "x".repeat(L.highlightLength)) },
        view: Array.from({ length: L.viewTags }, () => "x".repeat(L.viewTagLength)),
        poi: Array.from({ length: L.poiCount }, () => ({ kind: "park" as const, name: "x".repeat(L.poiName), distanceM: 1 })),
        seo: { metaTitle: { sr: "x".repeat(L.metaTitle) }, metaDescription: { sr: "x".repeat(L.metaDescription) } },
      },
    });
    expect((await t.run((ctx) => ctx.db.get("listings", ids.draft)))?.title.sr).toHaveLength(L.title);
  });

  test("create caps the title, and a copy's title stays within it", async () => {
    const { t, ids, asAdmin } = await setup();
    expect(
      await refusal(
        asAdmin.mutation(api.listingsAdmin.create, {
          transaction: "sale",
          propertyType: "apartment",
          cityId: ids.city,
          titleSr: "x".repeat(L.title + 1),
        }),
      ),
    ).toMatchObject({ code: "INVALID_INPUT" });

    await t.run((ctx) => ctx.db.patch("listings", ids.live, { title: { sr: "y".repeat(L.title) } }));
    const copy = await asAdmin.mutation(api.listingsAdmin.duplicate, { id: ids.live });
    const title = (await t.run((ctx) => ctx.db.get("listings", copy.id)))?.title.sr ?? "";
    expect(title).toHaveLength(L.title);
    expect(title.endsWith(" (kopija)")).toBe(true);
  });
});
