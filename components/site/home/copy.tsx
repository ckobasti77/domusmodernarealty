import type { ReactNode } from "react";
import type { Locale } from "@/i18n/routing";
import { blockText, findBlock, HOME_BLOCKS, type Localized, localizedText, type PublicPage } from "@/lib/content/pages";
import { fixTypography, fixWidows } from "@/lib/format";
import { pickL10n, type L10nValue } from "@/lib/l10n";

/**
 * The landing's managed copy (PRD B10), resolved once per request by the page
 * (`buildHomeCopy` is pure: the page passes the `home` translator in, which
 * also lets a plain Node check compare the seed with `messages`).
 *
 * Every text comes from the `home` page in Convex (edited in
 * /admin/sadrzaj) and falls back, field by field, to the built-in string in
 * `messages/*.json` — so the landing renders the same with the seeded page,
 * with a half-filled block or with no page at all. Eyebrows, alt texts,
 * button labels and links are part of the design and stay in messages/code.
 *
 * `lang` is set only when a text is NOT in the page's language (a block that
 * has no translation yet shows the Serbian source), so the markup of a fully
 * translated landing is unchanged.
 */

export type Copy = { text: string; lang?: string };

export const SERVICE_KEYS = ["Buy", "Sell", "Rent", "Valuation", "Tours", "Relocation"] as const;
export type ServiceKey = (typeof SERVICE_KEYS)[number];

const PROCESS_STEPS = [1, 2, 3, 4, 5] as const;

export type StatCopy = { value: string; label: Copy; isDemo: boolean };

export type HomeCopy = {
  hero: { headline: Copy; lede: Copy };
  intro: Copy;
  neighborhoods: { heading: Copy; lede: Copy };
  services: { heading: Copy; items: { key: ServiceKey; title: Copy; body: Copy }[] };
  tours: { heading: Copy; lede: Copy };
  process: { heading: Copy; lede: Copy; steps: { title: Copy; body: Copy }[] };
  numbers: { heading: Copy; stats: StatCopy[] };
  valuation: { heading: Copy; lede: Copy; note: Copy };
  final: { heading: Copy; lede: Copy };
};

/** A settings counter, the shape the landing used before the `numbers` block. */
type SettingsStat = { value: string; label: L10nValue; isDemo: boolean };

function copyOf(managed: Localized | null, fallback: string, locale: Locale): Copy {
  if (managed === null) return { text: fallback };
  return managed.lang !== locale ? { text: managed.text, lang: managed.lang } : { text: managed.text };
}

/** The `home` namespace translator (`getTranslations({ locale, namespace: "home" })`). */
export type HomeTranslator = (key: string) => string;

export function buildHomeCopy(
  page: PublicPage | null,
  locale: Locale,
  settingsStats: readonly SettingsStat[],
  t: HomeTranslator,
): HomeCopy {
  const text = (key: string, field: Parameters<typeof blockText>[2], fallback: string) =>
    copyOf(blockText(page, key, field, locale), fallback, locale);

  const services = findBlock(page, HOME_BLOCKS.services.key, HOME_BLOCKS.services.type);
  const process = findBlock(page, HOME_BLOCKS.process.key, HOME_BLOCKS.process.type);
  const numbers = findBlock(page, HOME_BLOCKS.numbers.key, HOME_BLOCKS.numbers.type);

  // The block is the single source of the figures; `settings.stats` only
  // stands in when the landing has no `numbers` block at all.
  const stats: StatCopy[] = (numbers?.items ?? settingsStats).map((stat) => {
    const label = pickL10n(stat.label, locale);
    return {
      value: stat.value,
      label: label.lang !== locale ? { text: label.text, lang: label.lang } : { text: label.text },
      isDemo: stat.isDemo,
    };
  });

  return {
    hero: {
      headline: text(HOME_BLOCKS.hero.key, "title", t("heroHeadline")),
      lede: text(HOME_BLOCKS.hero.key, "body", t("heroLede")),
    },
    intro: text(HOME_BLOCKS.intro.key, "body", t("introStatement")),
    neighborhoods: {
      heading: text(HOME_BLOCKS.neighborhoods.key, "title", t("neighborhoodsHeading")),
      lede: text(HOME_BLOCKS.neighborhoods.key, "body", t("neighborhoodsLede")),
    },
    services: {
      heading: text(HOME_BLOCKS.services.key, "title", t("servicesHeading")),
      items: SERVICE_KEYS.map((key, index) => {
        const item = services?.items[index];
        return {
          key,
          title: copyOf(localizedText(item?.title, locale), t(`services${key}Title`), locale),
          body: copyOf(localizedText(item?.body, locale), t(`services${key}Body`), locale),
        };
      }),
    },
    tours: {
      heading: text(HOME_BLOCKS.tours.key, "title", t("toursHeading")),
      lede: text(HOME_BLOCKS.tours.key, "body", t("toursLede")),
    },
    process: {
      heading: text(HOME_BLOCKS.process.key, "title", t("processHeading")),
      lede: text(HOME_BLOCKS.process.key, "lede", t("processLede")),
      steps: PROCESS_STEPS.map((n, index) => {
        const item = process?.items[index];
        return {
          title: copyOf(localizedText(item?.title, locale), t(`processStep${n}Title`), locale),
          body: copyOf(localizedText(item?.body, locale), t(`processStep${n}Body`), locale),
        };
      }),
    },
    numbers: {
      heading: text(HOME_BLOCKS.numbers.key, "title", t("numbersHeading")),
      stats,
    },
    valuation: {
      heading: text(HOME_BLOCKS.valuation.key, "heading", t("valuationHeading")),
      lede: text(HOME_BLOCKS.valuation.key, "sub", t("valuationLede")),
      note: text(HOME_BLOCKS.valuation.key, "note", t("valuationNote")),
    },
    final: {
      heading: text(HOME_BLOCKS.final.key, "heading", t("finalHeading")),
      lede: text(HOME_BLOCKS.final.key, "sub", t("finalLede")),
    },
  };
}

/**
 * A title for `SectionHeading`: the bare string when it is in the page's
 * language (the heading applies `fixWidows` itself, as before), otherwise the
 * same text wrapped in a `lang` span.
 */
export function headingNode(copy: Copy): ReactNode {
  return copy.lang === undefined ? copy.text : <span lang={copy.lang}>{fixWidows(copy.text)}</span>;
}

/** A lede for `SectionHeading`, by the same rule (`fixTypography`). */
export function ledeNode(copy: Copy): ReactNode {
  return copy.lang === undefined ? copy.text : <span lang={copy.lang}>{fixTypography(copy.text)}</span>;
}
