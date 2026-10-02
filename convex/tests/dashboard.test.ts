import { describe, expect, test } from "vitest";
import { api } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { testApp } from "../../tests/unit/convex-harness";
import { activityActor, activitySummary, feedSummary } from "../../components/admin/dashboard/activity-labels";
import { pluralSr } from "../../components/admin/dashboard/format";
import { chartWindow, dayTicks, type SeriesRow } from "../../components/admin/dashboard/series";
import { makeAgent, makeListing, makeLocation, makeUser } from "./fixtures";

/**
 * The admin dashboard (PRD B2): the to-do rows name their listing, and the
 * pure helpers the cards are drawn from (chart window and axis, feed wording).
 */

const DAY = 86_400_000;

describe("listingsAdmin.todos", () => {
  test("every row names its listing by ref and Serbian title", async () => {
    const t = testApp();
    const now = Date.now();
    const ids = await t.run(async (ctx) => {
      const city = await makeLocation(ctx, "beograd");
      const agent = await makeAgent(ctx, "agent-a");
      const manager = await makeUser(ctx, "manager");
      // 6 photos, no floor plan, no translations, a contract ending in 5 days.
      const listing = await makeListing(ctx, 1, city, agent, {
        titleSr: "Svetao trosoban stan na Vračaru",
        mandateEndsInDays: 5,
      });
      return { manager, listing };
    });

    const todos = await t.withIdentity({ subject: ids.manager }).query(api.listingsAdmin.todos, { now });
    const named = { id: ids.listing, ref: "ME-2001", title: "Svetao trosoban stan na Vračaru" };
    expect(todos.missingPhotos).toEqual([{ ...named, count: 6 }]);
    expect(todos.missingFloorPlan).toEqual([named]);
    expect(todos.missingTranslations).toEqual([{ ...named, locales: ["en", "ru", "de"] }]);
    expect(todos.mandateExpiring).toEqual([{ ...named, end: expect.any(Number) }]);
  });
});

describe("views & leads chart window", () => {
  // 15:00 UTC on 2 Oct 2026; the rollup has counted up to 30 Sep.
  const now = Date.UTC(2026, 9, 2, 15);
  const rows = (from: number, count: number): SeriesRow[] =>
    Array.from({ length: count }, (_, index) => ({
      day: new Date(from + index * DAY).toISOString().slice(0, 10),
      views: 10 + index,
      leads: index % 2,
    }));

  test("a record younger than 30 days fills the axis from the day before it starts", () => {
    const range = chartWindow(rows(Date.UTC(2026, 8, 27), 4), now);
    expect(range.days.map((day) => day.day)).toEqual([
      "2026-09-26",
      "2026-09-27",
      "2026-09-28",
      "2026-09-29",
      "2026-09-30",
    ]);
    expect(range.days.map((day) => day.recorded)).toEqual([false, true, true, true, true]);
    expect(range.recorded).toBe(4);
    expect(range.totalViews).toBe(10 + 11 + 12 + 13);
    expect(range.totalLeads).toBe(2);
  });

  test("a record of 30 days or more keeps the 30-day axis ending on the latest row", () => {
    const range = chartWindow(rows(Date.UTC(2026, 7, 22), 40), now);
    expect(range.days).toHaveLength(30);
    expect(range.days[0]?.day).toBe("2026-09-01");
    expect(range.days[29]?.day).toBe("2026-09-30");
    expect(range.recorded).toBe(30);

    // 29 days of record: the day before it is the 30th.
    const young = chartWindow(rows(Date.UTC(2026, 8, 2), 29), now);
    expect(young.days).toHaveLength(30);
    expect(young.days[0]).toMatchObject({ day: "2026-09-01", recorded: false });
  });

  test("a missing day inside the record is drawn as 0, not skipped", () => {
    const series = rows(Date.UTC(2026, 8, 27), 4).filter((row) => row.day !== "2026-09-28");
    const range = chartWindow(series, now);
    expect(range.days).toHaveLength(5);
    expect(range.days[2]).toMatchObject({ day: "2026-09-28", views: 0, leads: 0, recorded: false });
  });

  test("no record at all is an empty 30 days ending yesterday", () => {
    const range = chartWindow([], now);
    expect(range.days).toHaveLength(30);
    expect(range.days[29]?.day).toBe("2026-10-01");
    expect(range.recorded).toBe(0);
  });

  test("axis labels: first and last always, evenly spaced, never repeated", () => {
    expect(dayTicks(30, 5)).toEqual([0, 7, 14, 21, 29]);
    expect(dayTicks(30, 3)).toEqual([0, 14, 29]);
    expect(dayTicks(5, 5)).toEqual([0, 1, 2, 3, 4]);
    expect(dayTicks(5, 3)).toEqual([0, 2, 4]);
    expect(dayTicks(6, 3)).toEqual([0, 2, 5]);
    expect(dayTicks(22, 5)).toEqual([0, 5, 10, 15, 21]);
    expect(dayTicks(1, 5)).toEqual([0]);
    expect(dayTicks(0, 5)).toEqual([]);
    for (let count = 1; count <= 30; count += 1) {
      for (const slots of [3, 5]) {
        const ticks = dayTicks(count, slots);
        expect(ticks[0]).toBe(0);
        expect(ticks[ticks.length - 1]).toBe(count - 1);
        expect(new Set(ticks).size).toBe(ticks.length);
        expect([...ticks].sort((a, b) => a - b)).toEqual(ticks);
      }
    }
  });
});

describe("recent activity wording", () => {
  test("old 360° tour rows name the source in Serbian", () => {
    expect(activitySummary("tour.360.set", "ME-1048: none (skriveno)")).toBe("ME-1048: bez ture (skriveno)");
    expect(activitySummary("tour.360.set", "ME-1048: self (objavljeno)")).toBe(
      "ME-1048: sopstvene panorame (objavljeno)",
    );
    expect(activitySummary("tour.360.set", "ME-1048: matterport (objavljeno)")).toBe("ME-1048: Matterport (objavljeno)");
    expect(activitySummary("tour.360.set", "ME-1048: kuula (skriveno)")).toBe("ME-1048: Kuula (skriveno)");
    // What the server writes now passes through unchanged.
    expect(activitySummary("tour.360.set", "ME-1048: Matterport (objavljeno)")).toBe("ME-1048: Matterport (objavljeno)");
  });

  test("a page-copy refresh names the pages, not their keys, and does not restate its label", () => {
    expect(activitySummary("page.seedRefreshed", "Osvežen početni sadržaj: about")).toBe("O nama");
    expect(activitySummary("page.seedRefreshed", "Osvežen početni sadržaj: home, privacy")).toBe(
      "Početna, Politika privatnosti",
    );
  });

  test("a summary that restates the label keeps only the record", () => {
    expect(activitySummary("viewing.requested", "Zahtev za razgledanje ME-1042")).toBe("ME-1042");
  });

  test("what the public site wrote is credited to the site, without saying so twice", () => {
    const site = { byId: undefined, byName: "sistem" };
    expect(activityActor({ action: "lead.created", ...site })).toBe("Sajt");
    expect(activityActor({ action: "viewing.requested", ...site })).toBe("Sajt");
    expect(activityActor({ action: "listing.mandateExpired", ...site })).toBe("Sistem");

    expect(feedSummary({ action: "lead.created", summary: "Sa sajta: upit o nekretnini", ...site })).toBe(
      "upit o nekretnini",
    );
    // Rows logged before the current wording read the same.
    expect(feedSummary({ action: "lead.created", summary: "Novi upit (valuation) sa sajta", ...site })).toBe(
      "zahtev za procenu",
    );
    // All it said was the label: nothing is left to repeat.
    expect(
      feedSummary({ action: "lead.onsiteRequested", summary: "Sa sajta: zatražena procena na terenu", ...site }),
    ).toBeUndefined();
    // The activity log screen keeps "sistem" as the author, so it keeps "Sa sajta".
    expect(activitySummary("lead.created", "Sa sajta: upit o nekretnini")).toBe("Sa sajta: upit o nekretnini");
  });

  test("staff rows keep the staff member's name", () => {
    const row = { action: "lead.created", byId: "user-1" as Id<"users">, byName: "Mihajlo (admin)" };
    expect(activityActor(row)).toBe("Mihajlo (admin)");
    expect(feedSummary({ ...row, summary: "Sa sajta: upit o nekretnini" })).toBe("Sa sajta: upit o nekretnini");
  });
});

describe("Serbian plurals", () => {
  test("1 / 2–4 / 5+ forms, teens included", () => {
    const waiting = (count: number) => `${count} ${pluralSr(count, "čeka", "čeka", "čekaju")}`;
    expect([1, 2, 4, 5, 11, 12, 14, 21, 22, 25].map(waiting)).toEqual([
      "1 čeka",
      "2 čekaju",
      "4 čekaju",
      "5 čeka",
      "11 čeka",
      "12 čeka",
      "14 čeka",
      "21 čeka",
      "22 čekaju",
      "25 čeka",
    ]);
    // Two forms only: 2–4 take the plural.
    expect(pluralSr(3, "upit", "upita")).toBe("upita");
  });
});
