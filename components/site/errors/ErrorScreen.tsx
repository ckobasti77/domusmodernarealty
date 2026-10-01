import { ArrowRight, ArrowUpRight, Search } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { Container } from "@/components/site/Container";
import { cn } from "@/lib/utils";

/**
 * The shared body of every error surface: the localized 404, the localized
 * error boundary and the bilingual global 404 (which has no locale, no header
 * and no next-intl context). It therefore takes only plain strings and
 * already-localized hrefs, holds no state and touches no hook, so a Server
 * Component, a Client Component and the bare global document can all render it.
 *
 * The ink band sits under the transparent header like every page hero. A dead
 * end is the worst place to leave a visitor, so the page offers the two ways
 * on: a search that works without JavaScript (a plain GET to the localized
 * properties page) and the handful of pages people most often came for.
 */

export type ErrorLink = {
  href: string;
  label: string;
  /** BCP-47 tag when the label is in another language than the page (global 404). */
  lang?: string;
};

export type ErrorSearch = {
  /** The localized properties URL; the query travels as `?q=`. */
  action: string;
  label: string;
  placeholder: string;
  submit: string;
  testId?: string;
};

export type ErrorScreenProps = {
  /**
   * The HTTP status, when there is an honest one (404). It leads the eyebrow
   * and is set large and decorative behind the copy. The error boundary also
   * catches failures in the browser, which have no status, so it passes none.
   */
  code?: string;
  eyebrow: string;
  title: string;
  /** A second-language title under the first (the bilingual global 404). */
  subtitle?: { text: string; lang: string };
  body: ReactNode;
  /** A retry button, for the error boundary. */
  actions?: ReactNode;
  search: ErrorSearch;
  linksHeading: string;
  links: readonly ErrorLink[];
  /** Small print under the search (an error reference). */
  footnote?: ReactNode;
};

const SEARCH_INPUT_ID = "error-search-q";

export function ErrorScreen({
  code,
  eyebrow,
  title,
  subtitle,
  body,
  actions,
  search,
  linksHeading,
  links,
  footnote,
}: ErrorScreenProps) {
  return (
    <div className="relative isolate flex min-h-svh flex-col overflow-hidden bg-ink text-ivory">
      {/* The figure is texture, not content: the eyebrow says it in words. */}
      {code !== undefined ? (
        <p
          aria-hidden="true"
          data-numeric
          className="pointer-events-none absolute -bottom-[0.18em] -right-[0.04em] -z-10 select-none font-display text-[clamp(11rem,30vw,30rem)] leading-none tracking-[-0.04em] text-ivory/[0.045]"
        >
          {code}
        </p>
      ) : null}

      <Container className="flex flex-1 flex-col justify-center pb-section pt-[calc(var(--header-h,85px)+3rem)] lg:pb-32 lg:pt-[calc(var(--header-h,85px)+5rem)]">
        <div className="grid gap-16 lg:grid-cols-12 lg:gap-x-6">
          <div className="flex min-w-0 flex-col gap-6 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-3 motion-safe:duration-700 motion-safe:ease-out lg:col-span-7">
            <p className="eyebrow flex items-center gap-3 text-bronze">
              {code !== undefined ? (
                <>
                  <span data-numeric className="font-mono text-label">
                    {code}
                  </span>
                  <span aria-hidden="true" className="h-px w-8 bg-bronze/60" />
                </>
              ) : null}
              <span>{eyebrow}</span>
            </p>
            <h1 className="max-w-[16ch] font-display text-display-l font-normal text-ivory">
              {title}
              {subtitle !== undefined ? (
                <span lang={subtitle.lang} className="mt-3 block font-display text-h2 italic text-mist">
                  {subtitle.text}
                </span>
              ) : null}
            </h1>
            <div className="max-w-[52ch] text-pretty text-body-l text-mist">{body}</div>
            {actions !== undefined ? <div className="flex flex-wrap items-center gap-4 pt-2">{actions}</div> : null}

            <form
              role="search"
              method="get"
              action={search.action}
              data-testid={search.testId}
              className="mt-6 max-w-[36rem]"
            >
              <label htmlFor={SEARCH_INPUT_ID} className="eyebrow block text-mist">
                {search.label}
              </label>
              {/* The underline is the control's boundary, so it clears 3:1 on
                  ink (ivory at 40%) and turns bronze while the field has focus. */}
              <div className="mt-3 flex items-center gap-3 border-b border-ivory/40 transition-colors duration-200 focus-within:border-bronze">
                <Search aria-hidden="true" strokeWidth={1.25} className="size-5 shrink-0 text-mist" />
                <input
                  id={SEARCH_INPUT_ID}
                  type="search"
                  name="q"
                  maxLength={80}
                  autoComplete="off"
                  enterKeyHint="search"
                  placeholder={search.placeholder}
                  className="min-h-14 w-full min-w-0 bg-transparent py-3 font-sans text-body-l text-ivory placeholder:text-mist focus:outline-none [&::-webkit-search-cancel-button]:hidden"
                />
                <button
                  type="submit"
                  className="group/submit inline-flex min-h-11 shrink-0 items-center gap-2 font-sans text-small font-medium uppercase tracking-[0.12em] text-ivory transition-colors duration-200 pointer-fine:hover:text-bronze focus-visible:outline-bronze"
                >
                  {search.submit}
                  <ArrowRight
                    aria-hidden="true"
                    strokeWidth={1.25}
                    className="size-4 transition-transform duration-200 ease-out pointer-fine:group-hover/submit:translate-x-0.5"
                  />
                </button>
              </div>
            </form>

            {footnote !== undefined ? <div className="text-small text-mist">{footnote}</div> : null}
          </div>

          <nav
            aria-labelledby="error-links-heading"
            className="min-w-0 motion-safe:animate-in motion-safe:fade-in motion-safe:delay-150 motion-safe:duration-700 motion-safe:fill-mode-both lg:col-span-4 lg:col-start-9 lg:self-end"
          >
            <h2 id="error-links-heading" className="eyebrow text-mist">
              {linksHeading}
            </h2>
            <ul className="hairline-t-dark mt-5">
              {links.map((link) => (
                <li key={link.href} className="hairline-b-dark">
                  <Link
                    href={link.href}
                    lang={link.lang}
                    className={cn(
                      "group/link flex min-h-14 items-center justify-between gap-6 py-3",
                      "font-display text-[1.5rem] leading-tight text-ivory transition-colors duration-200",
                      "pointer-fine:hover:text-bronze focus-visible:outline-bronze",
                    )}
                  >
                    <span>{link.label}</span>
                    <ArrowUpRight
                      aria-hidden="true"
                      strokeWidth={1.25}
                      className="size-5 shrink-0 text-mist transition-[translate,color] duration-200 ease-out pointer-fine:group-hover/link:-translate-y-0.5 pointer-fine:group-hover/link:translate-x-0.5 pointer-fine:group-hover/link:text-bronze"
                    />
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      </Container>
    </div>
  );
}
