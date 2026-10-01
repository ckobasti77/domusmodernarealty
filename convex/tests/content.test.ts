/// <reference types="vite/client" />
import { describe, expect, test } from "vitest";
import { api, internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import type { PageBlock, PageKey } from "../lib/validators";
import { PAGE_CONTENT } from "../seed/content/pages";
import { testApp } from "../../tests/unit/convex-harness";
import { makeAgent, makeUser } from "./fixtures";

/* ------------------------------------------------------------- builders */

/** `updatedAt` of every page `seedPage` writes: the editor's conflict token. */
const SEEDED_AT = 1_000;

function template(key: PageKey): PageBlock[] {
  const page = PAGE_CONTENT.find((item) => item.key === key);
  if (page === undefined) throw new Error(`no template for ${key}`);
  return structuredClone(page.blocks);
}

async function seedPage(
  ctx: MutationCtx,
  key: PageKey,
  isDemo: boolean,
  blocks: PageBlock[] = template(key),
  extra: { updatedBy?: Id<"users">; seo?: { ogImage: { kind: "storage"; storageId: Id<"_storage"> } } } = {},
): Promise<Id<"pages">> {
  return await ctx.db.insert("pages", { key, blocks, updatedAt: SEEDED_AT, isDemo, ...extra });
}

async function makeTestimonial(
  ctx: MutationCtx,
  author: string,
  order: number,
  overrides: { verified?: boolean; isDemo?: boolean } = {},
): Promise<Id<"testimonials">> {
  return await ctx.db.insert("testimonials", {
    quote: { sr: `Citat klijenta ${author}, dovoljno dug za proveru.` },
    author,
    verified: overrides.verified ?? false,
    order,
    isDemo: overrides.isDemo ?? false,
  });
}

/** `t.run` gives the action-style storage writer (`store`), unlike a mutation. */
type RunCtx = Parameters<Parameters<ReturnType<typeof testApp>["run"]>[0]>[0];

async function storeImage(ctx: RunCtx): Promise<Id<"_storage">> {
  return await ctx.storage.store(new Blob([new Uint8Array([137, 80, 78, 71])], { type: "image/png" }));
}

async function setup() {
  const t = testApp();
  const ids = await t.run(async (ctx) => {
    const agentProfile = await makeAgent(ctx, "agent-a");
    return {
      admin: await makeUser(ctx, "admin"),
      manager: await makeUser(ctx, "manager"),
      editor: await makeUser(ctx, "editor"),
      agent: await makeUser(ctx, "agent", agentProfile),
    };
  });
  return {
    t,
    ids,
    asEditor: t.withIdentity({ subject: ids.editor }),
    asManager: t.withIdentity({ subject: ids.manager }),
    asAgent: t.withIdentity({ subject: ids.agent }),
  };
}

function withHeroTitle(blocks: PageBlock[], locale: "sr" | "en", text: string): PageBlock[] {
  return blocks.map((block) =>
    block.type === "richText" && block.key === "hero" && block.title !== undefined
      ? { ...block, title: { ...block.title, [locale]: text } }
      : block,
  );
}

/** The landing's figures with item `index` changed. */
function withStat(blocks: PageBlock[], index: number, patch: { value?: string; isDemo?: boolean }): PageBlock[] {
  return blocks.map((block) =>
    block.type === "stats" && block.key === "numbers"
      ? { ...block, items: block.items.map((item, at) => (at === index ? { ...item, ...patch } : item)) }
      : block,
  );
}

/** A legal page with the Serbian body of section `key` replaced. */
function withBody(blocks: PageBlock[], key: string, sr: string): PageBlock[] {
  return blocks.map((block) =>
    block.type === "richText" && block.key === key ? { ...block, body: { ...block.body, sr } } : block,
  );
}

async function lastActivity(t: ReturnType<typeof testApp>, action: string) {
  const entries = await t.run(async (ctx) => ctx.db.query("activity").order("desc").take(50));
  return entries.find((item) => item.action === action);
}

/* ----------------------------------------------------------------- pages */

describe("site content pages", () => {
  test("an editor saves a page, an agent is refused", async () => {
    const { t, asEditor, asAgent } = await setup();
    await t.run(async (ctx) => seedPage(ctx, "home", true));

    const page = await asEditor.query(api.pagesAdmin.get, { key: "home" });
    expect(page.exists).toBe(true);
    expect(page.layout).toBe("fixed");
    expect(page.fixedItems).toBe(true);

    const blocks = withHeroTitle(page.blocks, "sr", "Novi naslov naslovne strane.");
    await asEditor.mutation(api.pagesAdmin.upsert, {
      key: "home",
      blocks,
      expectedUpdatedAt: page.updatedAt,
    });

    const stored = await t.run(async (ctx) =>
      ctx.db.query("pages").withIndex("by_key", (q) => q.eq("key", "home")).unique(),
    );
    expect(stored?.isDemo).toBe(false);
    const hero = stored?.blocks.find((block) => block.key === "hero");
    expect(hero?.type === "richText" ? hero.title?.sr : null).toBe("Novi naslov naslovne strane.");

    // The public query serves the saved text.
    const pub = await t.query(api.pages.get, { key: "home" });
    const publicHero = pub?.blocks.find((block) => block.key === "hero");
    expect(publicHero?.type === "richText" ? publicHero.title?.sr : null).toBe("Novi naslov naslovne strane.");

    await expect(asAgent.query(api.pagesAdmin.get, { key: "home" })).rejects.toThrow(/FORBIDDEN|dozvolu/);
    await expect(
      asAgent.mutation(api.pagesAdmin.upsert, { key: "home", blocks, expectedUpdatedAt: stored?.updatedAt ?? null }),
    ).rejects.toThrow(/FORBIDDEN|dozvolu/);
  });

  test("the change log names the block, field and locale that changed", async () => {
    const { t, asEditor } = await setup();
    const pageId = await t.run(async (ctx) => seedPage(ctx, "home", true));
    const page = await asEditor.query(api.pagesAdmin.get, { key: "home" });

    await asEditor.mutation(api.pagesAdmin.upsert, {
      key: "home",
      blocks: withHeroTitle(page.blocks, "en", "A home worth keeping."),
      expectedUpdatedAt: SEEDED_AT,
    });

    const entry = await lastActivity(t, "page.updated");
    expect(entry?.entityId).toBe(pageId);
    expect(entry?.summary).toBe("home: hero");
    expect(entry?.diff).toEqual(
      expect.arrayContaining([
        { field: "hero.title.en", from: "A home to remember.", to: "A home worth keeping." },
        { field: "demo", from: "da", to: "ne" },
      ]),
    );
    // Untouched blocks and locales stay out of the log.
    expect(entry?.diff?.some((item) => item.field.startsWith("intro"))).toBe(false);
    expect(entry?.diff?.some((item) => item.field === "hero.title.sr")).toBe(false);
  });

  test("link targets and formatting-only edits are logged too", async () => {
    const { t, asEditor } = await setup();
    const base: PageBlock[] = [
      { type: "richText", key: "rules", title: { sr: "Pravila" }, body: { sr: '<p>Pišite na <a href="/sr/kontakt">kontakt</a>.</p>' } },
    ];
    await t.run(async (ctx) => seedPage(ctx, "privacy", false, base));

    const linked = await asEditor.mutation(api.pagesAdmin.upsert, {
      key: "privacy",
      blocks: withBody(base, "rules", '<p>Pišite na <a href="mailto:office@example.rs">kontakt</a>.</p>'),
      expectedUpdatedAt: SEEDED_AT,
    });
    const linkEntry = await lastActivity(t, "page.updated");
    expect(linkEntry?.diff).toEqual([
      { field: "rules.body.sr.links", from: "/sr/kontakt", to: "mailto:office@example.rs" },
    ]);

    await asEditor.mutation(api.pagesAdmin.upsert, {
      key: "privacy",
      blocks: withBody(base, "rules", '<p>Pišite na <a href="mailto:office@example.rs"><strong>kontakt</strong></a>.</p>'),
      expectedUpdatedAt: linked.updatedAt,
    });
    const formatEntry = await lastActivity(t, "page.updated");
    expect(formatEntry?.diff).toEqual([{ field: "rules.body.sr", to: "html izmenjen" }]);
    expect(formatEntry?.summary).toBe("privacy: rules");
  });

  test("a missing page is edited from its template and created on save", async () => {
    const { t, asEditor } = await setup();
    const page = await asEditor.query(api.pagesAdmin.get, { key: "contact" });
    expect(page.exists).toBe(false);
    expect(page.updatedAt).toBeNull();
    expect(page.blocks.map((block) => block.key)).toEqual(template("contact").map((block) => block.key));

    await asEditor.mutation(api.pagesAdmin.upsert, {
      key: "contact",
      blocks: page.blocks,
      expectedUpdatedAt: null,
    });
    const stored = await t.run(async (ctx) =>
      ctx.db.query("pages").withIndex("by_key", (q) => q.eq("key", "contact")).unique(),
    );
    expect(stored?.isDemo).toBe(false);
    expect(stored?.updatedBy).toBeDefined();
  });

  test("a stored block missing a template field is offered with the template text", async () => {
    const { t, asEditor } = await setup();
    const blocks = template("home").map((block) => {
      if (block.type !== "cta" || block.key !== "valuationCta") return block;
      const { note: _note, ...rest } = block;
      return rest;
    });
    await t.run(async (ctx) => seedPage(ctx, "home", false, blocks));
    const page = await asEditor.query(api.pagesAdmin.get, { key: "home" });
    const cta = page.blocks.find((block) => block.key === "valuationCta");
    expect(cta?.type === "cta" ? cta.note?.sr : null).toMatch(/Agent izlazi na teren/);
    await asEditor.mutation(api.pagesAdmin.upsert, { key: "home", blocks: page.blocks, expectedUpdatedAt: SEEDED_AT });
  });

  test("fixed pages keep their structure; the landing keeps its item counts", async () => {
    const { t, asEditor } = await setup();
    await t.run(async (ctx) => seedPage(ctx, "home", true));
    const blocks = template("home");
    const save = (next: PageBlock[]) =>
      asEditor.mutation(api.pagesAdmin.upsert, { key: "home", blocks: next, expectedUpdatedAt: SEEDED_AT });

    await expect(save([...blocks, { type: "richText", key: "extra", body: { sr: "<p>Tekst</p>" } }])).rejects.toThrow(
      /fiksan/,
    );
    await expect(
      save(
        blocks.map((block) =>
          block.type === "steps" && block.key === "services" ? { ...block, items: block.items.slice(0, 5) } : block,
        ),
      ),
    ).rejects.toThrow(/fiksan/);
    await expect(save(withHeroTitle(blocks, "sr", "   "))).rejects.toThrow(/obavezan/);
    await expect(
      save(blocks.map((block) => (block.type === "cta" ? { ...block, href: "https://example.com" } : block))),
    ).rejects.toThrow(/odredište/);
  });

  test("legal pages take added sections but only allowlisted HTML", async () => {
    const { t, asEditor } = await setup();
    await t.run(async (ctx) => seedPage(ctx, "privacy", true));
    const page = await asEditor.query(api.pagesAdmin.get, { key: "privacy" });
    expect(page.layout).toBe("sections");

    const added: PageBlock[] = [
      ...page.blocks,
      {
        type: "richText",
        key: "section-new",
        title: { sr: "Kolačići trećih strana" },
        body: { sr: "<p>Tekst <strong>sekcije</strong>.</p>" },
      },
    ];
    const first = await asEditor.mutation(api.pagesAdmin.upsert, {
      key: "privacy",
      blocks: added,
      expectedUpdatedAt: SEEDED_AT,
    });

    // A legal section's title is optional, even where the first draft had one.
    const untitled = added.map((block, index) =>
      index === 1 && block.type === "richText" ? { type: "richText" as const, key: block.key, body: block.body } : block,
    );
    const second = await asEditor.mutation(api.pagesAdmin.upsert, {
      key: "privacy",
      blocks: untitled,
      expectedUpdatedAt: first.updatedAt,
    });

    const save = (blocks: PageBlock[]) =>
      asEditor.mutation(api.pagesAdmin.upsert, { key: "privacy", blocks, expectedUpdatedAt: second.updatedAt });
    await expect(
      save([...page.blocks, { type: "richText", key: "section-bad", body: { sr: "<p>Tekst</p><script>alert(1)</script>" } }]),
    ).rejects.toThrow(/script/);
    await expect(
      save([...page.blocks, { type: "richText", key: "section-bad", body: { sr: '<p><a href="javascript:alert(1)">x</a></p>' } }]),
    ).rejects.toThrow(/href/);
    await expect(
      save([...page.blocks, { type: "faq", key: "faq", items: [{ q: { sr: "Pitanje?" }, a: { sr: "Odgovor." } }] }]),
    ).rejects.toThrow(/tekstualnih/);
  });

  test("a save based on a stale version is refused", async () => {
    const { t, asEditor } = await setup();
    await t.run(async (ctx) => seedPage(ctx, "about", true));
    const page = await asEditor.query(api.pagesAdmin.get, { key: "about" });
    await asEditor.mutation(api.pagesAdmin.upsert, {
      key: "about",
      blocks: page.blocks,
      expectedUpdatedAt: page.updatedAt,
    });
    await expect(
      asEditor.mutation(api.pagesAdmin.upsert, {
        key: "about",
        blocks: page.blocks,
        expectedUpdatedAt: page.updatedAt,
      }),
    ).rejects.toThrow(/CONFLICT|neko drugi/);
    // A page that already exists cannot be "created" again either.
    await expect(
      asEditor.mutation(api.pagesAdmin.upsert, { key: "about", blocks: page.blocks, expectedUpdatedAt: null }),
    ).rejects.toThrow(/CONFLICT|neko drugi/);
  });

  test("an oversized page is refused with a readable message", async () => {
    const { t, asEditor } = await setup();
    await t.run(async (ctx) => seedPage(ctx, "terms", false, []));
    // 40 sections of ~25 KB each: every field is within its own limit, the page is not.
    const huge: PageBlock[] = Array.from({ length: 40 }, (_unused, index) => ({
      type: "richText",
      key: `section-${index}`,
      body: { sr: `<p>${"Član ugovora o posredovanju. ".repeat(850)}</p>` },
    }));
    await expect(
      asEditor.mutation(api.pagesAdmin.upsert, { key: "terms", blocks: huge, expectedUpdatedAt: SEEDED_AT }),
    ).rejects.toThrow(/prevelika/);
  });
});

/* ------------------------------------------------------------ demo figures */

describe("demo figures on the landing", () => {
  test("an editor may not take the demo flag off a figure", async () => {
    const { t, asEditor } = await setup();
    await t.run(async (ctx) => seedPage(ctx, "home", true));
    await expect(
      asEditor.mutation(api.pagesAdmin.upsert, {
        key: "home",
        blocks: withStat(template("home"), 0, { value: "7", isDemo: false }),
        expectedUpdatedAt: SEEDED_AT,
      }),
    ).rejects.toThrow(/FORBIDDEN|dozvolu/);
  });

  test("a manager may not clear the flag while the demo value is still there", async () => {
    const { t, asManager } = await setup();
    await t.run(async (ctx) => seedPage(ctx, "home", true));
    await expect(
      asManager.mutation(api.pagesAdmin.upsert, {
        key: "home",
        blocks: withStat(template("home"), 0, { isDemo: false }),
        expectedUpdatedAt: SEEDED_AT,
      }),
    ).rejects.toThrow(/stvarnu vrednost/);
  });

  test("a manager clears the flag with a real value; editors may then save around it", async () => {
    const { t, asManager, asEditor } = await setup();
    await t.run(async (ctx) => seedPage(ctx, "home", true));
    const result = await asManager.mutation(api.pagesAdmin.upsert, {
      key: "home",
      blocks: withStat(template("home"), 0, { value: "7", isDemo: false }),
      expectedUpdatedAt: SEEDED_AT,
    });
    const page = await asEditor.query(api.pagesAdmin.get, { key: "home" });
    const numbers = page.blocks.find((block) => block.key === "numbers");
    expect(numbers?.type === "stats" ? numbers.items[0] : null).toMatchObject({ value: "7", isDemo: false });

    // The figure is already real: an editor's unrelated save goes through.
    await asEditor.mutation(api.pagesAdmin.upsert, {
      key: "home",
      blocks: withHeroTitle(page.blocks, "en", "A home worth keeping."),
      expectedUpdatedAt: result.updatedAt,
    });
  });
});

/* ------------------------------------------------------ public page media */

describe("uploaded images on pages", () => {
  test("the public query hands out the share image as a URL", async () => {
    const { t } = await setup();
    await t.run(async (ctx) => {
      const storageId = await storeImage(ctx);
      await seedPage(ctx, "about", false, template("about"), { seo: { ogImage: { kind: "storage", storageId } } });
    });
    const page = await t.query(api.pages.get, { key: "about" });
    expect(page?.seo?.ogImage?.kind).toBe("url");
  });

  test("a replaced upload is freed unless another page still uses it", async () => {
    const { t, asEditor } = await setup();
    const { shared, own } = await t.run(async (ctx) => {
      const sharedId = await storeImage(ctx);
      const ownId = await storeImage(ctx);
      await seedPage(ctx, "about", false, template("about"), { seo: { ogImage: { kind: "storage", storageId: sharedId } } });
      await seedPage(ctx, "sell", false, template("sell"), { seo: { ogImage: { kind: "storage", storageId: sharedId } } });
      await seedPage(ctx, "contact", false, template("contact"), { seo: { ogImage: { kind: "storage", storageId: ownId } } });
      return { shared: sharedId, own: ownId };
    });

    await asEditor.mutation(api.pagesAdmin.upsert, {
      key: "about",
      blocks: template("about"),
      seo: {},
      expectedUpdatedAt: SEEDED_AT,
    });
    await asEditor.mutation(api.pagesAdmin.upsert, {
      key: "contact",
      blocks: template("contact"),
      seo: {},
      expectedUpdatedAt: SEEDED_AT,
    });

    const [sharedMeta, ownMeta] = await t.run(async (ctx) =>
      Promise.all([ctx.db.system.get("_storage", shared), ctx.db.system.get("_storage", own)]),
    );
    expect(sharedMeta).not.toBeNull();
    expect(ownMeta).toBeNull();
  });
});

/* ------------------------------------------------------------- migration */

describe("refreshSeededPages", () => {
  test("rewrites stale demo pages and never touches edited or current ones", async () => {
    const { t, ids } = await setup();
    const stale: PageBlock[] = [{ type: "richText", key: "hero", body: { sr: "<p>Stari tekst</p>" } }];
    const edited: PageBlock[] = [{ type: "richText", key: "story", body: { sr: "<p>Naš tekst</p>" } }];
    await t.run(async (ctx) => {
      await seedPage(ctx, "home", true, stale);
      await seedPage(ctx, "about", false, edited);
      // Still flagged demo, but an editor saved it: theirs.
      await seedPage(ctx, "sell", true, edited, { updatedBy: ids.editor });
      // Already the current seed: nothing to write.
      await seedPage(ctx, "contact", true);
    });

    const result = await t.mutation(internal.contentMigrations.refreshSeededPages, {});
    expect(result.refreshed).toEqual(["home"]);
    expect(result.unchanged).toEqual(["contact"]);
    expect(result.keptEdited).toEqual(["about", "sell"]);
    expect(result.missing).toContain("privacy");

    const pages = await t.run(async (ctx) => ctx.db.query("pages").take(10));
    const byKey = new Map(pages.map((page) => [page.key, page]));
    expect(byKey.get("home")?.blocks).toEqual(template("home"));
    expect(byKey.get("home")?.isDemo).toBe(true);
    expect(byKey.get("about")?.blocks).toEqual(edited);
    expect(byKey.get("sell")?.blocks).toEqual(edited);
    expect(byKey.get("contact")?.updatedAt).toBe(SEEDED_AT);
  });
});

/* ---------------------------------------------------------- testimonials */

describe("testimonials", () => {
  test("only admin/manager may verify; demo testimonials never", async () => {
    const { t, asEditor, asManager } = await setup();
    const { real, demo } = await t.run(async (ctx) => ({
      real: await makeTestimonial(ctx, "Ana", 0),
      demo: await makeTestimonial(ctx, "Demo", 1, { isDemo: true }),
    }));
    const reviewed = (author: string) => ({
      author,
      quote: { sr: `Citat klijenta ${author}, dovoljno dug za proveru.` },
    });

    await expect(
      asEditor.mutation(api.testimonialsAdmin.setVerified, { id: real, verified: true, reviewed: reviewed("Ana") }),
    ).rejects.toThrow(/FORBIDDEN|dozvolu/);
    await expect(
      asManager.mutation(api.testimonialsAdmin.setVerified, { id: demo, verified: true, reviewed: reviewed("Demo") }),
    ).rejects.toThrow(/Demo/);

    await asManager.mutation(api.testimonialsAdmin.setVerified, { id: real, verified: true, reviewed: reviewed("Ana") });
    const entry = await lastActivity(t, "testimonial.verified");
    expect(entry?.entityId).toBe(real);
  });

  test("confirming a text that changed since it was read is refused", async () => {
    const { t, asManager, asEditor } = await setup();
    const id = await t.run(async (ctx) => makeTestimonial(ctx, "Jelena", 0));
    const read = (await asManager.query(api.testimonialsAdmin.listAll, {}))[0];

    await asEditor.mutation(api.testimonialsAdmin.upsert, {
      id,
      author: read.author,
      quote: { sr: "Drugačiji citat koji menadžer nije pročitao pre potvrde." },
    });
    await expect(
      asManager.mutation(api.testimonialsAdmin.setVerified, {
        id,
        verified: true,
        reviewed: { author: read.author, quote: read.quote },
      }),
    ).rejects.toThrow(/CONFLICT|izmenjena/);
    await expect(asManager.mutation(api.testimonialsAdmin.setVerified, { id, verified: true })).rejects.toThrow(
      /tekst/,
    );
  });

  test("the public query returns verified, non-demo testimonials within a sane limit", async () => {
    const { t } = await setup();
    await t.run(async (ctx) => {
      await makeTestimonial(ctx, "Neprovereno", 0);
      await makeTestimonial(ctx, "Provereno", 1, { verified: true });
      // Verified by hand in the database: still never public.
      await makeTestimonial(ctx, "Demo", 2, { verified: true, isDemo: true });
    });
    const visible = await t.query(api.testimonials.verified, {});
    expect(visible.map((item) => item.author)).toEqual(["Provereno"]);

    for (const limit of [Number.NaN, -3, 0.5, 1e9]) {
      const rows = await t.query(api.testimonials.verified, { limit });
      expect(rows.length).toBe(1);
    }
  });

  test("changing a verified quote takes it off the site; an unchanged save does not", async () => {
    const { t, asEditor } = await setup();
    const id = await t.run(async (ctx) => makeTestimonial(ctx, "Marko", 0, { verified: true }));
    const doc = await t.run(async (ctx) => ctx.db.get("testimonials", id));
    if (doc === null) throw new Error("missing");

    const same = await asEditor.mutation(api.testimonialsAdmin.upsert, {
      id,
      quote: doc.quote,
      author: doc.author,
    });
    expect(same.unverified).toBe(false);

    const changed = await asEditor.mutation(api.testimonialsAdmin.upsert, {
      id,
      quote: { ...doc.quote, en: "A quote that the client never approved in English." },
      author: doc.author,
    });
    expect(changed.unverified).toBe(true);
    expect((await t.query(api.testimonials.verified, {})).length).toBe(0);

    const update = await lastActivity(t, "testimonial.updated");
    expect(update?.diff?.map((item) => item.field)).toEqual(["quote.en"]);
  });

  test("move swaps neighbours and renumbers; delete is manager-only", async () => {
    const { t, asEditor, asManager } = await setup();
    const [a, b, c] = await t.run(async (ctx) => [
      await makeTestimonial(ctx, "A", 0),
      await makeTestimonial(ctx, "B", 0),
      await makeTestimonial(ctx, "C", 5),
    ]);
    await asEditor.mutation(api.testimonialsAdmin.move, { id: c, direction: "up" });
    const order = (await asEditor.query(api.testimonialsAdmin.listAll, {})).map((item) => item._id);
    expect(order).toEqual([a, c, b]);

    await expect(asEditor.mutation(api.testimonialsAdmin.remove, { id: a })).rejects.toThrow(/FORBIDDEN|dozvolu/);
    await asManager.mutation(api.testimonialsAdmin.remove, { id: a });
    expect((await asEditor.query(api.testimonialsAdmin.listAll, {})).length).toBe(2);
  });

  test("the 201st testimonial is refused", async () => {
    const { t, asEditor } = await setup();
    await t.run(async (ctx) => {
      for (let order = 0; order < 200; order += 1) await makeTestimonial(ctx, `Klijent ${order}`, order);
    });
    await expect(
      asEditor.mutation(api.testimonialsAdmin.upsert, {
        author: "Klijent 200",
        quote: { sr: "Još jedna preporuka koja više ne staje na spisak." },
      }),
    ).rejects.toThrow(/najveći broj/);
  });
});
