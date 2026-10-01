import { paginationOptsValidator, paginationResultValidator } from "convex/server";
import { v } from "convex/values";
import type { Infer } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { internalMutation, mutation, query } from "./_generated/server";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import schema from "./schema";
import { diffFields, logActivity } from "./lib/activity";
import { requireRole } from "./lib/auth";
import { imageUrl } from "./lib/dto";
import { appError, invalidInput, notFound } from "./lib/errors";
import { htmlProblem, postHtml } from "./lib/html";
import { foldDiacritics, slugify } from "./lib/slug";
import {
  assertImageRef,
  assertImageUpload,
  deleteBlobIfPresent,
  releaseReplacedImage,
} from "./lib/storage";
import {
  imageV,
  L10N_KEYS,
  l10nV,
  postCategoryV,
  postStatusV,
  seoV,
  type ImageRef,
  type L10n,
  type L10nKey,
} from "./lib/validators";

/**
 * Journal ("Magazin", PRD B9) for the content team. Posts are written per
 * locale in the Tiptap editor; `upsert` refuses any HTML outside the editor's
 * allowlist (`lib/html.ts`) and the site sanitizes it again on render
 * (`lib/content/sanitize.ts`). A draft can be published now or
 * scheduled: `schedule` stores `scheduledAt` and asks the Convex scheduler to
 * run `publishScheduled` at that instant, so no query ever reads the clock.
 */

const CONTENT = ["admin", "manager", "editor"] as const;
const MANAGERS = ["admin", "manager"] as const;

/* ------------------------------------------------------------------ limits */

const TITLE_MIN_SAVE = 3;
const TITLE_MAX = 160;
const EXCERPT_MAX = 400;
/** Per locale. Four bodies at the cap stay well under the 1 MB document limit. */
const BODY_MAX = 150_000;
const TAGS_MAX = 12;
const TAG_MAX = 40;
const META_TITLE_MAX = 70;
const META_DESCRIPTION_MAX = 170;
const INLINE_IMAGES_MAX = 80;
const SLUG_MAX = 80;
const SLUG_ATTEMPTS = 50;

/** What publishing needs on the Serbian (source) version. */
const PUBLISH_TITLE_MIN = 5;
const PUBLISH_EXCERPT_MIN = 30;
const PUBLISH_BODY_MIN = 150;

/** Scheduling window: not in the next two minutes, not beyond a year. */
const SCHEDULE_MIN_LEAD_MS = 2 * 60_000;
const SCHEDULE_MAX_AHEAD_MS = 366 * 86_400_000;

const WORDS_PER_MINUTE = 200;

/* -------------------------------------------------------------- validators */

const l10nKeyV = v.union(v.literal("sr"), v.literal("en"), v.literal("ru"), v.literal("de"));

/** The list's status filter: the stored statuses plus "scheduled" drafts. */
const adminStatusV = v.union(postStatusV, v.literal("scheduled"));

const checkItemV = v.object({
  code: v.string(),
  label: v.string(),
  ok: v.boolean(),
  warning: v.optional(v.boolean()),
});
type CheckItem = Infer<typeof checkItemV>;

const adminRowV = v.object({
  _id: v.id("posts"),
  slug: v.string(),
  title: l10nV,
  category: postCategoryV,
  status: postStatusV,
  publishedAt: v.optional(v.number()),
  scheduledAt: v.optional(v.number()),
  featured: v.boolean(),
  coverUrl: v.optional(v.string()),
  authorName: v.optional(v.string()),
  /** Locales whose title and body are both filled. */
  filledLocales: v.array(l10nKeyV),
  isDemo: v.boolean(),
  updatedAt: v.optional(v.number()),
});

/* ----------------------------------------------------------------- helpers */

const ENTITIES: Record<string, string> = {
  "&nbsp;": " ",
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#39;": "'",
};

/** The readable text of stored HTML, whitespace collapsed. */
function textOf(html: string): string {
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/&(?:nbsp|amp|lt|gt|quot|#39);/g, (entity) => ENTITIES[entity] ?? " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Reading time of the Serbian body at 200 words a minute, at least one. */
function readingMinutes(html: string): number {
  const text = textOf(html);
  const words = text.length === 0 ? 0 : text.split(" ").length;
  return Math.max(1, Math.round(words / WORDS_PER_MINUTE));
}

function filledLocales(doc: Pick<Doc<"posts">, "title" | "body">): L10nKey[] {
  return L10N_KEYS.filter(
    (key) => (doc.title[key] ?? "").trim().length > 0 && textOf(doc.body[key] ?? "").length > 0,
  );
}

/**
 * The publish conditions over a saved post. Items with `warning` never block;
 * the rest must all be `ok` before `publish`, `schedule` or the scheduled run
 * puts the post on the site.
 */
function publishChecklist(doc: Doc<"posts">): CheckItem[] {
  const translated = filledLocales(doc).length === L10N_KEYS.length;
  return [
    {
      code: "title",
      label: `Naslov na srpskom (najmanje ${PUBLISH_TITLE_MIN} znakova)`,
      ok: doc.title.sr.trim().length >= PUBLISH_TITLE_MIN,
    },
    {
      code: "excerpt",
      label: `Kratak opis na srpskom (najmanje ${PUBLISH_EXCERPT_MIN} znakova)`,
      ok: doc.excerpt.sr.trim().length >= PUBLISH_EXCERPT_MIN,
    },
    {
      code: "body",
      label: `Tekst na srpskom (najmanje ${PUBLISH_BODY_MIN} znakova)`,
      ok: textOf(doc.body.sr).length >= PUBLISH_BODY_MIN,
    },
    { code: "slug", label: "Adresa (slug)", ok: /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(doc.slug) },
    { code: "cover", label: "Naslovna slika", ok: doc.cover !== undefined, warning: true },
    { code: "translations", label: "Prevodi na engleski, ruski i nemački", ok: translated, warning: true },
  ];
}

function blockers(doc: Doc<"posts">): string[] {
  return publishChecklist(doc)
    .filter((item) => item.warning !== true && !item.ok)
    .map((item) => item.label);
}

function assertPublishable(doc: Doc<"posts">): void {
  const reasons = blockers(doc);
  if (reasons.length > 0) {
    appError("PUBLISH_BLOCKED", "Tekst još nije spreman za objavu.", { reasons });
  }
}

function titleOf(doc: Pick<Doc<"posts">, "title">): string {
  const title = doc.title.sr.trim();
  return title.length > 0 ? title : "Bez naslova";
}

async function loadPost(ctx: QueryCtx, id: Id<"posts">): Promise<Doc<"posts">> {
  const doc = await ctx.db.get("posts", id);
  if (doc === null) notFound("Tekst");
  return doc;
}

/** `base`, else `base-2`, `base-3`… — the first slug no other post uses. */
async function uniqueSlug(
  ctx: QueryCtx,
  base: string,
  selfId: Id<"posts"> | undefined,
): Promise<string> {
  for (let attempt = 1; attempt <= SLUG_ATTEMPTS; attempt += 1) {
    const suffix = attempt === 1 ? "" : `-${attempt}`;
    const candidate = `${base.slice(0, SLUG_MAX - suffix.length).replace(/-+$/, "")}${suffix}`;
    const clashes = await ctx.db
      .query("posts")
      .withIndex("by_slug", (q) => q.eq("slug", candidate))
      .take(2);
    if (clashes.every((doc) => doc._id === selfId)) return candidate;
  }
  return invalidInput("Ova adresa je zauzeta. Unesite drugu adresu (slug).");
}

/** Storage URL → id of a post's body uploads (blobs already gone are skipped). */
async function inlineImageUrls(
  ctx: QueryCtx,
  storageIds: readonly Id<"_storage">[],
): Promise<Map<string, Id<"_storage">>> {
  const urls = new Map<string, Id<"_storage">>();
  for (const storageId of storageIds) {
    const url = await ctx.storage.getUrl(storageId);
    if (url !== null) urls.set(url, storageId);
  }
  return urls;
}

/** Cancels the pending scheduled publish, if it has not run yet. */
async function cancelSchedule(ctx: MutationCtx, doc: Doc<"posts">): Promise<void> {
  if (doc.scheduledFnId === undefined) return;
  const job = await ctx.db.system.get("_scheduled_functions", doc.scheduledFnId);
  if (job !== null && job.state.kind === "pending") {
    await ctx.scheduler.cancel(doc.scheduledFnId);
  }
}

/** Plain-text fields are stored trimmed; empty translations are dropped. */
function trimL10n(value: L10n): L10n {
  const out: L10n = { sr: value.sr.trim() };
  for (const key of ["en", "ru", "de"] as const) {
    const text = value[key]?.trim() ?? "";
    if (text.length > 0) out[key] = text;
  }
  return out;
}

function checkL10nLength(value: L10n, max: number, what: string): void {
  for (const key of L10N_KEYS) {
    if ((value[key] ?? "").length > max) {
      invalidInput(`${what} je predugačak (najviše ${grouped(max)} znakova).`);
    }
  }
}

function sameImage(a: ImageRef | undefined, b: ImageRef | undefined): boolean {
  return JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
}

type EditableFields = Pick<
  Doc<"posts">,
  "slug" | "title" | "excerpt" | "cover" | "category" | "tags" | "authorAgentId" | "featured" | "seo"
>;

/** The fields compared for the change log (the body is summarized separately). */
function loggedFields(doc: EditableFields): Record<string, unknown> {
  return {
    slug: doc.slug,
    title: doc.title,
    excerpt: doc.excerpt,
    cover: doc.cover,
    category: doc.category,
    tags: doc.tags,
    authorAgentId: doc.authorAgentId,
    featured: doc.featured,
    seo: doc.seo,
  };
}

/** `150000` → `150.000` (Serbian digit grouping, no Intl in the runtime). */
function grouped(value: number): string {
  return String(value).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

const LOCALE_SHORT: Record<L10nKey, string> = { sr: "SR", en: "EN", ru: "RU", de: "DE" };

/* ----------------------------------------------------------------- queries */

export const list = query({
  args: {
    status: v.optional(adminStatusV),
    category: v.optional(postCategoryV),
    q: v.optional(v.string()),
    paginationOpts: paginationOptsValidator,
  },
  returns: paginationResultValidator(adminRowV),
  handler: async (ctx, args) => {
    await requireRole(ctx, CONTENT);
    const paginationOpts = {
      ...args.paginationOpts,
      numItems: Math.min(Math.max(args.paginationOpts.numItems, 1), 100),
    };
    const status = args.status;
    const category = args.category;

    // The narrowest index for the status/category pair; the title search and
    // the scheduled/plain draft split are cheap checks on the page. The client
    // tops up short pages (the journal is small).
    const result =
      status === "scheduled"
        ? await ctx.db
            .query("posts")
            .withIndex("by_scheduledAt", (q) => q.gte("scheduledAt", 0))
            .paginate(paginationOpts)
        : status !== undefined
          ? category !== undefined
            ? await ctx.db
                .query("posts")
                .withIndex("by_status_and_category_and_publishedAt", (q) =>
                  q.eq("status", status).eq("category", category),
                )
                .order("desc")
                .paginate(paginationOpts)
            : await ctx.db
                .query("posts")
                .withIndex("by_status_and_publishedAt", (q) => q.eq("status", status))
                .order("desc")
                .paginate(paginationOpts)
          : category !== undefined
            ? await ctx.db
                .query("posts")
                .withIndex("by_category_and_publishedAt", (q) => q.eq("category", category))
                .order("desc")
                .paginate(paginationOpts)
            : await ctx.db.query("posts").order("desc").paginate(paginationOpts);

    const needle = foldDiacritics(args.q?.trim() ?? "");
    const authors = new Map<Id<"agents">, string | null>();
    const page = [];
    for (const doc of result.page) {
      if (status === "scheduled" && (doc.status !== "draft" || doc.scheduledAt === undefined)) continue;
      if (status === "draft" && doc.scheduledAt !== undefined) continue;
      if (category !== undefined && doc.category !== category) continue;
      if (needle.length > 0) {
        const haystack = foldDiacritics(
          [doc.slug, ...L10N_KEYS.map((key) => doc.title[key] ?? "")].join(" "),
        );
        if (!haystack.includes(needle)) continue;
      }

      let authorName: string | null = null;
      if (doc.authorAgentId !== undefined) {
        const cached = authors.get(doc.authorAgentId);
        if (cached !== undefined) {
          authorName = cached;
        } else {
          authorName = (await ctx.db.get("agents", doc.authorAgentId))?.name ?? null;
          authors.set(doc.authorAgentId, authorName);
        }
      }
      const coverUrl = doc.cover !== undefined ? await imageUrl(ctx, doc.cover) : null;

      page.push({
        _id: doc._id,
        slug: doc.slug,
        title: doc.title,
        category: doc.category,
        status: doc.status,
        ...(doc.publishedAt !== undefined ? { publishedAt: doc.publishedAt } : {}),
        ...(doc.scheduledAt !== undefined ? { scheduledAt: doc.scheduledAt } : {}),
        featured: doc.featured,
        ...(coverUrl !== null ? { coverUrl } : {}),
        ...(authorName !== null ? { authorName } : {}),
        filledLocales: filledLocales(doc),
        isDemo: doc.isDemo,
        ...(doc.updatedAt !== undefined ? { updatedAt: doc.updatedAt } : {}),
      });
    }
    return { ...result, page };
  },
});

/**
 * One post for the editor. Takes the raw route segment and answers `null` for
 * anything that is not a post id, so a mistyped URL shows "not found".
 */
export const get = query({
  args: { id: v.string() },
  returns: v.union(
    v.object({
      post: schema.doc("posts"),
      coverUrl: v.optional(v.string()),
      ogImageUrl: v.optional(v.string()),
      checklist: v.array(checkItemV),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    await requireRole(ctx, CONTENT);
    const id = ctx.db.normalizeId("posts", args.id);
    if (id === null) return null;
    const post = await ctx.db.get("posts", id);
    if (post === null) return null;
    const coverUrl = post.cover !== undefined ? await imageUrl(ctx, post.cover) : null;
    const ogImageUrl = post.seo?.ogImage !== undefined ? await imageUrl(ctx, post.seo.ogImage) : null;
    return {
      post,
      ...(coverUrl !== null ? { coverUrl } : {}),
      ...(ogImageUrl !== null ? { ogImageUrl } : {}),
      checklist: publishChecklist(post),
    };
  },
});

/* --------------------------------------------------------------- mutations */

/** An empty draft for "Novi tekst"; the editor opens on it right away. */
export const create = mutation({
  args: {},
  returns: v.id("posts"),
  handler: async (ctx) => {
    const viewer = await requireRole(ctx, CONTENT);
    const now = Date.now();
    const id = await ctx.db.insert("posts", {
      slug: "",
      title: { sr: "" },
      excerpt: { sr: "" },
      body: { sr: "" },
      category: "guide",
      tags: [],
      ...(viewer.agentId !== undefined ? { authorAgentId: viewer.agentId } : {}),
      status: "draft",
      featured: false,
      isDemo: false,
      updatedAt: now,
    });
    const slug = await uniqueSlug(ctx, slugify(`nacrt-${id.slice(-6)}`), id);
    await ctx.db.patch("posts", id, { slug });
    await logActivity(ctx, {
      entity: "post",
      entityId: id,
      action: "post.created",
      summary: "Novi nacrt",
      by: viewer._id,
    });
    return id;
  },
});

/**
 * Saves a post (creates one when `id` is absent). The slug comes from `slug`,
 * or the Serbian title when it is empty, and is made unique with a numeric
 * suffix; the saved slug is returned so the editor can show it. Bodies must
 * pass the editor's HTML allowlist, images included (Unsplash or this post's
 * own uploads). `changed: false` means the post already held exactly this
 * content: nothing was written or logged.
 */
export const upsert = mutation({
  args: {
    id: v.optional(v.id("posts")),
    slug: v.optional(v.string()),
    title: l10nV,
    excerpt: l10nV,
    body: l10nV,
    cover: v.optional(imageV),
    category: postCategoryV,
    tags: v.array(v.string()),
    authorAgentId: v.optional(v.id("agents")),
    featured: v.boolean(),
    seo: v.optional(seoV),
  },
  returns: v.object({ id: v.id("posts"), slug: v.string(), changed: v.boolean() }),
  handler: async (ctx, args) => {
    const viewer = await requireRole(ctx, CONTENT);
    const existing = args.id !== undefined ? await loadPost(ctx, args.id) : null;

    if (args.title.sr.trim().length < TITLE_MIN_SAVE) {
      invalidInput(`Unesite naslov na srpskom (najmanje ${TITLE_MIN_SAVE} znaka).`);
    }
    checkL10nLength(args.title, TITLE_MAX, "Naslov");
    checkL10nLength(args.excerpt, EXCERPT_MAX, "Kratak opis");
    checkL10nLength(args.body, BODY_MAX, "Tekst");
    // This post's own uploads, by the URL the editor put in `<img src>`.
    const inline = await inlineImageUrls(ctx, existing?.inlineImages ?? []);
    const allowlist = postHtml(new Set(inline.keys()));
    for (const key of L10N_KEYS) {
      const problem = htmlProblem(args.body[key] ?? "", allowlist);
      if (problem !== null) invalidInput(`Tekst (${LOCALE_SHORT[key]}): ${problem}.`);
    }
    if (args.seo?.metaTitle !== undefined) checkL10nLength(args.seo.metaTitle, META_TITLE_MAX, "Meta naslov");
    if (args.seo?.metaDescription !== undefined) {
      checkL10nLength(args.seo.metaDescription, META_DESCRIPTION_MAX, "Meta opis");
    }

    const tags: string[] = [];
    for (const raw of args.tags) {
      const tag = raw.trim().replace(/\s+/g, " ");
      if (tag.length === 0) continue;
      if (tag.length > TAG_MAX) invalidInput(`Oznaka „${tag.slice(0, 20)}…” je predugačka (najviše ${TAG_MAX} znakova).`);
      if (!tags.some((known) => foldDiacritics(known) === foldDiacritics(tag))) tags.push(tag);
    }
    if (tags.length > TAGS_MAX) invalidInput(`Najviše ${TAGS_MAX} oznaka po tekstu.`);

    if (args.cover !== undefined && !sameImage(args.cover, existing?.cover)) {
      await assertImageRef(ctx, args.cover);
    }
    if (args.seo?.ogImage !== undefined && !sameImage(args.seo.ogImage, existing?.seo?.ogImage)) {
      await assertImageRef(ctx, args.seo.ogImage);
    }
    if (args.authorAgentId !== undefined && (await ctx.db.get("agents", args.authorAgentId)) === null) {
      notFound("Autor");
    }

    const requested = args.slug?.trim() ?? "";
    const slug = await uniqueSlug(ctx, slugify(requested.length > 0 ? requested : args.title.sr), args.id);
    const now = Date.now();
    const fields = {
      slug,
      title: trimL10n(args.title),
      excerpt: trimL10n(args.excerpt),
      body: args.body,
      cover: args.cover,
      category: args.category,
      tags,
      authorAgentId: args.authorAgentId,
      featured: args.featured,
      seo: args.seo,
      readingMinutes: readingMinutes(args.body.sr),
      updatedAt: now,
    };

    if (existing !== null) {
      // Uploads the text no longer shows (deleted in the editor) are freed.
      const used = [...inline].filter(([url]) => L10N_KEYS.some((key) => (args.body[key] ?? "").includes(url)));
      if (used.length !== (existing.inlineImages ?? []).length) {
        const keep = new Set(used.map(([, storageId]) => storageId));
        for (const storageId of existing.inlineImages ?? []) {
          if (!keep.has(storageId)) await deleteBlobIfPresent(ctx, storageId);
        }
        await ctx.db.patch("posts", existing._id, { inlineImages: [...keep] });
      }

      const diff = diffFields(loggedFields(existing), loggedFields(fields));
      // Bodies are long HTML: log which languages changed, not the markup.
      const changedBodies = L10N_KEYS.filter(
        (key) => (existing.body[key] ?? "") !== (fields.body[key] ?? ""),
      );
      if (changedBodies.length > 0) {
        diff.push({ field: "body", to: `Izmenjen tekst: ${changedBodies.map((key) => LOCALE_SHORT[key]).join(", ")}` });
      }
      // Nothing to save: no write, no log, `updatedAt` stays.
      if (diff.length === 0) return { id: existing._id, slug, changed: false };

      await ctx.db.patch("posts", existing._id, fields);
      await releaseReplacedImage(ctx, existing.cover, args.cover);
      await releaseReplacedImage(ctx, existing.seo?.ogImage, args.seo?.ogImage);
      await logActivity(ctx, {
        entity: "post",
        entityId: existing._id,
        action: "post.updated",
        summary: titleOf(fields),
        diff,
        by: viewer._id,
      });
      return { id: existing._id, slug, changed: true };
    }

    const id = await ctx.db.insert("posts", {
      ...fields,
      status: "draft",
      isDemo: false,
    });
    await logActivity(ctx, {
      entity: "post",
      entityId: id,
      action: "post.created",
      summary: titleOf(fields),
      by: viewer._id,
    });
    return { id, slug, changed: true };
  },
});

/**
 * An image uploaded from the body editor: validates the blob, records it on
 * the post (so deleting the post frees it) and returns its URL for `<img>`.
 */
export const attachImage = mutation({
  args: { id: v.id("posts"), storageId: v.id("_storage") },
  returns: v.string(),
  handler: async (ctx, args) => {
    const viewer = await requireRole(ctx, CONTENT);
    const doc = await loadPost(ctx, args.id);
    await assertImageUpload(ctx, args.storageId);
    const images = doc.inlineImages ?? [];
    if (!images.includes(args.storageId)) {
      if (images.length >= INLINE_IMAGES_MAX) {
        invalidInput(`Tekst već ima ${INLINE_IMAGES_MAX} otpremljenih slika.`);
      }
      await ctx.db.patch("posts", doc._id, { inlineImages: [...images, args.storageId] });
    }
    const url = await ctx.storage.getUrl(args.storageId);
    if (url === null) notFound("Fajl");
    await logActivity(ctx, {
      entity: "post",
      entityId: doc._id,
      action: "post.image_added",
      summary: titleOf(doc),
      by: viewer._id,
    });
    return url;
  },
});

/** Puts a saved post on the site now. A republished post keeps its first date. */
export const publish = mutation({
  args: { id: v.id("posts") },
  returns: v.object({ publishedAt: v.number() }),
  handler: async (ctx, args) => {
    const viewer = await requireRole(ctx, CONTENT);
    const doc = await loadPost(ctx, args.id);
    if (doc.status === "published" && doc.publishedAt !== undefined) {
      return { publishedAt: doc.publishedAt };
    }
    assertPublishable(doc);

    const now = Date.now();
    const publishedAt = doc.publishedAt !== undefined && doc.publishedAt <= now ? doc.publishedAt : now;
    await cancelSchedule(ctx, doc);
    await ctx.db.patch("posts", doc._id, {
      status: "published",
      publishedAt,
      scheduledAt: undefined,
      scheduledFnId: undefined,
      updatedAt: now,
    });
    await logActivity(ctx, {
      entity: "post",
      entityId: doc._id,
      action: "post.published",
      summary: titleOf(doc),
      diff: diffFields({ status: doc.status }, { status: "published" }),
      by: viewer._id,
    });
    return { publishedAt };
  },
});

/**
 * Schedules a draft to go live at `at` (epoch ms; the editor converts the
 * Belgrade date and time). Rescheduling replaces the pending run.
 */
export const schedule = mutation({
  args: { id: v.id("posts"), at: v.number() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const viewer = await requireRole(ctx, CONTENT);
    const doc = await loadPost(ctx, args.id);
    if (doc.status === "published") {
      invalidInput("Tekst je već objavljen. Vratite ga u nacrt da biste zakazali novu objavu.");
    }
    const now = Date.now();
    if (!Number.isFinite(args.at) || args.at < now + SCHEDULE_MIN_LEAD_MS) {
      invalidInput("Izaberite vreme objave najmanje dva minuta od sada.");
    }
    if (args.at > now + SCHEDULE_MAX_AHEAD_MS) {
      invalidInput("Objavu možete zakazati najviše godinu dana unapred.");
    }
    assertPublishable(doc);

    await cancelSchedule(ctx, doc);
    const scheduledFnId = await ctx.scheduler.runAt(args.at, internal.postsAdmin.publishScheduled, {
      id: doc._id,
      at: args.at,
    });
    await ctx.db.patch("posts", doc._id, {
      status: "draft",
      scheduledAt: args.at,
      scheduledFnId,
      updatedAt: now,
    });
    await logActivity(ctx, {
      entity: "post",
      entityId: doc._id,
      action: "post.scheduled",
      summary: titleOf(doc),
      diff: [
        // An archived post comes back as a (scheduled) draft: log that too.
        ...diffFields({ status: doc.status }, { status: "draft" }),
        {
          field: "scheduledAt",
          ...(doc.scheduledAt !== undefined ? { from: new Date(doc.scheduledAt).toISOString() } : {}),
          to: new Date(args.at).toISOString(),
        },
      ],
      by: viewer._id,
    });
    return null;
  },
});

/** Takes a post off the site (or cancels its schedule): back to a plain draft. */
export const unpublish = mutation({
  args: { id: v.id("posts") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const viewer = await requireRole(ctx, CONTENT);
    const doc = await loadPost(ctx, args.id);
    if (doc.status === "draft" && doc.scheduledAt === undefined) return null;

    await cancelSchedule(ctx, doc);
    await ctx.db.patch("posts", doc._id, {
      status: "draft",
      scheduledAt: undefined,
      scheduledFnId: undefined,
      updatedAt: Date.now(),
    });
    await logActivity(ctx, {
      entity: "post",
      entityId: doc._id,
      action:
        doc.status === "published"
          ? "post.unpublished"
          : doc.status === "archived"
            ? "post.restored"
            : "post.unscheduled",
      summary: titleOf(doc),
      diff: diffFields(
        { status: doc.status, scheduledAt: doc.scheduledAt },
        { status: "draft", scheduledAt: undefined },
      ),
      by: viewer._id,
    });
    return null;
  },
});

/** Archives a post: off the site, kept for reference, schedule cancelled. */
export const archive = mutation({
  args: { id: v.id("posts") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const viewer = await requireRole(ctx, CONTENT);
    const doc = await loadPost(ctx, args.id);
    if (doc.status === "archived") return null;

    await cancelSchedule(ctx, doc);
    await ctx.db.patch("posts", doc._id, {
      status: "archived",
      scheduledAt: undefined,
      scheduledFnId: undefined,
      updatedAt: Date.now(),
    });
    await logActivity(ctx, {
      entity: "post",
      entityId: doc._id,
      action: "post.archived",
      summary: titleOf(doc),
      diff: diffFields({ status: doc.status }, { status: "archived" }),
      by: viewer._id,
    });
    return null;
  },
});

/**
 * The scheduler's run. It publishes only if the post is still the draft that
 * was scheduled for this instant (a reschedule or unpublish made it stale),
 * and only if it still passes the checklist; otherwise the schedule is
 * dropped and the reason logged.
 */
export const publishScheduled = internalMutation({
  args: { id: v.id("posts"), at: v.number() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const doc = await ctx.db.get("posts", args.id);
    if (doc === null || doc.status !== "draft" || doc.scheduledAt !== args.at) return null;

    const reasons = blockers(doc);
    if (reasons.length > 0) {
      await ctx.db.patch("posts", doc._id, { scheduledAt: undefined, scheduledFnId: undefined });
      await logActivity(ctx, {
        entity: "post",
        entityId: doc._id,
        action: "post.schedule_failed",
        summary: `${titleOf(doc)} — nije objavljeno: ${reasons.join("; ")}`,
      });
      return null;
    }

    await ctx.db.patch("posts", doc._id, {
      status: "published",
      // Back on the site after an unpublish: the first publication date stays.
      publishedAt: doc.publishedAt !== undefined && doc.publishedAt <= args.at ? doc.publishedAt : args.at,
      scheduledAt: undefined,
      scheduledFnId: undefined,
      updatedAt: Date.now(),
    });
    await logActivity(ctx, {
      entity: "post",
      entityId: doc._id,
      action: "post.published",
      summary: `${titleOf(doc)} (zakazana objava)`,
      diff: diffFields({ status: "draft" }, { status: "published" }),
    });
    return null;
  },
});

/** Deletes a post with its cover, share image and body images. Managers only. */
export const remove = mutation({
  args: { id: v.id("posts") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const viewer = await requireRole(ctx, MANAGERS);
    const doc = await loadPost(ctx, args.id);
    await cancelSchedule(ctx, doc);
    const blobs = new Set<Id<"_storage">>(doc.inlineImages ?? []);
    if (doc.cover?.kind === "storage") blobs.add(doc.cover.storageId);
    if (doc.seo?.ogImage?.kind === "storage") blobs.add(doc.seo.ogImage.storageId);
    for (const storageId of blobs) await deleteBlobIfPresent(ctx, storageId);
    await ctx.db.delete("posts", doc._id);
    await logActivity(ctx, {
      entity: "post",
      entityId: doc._id,
      action: "post.deleted",
      summary: titleOf(doc),
      by: viewer._id,
    });
    return null;
  },
});
