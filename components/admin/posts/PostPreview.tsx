"use client";

import { useMemo } from "react";
import { LOCALE_LANG } from "@/components/admin/listings/editor/LocaleTabs";
import type { L10nKey } from "@/convex/lib/validators";
import { L10N_LABEL, POST_CATEGORY_LABEL } from "@/lib/admin/labels";
import { adminThumb } from "@/lib/admin/images";
import { sanitizePostHtml } from "@/lib/content/sanitize";
import { cn } from "@/lib/utils";
import type { PostForm } from "./form";
import { POST_PROSE } from "./shared";

/**
 * The article as readers get it, through the same sanitizer as the public
 * page: anything the site would drop is dropped here too. A missing
 * translation falls back to Serbian, as on the site, and says so.
 */
export function PostPreview({
  form,
  locale,
  coverUrl,
  readingMinutes,
}: {
  form: PostForm;
  locale: L10nKey;
  coverUrl: string | undefined;
  readingMinutes: number | undefined;
}) {
  const pick = (value: PostForm["title"]): { text: string; key: L10nKey } =>
    value[locale].trim().length > 0 ? { text: value[locale], key: locale } : { text: value.sr, key: "sr" };
  const title = pick(form.title);
  const excerpt = pick(form.excerpt);
  const body = pick(form.body);
  const html = useMemo(() => sanitizePostHtml(body.text), [body.text]);
  const fallback = [title, excerpt, body].some((part) => part.key !== locale);

  return (
    <article lang={LOCALE_LANG[locale]} className="mx-auto max-w-[68ch] py-2" data-testid="post-preview">
      {fallback ? (
        <p className="mb-4 rounded-md border border-dashed px-3 py-2 text-xs text-muted-foreground">
          Deo teksta nije preveden na {L10N_LABEL[locale].toLowerCase()} jezik; prikazuje se srpska verzija, kao i na sajtu.
        </p>
      ) : null}
      <p className="font-mono text-xs tracking-wide text-muted-foreground uppercase">
        {POST_CATEGORY_LABEL[form.category]}
        {readingMinutes !== undefined ? ` · ${readingMinutes} min čitanja` : null}
      </p>
      <h2 lang={LOCALE_LANG[title.key]} className="mt-2 text-3xl leading-tight font-semibold tracking-tight">
        {title.text.trim().length > 0 ? title.text : <span className="text-muted-foreground">Bez naslova</span>}
      </h2>
      {excerpt.text.trim().length > 0 ? (
        <p lang={LOCALE_LANG[excerpt.key]} className="mt-3 text-base leading-relaxed text-muted-foreground">
          {excerpt.text}
        </p>
      ) : null}
      {coverUrl !== undefined ? (
        // eslint-disable-next-line @next/next/no-img-element -- admin preview of a storage or remote URL
        <img src={adminThumb(coverUrl, 1200)} alt="" className="mt-6 aspect-video w-full rounded-lg object-cover" />
      ) : null}
      {html.length > 0 ? (
        <div
          lang={LOCALE_LANG[body.key]}
          className={cn(POST_PROSE, "mt-6")}
          // Sanitized by `sanitizePostHtml` right above.
          dangerouslySetInnerHTML={{ __html: html }}
        />
      ) : (
        <p className="mt-6 text-sm text-muted-foreground">Tekst je prazan.</p>
      )}
    </article>
  );
}
