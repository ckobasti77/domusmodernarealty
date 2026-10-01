import "server-only";

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { ImageResponse } from "next/og";
import sharp from "sharp";

/**
 * Shared pieces of the share images (ARCHITECTURE §9): the site card, the
 * listing card and the article card are all Route Handlers at localized public
 * paths (DECISIONS [07]) and draw with the same fonts, colours and wordmark.
 *
 * Satori needs TTF/OTF (not WOFF2), so the two static OFL fonts in
 * `assets/fonts/` — EB Garamond and Manrope, both with Latin-Ext and Cyrillic —
 * are read from disk; together they are under 500 KB.
 */

export const OG_SIZE = { width: 1200, height: 630 } as const;

export const INK = "#0e0d0b";
export const IVORY = "#f4efe6";
export const MIST = "#b9b0a2";
export const BRONZE = "#b08d57";

export async function ogFonts() {
  const dir = join(process.cwd(), "assets", "fonts");
  const [serif, sans] = await Promise.all([
    readFile(join(dir, "EBGaramond-Regular.ttf")),
    readFile(join(dir, "Manrope-Medium.ttf")),
  ]);
  return [
    { name: "Serif", data: serif, weight: 400 as const, style: "normal" as const },
    { name: "Sans", data: sans, weight: 500 as const, style: "normal" as const },
  ];
}

/**
 * Satori only writes PNG, which for a photograph is ~800 KB. WhatsApp and
 * Viber, the channels Serbian buyers share on, drop the preview above ~300 KB,
 * so the PNG is re-encoded to a ~100 KB progressive JPEG before it is sent.
 */
export async function asJpeg(image: ImageResponse, cacheControl: string): Promise<Response> {
  const png = Buffer.from(await image.arrayBuffer());
  const jpeg = await sharp(png).jpeg({ quality: 82, mozjpeg: true, progressive: true }).toBuffer();
  return new Response(new Uint8Array(jpeg), {
    headers: { "Content-Type": "image/jpeg", "Cache-Control": cacheControl },
  });
}

/**
 * A photo from `public/` as a data URI, scaled to the card first: Satori
 * cannot fetch a relative URL, and inlining the 2560 px master would make
 * every render decode megabytes it then throws away.
 */
export async function publicPhoto(publicPath: string, width: number, height: number): Promise<string> {
  const file = await readFile(join(process.cwd(), "public", publicPath.replace(/^\//, "")));
  const jpeg = await sharp(file).resize(width, height, { fit: "cover" }).jpeg({ quality: 85 }).toBuffer();
  return `data:image/jpeg;base64,${jpeg.toString("base64")}`;
}

export function Wordmark() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ fontFamily: "Serif", fontSize: 26, letterSpacing: 7, color: IVORY }}>MIHAJLO ESTATE</div>
      <div style={{ width: 56, height: 1, backgroundColor: BRONZE }} />
    </div>
  );
}
