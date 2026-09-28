/**
 * Proves the real Convex Auth round-trip against the DEV deployment:
 *   1. an anonymous admin query and an anonymous admin mutation are rejected;
 *   2. signIn("password", { flow: "signIn" }) returns a JWT;
 *   3. that JWT lets an admin query through and reports the right role;
 *   4. the public queries answer without any auth.
 *
 * Credentials come from night-run/state/admin.json (gitignored) and are never
 * printed. Run: node scripts/check-auth.mjs
 */
import { readFileSync } from "node:fs";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api.js";

const url = readFileSync(".env.local", "utf8")
  .split(/\r?\n/)
  .find((line) => line.startsWith("NEXT_PUBLIC_CONVEX_URL="))
  ?.split("=")[1]
  ?.trim();
if (!url) throw new Error("NEXT_PUBLIC_CONVEX_URL missing from .env.local");

const admin = JSON.parse(readFileSync("night-run/state/admin.json", "utf8"));

let failures = 0;
function ok(label, detail = "") {
  console.log(`  PASS  ${label}${detail ? ` — ${detail}` : ""}`);
}
function fail(label, detail) {
  failures += 1;
  console.log(`  FAIL  ${label} — ${detail}`);
}

console.log(`deployment: ${url}\n`);
console.log("1. anonymous access");

const anon = new ConvexHttpClient(url);

try {
  await anon.query(api.users.getMe, {});
  ok("users.getMe returns null when anonymous");
} catch (error) {
  fail("users.getMe should not throw", String(error).slice(0, 160));
}

for (const [label, run] of [
  ["listingsAdmin.list", () => anon.query(api.listingsAdmin.list, { paginationOpts: { cursor: null, numItems: 5 } })],
  ["settingsAdmin.get", () => anon.query(api.settingsAdmin.get, {})],
  ["media.generateUploadUrl (mutation)", () => anon.mutation(api.media.generateUploadUrl, {})],
  ["invites.create (mutation)", () => anon.mutation(api.invites.create, { email: "intruder@example.com", role: "admin" })],
  ["demo.purge (mutation)", () => anon.mutation(api.demo.purge, { confirm: "OBRIŠI DEMO" })],
]) {
  try {
    await run();
    fail(`${label} must reject anonymous callers`, "it returned a result");
  } catch (error) {
    const message = String(error);
    if (/UNAUTHENTICATED|Niste prijavljeni/.test(message)) {
      ok(`${label} rejected`, "UNAUTHENTICATED");
    } else {
      fail(`${label} rejected with the wrong error`, message.slice(0, 200));
    }
  }
}

console.log("\n2. public queries need no auth");
const settings = await anon.query(api.settings.publicSettings, {});
ok("settings.publicSettings", `${settings?.companyName}, registry ${settings?.registryNo}`);
const search = await anon.query(api.listings.search, {
  filters: { transaction: "sale" },
  sort: "newest",
  paginationOpts: { cursor: null, numItems: 6 },
});
ok("listings.search", `${search.page.length} cards, scanned ${search.scanned}`);
const featured = await anon.query(api.listings.featured, { limit: 6 });
ok("listings.featured", `${featured.length} featured`);
const tree = await anon.query(api.locations.tree, {});
ok("locations.tree", `${tree.length} locations`);
const agents = await anon.query(api.agents.list, {});
ok("agents.list", `${agents.length} agents, monograms ${agents.map((a) => a.monogram).join("/")}`);
const verified = await anon.query(api.testimonials.verified, {});
ok("testimonials.verified", `${verified.length} (demo testimonials stay hidden)`);

console.log("\n3. real sign-in round-trip");
const signInClient = new ConvexHttpClient(url);
const result = await signInClient.action(api.auth.signIn, {
  provider: "password",
  params: { email: admin.email, password: admin.password, flow: "signIn" },
});
const token = result?.tokens?.token;
if (typeof token !== "string" || token.length < 40) {
  fail("signIn did not return a JWT", JSON.stringify(result).slice(0, 200));
} else {
  ok("signIn(password, flow:signIn) returned a JWT", `${token.length} chars`);
}

const authed = new ConvexHttpClient(url);
authed.setAuth(token);

const me = await authed.query(api.users.getMe, {});
if (me?.role === "admin") {
  ok("users.getMe as the signed-in admin", `${me.email} · role ${me.role} · ${me.status}`);
} else {
  fail("users.getMe returned the wrong viewer", JSON.stringify(me));
}

const adminList = await authed.query(api.listingsAdmin.list, {
  paginationOpts: { cursor: null, numItems: 5 },
});
ok("listingsAdmin.list as admin", `${adminList.page.length} rows, first ${adminList.page[0]?.ref}`);

const counts = await authed.query(api.listingsAdmin.counts, {});
ok("listingsAdmin.counts as admin", counts.map((row) => `${row.status}:${row.count}`).join(" "));

const demoCounts = await authed.query(api.demo.counts, {});
ok("demo.counts as admin", `${demoCounts.total} demo rows across ${demoCounts.rows.length} tables`);

const dashboard = await authed.query(api.analytics.dashboard, { now: Date.now() });
ok("analytics.dashboard as admin", `${dashboard.activeListings} active, ${dashboard.newLeads7d} leads/7d`);

console.log("\n4. sign-in with a wrong password is refused");
try {
  await new ConvexHttpClient(url).action(api.auth.signIn, {
    provider: "password",
    params: { email: admin.email, password: "definitely-not-the-password", flow: "signIn" },
  });
  fail("a wrong password was accepted", "signIn returned tokens");
} catch (error) {
  ok("wrong password rejected", String(error).split("\n")[0].slice(0, 120));
}

console.log("\n5. sign-up without an invite is refused");
try {
  await new ConvexHttpClient(url).action(api.auth.signIn, {
    provider: "password",
    params: {
      email: `intruder-${Date.now()}@example.com`,
      password: "a-very-long-password-1234",
      flow: "signUp",
    },
  });
  fail("invite-only gate is open", "signUp succeeded without an invite");
} catch (error) {
  const message = String(error);
  if (/pozivnic|FORBIDDEN/i.test(message)) {
    ok("signUp without an invite rejected", "invite-only gate held");
  } else {
    fail("signUp rejected with an unexpected error", message.slice(0, 200));
  }
}

console.log(`\n${failures === 0 ? "ALL CHECKS PASSED" : `${failures} CHECK(S) FAILED`}`);
process.exit(failures === 0 ? 0 : 1);
