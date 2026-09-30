"use client";

import { ArrowRight, Search } from "lucide-react";
import { useTranslations } from "next-intl";
import { useId, useState, type FormEvent } from "react";
import { Link } from "@/i18n/navigation";
import { fixOrphans } from "@/lib/format";
import { LIMITS, type SearchState } from "@/lib/search-params";
import { cn } from "@/lib/utils";

/**
 * The ink band at the top of the search page: breadcrumb, the H1 (which tracks
 * the filters, e.g. "Stanovi na prodaju — Vračar") and the free-text search
 * for a street, a neighborhood or a listing reference.
 *
 * It is deliberately compact — the results are the page, so the first price
 * shows on a 1440×900 screen and the first photo on a phone — and on desktop
 * it shares the list/map split below it, so the search field starts on the
 * map's left edge instead of on a second vertical axis.
 */
export function SearchHeader({
  title,
  showLeaf,
  mapHidden,
  state,
  onChange,
}: {
  title: string;
  /** The breadcrumb names the search only when it says more than "Nekretnine". */
  showLeaf: boolean;
  mapHidden: boolean;
  state: SearchState;
  onChange: (next: SearchState) => void;
}) {
  const t = useTranslations("search");
  const tNav = useTranslations("nav");
  const tSeo = useTranslations("seo");
  const tFilters = useTranslations("filters");
  const tCommon = useTranslations("common");

  return (
    <div className="bg-ink text-ivory">
      <div
        className={cn(
          "grid gap-6 pb-6 pt-[calc(var(--header-h,85px)+1.25rem)] lg:items-end lg:gap-0 lg:pb-8",
          mapHidden ? "lg:grid-cols-[7fr_5fr]" : "lg:grid-cols-[55fr_45fr]",
        )}
      >
        <div className="min-w-0 px-gutter md:px-gutter-md lg:px-gutter-lg">
          <nav aria-label={t("breadcrumbLabel")}>
            <ol className="flex flex-wrap items-center gap-x-2 gap-y-1 font-sans text-label uppercase tracking-[0.12em] text-mist">
              <li>
                <Link href="/" className="transition-colors duration-200 pointer-fine:hover:text-ivory">
                  {tNav("home")}
                </Link>
              </li>
              <li aria-hidden="true">/</li>
              {showLeaf ? (
                <>
                  <li>
                    <Link href="/properties" className="transition-colors duration-200 pointer-fine:hover:text-ivory">
                      {tNav("properties")}
                    </Link>
                  </li>
                  <li aria-hidden="true">/</li>
                  <li aria-current="page" className="text-ivory">
                    {title}
                  </li>
                </>
              ) : (
                <li aria-current="page" className="text-ivory">
                  {tNav("properties")}
                </li>
              )}
            </ol>
          </nav>
          <h1
            className="mt-4 font-display text-h2 font-normal lg:line-clamp-1 lg:text-[clamp(2.5rem,3.4vw,3.25rem)] lg:leading-[1.1]"
            data-testid="search-title"
          >
            {fixOrphans(title)}
          </h1>
          <p className="mt-3 hidden max-w-xl text-body text-mist md:block">{tSeo("propertiesDescription")}</p>
        </div>
        <div className="min-w-0 px-gutter md:px-gutter-md lg:pl-0 lg:pr-gutter-lg">
          <QueryForm
            state={state}
            onChange={onChange}
            labels={{
              field: tFilters("query"),
              placeholder: t("queryPlaceholder"),
              submit: tCommon("search"),
            }}
          />
        </div>
      </div>
    </div>
  );
}

function QueryForm({
  state,
  onChange,
  labels,
}: {
  state: SearchState;
  onChange: (next: SearchState) => void;
  labels: { field: string; placeholder: string; submit: string };
}) {
  const id = useId();
  const [text, setText] = useState(state.q ?? "");
  // Follow the URL (a removed chip, Back) without remounting the focused field.
  const [seed, setSeed] = useState(state.q);
  if (seed !== state.q) {
    setSeed(state.q);
    setText(state.q ?? "");
  }

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const q = text.trim().slice(0, LIMITS.qLength);
    const next: SearchState = { ...state };
    delete next.q;
    if (next.sort === "relevance") delete next.sort;
    onChange(q.length > 0 ? { ...next, q } : next);
  };

  return (
    <form role="search" onSubmit={submit} className="flex items-end gap-3">
      <label htmlFor={id} className="flex min-w-0 flex-1 flex-col gap-2">
        <span className="font-sans text-label uppercase tracking-[0.12em] text-mist">{labels.field}</span>
        <span className="relative block">
          <Search
            aria-hidden="true"
            strokeWidth={1.25}
            className="pointer-events-none absolute left-0 top-1/2 size-4 -translate-y-1/2 text-mist"
          />
          <input
            id={id}
            type="search"
            name="q"
            value={text}
            maxLength={LIMITS.qLength}
            autoComplete="off"
            placeholder={labels.placeholder}
            onChange={(event) => setText(event.target.value)}
            data-testid="search-query"
            className="h-12 w-full text-ellipsis border-0 border-b border-ivory/40 bg-transparent pl-7 font-sans text-body text-ivory placeholder:text-mist focus:border-ivory focus-visible:outline-none"
          />
        </span>
      </label>
      <button
        type="submit"
        aria-label={labels.submit}
        className="inline-flex size-12 shrink-0 items-center justify-center border border-ivory/40 text-ivory transition-colors duration-200 pointer-fine:hover:border-bronze pointer-fine:hover:text-bronze focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-bronze"
      >
        <ArrowRight aria-hidden="true" strokeWidth={1.25} className="size-5" />
      </button>
    </form>
  );
}
