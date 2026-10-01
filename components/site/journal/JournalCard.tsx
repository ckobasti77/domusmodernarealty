import { useLocale, useTranslations } from "next-intl";
import { ImageReveal } from "@/components/motion/ImageReveal";
import { photoGrade } from "@/components/site/home/art-direction";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { fixTypography } from "@/lib/format";
import { pickL10n } from "@/lib/l10n";
import { cn } from "@/lib/utils";
import { formatLongDate, isoDate, type PostCard } from "./shared";

/**
 * A journal card: cover, the meta line (category, date, reading time), title
 * and excerpt. The whole card is one link — the title anchor is stretched over
 * the article — so it is a single tab stop. Covers sit next to the title they
 * illustrate, so their alt is empty (as on the landing teaser).
 *
 * No hooks beyond next-intl's, which work in Server Components too: the index
 * renders these on the server and the "load more" island renders the next
 * pages with the same component in the browser.
 */

/** Category · date · reading time, in the mono label face. */
export function PostMeta({ post, className }: { post: PostCard; className?: string }) {
  const locale = useLocale() as Locale;
  const t = useTranslations("journal");
  return (
    <p className={cn("flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-label uppercase", className)}>
      <span className="text-bronze-text">{t(`categories.${post.category}`)}</span>
      {post.publishedAt !== undefined ? (
        <time dateTime={isoDate(post.publishedAt)} className="text-stone-text">
          {formatLongDate(post.publishedAt, locale)}
        </time>
      ) : null}
      {post.readingMinutes !== undefined ? (
        <span className="text-stone-text">{t("readingTime", { minutes: post.readingMinutes })}</span>
      ) : null}
    </p>
  );
}

/** Stretched title link: covers the card, draws its focus ring around the whole card. */
export const STRETCHED_LINK =
  "transition-colors duration-200 before:absolute before:inset-0 before:z-10 before:content-[''] focus-visible:outline-none focus-visible:before:outline-2 focus-visible:before:outline-offset-4 focus-visible:before:outline-current pointer-fine:group-hover/post:text-bronze-text";

export function JournalCard({ post, level = 2 }: { post: PostCard; level?: 2 | 3 }) {
  const locale = useLocale() as Locale;
  const title = pickL10n(post.title, locale);
  const excerpt = pickL10n(post.excerpt, locale);
  const Heading = level === 2 ? "h2" : "h3";

  return (
    <article data-testid="journal-card" className="group/post relative flex flex-col">
      {post.coverUrl !== undefined ? (
        <ImageReveal
          src={post.coverUrl}
          alt=""
          ratio="aspect-[3/2]"
          crop={2 / 3}
          sizes="(min-width: 1024px) 30vw, (min-width: 768px) 45vw, 92vw"
          imageClassName={cn(
            photoGrade(post.coverUrl),
            "transition-[scale] duration-700 ease-estate pointer-fine:group-hover/post:scale-[1.03]",
          )}
        />
      ) : null}

      <PostMeta post={post} className={post.coverUrl !== undefined ? "mt-6" : "hairline-t pt-6"} />

      <Heading
        lang={title.lang !== locale ? title.lang : undefined}
        // Not a SplitText target, so balanced wrapping is allowed.
        className="mt-3 max-w-[26ch] text-balance font-display text-h3 font-normal"
      >
        <Link
          href={{ pathname: "/journal/[slug]", params: { slug: post.slug } }}
          className={STRETCHED_LINK}
        >
          {fixTypography(title.text)}
        </Link>
      </Heading>

      <p
        lang={excerpt.lang !== locale ? excerpt.lang : undefined}
        className="mt-3 line-clamp-3 max-w-[52ch] text-pretty text-body text-stone-text"
      >
        {fixTypography(excerpt.text)}
      </p>
    </article>
  );
}
