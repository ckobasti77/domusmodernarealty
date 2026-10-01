import { ArrowRight } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { ImageReveal } from "@/components/motion/ImageReveal";
import { Eyebrow } from "@/components/site/Eyebrow";
import { photoGrade } from "@/components/site/home/art-direction";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { fixTypography } from "@/lib/format";
import { pickL10n } from "@/lib/l10n";
import { cn } from "@/lib/utils";
import { PostMeta, STRETCHED_LINK } from "./JournalCard";
import type { PostCard } from "./shared";

/**
 * The lead story of the journal index: a wide photograph with the title,
 * standfirst and meta line beside it on desktop (text aligned to the image's
 * foot, the editorial offset), stacked on a phone. One link, like the cards.
 */
export function FeaturedPost({ post }: { post: PostCard }) {
  const locale = useLocale() as Locale;
  const t = useTranslations("journal");
  const title = pickL10n(post.title, locale);
  const excerpt = pickL10n(post.excerpt, locale);

  return (
    <article
      data-testid="journal-featured"
      className="group/post relative grid grid-cols-4 gap-x-6 gap-y-8 lg:grid-cols-12 lg:items-end"
    >
      {post.coverUrl !== undefined ? (
        <ImageReveal
          src={post.coverUrl}
          alt=""
          ratio="aspect-[3/2]"
          crop={2 / 3}
          priority
          sizes="(min-width: 1440px) 900px, (min-width: 1024px) 64vw, 100vw"
          className="col-span-4 lg:col-span-8"
          imageClassName={cn(
            photoGrade(post.coverUrl),
            "transition-[scale] duration-700 ease-estate pointer-fine:group-hover/post:scale-[1.03]",
          )}
        />
      ) : null}

      <div className={cn("col-span-4 flex flex-col", post.coverUrl !== undefined ? "lg:pb-1" : "lg:col-span-8")}>
        <Eyebrow tone="accent">{t("featured")}</Eyebrow>
        <h2
          lang={title.lang !== locale ? title.lang : undefined}
          className="mt-5 max-w-[20ch] text-balance font-display text-[clamp(2rem,3.2vw,3rem)] font-normal leading-[1.05] tracking-[-0.01em]"
        >
          <Link
            href={{ pathname: "/journal/[slug]", params: { slug: post.slug } }}
            className={STRETCHED_LINK}
          >
            {fixTypography(title.text)}
          </Link>
        </h2>
        <p
          lang={excerpt.lang !== locale ? excerpt.lang : undefined}
          className="mt-5 max-w-[46ch] text-pretty text-body-l text-stone-text"
        >
          {fixTypography(excerpt.text)}
        </p>
        <PostMeta post={post} className="mt-6" />
        {/* The card's link is the title; this is only its visual cue. */}
        <span
          aria-hidden="true"
          className="mt-8 inline-flex items-center gap-3 text-small uppercase tracking-[0.12em] text-ink transition-colors duration-200 pointer-fine:group-hover/post:text-bronze-text"
        >
          {t("readMore")}
          <ArrowRight
            strokeWidth={1.25}
            className="size-4 transition-transform duration-300 ease-out pointer-fine:group-hover/post:translate-x-1"
          />
        </span>
      </div>
    </article>
  );
}
