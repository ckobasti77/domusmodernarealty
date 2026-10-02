import { existsSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

/**
 * The suite asserts against the production build that `npm run start` serves.
 * A missing or stale `.next` makes every failure misleading (old markup, old
 * strings), so refuse to start instead. Set `PLAYWRIGHT_BASE_URL` to test a
 * server elsewhere, or `E2E_ALLOW_STALE_BUILD=1` to skip the freshness check.
 */

const ROOT = process.cwd();
const SOURCES = ["app", "components", "lib", "hooks", "i18n", "messages", "proxy.ts", "next.config.ts"];

function newestMtime(entry: string): number {
  const stats = statSync(entry);
  if (!stats.isDirectory()) return stats.mtimeMs;
  let newest = 0;
  for (const child of readdirSync(entry)) {
    newest = Math.max(newest, newestMtime(path.join(entry, child)));
  }
  return newest;
}

export default function globalSetup(): void {
  if (process.env.PLAYWRIGHT_BASE_URL !== undefined) return;
  const buildId = path.join(ROOT, ".next", "BUILD_ID");
  if (!existsSync(buildId)) {
    throw new Error("No production build: run `npm run build` before `npm run test:e2e`.");
  }
  if (process.env.E2E_ALLOW_STALE_BUILD === "1") return;
  const builtAt = statSync(buildId).mtimeMs;
  const changed = SOURCES.map((entry) => path.join(ROOT, entry))
    .filter((entry) => existsSync(entry))
    .find((entry) => newestMtime(entry) > builtAt);
  if (changed !== undefined) {
    throw new Error(
      `The production build is older than ${path.relative(ROOT, changed)}: run \`npm run build\` ` +
        "(and stop any old server on :3000) before `npm run test:e2e`, or set E2E_ALLOW_STALE_BUILD=1.",
    );
  }
}
