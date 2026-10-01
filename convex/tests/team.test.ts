/// <reference types="vite/client" />
import { describe, expect, test } from "vitest";
import { api } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { testApp } from "../../tests/unit/convex-harness";
import { makeAgent, makeLocation, makeUser } from "./fixtures";

type T = ReturnType<typeof testApp>;

/** `makeUser` gives every role the same address; the team tests need distinct ones. */
async function makeStaff(
  ctx: MutationCtx,
  email: string,
  role: "admin" | "manager" | "agent" | "editor",
  agentId?: Id<"agents">,
): Promise<Id<"users">> {
  const id = await ctx.db.insert("users", {
    email,
    name: email.split("@")[0],
    role,
    status: "active",
    ...(agentId !== undefined ? { agentId } : {}),
  });
  if (agentId !== undefined) await ctx.db.patch("agents", agentId, { userId: id });
  return id;
}

/** One signed-in session with a refresh token, as `@convex-dev/auth` writes it. */
async function makeSession(ctx: MutationCtx, userId: Id<"users">): Promise<Id<"authSessions">> {
  const sessionId = await ctx.db.insert("authSessions", {
    userId,
    expirationTime: Date.now() + 86_400_000,
  });
  await ctx.db.insert("authRefreshTokens", {
    sessionId,
    expirationTime: Date.now() + 86_400_000,
  });
  return sessionId;
}

async function setup() {
  const t = testApp();
  const ids = await t.run(async (ctx) => {
    const city = await makeLocation(ctx, "beograd");
    const agentA = await makeAgent(ctx, "agent-a");
    const free = await makeAgent(ctx, "slobodan-profil");
    const admin = await makeUser(ctx, "admin");
    const manager = await makeUser(ctx, "manager");
    const editor = await makeUser(ctx, "editor");
    const agentUser = await makeStaff(ctx, "agent.a@test.local", "agent", agentA);
    return { city, agentA, free, admin, manager, editor, agentUser };
  });
  return { t, ids };
}

async function activity(t: T, action: string) {
  return await t.run(async (ctx) => {
    const rows = await ctx.db.query("activity").order("desc").take(50);
    return rows.filter((row) => row.action === action);
  });
}

describe("team: invites", () => {
  test("only an admin can create, renew and revoke invites", async () => {
    const { t, ids } = await setup();
    for (const who of [ids.manager, ids.editor, ids.agentUser]) {
      await expect(
        t.withIdentity({ subject: who }).mutation(api.invites.create, {
          email: "novi@test.local",
          role: "manager",
        }),
      ).rejects.toThrow(/FORBIDDEN/);
      await expect(t.withIdentity({ subject: who }).query(api.invites.list, {})).rejects.toThrow(
        /FORBIDDEN/,
      );
    }

    const asAdmin = t.withIdentity({ subject: ids.admin });
    const invite = await asAdmin.mutation(api.invites.create, {
      email: "Novi@Test.local",
      name: "Novi Menadžer",
      role: "manager",
    });
    const asManager = t.withIdentity({ subject: ids.manager });
    await expect(asManager.mutation(api.invites.renew, { id: invite.id })).rejects.toThrow(/FORBIDDEN/);
    await expect(asManager.mutation(api.invites.revoke, { id: invite.id })).rejects.toThrow(/FORBIDDEN/);

    const rows = await asAdmin.query(api.invites.list, {});
    expect(rows[0]).toMatchObject({ email: "novi@test.local", role: "manager", name: "Novi Menadžer" });
    expect(rows[0]).not.toHaveProperty("tokenHash");
    expect((await activity(t, "invite.created")).length).toBe(1);
  });

  test("an agent invite needs a profile; a new one is created hidden and linked", async () => {
    const { t, ids } = await setup();
    const asAdmin = t.withIdentity({ subject: ids.admin });

    await expect(
      asAdmin.mutation(api.invites.create, { email: "agent.b@test.local", role: "agent" }),
    ).rejects.toThrow(/profil/);

    const invite = await asAdmin.mutation(api.invites.create, {
      email: "agent.b@test.local",
      name: "Ana Babić",
      role: "agent",
      agentName: "Ana Babić",
    });
    expect(invite.agentId).toBeDefined();
    const stored = await t.run(async (ctx) => ({
      invite: await ctx.db.get("invites", invite.id),
      agent: invite.agentId !== undefined ? await ctx.db.get("agents", invite.agentId) : null,
    }));
    expect(stored.invite?.agentId).toBe(invite.agentId);
    expect(stored.agent).toMatchObject({ name: "Ana Babić", slug: "ana-babic", isPublic: false });
    expect(stored.agent?.userId).toBeUndefined();

    const check = await t.query(api.invites.checkToken, { token: invite.token, now: Date.now() });
    expect(check).toMatchObject({ valid: true, email: "agent.b@test.local" });
  });

  test("a linked profile or one promised to another address cannot be invited again", async () => {
    const { t, ids } = await setup();
    const asAdmin = t.withIdentity({ subject: ids.admin });

    await expect(
      asAdmin.mutation(api.invites.create, {
        email: "drugi@test.local",
        role: "agent",
        agentId: ids.agentA,
      }),
    ).rejects.toThrow(/već povezan/);

    await asAdmin.mutation(api.invites.create, { email: "prvi@test.local", role: "agent", agentId: ids.free });
    await expect(
      asAdmin.mutation(api.invites.create, { email: "drugi@test.local", role: "agent", agentId: ids.free }),
    ).rejects.toThrow(/otvorena pozivnica/);
    // The same address may be re-invited: the older link is superseded.
    const again = await asAdmin.mutation(api.invites.create, {
      email: "prvi@test.local",
      role: "agent",
      agentId: ids.free,
    });
    const open = (await asAdmin.query(api.invites.list, {})).filter(
      (row) => row.email === "prvi@test.local" && row.revokedAt === undefined,
    );
    expect(open.map((row) => row._id)).toEqual([again.id]);
  });

  test("renew issues a new link, the old one stops working, revoke closes it", async () => {
    const { t, ids } = await setup();
    const asAdmin = t.withIdentity({ subject: ids.admin });
    const invite = await asAdmin.mutation(api.invites.create, { email: "novi@test.local", role: "editor" });
    const renewed = await asAdmin.mutation(api.invites.renew, { id: invite.id });
    expect(renewed.token).not.toBe(invite.token);

    const now = Date.now();
    expect(await t.query(api.invites.checkToken, { token: invite.token, now })).toMatchObject({ valid: false });
    expect(await t.query(api.invites.checkToken, { token: renewed.token, now })).toMatchObject({ valid: true });

    await asAdmin.mutation(api.invites.revoke, { id: invite.id });
    expect(await t.query(api.invites.checkToken, { token: renewed.token, now })).toMatchObject({ valid: false });
    await expect(asAdmin.mutation(api.invites.renew, { id: invite.id })).rejects.toThrow(/opozvana/);
    expect((await activity(t, "invite.renewed")).length).toBe(1);
    expect((await activity(t, "invite.revoked")).length).toBe(1);
  });
});

describe("team: roles and status", () => {
  test("only an admin changes roles; the change is logged with a diff", async () => {
    const { t, ids } = await setup();
    await expect(
      t.withIdentity({ subject: ids.manager }).mutation(api.users.setRole, { id: ids.editor, role: "manager" }),
    ).rejects.toThrow(/FORBIDDEN/);
    await expect(t.withIdentity({ subject: ids.manager }).query(api.users.list, {})).rejects.toThrow(/FORBIDDEN/);

    const asAdmin = t.withIdentity({ subject: ids.admin });
    await asAdmin.mutation(api.users.setRole, { id: ids.editor, role: "manager" });
    const [row] = await activity(t, "user.role");
    expect(row.entityId).toBe(ids.editor);
    expect(row.diff).toEqual([{ field: "role", from: "Urednik", to: "Menadžer" }]);
  });

  test("the last active admin can be neither demoted nor deactivated", async () => {
    const { t, ids } = await setup();
    const asAdmin = t.withIdentity({ subject: ids.admin });
    await expect(asAdmin.mutation(api.users.setRole, { id: ids.admin, role: "manager" })).rejects.toThrow(
      /jedini aktivni administrator/,
    );
    await expect(asAdmin.mutation(api.users.setStatus, { id: ids.admin, status: "disabled" })).rejects.toThrow(
      /FORBIDDEN/,
    );

    // A disabled second admin does not count.
    const second = await t.run(async (ctx) => {
      const id = await makeStaff(ctx, "drugi.admin@test.local", "admin");
      await ctx.db.patch("users", id, { status: "disabled" });
      return id;
    });
    await expect(asAdmin.mutation(api.users.setRole, { id: ids.admin, role: "manager" })).rejects.toThrow(
      /jedini aktivni administrator/,
    );

    // Once there is another active admin, the first may step down.
    await asAdmin.mutation(api.users.setStatus, { id: second, status: "active" });
    await asAdmin.mutation(api.users.setRole, { id: ids.admin, role: "manager" });
    const asSecond = t.withIdentity({ subject: second });
    await expect(asSecond.mutation(api.users.setStatus, { id: second, status: "disabled" })).rejects.toThrow(
      /FORBIDDEN/,
    );
    await expect(asSecond.mutation(api.users.setRole, { id: second, role: "editor" })).rejects.toThrow(
      /jedini aktivni administrator/,
    );
  });

  test("deactivation ends the account's sessions and blocks the panel", async () => {
    const { t, ids } = await setup();
    await t.run(async (ctx) => {
      await makeSession(ctx, ids.agentUser);
      await makeSession(ctx, ids.agentUser);
    });
    const asAdmin = t.withIdentity({ subject: ids.admin });
    const before = await asAdmin.query(api.users.list, {});
    expect(before.find((row) => row._id === ids.agentUser)?.lastSeenAt).toBeTypeOf("number");

    await asAdmin.mutation(api.users.setStatus, { id: ids.agentUser, status: "disabled" });
    const left = await t.run(async (ctx) => ({
      sessions: await ctx.db
        .query("authSessions")
        .withIndex("userId", (q) => q.eq("userId", ids.agentUser))
        .take(10),
      tokens: await ctx.db.query("authRefreshTokens").take(10),
    }));
    expect(left).toEqual({ sessions: [], tokens: [] });
    await expect(
      t.withIdentity({ subject: ids.agentUser }).query(api.agentsAdmin.list, {}),
    ).rejects.toThrow(/FORBIDDEN/);

    const [row] = await activity(t, "user.status");
    expect(row.diff).toEqual([{ field: "status", from: "Aktivan", to: "Deaktiviran" }]);
  });

  test("an agent account keeps a profile: no demotion to agent without one, no unlinking", async () => {
    const { t, ids } = await setup();
    const asAdmin = t.withIdentity({ subject: ids.admin });
    await expect(asAdmin.mutation(api.users.setRole, { id: ids.editor, role: "agent" })).rejects.toThrow(
      /profilom agenta/,
    );
    await expect(asAdmin.mutation(api.users.linkAgent, { id: ids.agentUser })).rejects.toThrow(/mora imati profil/);
    await expect(
      asAdmin.mutation(api.users.linkAgent, { id: ids.editor, agentId: ids.agentA }),
    ).rejects.toThrow(/već povezan/);

    await asAdmin.mutation(api.users.linkAgent, { id: ids.agentUser, agentId: ids.free });
    const after = await t.run(async (ctx) => ({
      user: await ctx.db.get("users", ids.agentUser),
      old: await ctx.db.get("agents", ids.agentA),
      next: await ctx.db.get("agents", ids.free),
    }));
    expect(after.user?.agentId).toBe(ids.free);
    expect(after.old?.userId).toBeUndefined();
    expect(after.next?.userId).toBe(ids.agentUser);
  });
});

describe("team: agent profiles", () => {
  test("a manager edits a profile (logged with a field diff); an agent or editor cannot", async () => {
    const { t, ids } = await setup();
    const base = {
      id: ids.agentA,
      name: "Agent A",
      role: { sr: "Viši agent", en: "Senior Agent" },
      languages: ["sr", "EN", "it"],
      areas: [ids.city],
      isPublic: true,
      phone: "+381 64 123 4567",
    };
    for (const who of [ids.agentUser, ids.editor]) {
      await expect(t.withIdentity({ subject: who }).mutation(api.agentsAdmin.upsert, base)).rejects.toThrow(
        /FORBIDDEN/,
      );
    }

    const asManager = t.withIdentity({ subject: ids.manager });
    const saved = await asManager.mutation(api.agentsAdmin.upsert, base);
    // A rename keeps the public address.
    expect(saved.slug).toBe("agent-a");
    const doc = await t.run(async (ctx) => ctx.db.get("agents", ids.agentA));
    expect(doc?.languages).toEqual(["sr", "en", "it"]);

    const [row] = await activity(t, "agent.updated");
    expect(row.by).toBe(ids.manager);
    expect(row.diff?.map((entry) => entry.field)).toEqual(
      expect.arrayContaining(["name", "role", "languages", "phone", "areas"]),
    );

    await expect(
      asManager.mutation(api.agentsAdmin.upsert, { ...base, languages: ["Italijanski"] }),
    ).rejects.toThrow(/kod jezika/);
    await expect(
      asManager.mutation(api.agentsAdmin.upsert, { ...base, photo: { kind: "url", url: "https://example.com/face.jpg" } }),
    ).rejects.toThrow(/nije dozvoljena/);
    await expect(
      asManager.mutation(api.agentsAdmin.upsert, { ...base, slug: "slobodan-profil" }),
    ).rejects.toThrow(/zauzeta/);
  });

  test("a new profile goes to the end of the order; reorder is manager-only", async () => {
    const { t, ids } = await setup();
    const asManager = t.withIdentity({ subject: ids.manager });
    const created = await asManager.mutation(api.agentsAdmin.upsert, {
      name: "Novi Agent",
      role: { sr: "Agent" },
      languages: ["sr"],
      areas: [],
      isPublic: false,
    });
    const rows = await asManager.query(api.agentsAdmin.list, {});
    expect(rows[rows.length - 1]._id).toBe(created.id);

    await expect(
      t.withIdentity({ subject: ids.agentUser }).mutation(api.agentsAdmin.reorder, { ids: [created.id] }),
    ).rejects.toThrow(/FORBIDDEN/);
    await asManager.mutation(api.agentsAdmin.reorder, { ids: [created.id, ids.free, ids.agentA] });
    const order = (await asManager.query(api.agentsAdmin.list, {})).map((row) => row._id);
    expect(order).toEqual([created.id, ids.free, ids.agentA]);
  });

  test("weekly slots: strict HH:MM on a 15-minute grid, weekday 0–6, no overlaps, own profile only", async () => {
    const { t, ids } = await setup();
    const asAgent = t.withIdentity({ subject: ids.agentUser });
    await asAgent.mutation(api.agentsAdmin.setAvailability, {
      id: ids.agentA,
      availability: [
        { weekday: 2, from: "13:00", to: "17:00" },
        { weekday: 2, from: "09:00", to: "12:00" },
        { weekday: 0, from: "10:15", to: "12:45" },
      ],
    });
    const doc = await t.run(async (ctx) => ctx.db.get("agents", ids.agentA));
    // Stored sorted by weekday, then start.
    expect(doc?.availability).toEqual([
      { weekday: 0, from: "10:15", to: "12:45" },
      { weekday: 2, from: "09:00", to: "12:00" },
      { weekday: 2, from: "13:00", to: "17:00" },
    ]);
    expect((await activity(t, "agent.availability")).length).toBe(1);

    const refused: [string, { weekday: number; from: string; to: string }[], RegExp][] = [
      // "9:00" sorts after "10:00" as a string: only zero-padded times are accepted.
      ["unpadded hour", [{ weekday: 1, from: "9:00", to: "10:00" }], /dve cifre/],
      ["hour 24", [{ weekday: 1, from: "23:00", to: "24:00" }], /dve cifre/],
      ["off the grid", [{ weekday: 1, from: "09:10", to: "10:00" }], /15 minuta/],
      ["weekday 7", [{ weekday: 7, from: "09:00", to: "10:00" }], /0–6/],
      ["fractional weekday", [{ weekday: 1.5, from: "09:00", to: "10:00" }], /0–6/],
      ["end before start", [{ weekday: 1, from: "12:00", to: "09:00" }], /posle početka/],
      ["empty range", [{ weekday: 1, from: "12:00", to: "12:00" }], /posle početka/],
      [
        "overlap",
        [
          { weekday: 1, from: "09:00", to: "12:00" },
          { weekday: 1, from: "11:00", to: "15:00" },
        ],
        /preklapaju/,
      ],
      [
        "too many",
        Array.from({ length: 41 }, (_, index) => ({
          weekday: index % 7,
          from: `${String(index % 20).padStart(2, "0")}:00`,
          to: `${String((index % 20) + 1).padStart(2, "0")}:00`,
        })),
        /Najviše 40/,
      ],
    ];
    for (const [label, availability, message] of refused) {
      await expect(
        asAgent.mutation(api.agentsAdmin.setAvailability, { id: ids.agentA, availability }),
        label,
      ).rejects.toThrow(message);
    }
    // Back-to-back ranges touch but do not overlap.
    await asAgent.mutation(api.agentsAdmin.setAvailability, {
      id: ids.agentA,
      availability: [
        { weekday: 3, from: "09:00", to: "12:00" },
        { weekday: 3, from: "12:00", to: "15:00" },
      ],
    });

    await expect(
      asAgent.mutation(api.agentsAdmin.setAvailability, { id: ids.free, availability: [] }),
    ).rejects.toThrow(/FORBIDDEN/);
    await expect(
      t.withIdentity({ subject: ids.editor }).mutation(api.agentsAdmin.setAvailability, { id: ids.agentA, availability: [] }),
    ).rejects.toThrow(/FORBIDDEN/);
    // A manager may set anyone's hours.
    await t.withIdentity({ subject: ids.manager }).mutation(api.agentsAdmin.setAvailability, {
      id: ids.free,
      availability: [{ weekday: 1, from: "08:00", to: "16:00" }],
    });
  });

  test("a profile linked to an active account is not deleted; a free one is, with its open invites", async () => {
    const { t, ids } = await setup();
    const asAdmin = t.withIdentity({ subject: ids.admin });
    await expect(asAdmin.mutation(api.agentsAdmin.remove, { id: ids.agentA })).rejects.toThrow(/aktivnim nalogom/);

    const invite = await asAdmin.mutation(api.invites.create, { email: "neko@test.local", role: "agent", agentId: ids.free });
    await asAdmin.mutation(api.agentsAdmin.remove, { id: ids.free });
    expect(await t.query(api.invites.checkToken, { token: invite.token, now: Date.now() })).toMatchObject({
      valid: false,
    });
    expect((await activity(t, "agent.deleted")).length).toBe(1);
  });
});
