import Image from "next/image";
import { useTranslations } from "next-intl";
import type { AgentPublic } from "@/convex/lib/dto";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { pickL10n } from "@/lib/l10n";

/** "Mihajlo Estate" → "ME": the agency's monogram when it signs a post itself. */
function initials(name: string): string {
  const words = name.split(/[^\p{L}\p{N}]+/u).filter((word) => word.length > 0);
  const first = words[0];
  const last = words[words.length - 1];
  if (first === undefined || last === undefined) return "";
  return (words.length === 1 ? first.slice(0, 2) : `${first[0]}${last[0]}`).toUpperCase();
}

const AVATAR =
  "flex size-14 shrink-0 items-center justify-center rounded-full bg-ink font-display text-[1.25rem] tracking-[0.06em] text-ivory";

/**
 * Who wrote the article: the agent (linked to their profile; a real photo
 * only when one is on file, otherwise their monogram — never a stock face) or,
 * for a post without an author, the agency itself.
 */
export function ArticleByline({
  author,
  agencyName,
  locale,
}: {
  author: AgentPublic | undefined;
  agencyName: string;
  locale: Locale;
}) {
  const t = useTranslations("journal");
  const role = author !== undefined ? pickL10n(author.role, locale) : null;

  return (
    <div>
      <p className="eyebrow text-stone-text">{t("writtenBy")}</p>
      <div className="mt-4 flex items-center gap-4">
        {author?.photoUrl !== undefined ? (
          <Image
            src={author.photoUrl}
            alt=""
            width={56}
            height={56}
            className="size-14 shrink-0 rounded-full object-cover"
          />
        ) : (
          <span aria-hidden="true" className={AVATAR}>
            {author !== undefined ? author.monogram : initials(agencyName)}
          </span>
        )}
        <div className="min-w-0">
          {author !== undefined ? (
            <Link
              href={{ pathname: "/agents/[slug]", params: { slug: author.slug } }}
              prefetch={false}
              className="relative font-display text-h3 leading-tight transition-colors duration-200 pointer-coarse:before:absolute pointer-coarse:before:inset-x-0 pointer-coarse:before:-inset-y-2 pointer-fine:hover:text-bronze-text"
            >
              {author.name}
            </Link>
          ) : (
            <p className="font-display text-h3 leading-tight">{agencyName}</p>
          )}
          {role !== null ? (
            <p lang={role.lang !== locale ? role.lang : undefined} className="text-small text-stone-text">
              {role.text}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
