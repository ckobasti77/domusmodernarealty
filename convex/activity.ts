import { paginationOptsValidator, paginationResultValidator } from "convex/server";
import { v } from "convex/values";
import type { Infer } from "convex/values";
import type { Doc, Id, TableNames } from "./_generated/dataModel";
import { query } from "./_generated/server";
import type { QueryCtx } from "./_generated/server";
import { requireRole } from "./lib/auth";
import { forbidden } from "./lib/errors";
import { activityEntityV, diffEntryV, roleV } from "./lib/validators";
import type { ActivityEntity } from "./lib/validators";

/**
 * The activity log (PRD B13): who changed what, when. Managers and admins
 * only. Rows are written by `lib/activity.ts::logActivity` from every admin
 * mutation; this module only reads them.
 */

const MANAGERS = ["admin", "manager"] as const;

/** Admin screens a row can link to. The client maps a kind to its route. */
const targetKindV = v.union(
  v.literal("listing"),
  v.literal("lead"),
  v.literal("viewing"),
  v.literal("post"),
  v.literal("location"),
  v.literal("contact"),
  v.literal("settings"),
);
type Target = { kind: Infer<typeof targetKindV>; id?: string };

const rowV = v.object({
  _id: v.id("activity"),
  entity: activityEntityV,
  entityId: v.optional(v.string()),
  action: v.string(),
  summary: v.optional(v.string()),
  diff: v.optional(v.array(diffEntryV)),
  byId: v.optional(v.id("users")),
  byName: v.optional(v.string()),
  at: v.number(),
  /** The record the row is about, when it still exists and has a screen. */
  target: v.optional(v.object({ kind: targetKindV, id: v.optional(v.string()) })),
});

/** Entities whose `entityId` is the id of a row in this table. */
const DIRECT: Partial<Record<ActivityEntity, { table: TableNames; kind: Target["kind"] }>> = {
  listing: { table: "listings", kind: "listing" },
  media: { table: "listings", kind: "listing" },
  lead: { table: "leads", kind: "lead" },
  viewing: { table: "viewings", kind: "viewing" },
  post: { table: "posts", kind: "post" },
  location: { table: "locations", kind: "location" },
  contact: { table: "contacts", kind: "contact" },
};

async function exists<T extends TableNames>(ctx: QueryCtx, table: T, raw: string): Promise<Id<T> | null> {
  const id = ctx.db.normalizeId(table, raw);
  if (id === null) return null;
  return (await ctx.db.get(table, id)) !== null ? id : null;
}

/**
 * Resolves where a row links to. Tour rows carry either the listing id or a
 * scene id; both lead to the listing. Deleted records get no link.
 */
async function resolveTarget(ctx: QueryCtx, row: Doc<"activity">): Promise<Target | null> {
  if (row.entity === "settings") return { kind: "settings" };
  const raw = row.entityId;
  if (raw === undefined) return null;
  if (row.entity === "tour") {
    const listing = await exists(ctx, "listings", raw);
    if (listing !== null) return { kind: "listing", id: listing };
    const sceneId = ctx.db.normalizeId("tourScenes", raw);
    const scene = sceneId !== null ? await ctx.db.get("tourScenes", sceneId) : null;
    if (scene === null) return null;
    const owner = await ctx.db.get("listings", scene.listingId);
    return owner !== null ? { kind: "listing", id: owner._id } : null;
  }
  const direct = DIRECT[row.entity];
  if (direct === undefined) return null;
  const id = await exists(ctx, direct.table, raw);
  return id !== null ? { kind: direct.kind, id } : null;
}

/** What a non-admin sees instead of a staff member's e-mail. */
const TEAM_MEMBER = "Član tima";
const EMAIL_RE = /[^\s@()<>,;:]+@[^\s@()<>,;:]+\.[^\s@()<>,;:]+/g;

/** A staff member's display name; only admins see an e-mail when no name is set. */
function staffName(user: Doc<"users">, admin: boolean): string {
  return user.name ?? (admin ? (user.email ?? TEAM_MEMBER) : TEAM_MEMBER);
}

/**
 * One page of the log, newest first. The index follows the filter: a record
 * (`entityId`), a staff member and an entity type together, a staff member,
 * an entity type, or everything; `from` / `to` bound `at` inside that index.
 *
 * Staff accounts and invitations (`entity: "user"`: e-mails, roles) are an
 * admin matter: managers never get those rows, and e-mails in agent rows
 * (an agent created with an invitation) are masked for them.
 */
export const list = query({
  args: {
    entity: v.optional(activityEntityV),
    entityId: v.optional(v.string()),
    by: v.optional(v.id("users")),
    /** Inclusive lower bound on `at` (ms). */
    from: v.optional(v.number()),
    /** Exclusive upper bound on `at` (ms). */
    to: v.optional(v.number()),
    paginationOpts: paginationOptsValidator,
  },
  returns: paginationResultValidator(rowV),
  handler: async (ctx, args) => {
    const viewer = await requireRole(ctx, MANAGERS);
    const admin = viewer.role === "admin";
    const from = args.from ?? 0;
    const to = args.to ?? Number.MAX_SAFE_INTEGER;
    const { entity, entityId, by } = args;
    if (!admin && entity === "user") forbidden("pregled aktivnosti naloga i pozivnica");

    const base =
      entityId !== undefined
        ? ctx.db
            .query("activity")
            .withIndex("by_entityId_and_at", (q) => q.eq("entityId", entityId).gte("at", from).lt("at", to))
        : by !== undefined && entity !== undefined
          ? ctx.db
              .query("activity")
              .withIndex("by_by_and_entity_and_at", (q) =>
                q.eq("by", by).eq("entity", entity).gte("at", from).lt("at", to),
              )
          : by !== undefined
            ? ctx.db
                .query("activity")
                .withIndex("by_by_and_at", (q) => q.eq("by", by).gte("at", from).lt("at", to))
            : entity !== undefined
              ? ctx.db
                  .query("activity")
                  .withIndex("by_entity_and_at", (q) => q.eq("entity", entity).gte("at", from).lt("at", to))
              : ctx.db.query("activity").withIndex("by_at", (q) => q.gte("at", from).lt("at", to));

    // Only the record index leaves the entity / user filters to the page scan.
    const byEntity =
      entityId !== undefined && entity !== undefined ? base.filter((q) => q.eq(q.field("entity"), entity)) : base;
    const byUser =
      entityId !== undefined && by !== undefined ? byEntity.filter((q) => q.eq(q.field("by"), by)) : byEntity;
    const visible =
      !admin && entity === undefined ? byUser.filter((q) => q.neq(q.field("entity"), "user")) : byUser;

    const result = await visible.order("desc").paginate(args.paginationOpts);

    const names = new Map<Id<"users">, string>();
    const targets = new Map<string, Target | null>();
    const page: Infer<typeof rowV>[] = [];
    for (const row of result.page) {
      let byName = "sistem";
      if (row.by !== undefined) {
        const known = names.get(row.by);
        if (known !== undefined) {
          byName = known;
        } else {
          const user = await ctx.db.get("users", row.by);
          byName = user === null ? "obrisan korisnik" : staffName(user, admin);
          names.set(row.by, byName);
        }
      }
      const targetKey = `${row.entity}:${row.entityId ?? ""}`;
      let target = targets.get(targetKey);
      if (target === undefined) {
        target = await resolveTarget(ctx, row);
        targets.set(targetKey, target);
      }
      const summary =
        row.summary !== undefined && !admin && row.entity === "agent"
          ? row.summary.replace(EMAIL_RE, "[e-pošta skrivena]")
          : row.summary;
      page.push({
        _id: row._id,
        entity: row.entity,
        ...(row.entityId !== undefined ? { entityId: row.entityId } : {}),
        action: row.action,
        ...(summary !== undefined ? { summary } : {}),
        ...(row.diff !== undefined ? { diff: row.diff } : {}),
        ...(row.by !== undefined ? { byId: row.by } : {}),
        byName,
        at: row.at,
        ...(target !== null && !row.action.endsWith(".deleted") ? { target } : {}),
      });
    }

    return { ...result, page };
  },
});

/**
 * Staff for the log's user filter (managers cannot read `users.list`). Names
 * only: a manager sees "Član tima" for an account without a name, never its
 * e-mail.
 */
export const staff = query({
  args: {},
  returns: v.array(v.object({ _id: v.id("users"), name: v.string(), role: roleV })),
  handler: async (ctx) => {
    const viewer = await requireRole(ctx, MANAGERS);
    const admin = viewer.role === "admin";
    const users = await ctx.db.query("users").take(200);
    return users
      .map((user) => ({ _id: user._id, name: staffName(user, admin), role: user.role }))
      .sort((a, b) => a.name.localeCompare(b.name, "sr-Latn"));
  },
});
