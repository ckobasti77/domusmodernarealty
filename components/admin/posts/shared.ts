import type { DotTone } from "@/components/admin/common/StatusBadge";
import type { PostStatus, Role } from "@/convex/lib/validators";
import { pathnames } from "@/i18n/routing";
import { POST_STATUS_LABEL } from "@/lib/admin/labels";

/** Who works on the journal (the same rule as `convex/postsAdmin.ts`). */
export const CONTENT_ROLES = ["admin", "manager", "editor"] as const satisfies readonly Role[];

export const POSTS_PATH = "/admin/magazin";

export function postEditorHref(id: string): string {
  return `${POSTS_PATH}/${id}`;
}

/** Stored status plus the "scheduled" state of a draft with `scheduledAt`. */
export type PostPhase = PostStatus | "scheduled";

export function phaseOf(post: { status: PostStatus; scheduledAt?: number }): PostPhase {
  return post.status === "draft" && post.scheduledAt !== undefined ? "scheduled" : post.status;
}

export const PHASE_LABEL: Record<PostPhase, string> = {
  draft: POST_STATUS_LABEL.draft,
  scheduled: "Zakazano",
  published: POST_STATUS_LABEL.published,
  archived: POST_STATUS_LABEL.archived,
};

export const PHASE_TONE: Record<PostPhase, DotTone> = {
  draft: "muted",
  scheduled: "accent",
  published: "success",
  archived: "muted",
};

export function isPostPhase(value: string | null): value is PostPhase {
  return value === "draft" || value === "scheduled" || value === "published" || value === "archived";
}

/** Public URL of a post in Serbian, from the router's own pathnames. */
export function publicPostPath(slug: string): string {
  return `/sr${pathnames["/journal/[slug]"]["sr-Latn"].replace("[slug]", slug)}`;
}

/**
 * Reading styles for post HTML, shared by the editor surface and the preview
 * so what staff type looks like what they preview. Only the elements the
 * sanitizer allows are styled.
 */
export const POST_PROSE = [
  "text-[0.9375rem] leading-7 text-foreground break-words",
  "[&>:first-child]:mt-0 [&>:last-child]:mb-0",
  "[&_p]:my-3",
  "[&_h2]:mt-8 [&_h2]:mb-3 [&_h2]:text-xl [&_h2]:leading-snug [&_h2]:font-semibold [&_h2]:tracking-tight",
  "[&_h3]:mt-6 [&_h3]:mb-2 [&_h3]:text-lg [&_h3]:leading-snug [&_h3]:font-semibold",
  "[&_ul]:my-3 [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:my-3 [&_ol]:list-decimal [&_ol]:pl-6 [&_li]:my-1 [&_li>p]:my-0",
  "[&_blockquote]:my-5 [&_blockquote]:border-l-2 [&_blockquote]:border-bronze [&_blockquote]:pl-4 [&_blockquote]:text-muted-foreground",
  "[&_a]:font-medium [&_a]:underline [&_a]:underline-offset-2",
  "[&_img]:my-5 [&_img]:h-auto [&_img]:max-w-full [&_img]:rounded-md",
  "[&_hr]:my-8 [&_hr]:border-border",
].join(" ");
