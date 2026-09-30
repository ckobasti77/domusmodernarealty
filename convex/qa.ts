import { v } from "convex/values";
import { internalMutation, internalQuery } from "./_generated/server";
import { leadTypeV, leadStatusV, viewingModeV, viewingStatusV } from "./lib/validators";

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
