/// <reference types="vite/client" />
import { afterEach, describe, expect, test, vi } from "vitest";
import { api } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { testApp } from "../../tests/unit/convex-harness";
import { makeAgent, makeUser } from "./fixtures";

const PAGE = { cursor: null, numItems: 20 };
const HOUR = 3_600_000;

const BODY =
  "<h2>Pre kupovine</h2><p>Proverite list nepokretnosti, teret i vlasništvo pre nego što date kaparu. " +
  "Zatražite kopiju ugovora unapred i pročitajte ga sa advokatom, a iznos poreza na prenos proverite " +
  "u lokalnoj poreskoj upravi.</p>";

type Tester = ReturnType<typeof testApp>;

async function setup() {
  const t = testApp();
  const ids = await t.run(async (ctx) => {
    const agent = await makeAgent(ctx, "milica");
    const editor = await makeUser(ctx, "editor");
    const manager = await makeUser(ctx, "manager");
    const agentUser = await makeUser(ctx, "agent", agent);
    return { agent, editor, manager, agentUser };
  });
  return { t, ids };
}

/** A saved post that passes the publish checklist. */
async function readyPost(t: Tester, userId: Id<"users">, title = "Kako kupiti stan u Beogradu") {
  const as = t.withIdentity({ subject: userId });
  const id = await as.mutation(api.postsAdmin.create, {});
  const saved = await as.mutation(api.postsAdmin.upsert, {
    id,
    title: { sr: title },
    excerpt: { sr: "Praktičan vodič kroz dokumenta, poreze i korake do uknjižbe." },
    body: { sr: BODY },
    category: "guide",
    tags: ["Kupovina", " kupovina ", "Porezi"],
    featured: false,
  });
  return { id, slug: saved.slug };
}

async function publicTitles(t: Tester): Promise<string[]> {
  const result = await t.query(api.posts.list, { paginationOpts: PAGE });
  return result.page.map((post) => post.title.sr);
}

async function actions(t: Tester, id: Id<"posts">): Promise<string[]> {
  return await t.run(async (ctx) => {
    const rows = await ctx.db.query("activity").take(200);
    return rows.filter((row) => row.entityId === id).map((row) => row.action);
  });
}

afterEach(() => {
  vi.useRealTimers();
});

describe("journal posts in the admin", () => {
  test("an editor creates, saves and publishes a post that the public list then shows", async () => {
    const { t, ids } = await setup();
    const asEditor = t.withIdentity({ subject: ids.editor });
    const { id, slug } = await readyPost(t, ids.editor);

    expect(slug).toBe("kako-kupiti-stan-u-beogradu");
    const draft = await asEditor.query(api.postsAdmin.get, { id });
    expect(draft?.post.status).toBe("draft");
    expect(draft?.post.tags).toEqual(["Kupovina", "Porezi"]);
    expect(draft?.post.readingMinutes).toBe(1);
    expect(draft?.checklist.filter((item) => item.warning !== true).every((item) => item.ok)).toBe(true);
    expect(await publicTitles(t)).toEqual([]);

    const { publishedAt } = await asEditor.mutation(api.postsAdmin.publish, { id });
    expect(publishedAt).toBeGreaterThan(0);
    expect(await publicTitles(t)).toEqual(["Kako kupiti stan u Beogradu"]);
    const detail = await t.query(api.posts.bySlug, { slug });
    expect(detail?.body.sr).toBe(BODY);

    const rows = await asEditor.query(api.postsAdmin.list, { status: "published", paginationOpts: PAGE });
    expect(rows.page.map((row) => row._id)).toEqual([id]);
    expect(rows.page[0]?.filledLocales).toEqual(["sr"]);

    await asEditor.mutation(api.postsAdmin.unpublish, { id });
    expect(await publicTitles(t)).toEqual([]);
    expect(await t.query(api.posts.bySlug, { slug })).toBeNull();
  });

  test("publishing is refused with reasons while the Serbian text is incomplete", async () => {
    const { t, ids } = await setup();
    const asEditor = t.withIdentity({ subject: ids.editor });
    const id = await asEditor.mutation(api.postsAdmin.create, {});
    await asEditor.mutation(api.postsAdmin.upsert, {
      id,
      title: { sr: "Kratak nacrt" },
      excerpt: { sr: "" },
      body: { sr: "<p>Samo početak.</p>" },
      category: "market",
      tags: [],
      featured: false,
    });
    await expect(asEditor.mutation(api.postsAdmin.publish, { id })).rejects.toThrow(/PUBLISH_BLOCKED|spreman/);
    const detail = await asEditor.query(api.postsAdmin.get, { id });
    const failing = detail?.checklist.filter((item) => !item.ok && item.warning !== true).map((item) => item.code);
    expect(failing).toEqual(["excerpt", "body"]);
  });

  test("an agent can neither read nor write the journal, and only managers delete", async () => {
    const { t, ids } = await setup();
    const { id } = await readyPost(t, ids.editor);
    const asAgent = t.withIdentity({ subject: ids.agentUser });
    const asEditor = t.withIdentity({ subject: ids.editor });
    const asManager = t.withIdentity({ subject: ids.manager });

    await expect(asAgent.query(api.postsAdmin.list, { paginationOpts: PAGE })).rejects.toThrow(/FORBIDDEN|dozvolu/);
    await expect(asAgent.query(api.postsAdmin.get, { id })).rejects.toThrow(/FORBIDDEN|dozvolu/);
    await expect(asAgent.mutation(api.postsAdmin.create, {})).rejects.toThrow(/FORBIDDEN|dozvolu/);
    await expect(asAgent.mutation(api.postsAdmin.publish, { id })).rejects.toThrow(/FORBIDDEN|dozvolu/);
    await expect(t.mutation(api.postsAdmin.publish, { id })).rejects.toThrow(/UNAUTHENTICATED|prijavljeni/);

    await expect(asEditor.mutation(api.postsAdmin.remove, { id })).rejects.toThrow(/FORBIDDEN|dozvolu/);
    await asManager.mutation(api.postsAdmin.remove, { id });
    expect(await asManager.query(api.postsAdmin.get, { id })).toBeNull();
    expect(await actions(t, id)).toContain("post.deleted");
  });

  test("publishing and saving are logged with a field-level diff", async () => {
    const { t, ids } = await setup();
    const asEditor = t.withIdentity({ subject: ids.editor });
    const { id } = await readyPost(t, ids.editor);
    await asEditor.mutation(api.postsAdmin.publish, { id });
    await asEditor.mutation(api.postsAdmin.upsert, {
      id,
      title: { sr: "Kako kupiti stan u Beogradu", en: "How to buy a flat in Belgrade" },
      excerpt: { sr: "Praktičan vodič kroz dokumenta, poreze i korake do uknjižbe." },
      body: { sr: BODY, en: "<p>English body.</p>" },
      category: "legal",
      tags: ["Kupovina"],
      featured: true,
    });

    expect(await actions(t, id)).toEqual(["post.created", "post.updated", "post.published", "post.updated"]);
    const last = await t.run(async (ctx) => {
      const rows = await ctx.db.query("activity").order("desc").take(1);
      return rows[0];
    });
    const fields = last?.diff?.map((entry) => entry.field);
    expect(fields).toEqual(expect.arrayContaining(["title", "category", "tags", "featured", "body"]));
    expect(last?.diff?.find((entry) => entry.field === "body")?.to).toBe("Izmenjen tekst: EN");
  });

  test("slugs stay unique: a clashing title gets a numeric suffix, the post keeps its own", async () => {
    const { t, ids } = await setup();
    const asEditor = t.withIdentity({ subject: ids.editor });
    const first = await readyPost(t, ids.editor, "Tržište stanova u 2026.");
    const second = await readyPost(t, ids.editor, "Tržište stanova u 2026.");
    expect(first.slug).toBe("trziste-stanova-u-2026");
    expect(second.slug).toBe("trziste-stanova-u-2026-2");

    const explicit = await asEditor.mutation(api.postsAdmin.upsert, {
      id: second.id,
      slug: "Tržište Stanova u 2026",
      title: { sr: "Tržište stanova u 2026." },
      excerpt: { sr: "Kratak pregled cena i prodaje." },
      body: { sr: BODY },
      category: "market",
      tags: [],
      featured: false,
    });
    expect(explicit.slug).toBe("trziste-stanova-u-2026-2");

    const resaved = await asEditor.mutation(api.postsAdmin.upsert, {
      id: first.id,
      title: { sr: "Tržište stanova u 2026." },
      excerpt: { sr: "Kratak pregled cena i prodaje." },
      body: { sr: BODY },
      category: "market",
      tags: [],
      featured: false,
    });
    expect(resaved.slug).toBe("trziste-stanova-u-2026");
  });

  test("body images are validated and freed with the post", async () => {
    const { t, ids } = await setup();
    const asEditor = t.withIdentity({ subject: ids.editor });
    const asManager = t.withIdentity({ subject: ids.manager });
    const { id } = await readyPost(t, ids.editor);
    const blob = await t.run(async (ctx) =>
      ctx.storage.store(new Blob([new Uint8Array([255, 216, 255, 224])], { type: "image/jpeg" })),
    );

    // convex-test records no content type, so the image check refuses the
    // blob — which is the gate this test wants to see closed.
    await expect(asEditor.mutation(api.postsAdmin.attachImage, { id, storageId: blob })).rejects.toThrow(/formati/);
    await expect(
      t.withIdentity({ subject: ids.agentUser }).mutation(api.postsAdmin.attachImage, { id, storageId: blob }),
    ).rejects.toThrow(/FORBIDDEN|dozvolu/);

    await t.run(async (ctx) => ctx.db.patch("posts", id, { inlineImages: [blob] }));
    await asManager.mutation(api.postsAdmin.remove, { id });
    expect(await t.run(async (ctx) => ctx.storage.getUrl(blob))).toBeNull();
  });

  test("the title search folds diacritics and the scheduled filter splits drafts", async () => {
    vi.useFakeTimers();
    const { t, ids } = await setup();
    const asEditor = t.withIdentity({ subject: ids.editor });
    const { id: kupovina } = await readyPost(t, ids.editor, "Kupovina na Vračaru");
    const { id: zakazan } = await readyPost(t, ids.editor, "Zakazani tekst o tržištu");
    await asEditor.mutation(api.postsAdmin.schedule, { id: zakazan, at: Date.now() + 5 * HOUR });

    const found = await asEditor.query(api.postsAdmin.list, { q: "vracar", paginationOpts: PAGE });
    expect(found.page.map((row) => row._id)).toEqual([kupovina]);
    const scheduled = await asEditor.query(api.postsAdmin.list, { status: "scheduled", paginationOpts: PAGE });
    expect(scheduled.page.map((row) => row._id)).toEqual([zakazan]);
    const drafts = await asEditor.query(api.postsAdmin.list, { status: "draft", paginationOpts: PAGE });
    expect(drafts.page.map((row) => row._id)).toEqual([kupovina]);
  });
});

describe("scheduled publishing", () => {
  test("a scheduled post stays off the public list until the scheduler publishes it", async () => {
    vi.useFakeTimers();
    const { t, ids } = await setup();
    const asEditor = t.withIdentity({ subject: ids.editor });
    const { id } = await readyPost(t, ids.editor);
    const at = Date.now() + 3 * HOUR;

    await expect(
      asEditor.mutation(api.postsAdmin.schedule, { id, at: Date.now() + 30_000 }),
    ).rejects.toThrow(/dva minuta/);
    await asEditor.mutation(api.postsAdmin.schedule, { id, at });

    const pending = await asEditor.query(api.postsAdmin.get, { id });
    expect(pending?.post.status).toBe("draft");
    expect(pending?.post.scheduledAt).toBe(at);
    expect(await publicTitles(t)).toEqual([]);

    await t.finishAllScheduledFunctions(vi.runAllTimers);

    const done = await asEditor.query(api.postsAdmin.get, { id });
    expect(done?.post.status).toBe("published");
    expect(done?.post.publishedAt).toBe(at);
    expect(done?.post.scheduledAt).toBeUndefined();
    expect(await publicTitles(t)).toEqual(["Kako kupiti stan u Beogradu"]);
    expect(await actions(t, id)).toEqual(["post.created", "post.updated", "post.scheduled", "post.published"]);
  });

  test("rescheduling replaces the pending run and unpublishing cancels it", async () => {
    vi.useFakeTimers();
    const { t, ids } = await setup();
    const asEditor = t.withIdentity({ subject: ids.editor });
    const { id } = await readyPost(t, ids.editor);

    await asEditor.mutation(api.postsAdmin.schedule, { id, at: Date.now() + HOUR });
    const later = Date.now() + 2 * HOUR;
    await asEditor.mutation(api.postsAdmin.schedule, { id, at: later });
    const jobs = await t.run(async (ctx) => {
      const rows = await ctx.db.system.query("_scheduled_functions").take(10);
      return rows.map((row) => row.state.kind);
    });
    expect(jobs.filter((kind) => kind === "pending")).toHaveLength(1);

    await asEditor.mutation(api.postsAdmin.unpublish, { id });
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    const after = await asEditor.query(api.postsAdmin.get, { id });
    expect(after?.post.status).toBe("draft");
    expect(after?.post.scheduledAt).toBeUndefined();
    expect(await publicTitles(t)).toEqual([]);
  });

  test("a scheduled post edited below the checklist is not published and the reason is logged", async () => {
    vi.useFakeTimers();
    const { t, ids } = await setup();
    const asEditor = t.withIdentity({ subject: ids.editor });
    const { id } = await readyPost(t, ids.editor);
    await asEditor.mutation(api.postsAdmin.schedule, { id, at: Date.now() + HOUR });
    await asEditor.mutation(api.postsAdmin.upsert, {
      id,
      title: { sr: "Kako kupiti stan u Beogradu" },
      excerpt: { sr: "Praktičan vodič kroz dokumenta, poreze i korake do uknjižbe." },
      body: { sr: "<p>Skraćeno.</p>" },
      category: "guide",
      tags: [],
      featured: false,
    });

    await t.finishAllScheduledFunctions(vi.runAllTimers);
    const after = await asEditor.query(api.postsAdmin.get, { id });
    expect(after?.post.status).toBe("draft");
    expect(after?.post.scheduledAt).toBeUndefined();
    expect(await actions(t, id)).toContain("post.schedule_failed");
    expect(await publicTitles(t)).toEqual([]);
  });
});

describe("stored HTML and saves", () => {
  const base = {
    title: { sr: "Kako kupiti stan u Beogradu" },
    excerpt: { sr: "Praktičan vodič kroz dokumenta, poreze i korake do uknjižbe." },
    category: "guide" as const,
    tags: [],
    featured: false,
  };

  test("a body outside the editor's allowlist is refused, per language", async () => {
    const { t, ids } = await setup();
    const asEditor = t.withIdentity({ subject: ids.editor });
    const { id } = await readyPost(t, ids.editor);
    const save = (en: string) => asEditor.mutation(api.postsAdmin.upsert, { id, ...base, body: { sr: BODY, en } });

    await expect(save("<p>x</p><script>alert(1)</script>")).rejects.toThrow(/Tekst \(EN\).*<script>/);
    await expect(save('<p onclick="alert(1)">x</p>')).rejects.toThrow(/onclick/);
    await expect(save('<p style="color:red">x</p>')).rejects.toThrow(/style/);
    await expect(save('<p><a href="javascript:alert(1)">x</a></p>')).rejects.toThrow(/href/);
    await expect(save('<p><a href="/&#47;evil.example">x</a></p>')).rejects.toThrow(/href/);
    await expect(save('<img src="https://evil.example/a.png" alt="">')).rejects.toThrow(/src/);
    await expect(save('<img src="data:image/png;base64,iVBOR" alt="">')).rejects.toThrow(/src/);
    await save('<p>Ok <a href="https://rgz.gov.rs" target="_blank" rel="noopener noreferrer">RGZ</a></p>');
  });

  test("a body image must be this post's upload; dropping it from the text frees the blob", async () => {
    const { t, ids } = await setup();
    const asEditor = t.withIdentity({ subject: ids.editor });
    const { id } = await readyPost(t, ids.editor);
    const { id: other } = await readyPost(t, ids.editor, "Drugi tekst o kraju");
    const { blob, url } = await t.run(async (ctx) => {
      const stored = await ctx.storage.store(new Blob([new Uint8Array([255, 216, 255, 224])], { type: "image/jpeg" }));
      // convex-test records no content type, so the upload is linked directly
      // (attachImage would rightly refuse it).
      await ctx.db.patch("posts", id, { inlineImages: [stored] });
      return { blob: stored, url: (await ctx.storage.getUrl(stored)) ?? "" };
    });
    const withImage = `${BODY}<img src="${url}" alt="Dnevna soba" width="1200" height="800">`;

    await asEditor.mutation(api.postsAdmin.upsert, { id, ...base, body: { sr: withImage } });
    expect((await asEditor.query(api.postsAdmin.get, { id }))?.post.inlineImages).toEqual([blob]);
    await expect(
      asEditor.mutation(api.postsAdmin.upsert, { id: other, ...base, body: { sr: withImage } }),
    ).rejects.toThrow(/src/);

    await asEditor.mutation(api.postsAdmin.upsert, { id, ...base, body: { sr: BODY } });
    expect((await asEditor.query(api.postsAdmin.get, { id }))?.post.inlineImages).toEqual([]);
    expect(await t.run(async (ctx) => ctx.storage.getUrl(blob))).toBeNull();
  });

  test("a save that changes nothing writes and logs nothing", async () => {
    const { t, ids } = await setup();
    const asEditor = t.withIdentity({ subject: ids.editor });
    const { id } = await readyPost(t, ids.editor);
    const before = await asEditor.query(api.postsAdmin.get, { id });
    const logged = (await actions(t, id)).length;

    const result = await asEditor.mutation(api.postsAdmin.upsert, {
      id,
      ...base,
      title: { sr: "  Kako kupiti stan u Beogradu" },
      body: { sr: BODY },
      tags: ["Kupovina", "Porezi", "kupovina"],
    });
    expect(result.changed).toBe(false);
    const after = await asEditor.query(api.postsAdmin.get, { id });
    expect(after?.post.updatedAt).toBe(before?.post.updatedAt);
    expect((await actions(t, id)).length).toBe(logged);
  });
});

describe("publication dates and the public API", () => {
  test("a post republished by the scheduler keeps its first publication date", async () => {
    vi.useFakeTimers();
    const { t, ids } = await setup();
    const asEditor = t.withIdentity({ subject: ids.editor });
    const { id } = await readyPost(t, ids.editor);
    const { publishedAt } = await asEditor.mutation(api.postsAdmin.publish, { id });
    await asEditor.mutation(api.postsAdmin.unpublish, { id });
    await asEditor.mutation(api.postsAdmin.schedule, { id, at: Date.now() + HOUR });
    await t.finishAllScheduledFunctions(vi.runAllTimers);

    const done = await asEditor.query(api.postsAdmin.get, { id });
    expect(done?.post.status).toBe("published");
    expect(done?.post.publishedAt).toBe(publishedAt);
  });

  test("scheduling an archived post logs its return to draft", async () => {
    vi.useFakeTimers();
    const { t, ids } = await setup();
    const asEditor = t.withIdentity({ subject: ids.editor });
    const { id } = await readyPost(t, ids.editor);
    await asEditor.mutation(api.postsAdmin.archive, { id });
    await asEditor.mutation(api.postsAdmin.schedule, { id, at: Date.now() + HOUR });

    const entry = await t.run(async (ctx) => {
      const rows = await ctx.db.query("activity").order("desc").take(1);
      return rows[0];
    });
    expect(entry?.action).toBe("post.scheduled");
    expect(entry?.diff).toEqual(
      expect.arrayContaining([{ field: "status", from: "archived", to: "draft" }]),
    );
  });

  test("the article exposes a share image URL, never the storage reference", async () => {
    const { t, ids } = await setup();
    const asEditor = t.withIdentity({ subject: ids.editor });
    const { id, slug } = await readyPost(t, ids.editor);
    const blob = await t.run(async (ctx) => {
      const stored = await ctx.storage.store(new Blob([new Uint8Array([255, 216, 255, 224])], { type: "image/jpeg" }));
      await ctx.db.patch("posts", id, {
        seo: { metaTitle: { sr: "Kupovina stana" }, ogImage: { kind: "storage", storageId: stored } },
      });
      return stored;
    });
    await asEditor.mutation(api.postsAdmin.publish, { id });

    const detail = await t.query(api.posts.bySlug, { slug });
    expect(detail?.seo?.metaTitle).toEqual({ sr: "Kupovina stana" });
    expect(detail?.seo?.ogImageUrl).toMatch(/^https?:\/\//);
    expect(JSON.stringify(detail)).not.toContain(blob);
  });

  test("public page sizes are clamped and the related limit is an integer", async () => {
    const { t, ids } = await setup();
    await t.run(async (ctx) => {
      for (let index = 0; index < 26; index += 1) {
        await ctx.db.insert("posts", {
          slug: `tekst-${index}`,
          title: { sr: `Tekst ${index}` },
          excerpt: { sr: "Kratak opis." },
          body: { sr: "<p>Telo.</p>" },
          category: "market",
          tags: [],
          status: "published",
          publishedAt: Date.now() - index * HOUR,
          featured: false,
          isDemo: false,
        });
      }
    });
    expect(ids.editor).toBeDefined();

    const page = await t.query(api.posts.list, { paginationOpts: { cursor: null, numItems: 100 } });
    expect(page.page).toHaveLength(24);
    expect(page.isDone).toBe(false);
    const tiny = await t.query(api.posts.list, { paginationOpts: { cursor: null, numItems: 0 } });
    expect(tiny.page).toHaveLength(1);

    expect(await t.query(api.posts.related, { slug: "tekst-0", limit: 2.7 })).toHaveLength(2);
    expect(await t.query(api.posts.related, { slug: "tekst-0", limit: 50 })).toHaveLength(9);
  });
});
