/**
 * Demo photos are Unsplash URLs sized for the public gallery (`w=1600`). Admin
 * thumbnails ask Unsplash for a width that fits the tile instead; Convex
 * storage URLs are served as uploaded.
 */
export function adminThumb(url: string, width: number): string {
  try {
    const parsed = new URL(url);
    if (parsed.hostname !== "images.unsplash.com") return url;
    parsed.searchParams.set("w", String(width));
    parsed.searchParams.set("q", "70");
    return parsed.toString();
  } catch {
    return url;
  }
}
