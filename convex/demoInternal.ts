import { v } from "convex/values";
import { internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";
import { logActivity } from "./lib/activity";
import { DEMO_TABLES, purgeDemoTable } from "./demo";

const BATCH = 40;

/**
 * Walks `DEMO_TABLES` in order, deleting up to `BATCH` rows per transaction and
 * rescheduling itself. Listings go first so their child rows are cleaned before
 * the locations and agents they point at.
 */
export const purgeBatch = internalMutation({
  args: { tableIndex: v.number(), by: v.optional(v.id("users")) },
  returns: v.null(),
  handler: async (ctx, args) => {
    if (args.tableIndex >= DEMO_TABLES.length) {
      await logActivity(ctx, {
        entity: "demo",
        action: "demo.purge.finished",
        ...(args.by !== undefined ? { by: args.by } : {}),
      });
      return null;
    }

    const table = DEMO_TABLES[args.tableIndex];
    const removed = await purgeDemoTable(ctx, table, BATCH);

    await ctx.scheduler.runAfter(0, internal.demoInternal.purgeBatch, {
      tableIndex: removed === BATCH ? args.tableIndex : args.tableIndex + 1,
      ...(args.by !== undefined ? { by: args.by } : {}),
    });
    return null;
  },
});
