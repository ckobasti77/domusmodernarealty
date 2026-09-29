import { ArrowRight } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { ImageReveal } from "@/components/motion/ImageReveal";
import { Container } from "@/components/site/Container";
import { SectionHeading } from "@/components/site/SectionHeading";
import { textLinkClasses } from "@/components/site/TextLink";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { fixTypography } from "@/lib/format";
import { pickL10n } from "@/lib/l10n";
import { cn } from "@/lib/utils";
import type { PostCard } from "./data";

/**
 * Journal teaser (DESIGN §6.11), on ivory: the three newest published posts,
 * one large beside two small. Each post is one link (the title stretched over
 * its article). Covers are decorative next to the title, so their alt is empty.
 * With no published posts the section is left out.
 */

type Size = "lead" | "side";

async function Post({ post, size, locale }: { post: PostCard; size: Size; locale: Locale }) {
  const t = await getTranslations({ locale, namespace: "home" });
  const tJournal = await getTranslations({ locale, namespace: "journal" });
  const title = pickL10n(post.title, locale);
  const excerpt = pickL10n(post.excerpt, locale);
  const lead = size === "lead";

  const plate = lead && post.coverUrl !== undefined;

  return (
    // `isolate` + a negative z-index on the photograph let the lead's title
    // plate overlap the picture while staying un-positioned, so the stretched
    // title link still covers the whole article.
    <article className="group/post relative isolate">
      {post.coverUrl !== undefined ? (
        <ImageReveal
          src={post.coverUrl}
          alt=""
          ratio={lead ? "aspect-[4/3]" : "aspect-[3/2]"}
          crop={lead ? 0.75 : 2 / 3}
          sizes={lead ? "(min-width: 1024px) 56vw, 92vw" : "(min-width: 1024px) 30vw, 92vw"}
          className="-z-10"
          imageClassName="photo-grade transition-[scale] duration-700 ease-estate pointer-fine:group-hover/post:scale-[1.03]"
        />
      ) : null}

      <div className={plate ? "-mt-16 w-fit max-w-[88%] bg-ivory pr-8 pt-6 lg:-mt-20 lg:pr-12 lg:pt-8" : "mt-6"}>
        <p className="flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-label uppercase">
          <span className="text-bronze-text">{tJournal(`categories.${post.category}`)}</span>
          {post.readingMinutes !== undefined ? (
            <span className="text-stone-text">{t("journalReadingTime", { minutes: post.readingMinutes })}</span>
          ) : null}
        </p>

        <h3
          lang={title.lang !== locale ? title.lang : undefined}
          className={cn(
            // Not a SplitText target, so balanced wrapping is allowed here.
            "mt-3 text-balance font-display font-normal",
            lead ? "max-w-[22ch] text-[clamp(2rem,3.2vw,3rem)] leading-[1.05]" : "max-w-[24ch] text-h2",
          )}
        >
          <Link
            href={{ pathname: "/journal/[slug]", params: { slug: post.slug } }}
            prefetch={false}
            className="transition-colors duration-200 before:absolute before:inset-0 pointer-fine:group-hover/post:text-bronze-text"
          >
            {fixTypography(title.text)}
          </Link>
        </h3>
      </div>

      {lead ? (
        <p
          lang={excerpt.lang !== locale ? excerpt.lang : undefined}
          className="mt-4 max-w-[56ch] text-pretty text-body-l text-stone-text"
        >
          {fixTypography(excerpt.text)}
        </p>
      ) : null}
    </article>
  );
}

export async function JournalTeaser({ locale, posts }: { locale: Locale; posts: readonly PostCard[] }) {
  const [first, ...rest] = posts;
  if (first === undefined) return null;
  const t = await getTranslations({ locale, namespace: "home" });

  return (
    <section aria-labelledby="journal-title" className="bg-ivory py-section text-ink lg:py-section-lg">
      <Container>
        <SectionHeading
          id="journal-title"
          eyebrow={t("journalEyebrow")}
          title={t("journalHeading")}
          action={
            <Link
              href="/journal"
              prefetch={false}
              className={textLinkClasses(
                "light",
                "group/all inline-flex items-center gap-3 text-small uppercase tracking-[0.12em]",
              )}
            >
              {t("journalAll")}
              <ArrowRight
                aria-hidden="true"
                strokeWidth={1.25}
                className="size-4 transition-transform duration-300 ease-out pointer-fine:group-hover/all:translate-x-1"
              />
            </Link>
          }
        />

        <div className="mt-14 grid grid-cols-4 gap-x-6 gap-y-16 lg:mt-20 lg:grid-cols-12">
          <div className="col-span-4 lg:col-span-7">
            <Post post={first} size="lead" locale={locale} />
          </div>
          {rest.length > 0 ? (
            <div className="col-span-4 flex flex-col gap-16 lg:col-span-4 lg:col-start-9">
              {rest.slice(0, 2).map((post) => (
                <Post key={post._id} post={post} size="side" locale={locale} />
              ))}
            </div>
          ) : null}
        </div>
      </Container>
    </section>
  );
}
