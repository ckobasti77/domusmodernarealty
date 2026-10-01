import "server-only";

import type { FunctionReturnType } from "convex/server";
import type { ProcessStep } from "@/components/site/home/ProcessSteps";
import {
  managedFaq,
  managedIntro,
  managedList,
  managedSteps,
  type FaqEntry,
  type PageText,
} from "@/components/site/contact/managed";
import type { LocationChoice, LocationGroup } from "@/components/site/valuation/types";
import type { api } from "@/convex/_generated/api";
import type { Locale } from "@/i18n/routing";
import type { PublicPage } from "@/lib/content/pages";
import type { PlaceholderValues } from "@/lib/content/placeholders";
import { fixTypography } from "@/lib/format";
import { pickL10n } from "@/lib/l10n";

/**
 * Everything the sell page (PRD A7) resolves on the server: the managed copy
 * of `pages.sell` (opening, benefits, the five steps, the questions) with the
 * `sell.*` messages as the block-by-block fallback, and the location options
 * of the seller form.
 */

type Translate = (key: string, values?: Record<string, string | number>) => string;
type LocationNode = FunctionReturnType<typeof api.locations.tree>[number];

const BENEFIT_KEYS = ["b1", "b2", "b3", "b4", "b5", "b6"] as const;
const STEP_KEYS = ["s1", "s2", "s3", "s4", "s5"] as const;
const FAQ_KEYS = ["q1", "q2", "q3"] as const;
export const DOCUMENT_KEYS = ["d1", "d2", "d3", "d4", "d5", "d6", "d7"] as const;

export type SellCopy = {
  title: PageText;
  lede: PageText;
  /** Managed paragraphs after the first one, sanitized when rendered. */
  more: { html: string; lang?: string } | null;
  benefits: { title: PageText; items: string[]; lang?: string };
  steps: ProcessStep[];
  faq: FaqEntry[];
};

export function buildSellCopy(
  page: Pick<PublicPage, "blocks"> | null,
  locale: Locale,
  t: Translate,
  values: PlaceholderValues | null,
): SellCopy {
  const intro = managedIntro(page, locale, values);
  const benefits = managedList(page, "benefits", locale);
  const steps = managedSteps(page, "process", locale);
  const faq = managedFaq(page, locale, values);

  return {
    title: intro?.title ?? { text: t("heading") },
    lede: intro?.lead ?? { text: t("lede") },
    more: intro?.rest ?? null,
    benefits:
      benefits !== null
        ? {
            title: benefits.title ?? { text: t("benefitsHeading") },
            items: benefits.items,
            ...(benefits.lang !== undefined ? { lang: benefits.lang } : {}),
          }
        : {
            title: { text: t("benefitsHeading") },
            items: BENEFIT_KEYS.map((key) => t(`benefits.${key}`)),
          },
    steps:
      steps !== null
        ? steps.items.map((step) => ({
            title: step.title.text,
            body: fixTypography(step.body.text),
            ...(step.title.lang !== undefined ? { titleLang: step.title.lang } : {}),
            ...(step.body.lang !== undefined ? { bodyLang: step.body.lang } : {}),
          }))
        : STEP_KEYS.map((key) => ({
            title: t(`processSteps.${key}.title`),
            body: fixTypography(t(`processSteps.${key}.body`)),
          })),
    faq:
      faq.length > 0
        ? faq
        : FAQ_KEYS.map((key) => ({
            id: key,
            question: { text: t(`faq.${key}.q`) },
            answer: { text: t(`faq.${key}.a`) },
          })),
  };
}

/** Em spaces: a native `<option>` keeps leading whitespace, so the tree indents. */
const INDENT = " ";

/**
 * The seller form's location select. Unlike the valuation funnel, a seller can
 * be anywhere: every place is offered, whether or not it has a price average.
 * One `<optgroup>` per city with areas (the city itself first, then its
 * municipalities with their neighborhoods indented); cities without areas
 * share an "Other cities" group.
 */
export function sellLocationGroups(nodes: readonly LocationNode[], locale: Locale, t: Translate): LocationGroup[] {
  const children = new Map<string, LocationNode[]>();
  const roots: LocationNode[] = [];
  for (const node of nodes) {
    if (node.parentId === undefined) roots.push(node);
    else children.set(node.parentId, [...(children.get(node.parentId) ?? []), node]);
  }
  const byOrder = (a: LocationNode, b: LocationNode) => a.order - b.order;

  const choice = (node: LocationNode, depth: number): LocationChoice => {
    const name = pickL10n(node.name, locale);
    return {
      id: node._id,
      slug: node.slug,
      label: `${INDENT.repeat(depth)}${name.text}`,
      name: name.text,
      ...(name.lang !== locale ? { lang: name.lang } : {}),
    };
  };

  const subtree = (node: LocationNode, depth: number): LocationChoice[] => [
    choice(node, depth),
    ...(children.get(node._id) ?? []).sort(byOrder).flatMap((child) => subtree(child, depth + 1)),
  ];

  const groups: LocationGroup[] = [];
  const smallCities: LocationChoice[] = [];
  for (const root of [...roots].sort(byOrder)) {
    const areas = (children.get(root._id) ?? []).sort(byOrder).flatMap((child) => subtree(child, 1));
    if (areas.length === 0) {
      smallCities.push(choice(root, 0));
      continue;
    }
    const city = pickL10n(root.name, locale);
    groups.push({
      label: city.text,
      ...(city.lang !== locale ? { lang: city.lang } : {}),
      options: [choice(root, 0), ...areas],
    });
  }
  if (smallCities.length > 0) groups.push({ label: t("form.otherCities"), options: smallCities });
  return groups;
}
