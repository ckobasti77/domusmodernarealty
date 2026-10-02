/// <reference types="vite/client" />
import { describe, expect, test } from "vitest";
import { api } from "../_generated/api";
import { purgeDemoTable } from "../demo";
import { testApp } from "../../tests/unit/convex-harness";

/**
 * Step 15: "Obriši demo" used to delete the seeded privacy, terms and cookie
 * pages while they were still unsaved drafts, leaving the consent checkboxes and
 * the cookie banner pointing at "Tekst ove stranice trenutno nije dostupan.".
 */
describe("the demo purge keeps the legal pages", () => {
  test("privacy, terms and cookies survive and are not counted; other seeded pages go", async () => {
    const t = testApp();
    const admin = await t.run(async (ctx) => {
      for (const key of ["privacy", "terms", "cookies", "about", "home"] as const) {
        await ctx.db.insert("pages", { key, blocks: [], updatedAt: 0, isDemo: true });
      }
      return ctx.db.insert("users", { email: "admin@agency.test", role: "admin", status: "active" });
    });
    const asAdmin = t.withIdentity({ subject: admin });

    const before = await asAdmin.query(api.demo.counts, {});
    expect(before.rows.find((row) => row.table === "pages")?.count).toBe(2);

    expect(await t.run(async (ctx) => purgeDemoTable(ctx, "pages", 40))).toBe(2);

    const left = await t.run(async (ctx) =>
      (await ctx.db.query("pages").take(10)).map((page) => page.key).sort(),
    );
    expect(left).toEqual(["cookies", "privacy", "terms"]);
    const after = await asAdmin.query(api.demo.counts, {});
    expect(after.rows.find((row) => row.table === "pages")?.count).toBe(0);
  });
});
