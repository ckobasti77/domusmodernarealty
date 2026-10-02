import { describe, expect, test } from "vitest";
import { api } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { testApp } from "../../tests/unit/convex-harness";
import { bucketOf, scopeKey } from "../lib/search";
import type { ViewingStatus } from "../lib/validators";
import { makeAgent, makeListing, makeLocation, makeUser } from "./fixtures";

/**
 * Review 14 regressions in the public DTOs and the dashboard: the price
 * history, the share-image override, an agent's profile listings, and the
 * "active listings" / "viewings today" KPIs.
 */

async function setup() {
  const t = testApp();
  const ids = await t.run(async (ctx) => ({
    city: await makeLocation(ctx, "beograd"),
    agent: await makeAgent(ctx, "agent-one"),
    manager: await makeUser(ctx, "manager"),
  }));
  return { t, ids };
}

async function detailOf(t: ReturnType<typeof testApp>, listing: Id<"listings">) {
  const slug = await t.run(async (ctx) => (await ctx.db.get("listings", listing))?.slug ?? "");
  const result = await t.query(api.listings.bySlug, { slug });
  if (result.kind !== "listing") throw new Error(`expected a listing, got ${result.kind}`);
  return result.listing;
}

describe("listing detail", () => {
  test("public price changes survive any number of draft edits; the latest 20 are listed, oldest first", async () => {
    const { t, ids } = await setup();
    const { listing, publishedAt } = await t.run(async (ctx) => {
      const listing = await makeListing(ctx, 1, ids.city, ids.agent);
      const publishedAt = (await ctx.db.get("listings", listing))?.publishedAt ?? 0;
      for (let step = 1; step <= 25; step += 1) {
        const at = publishedAt - 86_400_000 + step * 60_000;
        await ctx.db.insert("priceChanges", { listingId: listing, at, from: 250_000 + step, to: 250_000 + step + 1 });
      }
      await ctx.db.insert("priceChanges", { listingId: listing, at: publishedAt + 3_600_000, from: 230_000, to: 200_000 });
      return { listing, publishedAt };
    });
    expect((await detailOf(t, listing)).priceHistory).toEqual([
      { at: publishedAt + 3_600_000, from: 230_000, price: 200_000 },
    ]);

    await t.run(async (ctx) => {
      for (let step = 1; step <= 22; step += 1) {
        const at = publishedAt + (step + 1) * 3_600_000;
        await ctx.db.insert("priceChanges", { listingId: listing, at, from: 200_000 - step + 1, to: 200_000 - step });
      }
    });
    const history = (await detailOf(t, listing)).priceHistory;
    expect(history).toHaveLength(20);
    expect(history.at(-1)).toEqual({ at: publishedAt + 23 * 3_600_000, from: 199_979, price: 199_978 });
    expect(history.map((change) => change.at)).toEqual([...history.map((change) => change.at)].sort((a, b) => a - b));
  });

  test("the admin's share-image override reaches the detail as a URL", async () => {
    const { t, ids } = await setup();
    const { plain, remote, uploaded, uploadedUrl } = await t.run(async (ctx) => {
      const storageId = await ctx.storage.store(
        new Blob([new Uint8Array([255, 216, 255, 224])], { type: "image/jpeg" }),
      );
      const remote = await makeListing(ctx, 2, ids.city, ids.agent);
      await ctx.db.patch("listings", remote, {
        seo: { ogImage: { kind: "url", url: "https://images.example/og-share.jpg" } },
      });
      const uploaded = await makeListing(ctx, 3, ids.city, ids.agent);
      await ctx.db.patch("listings", uploaded, { seo: { ogImage: { kind: "storage", storageId } } });
      return {
        plain: await makeListing(ctx, 1, ids.city, ids.agent),
        remote,
        uploaded,
        uploadedUrl: await ctx.storage.getUrl(storageId),
      };
    });

    expect((await detailOf(t, plain)).seo).toEqual({});
    expect((await detailOf(t, remote)).seo).toEqual({ ogImageUrl: "https://images.example/og-share.jpg" });
    expect(uploadedUrl).not.toBeNull();
    expect((await detailOf(t, uploaded)).seo).toEqual({ ogImageUrl: uploadedUrl });
  });
});

describe("agents.bySlug", () => {
  test("lists the newest public listings per section, however many old ones the agent has", async () => {
    const { t, ids } = await setup();
    const expected = await t.run(async (ctx) => {
      const now = Date.now();
      // Created first, so an agent-wide read in creation order meets them first.
      for (let index = 1; index <= 121; index += 1) {
        await makeListing(ctx, index, ids.city, ids.agent, { status: "archived", mediaCount: 1 });
      }
      const make = async (index: number, status: "published" | "reserved" | "sold" | "rented", hoursAgo: number) => {
        const id = await makeListing(ctx, index, ids.city, ids.agent, { status, mediaCount: 1 });
        await ctx.db.patch("listings", id, { updatedAt: now - hoursAgo * 3_600_000 });
        return id;
      };
      const published: Id<"listings">[] = [];
      for (let index = 0; index < 13; index += 1) published.push(await make(200 + index, "published", index * 2));
      const reserved = await make(220, "reserved", 1);
      const sold = await make(221, "sold", 5);
      const rented = await make(222, "rented", 3);
      // Public status, hidden visibility: never on the profile.
      for (const [index, status] of [[223, "published"], [224, "sold"]] as const) {
        const hidden = await make(index, status, 0);
        await ctx.db.patch("listings", hidden, {
          visibility: "private",
          scope: scopeKey(bucketOf(status, "private"), "sale"),
        });
      }
      // Newest first: published 0h, reserved 1h, published 2h, 4h, … (12 cards).
      const active = [published[0], reserved, ...published.slice(1, 11)];
      return { active, closed: [rented, sold] };
    });

    const profile = await t.query(api.agents.bySlug, { slug: "agent-one" });
    expect(profile?.active.map((card) => card._id)).toEqual(expected.active);
    expect(profile?.closed.map((card) => card._id)).toEqual(expected.closed);
  });
});

describe("analytics.dashboard", () => {
  test("viewings today leave out cancelled and no-shows; active listings include reserved", async () => {
    const { t, ids } = await setup();
    const now = Date.UTC(2026, 9, 2, 9);
    await t.run(async (ctx) => {
      const listing = await makeListing(ctx, 1, ids.city, ids.agent);
      await makeListing(ctx, 2, ids.city, ids.agent, { status: "reserved" });
      await makeListing(ctx, 3, ids.city, ids.agent, { status: "draft" });
      const statuses: ViewingStatus[] = ["requested", "confirmed", "done", "cancelled", "cancelled", "no_show"];
      for (const [index, status] of statuses.entries()) {
        const start = now + (index + 1) * 1_800_000;
        await ctx.db.insert("viewings", {
          listingId: listing,
          agentId: ids.agent,
          start,
          end: start + 3_600_000,
          mode: "in_person",
          status,
          isDemo: false,
        });
      }
      // Tomorrow (Belgrade): not today's.
      const tomorrow = now + 86_400_000;
      await ctx.db.insert("viewings", {
        listingId: listing,
        agentId: ids.agent,
        start: tomorrow,
        end: tomorrow + 3_600_000,
        mode: "in_person",
        status: "confirmed",
        isDemo: false,
      });
    });

    const dashboard = await t.withIdentity({ subject: ids.manager }).query(api.analytics.dashboard, { now });
    expect(dashboard).toMatchObject({ activeListings: 2, draftListings: 1, viewingsToday: 3 });
  });
});
