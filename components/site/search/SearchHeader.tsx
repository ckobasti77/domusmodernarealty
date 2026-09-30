"use client";

import { ArrowRight, Search } from "lucide-react";
import { useTranslations } from "next-intl";
import { useId, useState, type FormEvent } from "react";
import { Container } from "@/components/site/Container";
import { Link } from "@/i18n/navigation";
import { fixOrphans } from "@/lib/format";
import { LIMITS, type SearchState } from "@/lib/search-params";

/**
 * The ink band at the top of the search page: breadcrumb, the H1 (which tracks
 * the filters, e.g. "Stanovi na prodaju — Vračar") and the free-text search
 * for a street, a neighborhood or a listing reference.
 */
export function SearchHeader({
  title,
  filtered,
  state,
  onChange,
}: {
  title: string;
  filtered: boolean;
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
      <Container width="bleed" className="pb-10 pt-28 md:pb-12 md:pt-32">
        <nav aria-label={t("breadcrumbLabel")}>
          <ol className="flex flex-wrap items-center gap-x-2 gap-y-1 font-sans text-label uppercase tracking-[0.12em] text-mist">
            <li>
              <Link href="/" className="transition-colors duration-200 pointer-fine:hover:text-ivory">
                {tNav("home")}
              </Link>
            </li>
            <li aria-hidden="true">/</li>
            {filtered ? (
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

        <div className="mt-8 grid gap-8 lg:grid-cols-12 lg:items-end">
          <div className="lg:col-span-7">
            <h1 className="font-display text-display-m font-normal" data-testid="search-title">
              {fixOrphans(title)}
            </h1>
            <p className="mt-4 max-w-xl text-body-l text-mist">{tSeo("propertiesDescription")}</p>
          </div>
          <div className="lg:col-span-5">
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
      </Container>
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
            className="h-12 w-full border-0 border-b border-ivory/40 bg-transparent pl-7 font-sans text-body text-ivory placeholder:text-mist focus:border-ivory focus-visible:outline-none"
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
