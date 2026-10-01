import { type Infer, v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { mutation, query } from "./_generated/server";
import { logActivity } from "./lib/activity";
import { requireRole } from "./lib/auth";
import { imageUrl } from "./lib/dto";
import { HTML_TAG_RE, htmlProblem, PAGE_HTML } from "./lib/html";
import { appError, forbidden, invalidInput } from "./lib/errors";
import { assertImageRef, deleteBlobIfPresent } from "./lib/storage";
import {
  type diffEntryV,
  type ImageRef,
  type L10n,
  L10N_KEYS,
  type PageBlock,
  type PageKey,
  type Role,
  pageBlockV,
  pageKeyV,
  seoV,
} from "./lib/validators";
import { PAGE_CONTENT } from "./seed/content/pages";

/**
 * Site content (PRD B10): the admin side of the `pages` table.
 *
 * Structure rules, enforced here and mirrored by the editor:
 * - The legal pages (privacy, terms, cookies) are free-form: an ordered list
 *   of `richText` sections the editor may add, remove and reorder.
 * - Every other page has a FIXED structure: the blocks of its seeded template
 *   (`convex/seed/content/pages.ts`), same keys, same types, same order —
 *   the site reads them by key, so an unknown or missing block would be dead
 *   text or a silent fallback. On the landing (`home`) even the number of
 *   services / steps / figures is fixed: each is wired to a link or a slot.
 * - A field the template fills is required (a blank hero headline would
 *   quietly fall back to the built-in text, which reads as "my edit vanished").
 */

const CONTENT = ["admin", "manager", "editor"] as const;

type DiffEntry = Infer<typeof diffEntryV>;

/** Pages built from free-form sections. */
const SECTION_PAGES: readonly PageKey[] = ["privacy", "terms", "cookies"];
/** Pages whose item lists keep the template's length. */
const FIXED_ITEM_PAGES: readonly PageKey[] = ["home"];

/**
 * Where a CTA may point: the site's canonical (English) pathnames from
 * `i18n/routing.ts`; the site localizes them.
 */
const CTA_TARGETS = [
  "/",
  "/properties",
  "/locations",
  "/valuation",
  "/sell",
  "/agents",
  "/about",
  "/contact",
  "/journal",
  "/favorites",
  "/compare",
  "/privacy",
  "/terms",
  "/cookies",
] as const;

const LIMITS = {
  blocks: 40,
  items: 20,
  listItems: 20,
  title: 200,
  lede: 600,
  itemTitle: 160,
  itemBody: 2000,
  listItem: 300,
  body: 30_000,
  statValue: 24,
  statLabel: 80,
  ctaLabel: 60,
} as const;

const BLOCK_KEY_RE = /^[a-zA-Z][a-zA-Z0-9-]{0,39}$/;

/**
 * Whole-page budget, well under Convex's 1 MiB document limit, so a long
 * legal page fails with a readable message instead of a storage error.
 */
const PAGE_BYTES_MAX = 900_000;

/** Who may take the "demo" flag off a figure (the owner vouches for it). */
const DEMO_CLEARERS: readonly Role[] = ["admin", "manager"];

/* ------------------------------------------------------------ templates */

function templateOf(key: PageKey): PageBlock[] {
  return PAGE_CONTENT.find((page) => page.key === key)?.blocks ?? [];
}

function isSectionPage(key: PageKey): boolean {
  return SECTION_PAGES.includes(key);
}

function hasFixedItems(key: PageKey): boolean {
  return FIXED_ITEM_PAGES.includes(key);
}

/** Pads or trims a list to the template's length, template items filling gaps. */
function fitTo<T>(items: T[], template: T[]): T[] {
  if (items.length === template.length) return items;
  return template.map((fallback, index) => items[index] ?? fallback);
}

/**
 * The blocks the editor works on. Fixed pages always come back in template
 * shape: a stored block is used when its key and type still match, otherwise
 * the template block stands in (so a template that gained a block, or a page
 * that was never saved, is still editable and saves cleanly).
 */
function editorBlocks(key: PageKey, stored: PageBlock[] | null): PageBlock[] {
  const template = templateOf(key);
  if (stored === null) return template;
  if (isSectionPage(key)) return stored;
  const fixed = hasFixedItems(key);
  return template.map((base) => {
    const found = stored.find((block) => block.key === base.key && block.type === base.type);
    if (found === undefined) return base;
    // A field the template has (and `upsert` therefore requires) but the
    // stored block lacks is offered with the template's text.
    switch (found.type) {
      case "richText":
        return base.type === "richText" ? { ...base, ...found } : found;
      case "cta":
        return base.type === "cta" ? { ...base, ...found } : found;
      case "list":
        return base.type === "list" ? { ...base, ...found } : found;
      case "media":
        return base.type === "media" ? { ...base, ...found } : found;
      case "steps":
        return base.type === "steps"
          ? { ...base, ...found, items: fixed ? fitTo(found.items, base.items) : found.items }
          : found;
      case "stats":
        return base.type === "stats"
          ? { ...base, ...found, items: fixed ? fitTo(found.items, base.items) : found.items }
          : found;
      case "faq":
        return base.type === "faq" && fixed ? { ...found, items: fitTo(found.items, base.items) } : found;
    }
  });
}

/* ------------------------------------------------------------ validation */

/** Visible text of a body, for the "is it empty" check and the change log. */
function plainText(html: string): string {
  return html
    .replace(/<\/(p|h3|li|blockquote)>/gi, " ")
    .replace(/<br\s*\/?>/gi, " ")
    .replace(HTML_TAG_RE, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

type TextRule = { label: string; max: number; html?: boolean };

/** Checks a localized value: Serbian present, every locale within `max`. */
function checkL10n(where: string, value: L10n, rule: TextRule): void {
  const sr = rule.html === true ? plainText(value.sr) : value.sr.trim();
  if (sr.length === 0) invalidInput(`${where}: ${rule.label} na srpskom je obavezan.`);
  for (const locale of L10N_KEYS) {
    const text = value[locale];
    if (text === undefined) continue;
    if (text.length > rule.max) {
      invalidInput(`${where}: ${rule.label} (${locale}) je predugačak — najviše ${rule.max} znakova.`);
    }
    if (rule.html === true) {
      const problem = htmlProblem(text, PAGE_HTML);
      if (problem !== null) invalidInput(`${where}: ${rule.label} (${locale}) — ${problem}.`);
    }
  }
}

/** An optional field: validated when present, required when the template has it. */
function checkOptional(
  where: string,
  value: L10n | undefined,
  required: boolean,
  rule: TextRule,
): void {
  if (value === undefined) {
    if (required) invalidInput(`${where}: ${rule.label} je obavezan.`);
    return;
  }
  checkL10n(where, value, rule);
}

function checkCount(where: string, count: number, max: number, fixed: number | undefined): void {
  if (fixed !== undefined && count !== fixed) {
    invalidInput(`${where}: broj stavki je fiksan (${fixed}).`);
  }
  if (count < 1) invalidInput(`${where}: potrebna je bar jedna stavka.`);
  if (count > max) invalidInput(`${where}: najviše ${max} stavki.`);
}

function sameImage(a: ImageRef, b: ImageRef): boolean {
  if (a.kind === "storage") return b.kind === "storage" && a.storageId === b.storageId;
  return b.kind === "url" && a.url === b.url;
}

async function checkBlock(
  ctx: MutationCtx,
  block: PageBlock,
  template: PageBlock | undefined,
  stored: PageBlock | undefined,
  fixedItems: boolean,
  role: Role,
): Promise<void> {
  const where = `Blok „${block.key}”`;
  switch (block.type) {
    case "richText": {
      const base = template?.type === "richText" ? template : undefined;
      checkOptional(where, block.title, base?.title !== undefined, { label: "naslov", max: LIMITS.title });
      checkL10n(where, block.body, { label: "tekst", max: LIMITS.body, html: true });
      return;
    }
    case "stats": {
      const base = template?.type === "stats" ? template : undefined;
      checkOptional(where, block.title, base?.title !== undefined, { label: "naslov", max: LIMITS.title });
      checkCount(where, block.items.length, 8, fixedItems ? base?.items.length : undefined);
      // What each figure was before this save: the stored block, or the
      // template when the page (or the block) has never been saved.
      const before = stored?.type === "stats" ? stored.items : (base?.items ?? []);
      for (const [index, item] of block.items.entries()) {
        const value = item.value.trim();
        if (value.length === 0) invalidInput(`${where}: vrednost je obavezna.`);
        if (value.length > LIMITS.statValue) invalidInput(`${where}: vrednost „${value}” je predugačka.`);
        checkL10n(where, item.label, { label: "opis", max: LIMITS.statLabel });

        // Taking the "demo" flag off states that the figure is the agency's
        // real number: only admin/manager may, and never with the demo value.
        if (item.isDemo || before[index]?.isDemo !== true) continue;
        if (!DEMO_CLEARERS.includes(role)) forbidden("uklanjanje oznake „demo” sa brojke");
        const demo = base?.items[index];
        if (demo !== undefined && demo.isDemo && demo.value.trim() === value) {
          invalidInput("Unesite stvarnu vrednost pre nego što skinete oznaku demo.");
        }
      }
      return;
    }
    case "steps": {
      const base = template?.type === "steps" ? template : undefined;
      checkOptional(where, block.title, base?.title !== undefined, { label: "naslov", max: LIMITS.title });
      checkOptional(where, block.lede, base?.lede !== undefined, { label: "uvod", max: LIMITS.lede });
      checkCount(where, block.items.length, LIMITS.items, fixedItems ? base?.items.length : undefined);
      for (const item of block.items) {
        checkL10n(where, item.title, { label: "naslov stavke", max: LIMITS.itemTitle });
        checkL10n(where, item.body, { label: "tekst stavke", max: LIMITS.itemBody });
      }
      return;
    }
    case "faq": {
      const base = template?.type === "faq" ? template : undefined;
      checkCount(where, block.items.length, LIMITS.items, fixedItems ? base?.items.length : undefined);
      for (const item of block.items) {
        checkL10n(where, item.q, { label: "pitanje", max: LIMITS.itemTitle });
        checkL10n(where, item.a, { label: "odgovor", max: LIMITS.itemBody });
      }
      return;
    }
    case "cta": {
      const base = template?.type === "cta" ? template : undefined;
      checkL10n(where, block.heading, { label: "naslov", max: LIMITS.title });
      checkOptional(where, block.sub, base?.sub !== undefined, { label: "podnaslov", max: LIMITS.lede });
      checkOptional(where, block.note, base?.note !== undefined, { label: "napomena", max: LIMITS.lede });
      checkL10n(where, block.label, { label: "tekst dugmeta", max: LIMITS.ctaLabel });
      if (!(CTA_TARGETS as readonly string[]).includes(block.href)) {
        invalidInput(`${where}: odredište „${block.href}” nije stranica sajta.`);
      }
      return;
    }
    case "media": {
      const base = template?.type === "media" ? template : undefined;
      // Only a new or replaced image is checked: an upload is linkable for a
      // limited time after it was made (`UPLOAD_LINK_WINDOW_MS`), so an
      // image saved weeks ago must not block re-saving the page's text.
      const unchanged = stored?.type === "media" && sameImage(stored.image, block.image);
      if (!unchanged) await assertImageRef(ctx, block.image);
      checkOptional(where, block.caption, base?.caption !== undefined, { label: "opis slike", max: LIMITS.lede });
      return;
    }
    case "list": {
      const base = template?.type === "list" ? template : undefined;
      checkOptional(where, block.title, base?.title !== undefined, { label: "naslov", max: LIMITS.title });
      if (block.items.sr.filter((item) => item.trim().length > 0).length === 0) {
        invalidInput(`${where}: lista na srpskom mora imati bar jednu stavku.`);
      }
      for (const locale of L10N_KEYS) {
        const items = block.items[locale];
        if (items === undefined) continue;
        if (items.length > LIMITS.listItems) invalidInput(`${where}: najviše ${LIMITS.listItems} stavki.`);
        if (items.some((item) => item.length > LIMITS.listItem)) {
          invalidInput(`${where}: stavka liste (${locale}) je predugačka — najviše ${LIMITS.listItem} znakova.`);
        }
      }
      return;
    }
  }
}

async function validatePage(
  ctx: MutationCtx,
  key: PageKey,
  blocks: PageBlock[],
  stored: PageBlock[],
  role: Role,
): Promise<void> {
  if (blocks.length === 0) invalidInput("Stranica mora imati bar jednu sekciju.");
  if (blocks.length > LIMITS.blocks) invalidInput(`Stranica može imati najviše ${LIMITS.blocks} sekcija.`);

  const seen = new Set<string>();
  for (const block of blocks) {
    if (!BLOCK_KEY_RE.test(block.key)) invalidInput(`Oznaka sekcije „${block.key}” nije ispravna.`);
    if (seen.has(block.key)) invalidInput(`Oznaka sekcije „${block.key}” se ponavlja.`);
    seen.add(block.key);
  }

  const template = templateOf(key);
  if (isSectionPage(key)) {
    if (blocks.some((block) => block.type !== "richText")) {
      invalidInput("Pravne stranice se sastoje samo od tekstualnih sekcija.");
    }
  } else {
    const shape = (list: PageBlock[]) => list.map((block) => `${block.key}:${block.type}`).join("|");
    if (shape(blocks) !== shape(template)) {
      invalidInput("Raspored sekcija ove stranice je fiksan. Osvežite stranicu i pokušajte ponovo.");
    }
  }

  for (const block of blocks) {
    // The template binds fixed pages only; on a legal page it was just the
    // first draft, so its section titles are optional like any other.
    const base = isSectionPage(key) ? undefined : template.find((item) => item.key === block.key);
    const previous = stored.find((item) => item.key === block.key);
    await checkBlock(ctx, block, base, previous, hasFixedItems(key), role);
  }
}

type Seo = Infer<typeof seoV>;

/** The optional SEO fields: short texts and, when it changed, a valid image. */
async function validateSeo(ctx: MutationCtx, seo: Seo, stored: Seo | undefined): Promise<void> {
  if (seo.metaTitle !== undefined) checkL10n("SEO", seo.metaTitle, { label: "naslov", max: 120 });
  if (seo.metaDescription !== undefined) checkL10n("SEO", seo.metaDescription, { label: "opis", max: 320 });
  const before = stored?.ogImage;
  if (seo.ogImage !== undefined && !(before !== undefined && sameImage(before, seo.ogImage))) {
    await assertImageRef(ctx, seo.ogImage);
  }
}

/* ----------------------------------------------------------------- diff */

const MAX_DIFF = 60;

function clip(text: string | undefined): string | undefined {
  if (text === undefined || text.length === 0) return undefined;
  return text.length > 200 ? `${text.slice(0, 199)}…` : text;
}

/** Link targets in a body, in document order (`&amp;` decoded). */
function linksOf(html: string): string {
  return [...html.matchAll(/<a\b[^>]*?\shref="([^"]*)"/gi)].map((match) => match[1].replace(/&amp;/g, "&")).join(" · ");
}

/** Every editable leaf of a block as `path → text`, for a field-level diff. */
function flatten(block: PageBlock): Map<string, string> {
  const out = new Map<string, string>();
  const put = (path: string, value: L10n | undefined, html = false) => {
    if (value === undefined) return;
    for (const locale of L10N_KEYS) {
      const text = value[locale];
      if (text === undefined || text.length === 0) continue;
      out.set(`${path}.${locale}`, html ? plainText(text) : text);
      // A changed link target leaves the visible text as it was.
      const links = html ? linksOf(text) : "";
      if (links.length > 0) out.set(`${path}.${locale}.links`, links);
    }
  };
  const image = (ref: ImageRef) => (ref.kind === "url" ? ref.url : `fajl ${ref.storageId}`);

  switch (block.type) {
    case "richText":
      put("title", block.title);
      put("body", block.body, true);
      break;
    case "stats":
      put("title", block.title);
      block.items.forEach((item, index) => {
        out.set(`items[${index + 1}].value`, item.value);
        out.set(`items[${index + 1}].isDemo`, item.isDemo ? "da" : "ne");
        put(`items[${index + 1}].label`, item.label);
      });
      break;
    case "steps":
      put("title", block.title);
      put("lede", block.lede);
      block.items.forEach((item, index) => {
        put(`items[${index + 1}].title`, item.title);
        put(`items[${index + 1}].body`, item.body);
      });
      break;
    case "faq":
      block.items.forEach((item, index) => {
        put(`items[${index + 1}].q`, item.q);
        put(`items[${index + 1}].a`, item.a);
      });
      break;
    case "cta":
      put("heading", block.heading);
      put("sub", block.sub);
      put("note", block.note);
      put("label", block.label);
      out.set("href", block.href);
      break;
    case "media":
      out.set("image", image(block.image));
      put("caption", block.caption);
      break;
    case "list":
      put("title", block.title);
      for (const locale of L10N_KEYS) {
        const items = block.items[locale];
        if (items !== undefined && items.length > 0) out.set(`items.${locale}`, items.join(" · "));
      }
      break;
  }
  return out;
}

/**
 * What changed between two versions of a page, per block, field and locale
 * (`hero.title.en`, `process.items[2].body.sr`), plus added / removed
 * sections and a new order. Capped so one bulk edit cannot bloat the log.
 */
function diffBlocks(before: PageBlock[], after: PageBlock[]): DiffEntry[] {
  const out: DiffEntry[] = [];
  const beforeByKey = new Map(before.map((block) => [block.key, block]));
  const afterKeys = new Set(after.map((block) => block.key));

  for (const block of after) {
    const previous = beforeByKey.get(block.key);
    if (previous === undefined) {
      out.push({ field: block.key, to: "nova sekcija" });
      continue;
    }
    if (previous.type !== block.type) {
      out.push({ field: `${block.key}.type`, from: previous.type, to: block.type });
      continue;
    }
    const from = flatten(previous);
    const to = flatten(block);
    for (const path of new Set([...from.keys(), ...to.keys()])) {
      if (from.get(path) !== to.get(path)) {
        out.push({ field: `${block.key}.${path}`, from: clip(from.get(path)), to: clip(to.get(path)) });
      }
    }
    // Formatting-only edits (bold, a subheading, a list) change neither the
    // text nor the links; they still belong in the log.
    if (previous.type === "richText" && block.type === "richText") {
      for (const locale of L10N_KEYS) {
        const rawFrom = previous.body[locale];
        const rawTo = block.body[locale];
        if (rawFrom === undefined || rawTo === undefined || rawFrom === rawTo) continue;
        const path = `body.${locale}`;
        if (from.get(path) === to.get(path) && from.get(`${path}.links`) === to.get(`${path}.links`)) {
          out.push({ field: `${block.key}.${path}`, to: "html izmenjen" });
        }
      }
    }
  }
  for (const block of before) {
    if (!afterKeys.has(block.key)) out.push({ field: block.key, from: "sekcija", to: "uklonjena" });
  }

  const beforeOrder = before.map((block) => block.key).filter((key) => afterKeys.has(key));
  const afterOrder = after.map((block) => block.key).filter((key) => beforeByKey.has(key));
  if (beforeOrder.join("|") !== afterOrder.join("|")) {
    out.push({ field: "redosled", from: clip(beforeOrder.join(", ")), to: clip(afterOrder.join(", ")) });
  }

  if (out.length <= MAX_DIFF) return out;
  return [...out.slice(0, MAX_DIFF - 1), { field: "…", to: `još ${out.length - MAX_DIFF + 1} izmena` }];
}

/** Storage blobs a page references: media blocks and the SEO share image. */
function storageIds(blocks: PageBlock[], seo: Seo | undefined): Id<"_storage">[] {
  const ids = blocks.flatMap((block) =>
    block.type === "media" && block.image.kind === "storage" ? [block.image.storageId] : [],
  );
  if (seo?.ogImage?.kind === "storage") ids.push(seo.ogImage.storageId);
  return ids;
}

/**
 * Whether another page or the settings record still points at this blob (a
 * reused upload must outlive the page it was replaced on). Bounded: one
 * `pages` row per page key, one settings row.
 */
async function referencedElsewhere(
  ctx: MutationCtx,
  storageId: Id<"_storage">,
  pageId: Id<"pages">,
): Promise<boolean> {
  const pages = await ctx.db.query("pages").take(50);
  if (pages.some((page) => page._id !== pageId && JSON.stringify([page.blocks, page.seo ?? null]).includes(storageId))) {
    return true;
  }
  const settings = await ctx.db
    .query("settings")
    .withIndex("by_key", (q) => q.eq("key", "global"))
    .unique();
  return settings !== null && JSON.stringify(settings).includes(storageId);
}

/* --------------------------------------------------------------- queries */

async function findPage(ctx: QueryCtx, key: PageKey): Promise<Doc<"pages"> | null> {
  return await ctx.db
    .query("pages")
    .withIndex("by_key", (q) => q.eq("key", key))
    .unique();
}

export const get = query({
  args: { key: pageKeyV },
  returns: v.object({
    key: pageKeyV,
    /** False when the page was never created: `blocks` is then the template. */
    exists: v.boolean(),
    blocks: v.array(pageBlockV),
    seo: v.optional(seoV),
    /** `null` for a page that does not exist yet (the conflict check sends it back). */
    updatedAt: v.union(v.number(), v.null()),
    updatedByName: v.optional(v.string()),
    isDemo: v.boolean(),
    layout: v.union(v.literal("fixed"), v.literal("sections")),
    fixedItems: v.boolean(),
    ctaTargets: v.array(v.string()),
    /** Preview URLs for media blocks stored as uploads, by block key. */
    mediaPreviews: v.array(v.object({ key: v.string(), url: v.string() })),
  }),
  handler: async (ctx, args) => {
    const viewer = await requireRole(ctx, CONTENT);
    const doc = await findPage(ctx, args.key);
    const blocks = editorBlocks(args.key, doc?.blocks ?? null);

    const mediaPreviews: { key: string; url: string }[] = [];
    for (const block of blocks) {
      if (block.type !== "media" || block.image.kind !== "storage") continue;
      const url = await imageUrl(ctx, block.image);
      if (url !== null) mediaPreviews.push({ key: block.key, url });
    }

    let updatedByName: string | undefined;
    if (doc?.updatedBy !== undefined) {
      const user = await ctx.db.get("users", doc.updatedBy);
      // Only admins see an e-mail in place of a missing name (as in activity.ts).
      updatedByName = user?.name ?? (viewer.role === "admin" ? user?.email : undefined) ?? "Član tima";
    }

    return {
      key: args.key,
      exists: doc !== null,
      blocks,
      ...(doc?.seo !== undefined ? { seo: doc.seo } : {}),
      updatedAt: doc?.updatedAt ?? null,
      ...(updatedByName !== undefined ? { updatedByName } : {}),
      isDemo: doc?.isDemo ?? false,
      layout: isSectionPage(args.key) ? ("sections" as const) : ("fixed" as const),
      fixedItems: hasFixedItems(args.key),
      ctaTargets: [...CTA_TARGETS],
      mediaPreviews,
    };
  },
});

/** The page picker: every known page, whether it exists yet and how fresh it is. */
export const listKeys = query({
  args: {},
  returns: v.array(
    v.object({
      key: pageKeyV,
      exists: v.boolean(),
      blocks: v.number(),
      updatedAt: v.union(v.number(), v.null()),
      isDemo: v.boolean(),
    }),
  ),
  handler: async (ctx) => {
    await requireRole(ctx, CONTENT);
    const out = [];
    for (const page of PAGE_CONTENT) {
      const doc = await findPage(ctx, page.key);
      out.push({
        key: page.key,
        exists: doc !== null,
        blocks: doc?.blocks.length ?? page.blocks.length,
        updatedAt: doc?.updatedAt ?? null,
        isDemo: doc?.isDemo ?? false,
      });
    }
    return out;
  },
});

/* ------------------------------------------------------------- mutations */

export const upsert = mutation({
  args: {
    key: pageKeyV,
    blocks: v.array(pageBlockV),
    /** Omitted: the stored SEO fields are kept as they are. */
    seo: v.optional(seoV),
    /**
     * The `updatedAt` the editor loaded (`null` = the page did not exist).
     * A mismatch means someone else saved in between: refused, not merged.
     */
    expectedUpdatedAt: v.union(v.number(), v.null()),
  },
  returns: v.object({ id: v.id("pages"), updatedAt: v.number() }),
  handler: async (ctx, args) => {
    const viewer = await requireRole(ctx, CONTENT);
    const existing = await findPage(ctx, args.key);

    if ((existing?.updatedAt ?? null) !== args.expectedUpdatedAt) {
      appError(
        "CONFLICT",
        "Ovu stranicu je u međuvremenu sačuvao neko drugi. Kopirajte svoje izmene, osvežite stranicu i unesite ih ponovo.",
      );
    }

    const bytes = new TextEncoder().encode(JSON.stringify({ blocks: args.blocks, seo: args.seo ?? null })).length;
    if (bytes > PAGE_BYTES_MAX) {
      invalidInput(
        `Stranica je prevelika (oko ${Math.round(bytes / 1000)} KB, najviše ${PAGE_BYTES_MAX / 1000} KB). Skratite tekst ili ga podelite na više sekcija.`,
      );
    }

    await validatePage(ctx, args.key, args.blocks, existing?.blocks ?? [], viewer.role);
    if (args.seo !== undefined) await validateSeo(ctx, args.seo, existing?.seo);
    const now = Date.now();

    if (existing === null) {
      const id = await ctx.db.insert("pages", {
        key: args.key,
        blocks: args.blocks,
        ...(args.seo !== undefined ? { seo: args.seo } : {}),
        updatedAt: now,
        updatedBy: viewer._id,
        isDemo: false,
      });
      await logActivity(ctx, {
        entity: "page",
        entityId: id,
        action: "page.created",
        summary: args.key,
        diff: diffBlocks(templateOf(args.key), args.blocks),
        by: viewer._id,
      });
      return { id, updatedAt: now };
    }

    const blockDiff = diffBlocks(existing.blocks, args.blocks);
    // Block keys for the one-line summary ("home: hero, process").
    const changed = [...new Set(blockDiff.map((entry) => entry.field.split(/[.[]/)[0]))];
    const diff = [...blockDiff];
    if (args.seo !== undefined && JSON.stringify(args.seo) !== JSON.stringify(existing.seo ?? null)) {
      diff.push({ field: "seo", to: "izmenjeno" });
    }
    if (existing.isDemo) diff.push({ field: "demo", from: "da", to: "ne" });

    await ctx.db.patch("pages", existing._id, {
      blocks: args.blocks,
      ...(args.seo !== undefined ? { seo: args.seo } : {}),
      updatedAt: now,
      updatedBy: viewer._id,
      // Saving a seeded page makes it the agency's own content: the demo
      // refresh and "remove demo content" leave it alone from now on.
      isDemo: false,
    });

    // Free uploads that nothing on the page references any more.
    const kept = new Set(storageIds(args.blocks, args.seo ?? existing.seo));
    for (const storageId of storageIds(existing.blocks, existing.seo)) {
      if (kept.has(storageId) || (await referencedElsewhere(ctx, storageId, existing._id))) continue;
      await deleteBlobIfPresent(ctx, storageId);
    }

    await logActivity(ctx, {
      entity: "page",
      entityId: existing._id,
      action: "page.updated",
      summary: changed.length > 0 ? `${args.key}: ${changed.join(", ")}` : `${args.key}: bez izmena teksta`,
      diff,
      by: viewer._id,
    });
    return { id: existing._id, updatedAt: now };
  },
});
