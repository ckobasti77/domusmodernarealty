/**
 * Generates the upload fixtures for the admin e2e suite (night-run step 08):
 * tests/fixtures/listing-1.jpg … listing-6.jpg.
 *
 * Each is an 1800×1200 JPEG with its own warm gradient and a large numeral, so
 * the gallery grid, the cover star and the public page visibly show WHICH file
 * went where. The numeral is drawn from rectangles (a seven-segment digit), not
 * SVG text: librsvg's font lookup differs per machine, shapes do not. Output is
 * deterministic, so re-running is a no-op in git.
 *
 * Run: node scripts/make-fixtures.mjs
 */
import { mkdirSync, statSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";

const WIDTH = 1800;
const HEIGHT = 1200;
const MAX_BYTES = 400 * 1024;
const OUT_DIR = path.join(process.cwd(), "tests", "fixtures");

/** Warm palettes: [base, gradient start, gradient end, accent]. */
const PALETTES = [
  ["#6f5431", "#8c6d3f", "#e2c79c", "#fbf9f5"], // bronze
  ["#7c3f22", "#a0522d", "#f0bf94", "#fff4e8"], // sienna
  ["#4d3726", "#6b4f3a", "#d2ae88", "#f7efe4"], // walnut
  ["#8a4a12", "#b5651d", "#f4d193", "#fffaf0"], // amber
  ["#5e2a1f", "#7a3e2e", "#e39d82", "#fdf1ec"], // terracotta
  ["#77593a", "#9c7a54", "#f1e5d0", "#2b2118"], // sand (dark numeral)
];

/** Segments a–g of a seven-segment digit, as [x, y, w, h] in a 400×720 box. */
const T = 90;
const SEGMENTS = {
  a: [55, 0, 290, T],
  b: [400 - T, 50, T, 300],
  c: [400 - T, 370, T, 300],
  d: [55, 720 - T, 290, T],
  e: [0, 370, T, 300],
  f: [0, 50, T, 300],
  g: [55, 315, 290, T],
};
const DIGITS = {
  1: "bc",
  2: "abged",
  3: "abgcd",
  4: "fgbc",
  5: "afgcd",
  6: "afgedc",
};

function digitSvg(n, fill) {
  return [...DIGITS[n]]
    .map((key) => {
      const [x, y, w, h] = SEGMENTS[key];
      return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${T / 2}" fill="${fill}"/>`;
    })
    .join("");
}

function overlaySvg(n) {
  const [, from, to, accent] = PALETTES[n - 1];
  // A different gradient direction and ring layout per file.
  const angle = (n * 47) % 360;
  const rings = Array.from({ length: 5 }, (_, i) => {
    const cx = (n * 311 + i * 397) % WIDTH;
    const cy = (n * 173 + i * 251) % HEIGHT;
    const r = 120 + ((n + i) % 4) * 70;
    return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${accent}" stroke-opacity="0.16" stroke-width="18"/>`;
  }).join("");
  const dx = (WIDTH - 400) / 2;
  const dy = (HEIGHT - 720) / 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}">
  <defs>
    <linearGradient id="g" gradientTransform="rotate(${angle} 0.5 0.5)">
      <stop offset="0" stop-color="${from}"/>
      <stop offset="1" stop-color="${to}"/>
    </linearGradient>
  </defs>
  <rect width="100%" height="100%" fill="url(#g)"/>
  ${rings}
  <g transform="translate(${dx + 14} ${dy + 18})" opacity="0.28">${digitSvg(n, "#000")}</g>
  <g transform="translate(${dx} ${dy})">${digitSvg(n, accent)}</g>
</svg>`;
}

mkdirSync(OUT_DIR, { recursive: true });

for (let n = 1; n <= PALETTES.length; n += 1) {
  const file = path.join(OUT_DIR, `listing-${n}.jpg`);
  await sharp({
    create: { width: WIDTH, height: HEIGHT, channels: 3, background: PALETTES[n - 1][0] },
  })
    .composite([{ input: Buffer.from(overlaySvg(n)) }])
    .jpeg({ quality: 80, mozjpeg: true })
    .toFile(file);

  const { size } = statSync(file);
  const meta = await sharp(file).metadata();
  if (meta.width !== WIDTH || meta.height !== HEIGHT || meta.format !== "jpeg") {
    throw new Error(`${file}: expected a ${WIDTH}×${HEIGHT} JPEG, got ${meta.width}×${meta.height} ${meta.format}`);
  }
  if (size >= MAX_BYTES) {
    throw new Error(`${file}: ${size} bytes, over the ${MAX_BYTES}-byte budget`);
  }
  console.log(`${path.relative(process.cwd(), file)}  ${WIDTH}×${HEIGHT}  ${(size / 1024).toFixed(1)} KB`);
}
