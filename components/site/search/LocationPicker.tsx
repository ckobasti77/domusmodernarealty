"use client";

import { ChevronDown, Search } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useId, useMemo, useState } from "react";
import { foldDiacritics } from "@/convex/lib/slug";
import type { Locale } from "@/i18n/routing";
import { formatCount } from "@/lib/format";
import { pickL10n } from "@/lib/l10n";
import {
  ancestorsOf,
  countFor,
  descendantsOf,
  type LocationIndex,
  type LocationNode,
} from "@/lib/search-locations";
import { cn } from "@/lib/utils";
import { CheckRow } from "./controls";

/**
 * City → municipality → neighborhood multi-select with a search box (PRD A3).
 *
 * - Selecting a place removes its descendants from the selection: "Beograd"
 *   already covers "Vračar", and the Convex filter ORs every selected place.
 * - A descendant of a selected place shows as checked and disabled, with the
 *   reason in its accessible description.
 * - Places with no listing in the current transaction are hidden unless they
 *   are selected, so the list never offers a dead end.
 */
export type LocationPickerProps = {
  index: LocationIndex;
  transaction: "sale" | "rent";
  selected: readonly string[];
  onChange: (slugs: string[]) => void;
};

/** Case- and diacritic-insensitive haystack: current-locale name, Serbian name, slug. */
function haystack(node: LocationNode, locale: Locale): string {
  const local = pickL10n(node.name, locale).text;
  return foldDiacritics(`${local} ${node.name.sr} ${node.slug}`).toLowerCase();
}

export function LocationPicker({ index, transaction, selected, onChange }: LocationPickerProps) {
  const locale = useLocale() as Locale;
  const t = useTranslations("filters");
  const searchId = useId();
  const [query, setQuery] = useState("");
  // Belgrade is the primary market (BRIEF), so its municipalities start open.
  const [open, setOpen] = useState<ReadonlySet<string>>(() => {
    const initial = new Set<string>();
    for (const root of index.roots) if (root.slug === "beograd") initial.add(root._id);
    for (const slug of selected) {
      const node = index.bySlug.get(slug);
      if (node !== undefined) for (const parent of ancestorsOf(index, node)) initial.add(parent._id);
    }
    return initial;
  });

  const selectedSet = useMemo(() => new Set(selected), [selected]);

  const visible = (node: LocationNode) => countFor(node, transaction) > 0 || selectedSet.has(node.slug);

  const includedBy = (node: LocationNode): LocationNode | undefined =>
    ancestorsOf(index, node).find((parent) => selectedSet.has(parent.slug));

  const toggle = (node: LocationNode, checked: boolean) => {
    if (!checked) {
      onChange(selected.filter((slug) => slug !== node.slug));
      return;
    }
    const covered = new Set(descendantsOf(index, node).map((child) => child.slug));
    onChange([...selected.filter((slug) => !covered.has(slug)), node.slug]);
  };

  const needle = foldDiacritics(query.trim()).toLowerCase();
  const matches = useMemo(() => {
    if (needle.length === 0) return [];
    const out: LocationNode[] = [];
    for (const node of index.byId.values()) {
      if (haystack(node, locale).includes(needle)) out.push(node);
    }
    return out
      .filter((node) => countFor(node, transaction) > 0 || selectedSet.has(node.slug))
      .sort((a, b) => countFor(b, transaction) - countFor(a, transaction))
      .slice(0, 30);
  }, [index, locale, needle, selectedSet, transaction]);

  const row = (node: LocationNode, depth: number, withPath: boolean) => {
    const parent = includedBy(node);
    const name = pickL10n(node.name, locale);
    const children = (index.children.get(node._id) ?? []).filter(visible);
    const expanded = open.has(node._id);
    const reasonId = `${searchId}-${node._id}-reason`;
    const path = withPath
      ? ancestorsOf(index, node)
          .map((ancestor) => pickL10n(ancestor.name, locale).text)
          .join(", ")
      : "";
    return (
      <li key={node._id}>
        <div className="flex items-center gap-1" style={{ paddingLeft: `${depth * 1.25}rem` }}>
          <CheckRow
            className="flex-1"
            checked={selectedSet.has(node.slug) || parent !== undefined}
            disabled={parent !== undefined}
            onChange={(checked) => toggle(node, checked)}
            describedBy={parent !== undefined ? reasonId : undefined}
            testId={`location-${node.slug}`}
            label={
              <span className="flex flex-col">
                <span lang={name.lang === locale ? undefined : name.lang}>{name.text}</span>
                {path.length > 0 ? <span className="text-label text-stone-text">{path}</span> : null}
                {parent !== undefined ? (
                  <span id={reasonId} className="sr-only">
                    {t("locationIncluded", { name: pickL10n(parent.name, locale).text })}
                  </span>
                ) : null}
              </span>
            }
            meta={formatCount(countFor(node, transaction), locale)}
          />
          {!withPath && children.length > 0 ? (
            <button
              type="button"
              aria-expanded={expanded}
              aria-label={t(expanded ? "hideChildren" : "showChildren", { name: name.text })}
              onClick={() =>
                setOpen((prev) => {
                  const next = new Set(prev);
                  if (next.has(node._id)) next.delete(node._id);
                  else next.add(node._id);
                  return next;
                })
              }
              className="inline-flex size-11 shrink-0 items-center justify-center text-stone-text transition-colors duration-200 pointer-fine:hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-[-4px] focus-visible:outline-bronze-text"
            >
              <ChevronDown
                aria-hidden="true"
                strokeWidth={1.25}
                className={cn("size-4 transition-transform duration-200", expanded && "rotate-180")}
              />
            </button>
          ) : null}
        </div>
        {!withPath && expanded && children.length > 0 ? (
          <ul>{children.map((child) => row(child, depth + 1, false))}</ul>
        ) : null}
      </li>
    );
  };

  return (
    <div className="flex flex-col gap-3">
      <label htmlFor={searchId} className="relative block">
        <span className="sr-only">{t("locationSearch")}</span>
        <Search
          aria-hidden="true"
          strokeWidth={1.25}
          className="pointer-events-none absolute left-0 top-1/2 size-4 -translate-y-1/2 text-stone-text"
        />
        <input
          id={searchId}
          type="search"
          autoComplete="off"
          value={query}
          placeholder={t("locationSearch")}
          onChange={(event) => setQuery(event.target.value)}
          data-testid="location-search"
          className="h-11 w-full border-0 border-b border-stone-text bg-transparent pl-7 font-sans text-body text-ink placeholder:text-stone-text focus:border-ink focus-visible:outline-none"
        />
      </label>
      <div data-lenis-prevent="" className="max-h-[min(22rem,50svh)] overflow-y-auto overscroll-contain pr-1">
        {needle.length > 0 ? (
          matches.length > 0 ? (
            <ul>{matches.map((node) => row(node, 0, true))}</ul>
          ) : (
            <p className="py-3 text-small text-stone-text">{t("locationEmpty")}</p>
          )
        ) : (
          <ul>{index.roots.filter(visible).map((root) => row(root, 0, false))}</ul>
        )}
      </div>
    </div>
  );
}
