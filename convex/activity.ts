import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import { query } from "./_generated/server";
import { requireRole } from "./lib/auth";
import { activityEntityV, diffEntryV } from "./lib/validators";

const MANAGERS = ["admin", "manager"] as const;

export const list = query({
  args: {
    entity: v.optional(activityEntityV),
    entityId: v.optional(v.string()),
    paginationOpts: paginationOptsValidator,
  },
  returns: v.object({
    page: v.array(
      v.object({
        _id: v.id("activity"),
        entity: activityEntityV,
        entityId: v.optional(v.string()),
        action: v.string(),
        summary: v.optional(v.string()),
        diff: v.optional(v.array(diffEntryV)),
        byName: v.optional(v.string()),
        at: v.number(),
      }),
    ),
    isDone: v.boolean(),
    continueCursor: v.string(),
  }),
  handler: async (ctx, args) => {
    await requireRole(ctx, MANAGERS);

    const result =
      args.entityId !== undefined
        ? await ctx.db
            .query("activity")
            .withIndex("by_entityId_and_at", (q) => q.eq("entityId", args.entityId!))
            .order("desc")
            .paginate(args.paginationOpts)
        : args.entity !== undefined
          ? await ctx.db
              .query("activity")
              .withIndex("by_entity_and_at", (q) => q.eq("entity", args.entity!))
              .order("desc")
              .paginate(args.paginationOpts)
          : await ctx.db
              .query("activity")
              .withIndex("by_at")
              .order("desc")
              .paginate(args.paginationOpts);

    const page = [];
    for (const row of result.page) {
      const user = row.by !== undefined ? await ctx.db.get("users", row.by) : null;
      page.push({
        _id: row._id,
        entity: row.entity,
        ...(row.entityId !== undefined ? { entityId: row.entityId } : {}),
        action: row.action,
        ...(row.summary !== undefined ? { summary: row.summary } : {}),
        ...(row.diff !== undefined ? { diff: row.diff } : {}),
        ...(user !== null
          ? { byName: user.name ?? user.email ?? "korisnik" }
          : { byName: "sistem" }),
        at: row.at,
      });
    }

    return { page, isDone: result.isDone, continueCursor: result.continueCursor };
  },
});
