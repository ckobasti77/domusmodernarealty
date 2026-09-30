import { v } from "convex/values";
import { mutation } from "./_generated/server";
import { requireRole } from "./lib/auth";
import { ALL_ROLES } from "./lib/validators";

/**
 * One upload URL for any signed-in staff member (covers, agent photos, the OG
 * image, the terms PDF). The URL alone links nothing: every mutation that
 * stores the resulting id re-checks the blob with `lib/storage.ts` and its own
 * role rule, so an editor can upload but still cannot attach a PDF to settings.
 */
export const generateUploadUrl = mutation({
  args: {},
  returns: v.string(),
  handler: async (ctx) => {
    await requireRole(ctx, ALL_ROLES);
    return await ctx.storage.generateUploadUrl();
  },
});
