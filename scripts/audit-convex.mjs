/**
 * Static self-audit of the Convex function surface. It is deliberately dumb —
 * regex over the sources — but it catches the three mistakes that matter most and
 * that `tsc` cannot see:
 *
 *   1. a registered function with no `args` or no `returns` validator;
 *   2. an admin module function that never calls `requireRole`;
 *   3. a public mutation that skips `consumeLimit` or `assertHoneypotEmpty`.
 *
 * Run: node scripts/audit-convex.mjs
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const ADMIN_MODULES = [
  "listingsAdmin",
  "media",
  "toursAdmin",
  "leadsAdmin",
  "viewingsAdmin",
  "contacts",
  "users",
  "invites",
  "agentsAdmin",
  "locationsAdmin",
  "postsAdmin",
  "pagesAdmin",
  "testimonialsAdmin",
  "settingsAdmin",
  "analytics",
  "activity",
  "demo",
  "geocode",
];

/** Public mutations that must be rate limited and honeypot-guarded. */
const PUBLIC_FORM_MODULES = ["leads", "viewings"];

/**
 * Intentionally reachable without a role:
 *  - `users.getMe` answers `null` for anonymous callers (the admin shell gate);
 *  - `invites.checkToken` lets the acceptance page validate a link before the
 *    invitee has an account at all.
 */
const ROLE_EXEMPT = new Set(["users.getMe", "invites.checkToken"]);

/**
 * Helpers that call `requireRole` themselves and then apply the per-document
 * ownership rule. A function that goes through one of these is authorized.
 */
const ROLE_HELPERS = ["requireRole(", "requireRoleAction(", "loadEditable("];

const FUNCTION_RE =
  /export const (\w+) = (internalQuery|internalMutation|internalAction|query|mutation|action)\(\{([\s\S]*?)\n\}\);/g;

function sources(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) {
      if (entry !== "_generated") out.push(...sources(path));
    } else if (entry.endsWith(".ts") && !entry.endsWith(".test.ts")) {
      out.push(path);
    }
  }
  return out;
}

const problems = [];
let scanned = 0;
const perModule = [];

for (const file of sources("convex")) {
  const text = readFileSync(file, "utf8");
  const moduleName = file
    .replace(/\\/g, "/")
    .replace(/^convex\//, "")
    .replace(/\.ts$/, "");

  let found = 0;
  let roleChecks = 0;
  let match;
  FUNCTION_RE.lastIndex = 0;
  while ((match = FUNCTION_RE.exec(text)) !== null) {
    const [, name, kind, body] = match;
    scanned += 1;
    found += 1;
    const ref = `${moduleName}.${name}`;

    if (!/\bargs:/.test(body)) problems.push(`${ref}: no args validator`);
    if (!/\breturns:/.test(body)) problems.push(`${ref}: no returns validator`);
    if (/\bv\.any\(\)/.test(body)) problems.push(`${ref}: uses v.any()`);

    const isPublic = kind === "query" || kind === "mutation" || kind === "action";

    if (ADMIN_MODULES.includes(moduleName) && isPublic) {
      if (ROLE_HELPERS.some((helper) => body.includes(helper))) roleChecks += 1;
      else if (!ROLE_EXEMPT.has(ref)) problems.push(`${ref}: no requireRole`);
    }

    if (PUBLIC_FORM_MODULES.includes(moduleName) && kind === "mutation") {
      if (!/consumeLimit\(/.test(body)) problems.push(`${ref}: no rate limit`);
      if (!/assertHoneypotEmpty\(/.test(body)) problems.push(`${ref}: no honeypot`);
    }

    // A query must never read the wall clock (stale results, no cache reuse).
    if ((kind === "query" || kind === "internalQuery") && /Date\.now\(\)/.test(body)) {
      problems.push(`${ref}: reads Date.now() inside a query`);
    }

    if (/\.collect\(\)/.test(body)) problems.push(`${ref}: uses .collect()`);
  }

  if (found > 0) perModule.push({ moduleName, found, roleChecks });
}

for (const row of perModule.sort((a, b) => a.moduleName.localeCompare(b.moduleName))) {
  const role = ADMIN_MODULES.includes(row.moduleName)
    ? ` · requireRole ${row.roleChecks}`
    : "";
  console.log(`  ${row.moduleName}: ${row.found} functions${role}`);
}

console.log(`\nfunctions scanned: ${scanned}`);
if (problems.length === 0) {
  console.log("no problems found");
} else {
  console.log(`${problems.length} problem(s):`);
  for (const problem of problems) console.log(`  - ${problem}`);
}
process.exit(problems.length === 0 ? 0 : 1);
