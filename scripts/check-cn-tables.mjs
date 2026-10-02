#!/usr/bin/env node
// Fails when lib/cn-tables.ts is stale.
//
// `cn()` resolves Tailwind conflicts with tables generated from the @theme block
// AND the utilities the code actually uses (`npm run cn:tables`). A utility group
// that is missing from the tables is merged as if it were another group, so a
// class is silently dropped (a primary button once rendered ivory-on-ivory; in
// review 14 the map pins lost their pointer). This rebuilds the tables into a
// temp file with the exact `cn:tables` arguments and compares.
//
// Usage: node scripts/check-cn-tables.mjs        (exit 1 + instructions when stale)
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const root = process.cwd();
const pkg = JSON.parse(readFileSync(path.join(root, "package.json"), "utf8"));
const command = pkg.scripts?.["cn:tables"];
if (typeof command !== "string") {
  console.error("check-cn-tables: package.json has no cn:tables script");
  process.exit(1);
}

// Reuse the script's own --css/--content arguments so the two never drift.
const css = /--css\s+(\S+)/.exec(command)?.[1];
const content = /--content\s+"([^"]+)"/.exec(command)?.[1];
const out = /--out\s+(\S+)/.exec(command)?.[1];
if (css === undefined || content === undefined || out === undefined) {
  console.error(`check-cn-tables: cannot read --css/--content/--out from "${command}"`);
  process.exit(1);
}

const dir = mkdtempSync(path.join(tmpdir(), "cn-tables-"));
const fresh = path.join(dir, "cn-tables.ts");
try {
  execFileSync(
    process.execPath,
    [path.join(root, "node_modules", "cn", "bin", "cn.mjs"), "build", "--css", css, "--content", content, "--out", fresh],
    { cwd: root, stdio: ["ignore", "ignore", "inherit"] },
  );
  const normalize = (text) => text.replace(/\r\n/g, "\n");
  const committed = normalize(readFileSync(path.join(root, out), "utf8"));
  const rebuilt = normalize(readFileSync(fresh, "utf8"));
  if (committed !== rebuilt) {
    console.error(`check-cn-tables: ${out} is stale — run \`npm run cn:tables\` and commit the result.`);
    process.exit(1);
  }
  console.log(`check-cn-tables: ${out} is up to date`);
} finally {
  rmSync(dir, { recursive: true, force: true });
}
