import { useTranslations } from "next-intl";

/**
 * The first focusable element on every public page (WCAG 2.4.1). Hidden until
 * focused, then it parks itself over the header — `focus:` utilities only, no JS.
 *
 * The target `#main` must exist on every page that renders this.
 */
export function SkipLink() {
  const t = useTranslations("common");

  return (
    <a
      href="#main"
      className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-(--z-preloader) focus:inline-flex focus:min-h-11 focus:items-center focus:bg-ink focus:px-5 focus:font-sans focus:text-small focus:uppercase focus:tracking-[0.12em] focus:text-ivory"
    >
      {t("skipToContent")}
    </a>
  );
}
