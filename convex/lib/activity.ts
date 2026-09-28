import type { Infer } from "convex/values";
import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import type { activityEntityV, diffEntryV } from "./validators";

type ActivityEntity = Infer<typeof activityEntityV>;
type DiffEntry = Infer<typeof diffEntryV>;

type Primitive = string | number | boolean | null | undefined;

function stringify(value: unknown): string | undefined {
  if (value === undefined) return undefined;
  if (value === null) return "—";
  if (typeof value === "string") return value.slice(0, 200);
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return JSON.stringify(value).slice(0, 200);
}

/**
 * Field-level diff of two shallow record snapshots. Nested objects/arrays are
 * compared by their JSON form, which is enough for the admin change log.
 */
export function diffFields(
  before: Record<string, unknown>,
  after: Record<string, unknown>,
): DiffEntry[] {
  const entries: DiffEntry[] = [];
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  for (const key of keys) {
    if (key.startsWith("_")) continue;
    const from = stringify(before[key]);
    const to = stringify(after[key]);
    if (from !== to) entries.push({ field: key, from, to });
  }
  return entries;
}

/** Every admin mutation calls this. `by` is the acting user, when known. */
export async function logActivity(
  ctx: MutationCtx,
  args: {
    entity: ActivityEntity;
    entityId?: string;
    action: string;
    summary?: string;
    diff?: DiffEntry[];
    by?: Id<"users">;
  },
): Promise<void> {
  await ctx.db.insert("activity", {
    entity: args.entity,
    ...(args.entityId !== undefined ? { entityId: args.entityId } : {}),
    action: args.action,
    ...(args.summary !== undefined ? { summary: args.summary } : {}),
    ...(args.diff !== undefined && args.diff.length > 0 ? { diff: args.diff } : {}),
    ...(args.by !== undefined ? { by: args.by } : {}),
    at: Date.now(),
  });
}

export type { Primitive };
