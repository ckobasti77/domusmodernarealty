import { getTranslations } from "next-intl/server";
import type { ComponentProps } from "react";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

type Href = ComponentProps<typeof Link>["href"];

/** One step of the trail. The last item is the current page and is not linked. */
export type Crumb = { label: string; href?: Href };

/**
 * The visible breadcrumb trail of a content page (the matching
 * `BreadcrumbList` JSON-LD is built separately with `breadcrumbJsonLd`). It
 * always starts at the home page; the current page is `aria-current` text.
 */
export async function Breadcrumbs({
  items,
  tone = "dark",
  className,
}: {
  items: readonly Crumb[];
  /** `dark` for the ink page bands, `light` for ivory surfaces. */
  tone?: "dark" | "light";
  className?: string;
}) {
  const t = await getTranslations("common");
  const tNav = await getTranslations("nav");
  const trail: Crumb[] = [{ label: tNav("home"), href: "/" }, ...items];

  return (
    <nav aria-label={t("breadcrumb")} className={className}>
      <ol
        className={cn(
          "flex flex-wrap items-center gap-x-2 gap-y-1 font-sans text-label uppercase tracking-[0.12em]",
          tone === "dark" ? "text-mist" : "text-stone-text",
        )}
      >
        {trail.map((crumb, index) => {
          const last = index === trail.length - 1;
          return (
            <li key={`${crumb.label}-${index}`} className="flex items-center gap-x-2">
              {last || crumb.href === undefined ? (
                <span aria-current={last ? "page" : undefined} className={tone === "dark" ? "text-ivory" : "text-ink"}>
                  {crumb.label}
                </span>
              ) : (
                <Link
                  href={crumb.href}
                  className={cn(
                    "transition-colors duration-200",
                    tone === "dark" ? "pointer-fine:hover:text-ivory" : "pointer-fine:hover:text-ink",
                  )}
                >
                  {crumb.label}
                </Link>
              )}
              {last ? null : <span aria-hidden="true">/</span>}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
