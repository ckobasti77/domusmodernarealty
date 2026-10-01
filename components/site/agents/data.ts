import "server-only";

import { fetchQuery } from "convex/nextjs";
import type { FunctionReturnType } from "convex/server";
import { cache } from "react";
import { api } from "@/convex/_generated/api";
import type { AgentPublic, LocationRef } from "@/convex/lib/dto";
import type { Locale } from "@/i18n/routing";
import { pickL10n } from "@/lib/l10n";

/**
 * Reads and text helpers for the team pages (PRD A9). `agents.bySlug` returns
 * `null` for an unknown slug and for a profile the admin hid, so both are a 404.
 */

export type AgentDetail = NonNullable<FunctionReturnType<typeof api.agents.bySlug>>;

/** Agent slugs are lowercase ASCII words joined by hyphens ("milica-jovanovic"). */
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const getAgentBySlug = cache(async (slug: string): Promise<AgentDetail | null> => {
  if (slug.length > 96 || !SLUG.test(slug)) return null;
  return await fetchQuery(api.agents.bySlug, { slug });
});

/** `Intl` knows `sr-Latn` for display names; the region-less tags are enough here. */
const INTL_LOCALE: Record<Locale, string> = { "sr-Latn": "sr-Latn", en: "en-GB", ru: "ru", de: "de" };

function capitalize(text: string, locale: Locale): string {
  return text.length > 0 ? text.charAt(0).toLocaleUpperCase(INTL_LOCALE[locale]) + text.slice(1) : text;
}

/** "Srpski, engleski i nemački" — the agent's languages in the page's language. */
export function languageList(codes: readonly string[], locale: Locale): string {
  const names = new Intl.DisplayNames([INTL_LOCALE[locale]], { type: "language", fallback: "code" });
  const list = new Intl.ListFormat(INTL_LOCALE[locale], { style: "long", type: "conjunction" });
  const named = codes.map((code) => {
    try {
      return names.of(code) ?? code;
    } catch {
      // A malformed code typed in the admin is shown as typed, not thrown.
      return code;
    }
  });
  return capitalize(list.format(named), locale);
}

/** "Vračar, Savski venac i Stari grad". */
export function areaList(areas: readonly LocationRef[], locale: Locale): string {
  const list = new Intl.ListFormat(INTL_LOCALE[locale], { style: "long", type: "conjunction" });
  return list.format(areas.map((area) => pickL10n(area.name, locale).text));
}

/** The agent's role, with `lang` only when it fell back to Serbian. */
export function agentRole(agent: Pick<AgentPublic, "role">, locale: Locale): { text: string; lang?: string } {
  const role = pickL10n(agent.role, locale);
  return role.lang !== locale ? { text: role.text, lang: role.lang } : { text: role.text };
}
