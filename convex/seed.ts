"use node";

/**
 * Idempotent demo seed.
 *
 * `seed:all` is the entry point; it runs each stage as its own transaction so the
 * 30 listings (≈9 media items each) never hit a transaction limit. `force: true`
 * removes ONLY `isDemo` records first — real data is never touched.
 *
 * This file is a Node action module (it needs `createAccount` from
 * `@convex-dev/auth/server` for the admin bootstrap), so every database write
 * lives in `convex/seedStages.ts`.
 */
import { createAccount } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { internalAction } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { hashToken, randomToken } from "./lib/tokens";
import { roleV } from "./lib/validators";
import type { Role } from "./lib/validators";

const LISTING_BATCH = 5;

type SeedSummary = {
  locations: number;
  agents: number;
  listings: number;
  posts: number;
  pages: number;
  testimonials: number;
  leads: number;
  viewings: number;
  scenes: number;
  skipped: boolean;
};

type CreateAdminResult = {
  created: boolean;
  userId?: Id<"users">;
  message: string;
};

export const all = internalAction({
  args: { force: v.optional(v.boolean()) },
  returns: v.object({
    locations: v.number(),
    agents: v.number(),
    listings: v.number(),
    posts: v.number(),
    pages: v.number(),
    testimonials: v.number(),
    leads: v.number(),
    viewings: v.number(),
    scenes: v.number(),
    skipped: v.boolean(),
  }),
  handler: async (ctx, args): Promise<SeedSummary> => {
    const state = await ctx.runQuery(internal.seedStages.status, {});
    if (state.hasDemoListings && args.force !== true) {
      console.log("seed: demo data already present — pass {\"force\":true} to reseed");
      return { ...EMPTY, skipped: true };
    }

    if (args.force === true) {
      let guard = 0;
      for (;;) {
        const { remaining } = await ctx.runMutation(internal.seedStages.purgeDemo, {});
        guard += 1;
        if (remaining === 0 || guard > 60) break;
      }
      console.log("seed: demo data cleared");
    }

    await ctx.runMutation(internal.seedStages.seedSettings, {});
    const locations = await ctx.runMutation(internal.seedStages.seedLocations, {});
    const agents = await ctx.runMutation(internal.seedStages.seedAgents, {});
    const content = await ctx.runMutation(internal.seedStages.seedContent, {});

    let listings = 0;
    let scenes = 0;
    for (let from = 0; from < 30; from += LISTING_BATCH) {
      const result = await ctx.runMutation(internal.seedStages.seedListings, {
        from,
        count: LISTING_BATCH,
      });
      listings += result.listings;
      scenes += result.scenes;
      if (result.listings === 0) break;
    }

    const crm = await ctx.runMutation(internal.seedStages.seedCrm, {});
    await ctx.runMutation(internal.listingsInternal.rebuildLocationCounts, {});

    const summary = {
      locations: locations.created,
      agents: agents.created,
      listings,
      posts: content.posts,
      pages: content.pages,
      testimonials: content.testimonials,
      leads: crm.leads,
      viewings: crm.viewings,
      scenes,
      skipped: false,
    };
    console.log("seed: done", JSON.stringify(summary));
    return summary;
  },
});

const EMPTY = {
  locations: 0,
  agents: 0,
  listings: 0,
  posts: 0,
  pages: 0,
  testimonials: 0,
  leads: 0,
  viewings: 0,
  scenes: 0,
};

/**
 * Admin bootstrap. It first writes an invite for the address, then creates the
 * account — so the invite-only gate in `convex/auth.ts` has exactly one code
 * path and there is no "first user is free" hole.
 *
 * Run it without the password ever touching a file:
 *   node -e "const a=require('./night-run/state/admin.json');process.stdout.write(JSON.stringify(a))" \
 *     | xargs -0 npx convex run seed:createAdmin
 */
export const createAdmin = internalAction({
  args: {
    email: v.string(),
    password: v.string(),
    name: v.optional(v.string()),
    role: v.optional(roleV),
  },
  returns: v.object({
    created: v.boolean(),
    userId: v.optional(v.id("users")),
    message: v.string(),
  }),
  handler: async (ctx, args): Promise<CreateAdminResult> => {
    const email = args.email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new Error("createAdmin: invalid email");
    }
    if (args.password.length < 12) {
      throw new Error("createAdmin: password must be at least 12 characters");
    }

    const existing = await ctx.runQuery(internal.seedStages.userByEmail, { email });
    if (existing !== null) {
      return {
        created: false,
        userId: existing,
        message: `user ${email} already exists`,
      };
    }

    const role: Role = args.role ?? "admin";

    // `createOrUpdateUser` verifies the invite TOKEN, so the bootstrap mints one
    // and hands it over the same way the acceptance page will. If `createAccount`
    // throws, the invite is revoked instead of sitting open.
    const token = randomToken();
    const inviteId = await ctx.runMutation(internal.seedStages.bootstrapInvite, {
      email,
      role,
      tokenHash: await hashToken(token),
    });

    let userId: Id<"users">;
    try {
      const { user } = await createAccount(ctx, {
        provider: "password",
        account: { id: email, secret: args.password },
        profile: {
          email,
          name: args.name ?? "Administrator",
          role,
          status: "active",
          pendingInviteToken: token,
        },
      });
      userId = user._id as Id<"users">;
    } catch (error) {
      await ctx.runMutation(internal.seedStages.revokeInvite, { id: inviteId });
      throw error;
    }

    return { created: true, userId, message: `created ${role} ${email}` };
  },
});
