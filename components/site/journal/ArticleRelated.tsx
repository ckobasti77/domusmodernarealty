import { ArrowRight } from "lucide-react";
import { useTranslations } from "next-intl";
import type { ComponentProps } from "react";
import { Container, Section } from "@/components/site/Container";
import { PropertyCard } from "@/components/site/PropertyCard";
import { textLinkClasses } from "@/components/site/TextLink";
import type { ListingCard } from "@/convex/lib/dto";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { JournalCard } from "./JournalCard";
import { POST_GRID, type PostCard } from "./shared";

type Href = ComponentProps<typeof Link>["href"];

/** A related band's heading with its "see all" link beside it. */
function BandHeading({ id, title, href, linkLabel }: { id: string; title: string; href: Href; linkLabel: string }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
      <h2 id={id} className="font-display text-h2 font-normal">
        {title}
      </h2>
      <Link
        href={href}
        prefetch={false}
        className={textLinkClasses("light", "group/all inline-flex items-center gap-3 text-small uppercase tracking-[0.12em]")}
      >
        {linkLabel}
        <ArrowRight
          aria-hidden="true"
          strokeWidth={1.25}
          className="size-4 transition-transform duration-300 ease-out pointer-fine:group-hover/all:translate-x-1"
        />
      </Link>
    </div>
  );
}

/** More from the journal (`posts.related`): up to three cards. Hidden when empty. */
export function RelatedPosts({ posts }: { posts: readonly PostCard[] }) {
  const t = useTranslations("journal");
  if (posts.length === 0) return null;
  return (
    <Section tone="ivory-2" aria-labelledby="related-posts">
      <Container>
        <BandHeading id="related-posts" title={t("relatedHeading")} href="/journal" linkLabel={t("allPosts")} />
        <ul className={cn(POST_GRID, "mt-12 lg:mt-16")}>
          {posts.map((post) => (
            <li key={post._id}>
              <JournalCard post={post} level={3} />
            </li>
          ))}
        </ul>
      </Container>
    </Section>
  );
}

/**
 * Three listings from the featured selection, so a reader who came for the
 * guide can step straight into the offer. Two columns on a tablet show two
 * cards, never a lone third one.
 */
export function RelatedListings({ listings, now }: { listings: readonly ListingCard[]; now: number }) {
  const t = useTranslations("journal");
  if (listings.length === 0) return null;
  return (
    <Section tone="ivory" aria-labelledby="related-listings">
      <Container>
        <BandHeading
          id="related-listings"
          title={t("relatedListingsHeading")}
          href="/properties"
          linkLabel={t("allListings")}
        />
        <ul className="mt-12 grid grid-cols-1 gap-x-6 gap-y-14 md:grid-cols-2 lg:mt-16 lg:grid-cols-3">
          {listings.slice(0, 3).map((listing, index) => (
            <li key={listing._id} className={index === 2 ? "md:max-lg:hidden" : undefined}>
              <PropertyCard
                listing={listing}
                ratio="3/2"
                sizes="(min-width: 1024px) 30vw, (min-width: 768px) 45vw, 92vw"
                now={now}
              />
            </li>
          ))}
        </ul>
      </Container>
    </Section>
  );
}
