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
 * Deterministic, non-repeating pick: `offset` walks the category list so two
 * listings rarely open with the same photo, and a listing never repeats one.
 */
export function pickPhotos(
  categories: readonly PhotoCategory[],
  offset: number,
): DemoPhoto[] {
  const used = new Set<string>();
  const out: DemoPhoto[] = [];
  const perCategoryCursor = new Map<string, number>();

  for (const category of categories) {
    const pool = DEMO_PHOTOS_BY_CATEGORY[category] ?? [];
    if (pool.length === 0) continue;
    const start = (perCategoryCursor.get(category) ?? offset) % pool.length;
    let picked: DemoPhoto | undefined;
    for (let step = 0; step < pool.length; step += 1) {
      const candidate = pool[(start + step) % pool.length];
      if (used.has(candidate.url)) continue;
      picked = candidate;
      perCategoryCursor.set(category, (start + step + 1) % pool.length);
      break;
    }
    if (picked === undefined) continue;
    used.add(picked.url);
    out.push(picked);
  }
  return out;
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
