/**
 * Screenshots of signed-in admin screens (scripts/shots.mjs covers the public
 * site). Signs in through the real login form with the credentials in
 * night-run/state/admin.json (gitignored; never printed), then captures each
 * route at each width into `--out`.
 *
 *   node scripts/admin-shots.mjs [--base http://localhost:3000]
 *        [--routes /admin,/admin/nekretnine] [--widths 390,1440]
 *        [--editor ME-1042] [--tabs] [--dark] [--out .shots/admin]
 *
 *   --editor  also open the editor of this listing ref (resolved through
 *             `listingsAdmin.quickFind` as the admin)
 *   --tabs    with --editor: capture every editor tab
 *   --dark    switch the admin to the dark theme before capturing
 *
 * In Git Bash prefix the command with MSYS_NO_PATHCONV=1 so `/admin` is not
 * rewritten into a Windows path.
 */
import { mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "@playwright/test";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api.js";

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  if (i === -1) return fallback;
  const v = process.argv[i + 1];
  return v === undefined || v.startsWith("--") ? true : v;
}

const base = arg("base", "http://localhost:3000");
const routes = String(arg("routes", "/admin,/admin/nekretnine")).split(",").filter(Boolean);
const widths = String(arg("widths", "390,1440")).split(",").map(Number);
const editorRef = arg("editor", undefined);
const tabs = arg("tabs", false) === true;
const dark = arg("dark", false) === true;
const out = String(arg("out", ".shots/admin"));
mkdirSync(out, { recursive: true });

const admin = JSON.parse(readFileSync("night-run/state/admin.json", "utf8"));

async function resolveEditor(ref) {
  const url = readFileSync(".env.local", "utf8")
    .split(/\r?\n/)
    .find((line) => line.startsWith("NEXT_PUBLIC_CONVEX_URL="))
    ?.split("=")[1]
    ?.trim();
  const client = new ConvexHttpClient(url);
  const result = await client.action(api.auth.signIn, {
    provider: "password",
    params: { email: admin.email, password: admin.password, flow: "signIn" },
  });
  client.setAuth(result.tokens.token);
  const hits = await client.query(api.listingsAdmin.quickFind, { q: ref });
  const hit = hits.find((row) => row.ref === ref) ?? hits[0];
  if (hit === undefined) throw new Error(`No listing ${ref}`);
  return `/admin/nekretnine/${hit._id}`;
}

const slug = (route) => route.replace(/^\/+/, "").replace(/[^a-z0-9]+/gi, "_") || "root";
const errors = [];

const browser = await chromium.launch();
try {
  const allRoutes = [...routes];
  const editorRoute = typeof editorRef === "string" ? await resolveEditor(editorRef) : null;
  if (editorRoute !== null) allRoutes.push(editorRoute);

  for (const width of widths) {
    const height = width <= 390 ? 844 : width <= 768 ? 1024 : 900;
    const context = await browser.newContext({ viewport: { width, height }, locale: "sr-Latn-RS", timezoneId: "Europe/Belgrade" });
    const page = await context.newPage();
    page.on("pageerror", (error) => errors.push(`${width} pageerror: ${error.message}`));
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(`${width} console: ${message.text().slice(0, 200)}`);
    });

    await page.goto(`${base}/admin/login`);
    await page.fill("#admin-email", admin.email);
    await page.fill("#admin-password", admin.password);
    await page.getByRole("button", { name: "Prijavite se" }).click();
    await page.waitForURL(`${base}/admin`, { timeout: 30_000 });
    if (dark) {
      await page.evaluate(() => localStorage.setItem("me-admin-theme", "dark"));
    }

    for (const route of allRoutes) {
      await page.goto(`${base}${route}`, { waitUntil: "networkidle" });
      await page.waitForTimeout(800);
      const name = route === editorRoute ? `editor_${editorRef}` : slug(route);
      const file = join(out, `${name}_${width}${dark ? "_dark" : ""}.png`);
      await page.screenshot({ path: file, fullPage: true });
      console.log(`saved ${file}`);

      if (route === editorRoute && tabs) {
        const triggers = await page.locator('[data-testid^="tab-"]').all();
        for (const trigger of triggers) {
          const id = await trigger.getAttribute("data-testid");
          await trigger.click();
          await page.waitForTimeout(600);
          const tabFile = join(out, `editor_${editorRef}_${id}_${width}${dark ? "_dark" : ""}.png`);
          await page.screenshot({ path: tabFile, fullPage: true });
          console.log(`saved ${tabFile}`);
        }
      }
    }
    await context.close();
  }
} finally {
  await browser.close();
}

if (errors.length > 0) {
  console.log(`\n${errors.length} browser errors:`);
  for (const line of errors) console.log(`  ${line}`);
} else {
  console.log("\nno browser errors");
}
