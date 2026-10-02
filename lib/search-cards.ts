import type { CardFrame, PropertyCardListing } from "@/components/site/PropertyCard";
import type { Locale } from "@/i18n/routing";
import { LOCALE_FIELD, type L10nValue } from "./l10n";

/**
 * A search result as the results grid draws it: the card's fields and its
 * first gallery frames (PRD A4 carousel). Live pages from `listings.search`
 * are wider and fit as they are; the server page sends `toSearchCard`.
 */
export type SearchCard = PropertyCardListing & { images?: readonly CardFrame[] };

/**
 * `value` reduced to what `pickL10n(value, locale)` reads: the locale's own
 * text and the Serbian source, so the text and its fallback `lang` are the
 * same as before.
 */
export function forLocale(value: L10nValue, locale: Locale): L10nValue {
  const field = LOCALE_FIELD[locale];
  const own = value[field];
  if (field === "sr" || own === undefined || own.length === 0) return { sr: value.sr };
  return { sr: value.sr, [field]: own };
}

function frameFor(frame: CardFrame, locale: Locale): CardFrame {
  return {
    id: frame.id,
    url: frame.url,
    alt: forLocale(frame.alt, locale),
    ...(frame.blurDataURL !== undefined ? { blurDataURL: frame.blurDataURL } : {}),
  };
}

/**
 * The server-rendered first page of results crosses into the client island as
 * props, so it carries only what `PropertyCard` draws: texts for `locale`, no
 * photo credits, and the cover once — it is the first gallery frame whenever
 * there is a gallery. Keep in step with `PropertyCardListing`.
 */
export function toSearchCard(card: SearchCard, locale: Locale): SearchCard {
  const images = card.images?.map((frame) => frameFor(frame, locale));
  return {
    _id: card._id,
    slug: card.slug,
    ref: card.ref,
    status: card.status,
    transaction: card.transaction,
    propertyType: card.propertyType,
    title: forLocale(card.title, locale),
    locationLabel: forLocale(card.locationLabel, locale),
    price: card.price,
    pricePerM2: card.pricePerM2,
    ...(card.previousPrice !== undefined ? { previousPrice: card.previousPrice } : {}),
    areaM2: card.areaM2,
    rooms: card.rooms,
    floor: card.floor,
    ...(card.totalFloors !== undefined ? { totalFloors: card.totalFloors } : {}),
    ...(images !== undefined && images.length > 0
      ? { images }
      : card.cover !== undefined
        ? { cover: frameFor(card.cover, locale) }
        : {}),
    isExclusive: card.isExclusive,
    hasTour: card.hasTour,
    ...(card.publishedAt !== undefined ? { publishedAt: card.publishedAt } : {}),
    ...(card.constructionType !== undefined ? { constructionType: card.constructionType } : {}),
    ...(card.registered !== undefined ? { registered: card.registered } : {}),
    ...(card.mortgageEligible !== undefined ? { mortgageEligible: card.mortgageEligible } : {}),
  };
}

/** The photo the compare tray shows: the cover, wherever the card carries it. */
export function coverOf(card: SearchCard): CardFrame | undefined {
  return card.images?.[0] ?? card.cover;
}
