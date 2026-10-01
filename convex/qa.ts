import { v } from "convex/values";
import { internalMutation, internalQuery } from "./_generated/server";
import { deleteListingCascade } from "./lib/listingCascade";
import { leadTypeV, leadStatusV, pageBlockV, pageKeyV, viewingModeV, viewingStatusV } from "./lib/validators";

/**
 * Test-only helpers for the Playwright suite. Both are INTERNAL, so no browser
 * can call them; the e2e specs reach them through `npx convex run qa:<fn>`
 * against the dev deployment only.
 *
 * They only ever touch contacts whose address matches `E2E_EMAIL`, so a typo in
 * a spec cannot read or delete a real client.
 */
const E2E_EMAIL = /^e2e\+[a-z0-9-]{4,64}@mihajlo-estate\.local$/;

function assertE2EEmail(email: string): void {
  if (!E2E_EMAIL.test(email)) throw new Error(`Not an e2e address: ${email}`);
}

export const leadsByEmail = internalQuery({
  args: { email: v.string() },
  returns: v.array(
    v.object({
      leadId: v.id("leads"),
      type: leadTypeV,
      status: leadStatusV,
      listingId: v.optional(v.id("listings")),
      message: v.optional(v.string()),
      marketing: v.boolean(),
      viewing: v.union(
        v.null(),
        v.object({
          viewingId: v.id("viewings"),
          status: viewingStatusV,
          mode: viewingModeV,
          start: v.number(),
          end: v.number(),
        }),
      ),
    }),
  ),
  handler: async (ctx, args) => {
    assertE2EEmail(args.email);
    const contact = await ctx.db
      .query("contacts")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .first();
    if (contact === null) return [];

    const leads = await ctx.db
      .query("leads")
      .withIndex("by_contactId", (q) => q.eq("contactId", contact._id))
      .take(20);

    const out = [];
    for (const lead of leads) {
      const viewing =
        lead.type === "viewing" && lead.listingId !== undefined
          ? await ctx.db
              .query("viewings")
              .withIndex("by_listingId_and_start", (q) => q.eq("listingId", lead.listingId!))
              .order("desc")
              .take(50)
              .then((rows) => rows.find((row) => row.leadId === lead._id) ?? null)
          : null;
      out.push({
        leadId: lead._id,
        type: lead.type,
        status: lead.status,
        ...(lead.listingId !== undefined ? { listingId: lead.listingId } : {}),
        ...(lead.message !== undefined ? { message: lead.message } : {}),
        marketing: lead.consent.marketing,
        viewing:
          viewing === null
            ? null
            : {
                viewingId: viewing._id,
                status: viewing.status,
                mode: viewing.mode,
                start: viewing.start,
                end: viewing.end,
              },
      });
    }
    return out;
  },
});

/** Removes everything an e2e run created for one address. */
export const purgeByEmail = internalMutation({
  args: { email: v.string() },
  returns: v.object({ contacts: v.number(), leads: v.number(), viewings: v.number() }),
  handler: async (ctx, args) => {
    assertE2EEmail(args.email);
    const contacts = await ctx.db
      .query("contacts")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .take(10);

    let leads = 0;
    let viewings = 0;
    for (const contact of contacts) {
      const rows = await ctx.db
        .query("leads")
        .withIndex("by_contactId", (q) => q.eq("contactId", contact._id))
        .take(50);
      for (const lead of rows) {
        if (lead.listingId !== undefined) {
          const linked = await ctx.db
            .query("viewings")
            .withIndex("by_listingId_and_start", (q) => q.eq("listingId", lead.listingId!))
            .take(200);
          for (const viewing of linked) {
            if (viewing.leadId !== lead._id) continue;
            await ctx.db.delete("viewings", viewing._id);
            viewings += 1;
          }
        }
        await ctx.db.delete("leads", lead._id);
        leads += 1;
      }
      await ctx.db.delete("contacts", contact._id);
    }
    return { contacts: contacts.length, leads, viewings };
  },
});

/** Old-slug fixtures for the redirect test; only `e2e-…` slugs are accepted. */
const E2E_SLUG = /^e2e-[a-z0-9-]{4,64}$/;

export const addSlugRedirect = internalMutation({
  args: { from: v.string(), toSlug: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    if (!E2E_SLUG.test(args.from)) throw new Error(`Not an e2e slug: ${args.from}`);
    const target = await ctx.db
      .query("listings")
      .withIndex("by_slug", (q) => q.eq("slug", args.toSlug))
      .unique();
    if (target === null) throw new Error(`No listing ${args.toSlug}`);
    await ctx.db.insert("slugRedirects", { from: args.from, listingId: target._id, at: Date.now() });
    return null;
  },
});

export const removeSlugRedirect = internalMutation({
  args: { from: v.string() },
  returns: v.number(),
  handler: async (ctx, args) => {
    if (!E2E_SLUG.test(args.from)) throw new Error(`Not an e2e slug: ${args.from}`);
    const rows = await ctx.db
      .query("slugRedirects")
      .withIndex("by_from", (q) => q.eq("from", args.from))
      .take(10);
    for (const row of rows) await ctx.db.delete("slugRedirects", row._id);
    return rows.length;
  },
});

/**
 * How many view rows one browser session left on a listing, for the "one view
 * per session" e2e case. Session keys are random tokens that identify nobody.
 */
export const viewsForSession = internalQuery({
  args: { slug: v.string(), sessionKey: v.string() },
  returns: v.number(),
  handler: async (ctx, args) => {
    const listing = await ctx.db
      .query("listings")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .unique();
    if (listing === null) throw new Error(`No listing ${args.slug}`);
    const rows = await ctx.db
      .query("listingViews")
      .withIndex("by_listingId_and_sessionKey", (q) =>
        q.eq("listingId", listing._id).eq("sessionKey", args.sessionKey),
      )
      .take(10);
    return rows.length;
  },
});

/**
 * Removes an e2e staff account (created through a real invite by the admin
 * spec) and everything Convex Auth hung off it, plus the throwaway agent
 * profile it was linked to. Only `e2e+…@mihajlo-estate.local` addresses.
 */
export const purgeE2EUser = internalMutation({
  args: { email: v.string() },
  returns: v.object({ users: v.number(), invites: v.number(), agents: v.number() }),
  handler: async (ctx, args) => {
    assertE2EEmail(args.email);
    let users = 0;
    let agents = 0;
    const rows = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .take(5);
    for (const user of rows) {
      const accounts = await ctx.db
        .query("authAccounts")
        .withIndex("userIdAndProvider", (q) => q.eq("userId", user._id))
        .take(10);
      for (const account of accounts) {
        const codes = await ctx.db
          .query("authVerificationCodes")
          .withIndex("accountId", (q) => q.eq("accountId", account._id))
          .take(20);
        for (const code of codes) await ctx.db.delete("authVerificationCodes", code._id);
        await ctx.db.delete("authAccounts", account._id);
      }
      const sessions = await ctx.db
        .query("authSessions")
        .withIndex("userId", (q) => q.eq("userId", user._id))
        .take(50);
      for (const session of sessions) {
        const tokens = await ctx.db
          .query("authRefreshTokens")
          .withIndex("sessionId", (q) => q.eq("sessionId", session._id))
          .take(100);
        for (const token of tokens) await ctx.db.delete("authRefreshTokens", token._id);
        await ctx.db.delete("authSessions", session._id);
      }
      if (user.agentId !== undefined) {
        const agent = await ctx.db.get("agents", user.agentId);
        if (agent !== null && agent.name.startsWith("E2E ")) {
          const owned = await ctx.db
            .query("listings")
            .withIndex("by_agentId", (q) => q.eq("agentId", agent._id))
            .take(1);
          if (owned.length === 0) {
            await ctx.db.delete("agents", agent._id);
            agents += 1;
          }
        } else if (agent !== null && agent.userId === user._id) {
          await ctx.db.patch("agents", agent._id, { userId: undefined });
        }
      }
      await ctx.db.delete("users", user._id);
      users += 1;
    }
    const invites = await ctx.db
      .query("invites")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .take(20);
    for (const invite of invites) {
      // A profile created together with an invite that was never accepted has
      // no user to reach it through; remove it when it is an unused e2e one.
      if (invite.agentId !== undefined) {
        const agent = await ctx.db.get("agents", invite.agentId);
        if (agent !== null && agent.name.startsWith("E2E ") && agent.userId === undefined) {
          const owned = await ctx.db
            .query("listings")
            .withIndex("by_agentId", (q) => q.eq("agentId", agent._id))
            .take(1);
          if (owned.length === 0) {
            await ctx.db.delete("agents", agent._id);
            agents += 1;
          }
        }
      }
      await ctx.db.delete("invites", invite._id);
    }
    return { users, invites: invites.length, agents };
  },
});

/** Titles of listings the admin spec creates start with this marker. */
const E2E_TITLE = "[E2E]";

/** Deletes every non-demo listing whose Serbian title starts with "[E2E]". */
export const purgeE2EListings = internalMutation({
  args: {},
  returns: v.number(),
  handler: async (ctx) => {
    let removed = 0;
    for (const status of ["draft", "review", "published", "reserved", "sold", "rented", "withdrawn", "archived"] as const) {
      const rows = await ctx.db
        .query("listings")
        .withIndex("by_status_and_updatedAt", (q) => q.eq("status", status))
        .order("desc")
        .take(200);
      for (const doc of rows) {
        if (doc.isDemo || !doc.title.sr.startsWith(E2E_TITLE)) continue;
        await deleteListingCascade(ctx, doc);
        removed += 1;
      }
    }
    return removed;
  },
});

/** Deletes every non-demo journal post whose Serbian title starts with "[E2E]". */
export const purgeE2EPosts = internalMutation({
  args: {},
  returns: v.number(),
  handler: async (ctx) => {
    const rows = await ctx.db
      .query("posts")
      .withIndex("by_isDemo", (q) => q.eq("isDemo", false))
      .take(200);
    let removed = 0;
    for (const doc of rows) {
      if (!doc.title.sr.startsWith(E2E_TITLE)) continue;
      if (doc.cover?.kind === "storage") await ctx.storage.delete(doc.cover.storageId);
      await ctx.db.delete("posts", doc._id);
      removed += 1;
    }
    return removed;
  },
});

/**
 * The site-content e2e edits the live home page through the admin UI; these
 * two put the page back exactly as it was (blocks AND the demo flag, which an
 * editor's save clears).
 */
export const pageSnapshot = internalQuery({
  args: { key: pageKeyV },
  returns: v.union(v.null(), v.object({ blocks: v.array(pageBlockV), isDemo: v.boolean() })),
  handler: async (ctx, args) => {
    const doc = await ctx.db
      .query("pages")
      .withIndex("by_key", (q) => q.eq("key", args.key))
      .unique();
    return doc === null ? null : { blocks: doc.blocks, isDemo: doc.isDemo };
  },
});

export const restorePage = internalMutation({
  args: { key: pageKeyV, blocks: v.array(pageBlockV), isDemo: v.boolean() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const doc = await ctx.db
      .query("pages")
      .withIndex("by_key", (q) => q.eq("key", args.key))
      .unique();
    if (doc === null) throw new Error(`No page with key ${args.key}`);
    await ctx.db.patch("pages", doc._id, { blocks: args.blocks, isDemo: args.isDemo });
    return null;
  },
});
