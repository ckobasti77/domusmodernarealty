// Sets the Convex Auth environment variables on the DEV deployment (idempotent).
//   JWT_PRIVATE_KEY, JWKS  -> generated with Node's crypto (RS256), newlines -> spaces
//   SITE_URL               -> http://localhost:3000
// Usage (from the project root): node night-run/scripts/convex-auth-env.mjs [--force]
// Never prints secret values.
import { generateKeyPairSync } from "node:crypto";
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const convexBin = path.join(root, "node_modules", "convex", "bin", "main.js");
const force = process.argv.includes("--force");

if (!existsSync(convexBin)) {
  console.error("[auth-env] convex CLI not found at", convexBin, "- run npm install first");
  process.exit(1);
}

function convex(args) {
  const r = spawnSync(process.execPath, [convexBin, ...args], {
    cwd: root,
    encoding: "utf8",
    env: process.env,
    timeout: 180000,
  });
  return { code: r.status ?? 1, out: `${r.stdout ?? ""}${r.stderr ?? ""}` };
}

const list = convex(["env", "list"]);
if (list.code !== 0) {
  console.error("[auth-env] `convex env list` failed:\n" + list.out.slice(0, 2000));
  process.exit(2);
}
const has = (name) => new RegExp(`^${name}=`, "m").test(list.out);

if (!force && has("JWT_PRIVATE_KEY") && has("JWKS")) {
  console.log("[auth-env] JWT_PRIVATE_KEY and JWKS already set - keeping them");
} else {
  const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  const pem = privateKey.export({ type: "pkcs8", format: "pem" }).toString().trimEnd().replace(/\n/g, " ");
  const jwk = publicKey.export({ format: "jwk" });
  const jwks = JSON.stringify({ keys: [{ use: "sig", ...jwk }] });
  for (const [name, value] of [
    ["JWT_PRIVATE_KEY", pem],
    ["JWKS", jwks],
  ]) {
    const r = convex(["env", "set", `${name}=${value}`]);
    if (r.code !== 0) {
      console.error(`[auth-env] failed to set ${name}:\n` + r.out.slice(0, 2000));
      process.exit(3);
    }
    console.log(`[auth-env] set ${name}`);
  }
}

if (force || !has("SITE_URL")) {
  const r = convex(["env", "set", "SITE_URL=http://localhost:3000"]);
  if (r.code !== 0) {
    console.error("[auth-env] failed to set SITE_URL:\n" + r.out.slice(0, 2000));
    process.exit(4);
  }
  console.log("[auth-env] set SITE_URL=http://localhost:3000");
} else {
  console.log("[auth-env] SITE_URL already set");
}
