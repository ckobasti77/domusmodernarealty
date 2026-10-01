import { sanitizePageHtml, sanitizePostHtml } from "@/lib/content/sanitize";
import { cn } from "@/lib/utils";

/**
 * Managed rich text on the public site (legal sections, page bodies, journal
 * articles). The HTML is sanitized here, on every render, with the profile of
 * the editor that produced it (`lib/content/sanitize.ts`); the server already
 * checked it against the same allowlist on save. Typography comes from the
 * `.rich-text` rules in `app/globals.css` (serif headings, ~68ch measure,
 * bronze link underlines).
 *
 * Server Component only: the sanitizer loads jsdom.
 */
export function RichText({
  html,
  profile = "page",
  lang,
  size = "body",
  className,
}: {
  html: string;
  /** `post` for journal bodies (h2, images); `page` for managed page sections. */
  profile?: "page" | "post";
  /** BCP-47 tag of the text actually shown (Serbian when it fell back). */
  lang?: string;
  size?: "body" | "body-l";
  className?: string;
}) {
  const clean = profile === "post" ? sanitizePostHtml(html) : sanitizePageHtml(html);
  return (
    <div
      lang={lang}
      className={cn("rich-text", size === "body-l" && "rich-text-l", className)}
      dangerouslySetInnerHTML={{ __html: clean }}
    />
  );
}
