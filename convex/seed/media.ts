/**
 * Turns the verified demo photo list into `MediaItem`s with per-locale alt text.
 * Every URL in `media.generated.ts` was HEAD-checked by
 * `scripts/verify-demo-media.mjs`; nothing here invents an image URL.
 */
import type { L10n, MediaItem, RoomTag } from "../lib/validators";
import { DEMO_PHOTOS_BY_CATEGORY } from "./media.generated";
import type { DemoPhoto } from "./media.generated";
import type { PhotoCategory } from "./specTypes";

/** Unsplash sizing params, per ARCHITECTURE §7. */
export function photoUrl(base: string, width = 1600): string {
  return `${base}?w=${width}&q=80&auto=format&fit=crop`;
}

const ROOM_LABEL: Record<RoomTag, L10n> = {
  living: { sr: "Dnevna soba", en: "Living room", ru: "Гостиная", de: "Wohnzimmer" },
  kitchen: { sr: "Kuhinja", en: "Kitchen", ru: "Кухня", de: "Küche" },
  dining: { sr: "Trpezarija", en: "Dining area", ru: "Столовая", de: "Essbereich" },
  bedroom: { sr: "Spavaća soba", en: "Bedroom", ru: "Спальня", de: "Schlafzimmer" },
  bathroom: { sr: "Kupatilo", en: "Bathroom", ru: "Ванная комната", de: "Badezimmer" },
  office: { sr: "Radni prostor", en: "Work space", ru: "Рабочее пространство", de: "Arbeitsbereich" },
  terrace: { sr: "Terasa", en: "Terrace", ru: "Терраса", de: "Terrasse" },
  hall: { sr: "Hodnik", en: "Hallway", ru: "Прихожая", de: "Flur" },
  exterior: { sr: "Spoljašnjost", en: "Exterior", ru: "Внешний вид", de: "Außenansicht" },
  building: { sr: "Zgrada", en: "Building", ru: "Здание", de: "Gebäude" },
  view: { sr: "Pogled", en: "View", ru: "Вид", de: "Aussicht" },
  plan: { sr: "Tlocrt", en: "Floor plan", ru: "План", de: "Grundriss" },
  other: { sr: "Prostor", en: "Space", ru: "Помещение", de: "Raum" },
};

/**
 * Assigns photos to ALL demo listings in one deterministic pass.
 *
 * Doing it globally (rather than per listing with a modulo cursor) is what keeps
 * covers distinct: pass one hands every listing an unused photo for its first
 * category, and only then does pass two fill the remaining gallery slots. A
 * per-listing `index % pool.length` cursor collides as soon as two listings that
 * share a first category are `pool.length` apart — which is exactly what the six
 * villa photos did.
 *
 * Interior slots may still repeat across listings once a pool is exhausted: the
 * verified pool in `docs/assets/demo-media.json` is 184 photos for ~220 slots
 * (no photo is used more than twice), and inventing image URLs is forbidden.
 */
export function buildPhotoPlan(
  listings: readonly { photos: readonly PhotoCategory[] }[],
): DemoPhoto[][] {
  const plan: DemoPhoto[][] = listings.map(() => []);
  const usedGlobally = new Set<string>();
  const cursor = new Map<PhotoCategory, number>();

  /** Next photo in `category` that no one has taken yet; wraps when exhausted. */
  function next(category: PhotoCategory, usedHere: Set<string>): DemoPhoto | undefined {
    const pool = DEMO_PHOTOS_BY_CATEGORY[category] ?? [];
    if (pool.length === 0) return undefined;
    const start = cursor.get(category) ?? 0;

    // First choice: unused anywhere and unused in this listing.
    for (let step = 0; step < pool.length; step += 1) {
      const candidate = pool[(start + step) % pool.length];
      if (usedGlobally.has(candidate.url) || usedHere.has(candidate.url)) continue;
      cursor.set(category, (start + step + 1) % pool.length);
      return candidate;
    }
    // Fallback: the pool is exhausted globally, so only avoid repeats here.
    for (let step = 0; step < pool.length; step += 1) {
      const candidate = pool[(start + step) % pool.length];
      if (usedHere.has(candidate.url)) continue;
      cursor.set(category, (start + step + 1) % pool.length);
      return candidate;
    }
    return undefined;
  }

  const usedPerListing = listings.map(() => new Set<string>());

  // Pass 1 — the cover of every listing, so covers get first claim on the pools.
  for (const [index, listing] of listings.entries()) {
    const category = listing.photos[0];
    if (category === undefined) continue;
    const photo = next(category, usedPerListing[index]);
    if (photo === undefined) continue;
    usedGlobally.add(photo.url);
    usedPerListing[index].add(photo.url);
    plan[index].push(photo);
  }

  // Pass 2 — the remaining gallery slots, listing by listing.
  for (const [index, listing] of listings.entries()) {
    for (const category of listing.photos.slice(1)) {
      const photo = next(category, usedPerListing[index]);
      if (photo === undefined) continue;
      usedGlobally.add(photo.url);
      usedPerListing[index].add(photo.url);
      plan[index].push(photo);
    }
  }

  return plan;
}

/** Single-category pick, used for post and location cover images. */
export function pickPhoto(
  category: PhotoCategory,
  offset: number,
): DemoPhoto | undefined {
  const pool = DEMO_PHOTOS_BY_CATEGORY[category] ?? [];
  if (pool.length === 0) return undefined;
  return pool[offset % pool.length];
}

export function toMediaItems(
  photos: readonly DemoPhoto[],
  roomTags: readonly RoomTag[],
  title: L10n,
  idPrefix: string,
): MediaItem[] {
  return photos.map((photo, index) => {
    const room = roomTags[index] ?? "other";
    const label = ROOM_LABEL[room];
    return {
      id: `${idPrefix}-${index}`,
      image: { kind: "url" as const, url: photoUrl(photo.url) },
      alt: {
        sr: `${label.sr} — ${title.sr}`,
        ...(title.en !== undefined ? { en: `${label.en} — ${title.en}` } : {}),
        ...(title.ru !== undefined ? { ru: `${label.ru} — ${title.ru}` } : {}),
        ...(title.de !== undefined ? { de: `${label.de} — ${title.de}` } : {}),
      },
      room,
      order: index,
      ...(index === 0 ? { isCover: true } : {}),
      author: photo.author,
      sourcePage: photo.page,
    };
  });
}

export { ROOM_LABEL };
