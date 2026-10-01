import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { hasLocale } from "next-intl";
import { getTranslations } from "next-intl/server";
import { Badge } from "@/components/site/Badge";
import { Container } from "@/components/site/Container";
import { photoGrade } from "@/components/site/home/art-direction";
import { ArticleByline } from "@/components/site/journal/ArticleByline";
import { RelatedListings, RelatedPosts } from "@/components/site/journal/ArticleRelated";
import { getArticleExtras, getPost, readingMinutes } from "@/components/site/journal/data";
import { formatLongDate, isoDate } from "@/components/site/journal/shared";
import { ShareButtons } from "@/components/site/listing/ShareButtons";
import { textLinkClasses } from "@/components/site/TextLink";
import { JsonLdScript } from "@/components/site/page/JsonLd";
import { PageHero } from "@/components/site/page/PageHero";
import { RichText } from "@/components/site/page/RichText";
import { Link } from "@/i18n/navigation";
import { htmlLang, routing } from "@/i18n/routing";
import { fixTypography } from "@/lib/format";
import { articleJsonLd, breadcrumbJsonLd } from "@/lib/jsonld";
import { pickL10n } from "@/lib/l10n";
import { getPublicSettings } from "@/lib/page-data";
import { absoluteUrl, localizedUrl, pageMetadata, type ShareImage } from "@/lib/seo";

type Props = PageProps<"/[locale]/journal/[slug]">;

/**
 * A journal article (PRD A11). The ink band carries the category, title,
 * standfirst and date; the cover straddles the band and the page; the body
 * runs at a ~68ch measure beside a sticky rail with the author and the share
 * row (after the body on a phone). Related posts and three listings follow.
 */

async function resolve(params: Props["params"]) {
  const { locale, slug } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  return { locale, post: await getPost(slug) };
}

function articleHref(slug: string) {
  return { pathname: "/journal/[slug]" as const, params: { slug } };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, post } = await resolve(params);
  if (post === null) return {};
  const title = pickL10n(post.seo?.metaTitle ?? post.title, locale).text;
  const description = pickL10n(post.seo?.metaDescription ?? post.excerpt, locale).text;
  // The editor's own share picture wins; otherwise the article card
  // (`opengraph-image` next to this page) with the headline over the cover.
  const image =
    post.seo?.ogImageUrl ??
    ({
      url: localizedUrl({ pathname: "/journal/[slug]/opengraph-image", params: { slug: post.slug } }, locale),
      width: 1200,
      height: 630,
      alt: title,
    } satisfies ShareImage);
  return pageMetadata({
    locale,
    href: articleHref(post.slug),
    title,
    description,
    image,
    type: "article",
    ...(post.publishedAt !== undefined ? { publishedTime: post.publishedAt } : {}),
  });
}

export default async function ArticlePage({ params }: Props) {
  const { locale, post } = await resolve(params);
  if (post === null) notFound();

  const [extras, settings, t, tNav] = await Promise.all([
    getArticleExtras(post.slug),
    getPublicSettings(),
    getTranslations({ locale, namespace: "journal" }),
    getTranslations({ locale, namespace: "nav" }),
  ]);

  const lang = htmlLang[locale];
  const title = pickL10n(post.title, locale);
  const excerpt = pickL10n(post.excerpt, locale);
  const body = pickL10n(post.body, locale);
  const minutes = post.readingMinutes ?? readingMinutes(body.text);
  const category = t(`categories.${post.category}`);
  const url = localizedUrl(articleHref(post.slug), locale);
  const agencyName = settings?.companyName ?? "Mihajlo Estate";
  const fallback = (picked: { lang: string }) => (picked.lang !== lang ? picked.lang : undefined);

  const jsonLd = [
    articleJsonLd({
      url,
      headline: title.text,
      description: excerpt.text,
      inLanguage: title.lang,
      ...(post.coverUrl !== undefined ? { image: post.coverUrl } : {}),
      ...(post.publishedAt !== undefined ? { datePublished: post.publishedAt } : {}),
      ...(post.author !== undefined
        ? {
            author: {
              name: post.author.name,
              url: localizedUrl({ pathname: "/agents/[slug]", params: { slug: post.author.slug } }, locale),
            },
          }
        : {}),
      publisher: { name: agencyName, url: localizedUrl("/", locale), logo: absoluteUrl("/apple-icon.png") },
    }),
    breadcrumbJsonLd([
      { name: tNav("home"), url: localizedUrl("/", locale) },
      { name: t("heading"), url: localizedUrl("/journal", locale) },
      { name: category, url: localizedUrl({ pathname: "/journal", query: { category: post.category } }, locale) },
      { name: title.text, url },
    ]),
  ];

  return (
    <>
      <JsonLdScript data={jsonLd} />
      <article>
        <PageHero
          crumbs={[
            { label: t("heading"), href: "/journal" },
            { label: category, href: { pathname: "/journal", query: { category: post.category } } },
            { label: title.text },
          ]}
          eyebrow={category}
          // PageHero only binds one-letter words; a headline also keeps its
          // two-letter prepositions with the next word ("vodič / za strane
          // kupce"), as the index card sets the same title.
          title={title.text}
          titleLang={fallback(title)}
          size="display-m"
        >
          <p
            lang={fallback(excerpt)}
            className="max-w-[44ch] text-pretty font-display text-[clamp(1.375rem,2.1vw,1.875rem)] font-normal leading-[1.3] text-mist"
          >
            {fixTypography(excerpt.text)}
          </p>
          <p className="flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-label uppercase text-mist">
            {post.publishedAt !== undefined ? (
              <>
                <time dateTime={isoDate(post.publishedAt)}>
                  {t("publishedOn", { date: formatLongDate(post.publishedAt, locale) })}
                </time>
                <span aria-hidden="true" className="hidden h-px w-6 bg-hairline-dark sm:block" />
              </>
            ) : null}
            <span>{t("readingTime", { minutes })}</span>
          </p>
        </PageHero>

        {post.coverUrl !== undefined ? (
          <div className="relative">
            {/* The ink band runs on behind the top half of the cover. */}
            <div aria-hidden="true" className="absolute inset-x-0 top-0 h-1/2 bg-ink" />
            <Container className="relative px-0 md:px-gutter-md lg:px-gutter-lg">
              <div className="relative aspect-[4/3] overflow-hidden bg-ink-2 md:aspect-[16/9]">
                <Image
                  src={post.coverUrl}
                  alt=""
                  fill
                  priority
                  sizes="(min-width: 1440px) 1344px, (min-width: 1024px) calc(100vw - 6rem), (min-width: 768px) calc(100vw - 4rem), 100vw"
                  className={`object-cover ${photoGrade(post.coverUrl)}`}
                />
              </div>
            </Container>
          </div>
        ) : null}

        <div className="bg-ivory text-ink">
          <Container className="pb-section pt-14 lg:pb-section-lg lg:pt-24">
            <div className="grid grid-cols-4 gap-x-6 gap-y-14 lg:grid-cols-12">
              <div className="col-span-4 lg:col-span-7 lg:col-start-5">
                <div data-testid="article-body">
                  <RichText html={body.text} profile="post" lang={fallback(body)} size="body-l" />
                </div>

                {/* Tags are stored as Serbian words only, so they are shown on
                    the Serbian page and not dropped as foreign text into the others. */}
                {locale === "sr-Latn" && post.tags.length > 0 ? (
                  <div className="mt-16 hairline-t pt-8">
                    <p className="eyebrow text-stone-text">{t("tags")}</p>
                    <ul className="mt-4 flex flex-wrap gap-2">
                      {post.tags.map((tag) => (
                        <li key={tag}>
                          <Badge>{tag}</Badge>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                <Link
                  href="/journal"
                  className={textLinkClasses(
                    "light",
                    "group/back mt-14 inline-flex items-center gap-3 text-small uppercase tracking-[0.12em]",
                  )}
                >
                  <ArrowLeft
                    aria-hidden="true"
                    strokeWidth={1.25}
                    className="size-4 transition-transform duration-300 ease-out pointer-fine:group-hover/back:-translate-x-1"
                  />
                  {t("allPosts")}
                </Link>
              </div>

              <aside className="col-span-4 flex flex-col gap-10 hairline-t pt-8 lg:sticky lg:top-[calc(var(--header-h,85px)+2.5rem)] lg:col-span-3 lg:col-start-1 lg:row-start-1 lg:self-start">
                <ArticleByline author={post.author} agencyName={agencyName} locale={locale} />
                <div className="hairline-t pt-8">
                  <ShareButtons url={url} title={title.text} />
                </div>
              </aside>
            </div>
          </Container>
        </div>
      </article>

      <RelatedPosts posts={extras.related} />
      <RelatedListings listings={extras.listings} now={extras.now} />
    </>
  );
}
