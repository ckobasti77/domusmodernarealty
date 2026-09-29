#!/usr/bin/env node
// Turns the owner's raw renders in media-src/ into web-ready assets in
// public/media/ and writes lib/media-manifest.json (see ARCHITECTURE 7 and
// IMPLEMENTATION-PLAN 1.7).
//
// Usage: node scripts/optimize-media.mjs [--force] [--only hero,city]
//
//   Images -> <name>/<name>-{640,1280,1920,2560,native}.avif + .webp + -fallback.jpg
//             plus a 24px blurDataURL, skipping widths above the source width.
//   Videos -> <name>/<name>.mp4 (H.264 1080p CRF 24, +faststart)
//             <name>/<name>.webm (VP9 CRF 34)
//             <name>/<name>-720.mp4 (mobile)
//             <name>/<name>-poster.jpg (first frame)
//
// Idempotent: an output is rebuilt only when the source is newer or --force is
// given. A no-op when media-src/ holds nothing but .gitkeep/README.md.
import { execFile } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { promisify } from "node:util";
import ffmpegPath from "ffmpeg-static";
import sharp from "sharp";

const run = promisify(execFile);

const ROOT = process.cwd();
const SRC_DIR = path.join(ROOT, "media-src");
const OUT_DIR = path.join(ROOT, "public", "media");
const MANIFEST = path.join(ROOT, "lib", "media-manifest.json");

const IMAGE_EXT = new Set([".png", ".jpg", ".jpeg", ".webp", ".avif", ".tif", ".tiff"]);
const VIDEO_EXT = new Set([".mp4", ".mov", ".webm", ".m4v"]);
const WIDTHS = [640, 1280, 1920, 2560];

const force = process.argv.includes("--force");
const onlyArg = process.argv.indexOf("--only");
const only =
  onlyArg === -1 || !process.argv[onlyArg + 1] || process.argv[onlyArg + 1].startsWith("--")
    ? null
    : new Set(
        process.argv[onlyArg + 1]
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
      );

function mtime(file) {
  try {
    return statSync(file).mtimeMs;
  } catch {
    return -1;
  }
}

/** True when `target` is missing or older than `source`. */
function stale(source, target) {
  if (force) return true;
  const out = mtime(target);
  return out < 0 || out < mtime(source);
}

function listSources() {
  if (!existsSync(SRC_DIR)) return [];
  return readdirSync(SRC_DIR, { withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name)
    .filter((name) => {
      const ext = path.extname(name).toLowerCase();
      return IMAGE_EXT.has(ext) || VIDEO_EXT.has(ext);
    })
    .filter((name) => !only || only.has(path.basename(name, path.extname(name))))
    .sort();
}

async function optimizeImage(file) {
  const key = path.basename(file, path.extname(file));
  const source = path.join(SRC_DIR, file);
  const dir = path.join(OUT_DIR, key);
  mkdirSync(dir, { recursive: true });

  const meta = await sharp(source).metadata();
  const sourceWidth = meta.width ?? WIDTHS.at(-1);
  const sourceHeight = meta.height ?? 0;
  const widths = WIDTHS.filter((w) => w <= sourceWidth);
  // The native width is the top tier whenever it falls between two ladder
  // steps: a 1672px hero render must not top out at 1280px on a 2x screen, and
  // a 941px portrait poster must not stop at 640px on a 3x phone.
  if (sourceWidth <= WIDTHS.at(-1) && widths.at(-1) !== sourceWidth) widths.push(sourceWidth);

  const variants = [];
  let built = 0;

  for (const width of widths) {
    for (const format of ["avif", "webp"]) {
      const target = path.join(dir, `${key}-${width}.${format}`);
      if (stale(source, target)) {
        const pipeline = sharp(source).resize({ width, withoutEnlargement: true });
        await (format === "avif"
          ? pipeline.avif({ quality: 58, effort: 5 })
          : pipeline.webp({ quality: 78 })
        ).toFile(target);
        built += 1;
      }
      variants.push({ width, format, src: `/media/${key}/${key}-${width}.${format}` });
    }
  }

  const fallback = path.join(dir, `${key}-fallback.jpg`);
  if (stale(source, fallback)) {
    await sharp(source)
      .resize({ width: Math.min(1920, sourceWidth), withoutEnlargement: true })
      .jpeg({ quality: 82, mozjpeg: true, progressive: true })
      .toFile(fallback);
    built += 1;
  }

  const blur = await sharp(source)
    .resize({ width: 24 })
    .webp({ quality: 40 })
    .toBuffer()
    .then((buffer) => `data:image/webp;base64,${buffer.toString("base64")}`);

  return {
    entry: {
      key,
      kind: "image",
      width: sourceWidth,
      height: sourceHeight,
      fallback: `/media/${key}/${key}-fallback.jpg`,
      blurDataURL: blur,
      variants,
    },
    built,
  };
}

async function ffmpeg(args) {
  if (!ffmpegPath) throw new Error("ffmpeg-static did not provide a binary path");
  await run(ffmpegPath, ["-y", "-hide_banner", "-loglevel", "error", ...args], {
    maxBuffer: 1024 * 1024 * 32,
  });
}

async function probeDimensions(file) {
  // ffmpeg-static ships no ffprobe; read the first frame with sharp instead.
  const tmp = path.join(OUT_DIR, `.probe-${path.basename(file, path.extname(file))}.png`);
  await ffmpeg(["-i", file, "-frames:v", "1", tmp]);
  const meta = await sharp(tmp).metadata();
  return { width: meta.width ?? 0, height: meta.height ?? 0, frame: tmp };
}

/**
 * Poster frame per video, in seconds. The default is the first frame, which is
 * what the hero needs (its film was generated FROM the poster, so the hand-off
 * is invisible). A film that opens mid-camera-move gets a settled frame instead:
 * its poster is what phones, data-saver and reduced-motion visitors see.
 */
const POSTER_AT = { walkthrough: 5.5 };

async function optimizeVideo(file) {
  const key = path.basename(file, path.extname(file));
  const source = path.join(SRC_DIR, file);
  const dir = path.join(OUT_DIR, key);
  mkdirSync(dir, { recursive: true });

  const mp4 = path.join(dir, `${key}.mp4`);
  const webm = path.join(dir, `${key}.webm`);
  const mp4Mobile = path.join(dir, `${key}-720.mp4`);
  const poster = path.join(dir, `${key}-poster.jpg`);

  let built = 0;

  // Portrait sources keep their orientation; `-2` lets ffmpeg pick an even side.
  const { width, height, frame: firstFrame } = await probeDimensions(source);
  const posterAt = POSTER_AT[key];
  let frame = firstFrame;
  if (posterAt !== undefined) {
    frame = path.join(OUT_DIR, `.poster-${key}.png`);
    await ffmpeg(["-ss", String(posterAt), "-i", source, "-frames:v", "1", frame]);
  }
  const portrait = height > width;
  const scale1080 = portrait ? "scale=-2:1080" : "scale=1920:-2";
  const scale720 = portrait ? "scale=-2:720" : "scale=1280:-2";

  if (stale(source, mp4)) {
    await ffmpeg([
      "-i", source,
      "-vf", scale1080,
      "-c:v", "libx264", "-profile:v", "high", "-crf", "26", "-preset", "slow",
      "-pix_fmt", "yuv420p", "-movflags", "+faststart", "-an",
      mp4,
    ]);
    built += 1;
  }

  if (stale(source, webm)) {
    await ffmpeg([
      "-i", source,
      "-vf", scale1080,
      "-c:v", "libvpx-vp9", "-crf", "40", "-b:v", "0",
      "-deadline", "good", "-cpu-used", "2", "-row-mt", "1", "-tile-columns", "2", "-an",
      webm,
    ]);
    built += 1;
  }

  if (stale(source, mp4Mobile)) {
    await ffmpeg([
      "-i", source,
      "-vf", scale720,
      "-c:v", "libx264", "-profile:v", "high", "-crf", "26", "-preset", "slow",
      "-pix_fmt", "yuv420p", "-movflags", "+faststart", "-an",
      mp4Mobile,
    ]);
    built += 1;
  }

  if (stale(source, poster)) {
    await sharp(frame)
      .resize({ width: portrait ? 1080 : 1920, withoutEnlargement: true })
      .jpeg({ quality: 82, mozjpeg: true, progressive: true })
      .toFile(poster);
    built += 1;
  }

  const blur = await sharp(frame)
    .resize({ width: 24 })
    .webp({ quality: 40 })
    .toBuffer()
    .then((buffer) => `data:image/webp;base64,${buffer.toString("base64")}`);

  return {
    entry: {
      key,
      kind: "video",
      width,
      height,
      poster: `/media/${key}/${key}-poster.jpg`,
      blurDataURL: blur,
      sources: [
        { type: "video/webm", src: `/media/${key}/${key}.webm` },
        { type: "video/mp4", src: `/media/${key}/${key}.mp4` },
      ],
      mobileSrc: `/media/${key}/${key}-720.mp4`,
    },
    built,
  };
}

async function main() {
  const files = listSources();

  if (files.length === 0) {
    console.log("media:optimize - media-src/ has no images or videos, nothing to do");
    if (!existsSync(MANIFEST)) {
      writeFileSync(MANIFEST, `${JSON.stringify({ generatedAt: null, items: {} }, null, 2)}\n`);
    }
    return;
  }

  mkdirSync(OUT_DIR, { recursive: true });

  const items = {};
  let built = 0;

  for (const file of files) {
    const ext = path.extname(file).toLowerCase();
    const result = IMAGE_EXT.has(ext) ? await optimizeImage(file) : await optimizeVideo(file);
    items[result.entry.key] = result.entry;
    built += result.built;
    console.log(
      `  ${result.entry.key.padEnd(16)} ${result.entry.kind.padEnd(5)} ${
        result.built === 0 ? "up to date" : `${result.built} output(s)`
      }`,
    );
  }

  // Remove the temporary frame PNGs written by the video probe and the poster picks.
  for (const name of readdirSync(OUT_DIR)) {
    if (name.startsWith(".probe-") || name.startsWith(".poster-")) {
      const { rmSync } = await import("node:fs");
      rmSync(path.join(OUT_DIR, name), { force: true });
    }
  }

  writeFileSync(
    MANIFEST,
    `${JSON.stringify({ generatedAt: new Date().toISOString(), items }, null, 2)}\n`,
  );

  console.log(
    `media:optimize - ${Object.keys(items).length} asset(s), ${built} output(s) written, manifest at lib/media-manifest.json`,
  );
}

main().catch((error) => {
  console.error(`media:optimize failed: ${error.message}`);
  process.exit(1);
});
