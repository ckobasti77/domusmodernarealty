import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { hasLocale } from "next-intl";
import { getTranslations } from "next-intl/server";
import { Container } from "@/components/site/Container";
import { textLinkClasses } from "@/components/site/TextLink";
import { CategoryFilter } from "@/components/site/journal/CategoryFilter";
import { getJournalPage, getPopulatedCategories } from "@/components/site/journal/data";
import { FeaturedPost } from "@/components/site/journal/FeaturedPost";
import { JournalCard } from "@/components/site/journal/JournalCard";
import { LoadMorePosts } from "@/components/site/journal/LoadMorePosts";
import { parseCategory, POST_CATEGORIES, POST_GRID } from "@/components/site/journal/shared";
import { JsonLdScript } from "@/components/site/page/JsonLd";
import { PageHero } from "@/components/site/page/PageHero";
import type { PostCategory } from "@/convex/lib/validators";
import { Link } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { breadcrumbJsonLd } from "@/lib/jsonld";
import { localizedUrl, pageMetadata } from "@/lib/seo";
import { cn } from "@/lib/utils";

type Props = PageProps<"/[locale]/journal">;

/**
 * Journal index (PRD A11): the lead story large, the rest in a grid, a topic
 * filter on `?category=` (validated; anything unknown is "all") and older
 * posts on demand. Everything a crawler needs is in the server HTML; only
 * "show older articles" is a client island.
 */

async function resolve({ params, searchParams }: Pick<Props, "params" | "searchParams">) {
  const [{ locale }, query] = await Promise.all([params, searchParams]);
  if (!hasLocale(routing.locales, locale)) notFound();
  return { locale, category: parseCategory(query.category) };
}

function journalHref(category: PostCategory | undefined) {
  return category === undefined ? ("/journal" as const) : { pathname: "/journal" as const, query: { category } };
}

export async function generateMetadata(props: Props): Promise<Metadata> {
  const { locale, category } = await resolve(props);
  const t = await getTranslations({ locale, namespace: "journal" });
  return pageMetadata({
    locale,
    href: journalHref(category),
    title: category === undefined ? t("heading") : t("categoryTitle", { category: t(`categories.${category}`) }),
    description: t("lede"),
  });
}

export default async function JournalPage(props: Props) {
  const { locale, category } = await resolve(props);
  const [result, populated, t, tNav] = await Promise.all([
    getJournalPage(category),
    getPopulatedCategories(),
    getTranslations({ locale, namespace: "journal" }),
    getTranslations({ locale, namespace: "nav" }),
  ]);

  // A topic reached by URL stays in the filter even while it is empty, so the
  // visitor can see where they are.
  const categories = POST_CATEGORIES.filter((item) => populated.includes(item) || item === category);
  const posts = result.page;
  const featured = posts.find((post) => post.featured) ?? posts[0];
  const rest = posts.filter((post) => post !== featured);

  const crumbs =
    category === undefined
      ? [{ label: t("heading") }]
      : [{ label: t("heading"), href: "/journal" as const }, { label: t(`categories.${category}`) }];
  const trail = [
    { name: tNav("home"), url: localizedUrl("/", locale) },
    { name: t("heading"), url: localizedUrl("/journal", locale) },
    ...(category !== undefined
      ? [{ name: t(`categories.${category}`), url: localizedUrl(journalHref(category), locale) }]
      : []),
  ];

  return (
    <>
      <JsonLdScript data={breadcrumbJsonLd(trail)} />
      <PageHero crumbs={crumbs} eyebrow={t("eyebrow")} title={t("heading")} lede={t("lede")} />

      <div className="bg-ivory text-ink">
        <Container className="pb-section pt-10 lg:pb-section-lg lg:pt-14">
          <CategoryFilter categories={categories} active={category} />

          {featured === undefined ? (
            <div className="py-24 lg:py-32">
              <p className="max-w-[28ch] font-display text-h2">
                {category === undefined ? t("emptyAll") : t("emptyCategory")}
              </p>
              <p className="mt-5 max-w-[52ch] text-body-l text-stone-text">{t("emptyHint")}</p>
              <div className="mt-10 flex flex-wrap gap-x-10 gap-y-4">
                {category !== undefined ? (
                  <Link href="/journal" scroll={false} className={textLinkClasses("light", "text-small uppercase tracking-[0.12em]")}>
                    {t("allPosts")}
                  </Link>
                ) : null}
                <Link href="/properties" className={textLinkClasses("light", "text-small uppercase tracking-[0.12em]")}>
                  {t("allListings")}
                </Link>
              </div>
            </div>
          ) : (
            <>
              <div className="mt-12 lg:mt-20">
                <FeaturedPost post={featured} />
              </div>

              {rest.length > 0 ? (
                <ul className={cn(POST_GRID, "mt-20 hairline-t pt-16 lg:mt-28 lg:pt-20")}>
                  {rest.map((post) => (
                    <li key={post._id}>
                      <JournalCard post={post} />
                    </li>
                  ))}
                </ul>
              ) : null}

              {result.isDone ? null : (
                <LoadMorePosts key={category ?? "all"} category={category} cursor={result.continueCursor} />
              )}
            </>
          )}
        </Container>
      </div>
    </>
  );
}
