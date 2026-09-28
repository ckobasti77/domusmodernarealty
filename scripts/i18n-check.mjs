#!/usr/bin/env node
// Asserts that messages/{sr-Latn,en,ru,de}.json have identical key sets and that
// every ICU placeholder used in the source locale survives translation.
// Exits 1 on any difference so `npm run i18n:check` can gate the night run.
import { readFileSync } from "node:fs";
import path from "node:path";

const SOURCE = "sr-Latn";
const LOCALES = [SOURCE, "en", "ru", "de"];
const MESSAGES_DIR = path.join(process.cwd(), "messages");

/** Flattens a nested message object into `namespace.section.item` paths. */
function flatten(value, prefix = "", out = new Map()) {
  for (const [key, child] of Object.entries(value)) {
    const keyPath = prefix ? `${prefix}.${key}` : key;
    if (child !== null && typeof child === "object" && !Array.isArray(child)) {
      flatten(child, keyPath, out);
    } else {
      out.set(keyPath, String(child));
    }
  }
  return out;
}

/** Simple `{name}` placeholders, ignoring ICU plural/select category bodies. */
function placeholders(message) {
  const found = new Set();
  for (const match of message.matchAll(/\{\s*([a-zA-Z0-9_]+)\s*[,}]/g)) {
    found.add(match[1]);
  }
  return found;
}

function load(locale) {
  const file = path.join(MESSAGES_DIR, `${locale}.json`);
  try {
    return flatten(JSON.parse(readFileSync(file, "utf8")));
  } catch (error) {
    console.error(`x ${locale}.json could not be read: ${error.message}`);
    process.exit(1);
  }
}

const source = load(SOURCE);
const problems = [];

for (const locale of LOCALES.filter((l) => l !== SOURCE)) {
  const target = load(locale);

  const missing = [...source.keys()].filter((key) => !target.has(key));
  const extra = [...target.keys()].filter((key) => !source.has(key));

  for (const key of missing) problems.push(`${locale}: missing key  ${key}`);
  for (const key of extra) problems.push(`${locale}: unknown key  ${key}`);

  for (const [key, message] of source) {
    const translated = target.get(key);
    if (translated === undefined) continue;

    const expected = placeholders(message);
    const actual = placeholders(translated);
    const lost = [...expected].filter((name) => !actual.has(name));
    if (lost.length) {
      problems.push(`${locale}: ${key} lost placeholder(s) ${lost.map((n) => `{${n}}`).join(", ")}`);
    }
    if (translated.trim() === "") {
      problems.push(`${locale}: ${key} is empty`);
    }
  }
}

if (problems.length) {
  console.error(`i18n:check failed with ${problems.length} problem(s):\n`);
  for (const problem of problems) console.error(`  ${problem}`);
  process.exit(1);
}

console.log(
  `i18n:check ok - ${source.size} keys x ${LOCALES.length} locales (${LOCALES.join(", ")})`,
);
