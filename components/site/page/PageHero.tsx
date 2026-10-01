import type { ReactNode } from "react";
import { SplitReveal } from "@/components/motion/SplitReveal";
import { Container } from "@/components/site/Container";
import { Eyebrow } from "@/components/site/Eyebrow";
import { fixTypography, fixWidows } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Breadcrumbs, type Crumb } from "./Breadcrumbs";

/**
 * The ink band that opens every content page (valuation, sell, locations,
 * agents, about, contact, journal, favorites, compare, legal). The header is
 * transparent over it, so the band starts under the fixed bar
 * (`--header-h`). It holds the trail, the page's single `h1` (masked line
 * reveal) and an optional lede; `aside` takes the right-hand column on wide
 * screens (a figure, a key fact, an image) and `children` sits under the lede
 * (filters, a call to action).
 *
 * No `text-balance` on the title: SplitText owns its line breaks (CLAUDE.md).
 */
export function PageHero({
  crumbs,
  eyebrow,
  title,
  titleLang,
  lede,
  ledeLang,
  aside,
  asideClassName,
  children,
  size = "display-l",
  className,
}: {
  crumbs: readonly Crumb[];
  eyebrow?: ReactNode;
  title: string;
  /** BCP-47 tag when the title fell back to Serbian (managed content). */
  titleLang?: string;
  lede?: string;
  ledeLang?: string;
  aside?: ReactNode;
  /** Classes for the aside's grid cell (e.g. `max-lg:hidden` when it only matters beside the title). */
  asideClassName?: string;
  children?: ReactNode;
  size?: "display-l" | "display-m";
  className?: string;
}) {
  // A German compound ("Immobilienbewertung") is wider than a phone at the
  // display size, and a masked line cannot wrap or hyphenate inside a word,
  // so a title with a very long word steps down one size below `sm`.
  const longestWord = Math.max(...title.split(/\s+/).map((word) => word.length));
  return (
    <div className={cn("bg-ink text-ivory", className)}>
      <Container className="pb-14 pt-[calc(var(--header-h,85px)+2rem)] lg:pb-20 lg:pt-[calc(var(--header-h,85px)+3.5rem)]">
        <Breadcrumbs items={crumbs} />
        <div
          className={cn(
            "mt-10 grid gap-10 lg:mt-16",
            aside !== undefined && "lg:grid-cols-12 lg:items-end lg:gap-x-6",
          )}
        >
          <div className={cn("flex min-w-0 flex-col gap-6", aside !== undefined && "lg:col-span-7")}>
            {eyebrow !== undefined ? <Eyebrow tone="accentDark">{eyebrow}</Eyebrow> : null}
            <h1
              lang={titleLang}
              className={cn(
                "max-w-[18ch] font-display font-normal text-ivory",
                size === "display-l" ? "text-display-l" : "text-display-m",
                longestWord >= 15 && "max-sm:text-[2.25rem]",
              )}
            >
              <SplitReveal as="span" className="block">
                {fixWidows(fixTypography(title))}
              </SplitReveal>
            </h1>
            {lede !== undefined && lede.length > 0 ? (
              <p lang={ledeLang} className="max-w-[56ch] text-pretty text-body-l text-mist">
                {fixTypography(lede)}
              </p>
            ) : null}
            {children}
          </div>
          {aside !== undefined ? <div className={cn("min-w-0 lg:col-span-5", asideClassName)}>{aside}</div> : null}
        </div>
      </Container>
    </div>
  );
}
