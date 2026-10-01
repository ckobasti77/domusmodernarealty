import { useTranslations } from "next-intl";
import type { PostCategory } from "@/convex/lib/validators";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

/**
 * The topic filter: plain links to `?category=…`, rendered on the server, so
 * every topic has a real URL and works without JavaScript. The current one
 * carries `aria-current` and a bronze rule. `scroll={false}` keeps the visitor
 * at the filter instead of jumping back to the hero on every switch.
 *
 * On a phone the row scrolls sideways (x only, so a vertical swipe still
 * scrolls the page).
 */
export function CategoryFilter({
  categories,
  active,
}: {
  categories: readonly PostCategory[];
  active: PostCategory | undefined;
}) {
  const t = useTranslations("journal");
  const items: { key: string; label: string; category: PostCategory | undefined }[] = [
    { key: "all", label: t("allPosts"), category: undefined },
    ...categories.map((category) => ({ key: category, label: t(`categories.${category}`), category })),
  ];

  return (
    <nav aria-label={t("filterLabel")} data-testid="journal-filter" className="hairline-b">
      <ul className="-mx-gutter flex gap-x-8 overflow-x-auto overscroll-x-contain px-gutter py-1.5 [scrollbar-width:none] md:mx-0 md:flex-wrap md:overflow-visible md:px-0 md:py-0 lg:gap-x-10">
        {items.map((item) => {
          const current = item.category === active;
          return (
            <li key={item.key} className="shrink-0">
              <Link
                href={item.category === undefined ? "/journal" : { pathname: "/journal", query: { category: item.category } }}
                scroll={false}
                aria-current={current ? "page" : undefined}
                className={cn(
                  "relative inline-flex min-h-12 items-center whitespace-nowrap text-small uppercase tracking-[0.12em] transition-colors duration-200",
                  "after:absolute after:inset-x-0 after:-bottom-1.5 after:h-px md:after:bottom-0 after:origin-left after:bg-bronze after:transition-transform after:duration-300 after:ease-out",
                  current
                    ? "text-ink after:scale-x-100"
                    : "text-stone-text after:scale-x-0 pointer-fine:hover:text-ink pointer-fine:hover:after:scale-x-100",
                )}
              >
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
