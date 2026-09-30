import { getAuthUserId } from "@convex-dev/auth/server";
import type { Doc } from "../_generated/dataModel";
import { internal } from "../_generated/api";
import type { ActionCtx, MutationCtx, QueryCtx } from "../_generated/server";
import { forbidden, unauthenticated } from "./errors";
import type { Role } from "./validators";

export type Viewer = Doc<"users">;

/** The signed-in user, or null. Never throws. */
export async function getViewer(ctx: QueryCtx): Promise<Viewer | null> {
  const userId = await getAuthUserId(ctx);
  if (userId === null) return null;
  return await ctx.db.get("users", userId);
}

/** The signed-in, non-disabled user. Throws UNAUTHENTICATED / FORBIDDEN. */
export async function requireUser(ctx: QueryCtx): Promise<Viewer> {
  const viewer = await getViewer(ctx);
  if (viewer === null) unauthenticated();
  if (viewer.status === "disabled") forbidden("pristup panelu");
  return viewer;
}

/**
 * The security boundary for every admin function. Call it first, before any
 * read or write.
 */
export async function requireRole(
  ctx: QueryCtx,
  roles: readonly Role[],
): Promise<Viewer> {
  const viewer = await requireUser(ctx);
  if (!roles.includes(viewer.role)) forbidden("ovu radnju");
  return viewer;
}

/** True when the viewer is bound to this agent profile. */
export function isOwnAgent(viewer: Viewer, agentId: Doc<"agents">["_id"]): boolean {
  return viewer.agentId !== undefined && viewer.agentId === agentId;
}

/**
 * Agents may only touch their own listings; admin and manager may touch any.
 * Editors never edit listings.
 */
export function assertCanEditListing(
  viewer: Viewer,
  listing: Pick<Doc<"listings">, "agentId">,
): void {
  if (viewer.role === "admin" || viewer.role === "manager") return;
  if (viewer.role === "agent" && isOwnAgent(viewer, listing.agentId)) return;
  forbidden("izmenu ove nekretnine");
}

/** Same rule for leads and viewings. */
export function assertCanEditAssignment(
  viewer: Viewer,
  doc: { agentId?: Doc<"agents">["_id"] },
): void {
  if (viewer.role === "admin" || viewer.role === "manager") return;
  if (
    viewer.role === "agent" &&
    doc.agentId !== undefined &&
    isOwnAgent(viewer, doc.agentId)
  ) {
    return;
  }
  forbidden("izmenu ovog zapisa");
}

/** Narrowing helper so mutation-only helpers can demand a MutationCtx. */
export async function requireRoleMutation(
  ctx: MutationCtx,
  roles: readonly Role[],
): Promise<Viewer> {
  return await requireRole(ctx, roles);
}

/** `requireRole` for actions, which cannot read the database directly. */
export async function requireRoleAction(
  ctx: ActionCtx,
  roles: readonly Role[],
): Promise<{ _id: Doc<"users">["_id"]; role: Role }> {
  const viewer = await ctx.runQuery(internal.users.viewerForAction, {});
  if (viewer === null) unauthenticated();
  if (viewer.status === "disabled") forbidden("pristup panelu");
  if (!roles.includes(viewer.role)) forbidden("ovu radnju");
  return { _id: viewer._id, role: viewer.role };
}
