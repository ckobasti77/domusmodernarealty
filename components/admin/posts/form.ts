import { fromL10nValue, toL10nValue, type L10nValue } from "@/components/admin/common/L10nInput";
import type { FunctionArgs } from "convex/server";
import type { api } from "@/convex/_generated/api";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import { slugify } from "@/convex/lib/slug";
import { L10N_KEYS, type ImageRef, type PostCategory } from "@/convex/lib/validators";

/**
 * The post editor's state: every localized field as four strings, the body as
 * the Tiptap HTML per locale. Converted to `postsAdmin.upsert` arguments at
 * save time; the limits match the server's (`convex/postsAdmin.ts`).
 */
export type PostForm = {
  title: L10nValue;
  excerpt: L10nValue;
  body: L10nValue;
  slug: string;
  cover: ImageRef | undefined;
  category: PostCategory;
  tags: string[];
  authorAgentId: Id<"agents"> | undefined;
  featured: boolean;
  metaTitle: L10nValue;
  metaDescription: L10nValue;
};

export const TITLE_MIN = 3;
export const TITLE_MAX = 160;
export const EXCERPT_MAX = 400;
export const EXCERPT_SOFT = 220;
export const TAGS_MAX = 12;
export const TAG_MAX = 40;
export const META_TITLE_SOFT = 60;
export const META_TITLE_MAX = 70;
export const META_DESCRIPTION_SOFT = 155;
export const META_DESCRIPTION_MAX = 170;

export function toForm(post: Doc<"posts">): PostForm {
  return {
    title: toL10nValue(post.title),
    excerpt: toL10nValue(post.excerpt),
    body: toL10nValue(post.body),
    slug: post.slug,
    cover: post.cover,
    category: post.category,
    tags: post.tags,
    authorAgentId: post.authorAgentId,
    featured: post.featured,
    metaTitle: toL10nValue(post.seo?.metaTitle),
    metaDescription: toL10nValue(post.seo?.metaDescription),
  };
}

function sameL10n(a: L10nValue, b: L10nValue): boolean {
  return L10N_KEYS.every((key) => a[key] === b[key]);
}

function sameImage(a: ImageRef | undefined, b: ImageRef | undefined): boolean {
  if (a === undefined || b === undefined) return a === b;
  if (a.kind === "url") return b.kind === "url" && a.url === b.url;
  return b.kind === "storage" && a.storageId === b.storageId;
}

/** Field-by-field equality (cheap: no serialization of the long bodies). */
export function sameForm(a: PostForm, b: PostForm): boolean {
  return (
    sameL10n(a.title, b.title) &&
    sameL10n(a.excerpt, b.excerpt) &&
    sameL10n(a.body, b.body) &&
    a.slug === b.slug &&
    sameImage(a.cover, b.cover) &&
    a.category === b.category &&
    a.tags.length === b.tags.length &&
    a.tags.every((tag, index) => tag === b.tags[index]) &&
    a.authorAgentId === b.authorAgentId &&
    a.featured === b.featured &&
    sameL10n(a.metaTitle, b.metaTitle) &&
    sameL10n(a.metaDescription, b.metaDescription)
  );
}

export type FormErrors = Partial<Record<"title" | "slug", string>>;

export function validateForm(form: PostForm): FormErrors {
  const errors: FormErrors = {};
  if (form.title.sr.trim().length < TITLE_MIN) {
    errors.title = `Unesite naslov na srpskom (najmanje ${TITLE_MIN} znaka).`;
  }
  if (form.slug.trim().length > 0 && slugify(form.slug) !== form.slug.trim()) {
    errors.slug = "Adresa sme da sadrži samo mala slova a–z, cifre i crtice.";
  }
  return errors;
}

/**
 * Whether the slug still follows the title: never published, and either the
 * placeholder of a new draft or exactly what the title would give.
 */
export function slugFollowsTitle(post: Doc<"posts">): boolean {
  if (post.publishedAt !== undefined) return false;
  if (/^nacrt-[a-z0-9]+(?:-\d+)?$/.test(post.slug)) return true;
  const fromTitle = slugify(post.title.sr);
  return post.slug === fromTitle || new RegExp(`^${fromTitle}-\\d+$`).test(post.slug);
}

function optionalL10n(value: L10nValue): { sr: string; en?: string; ru?: string; de?: string } | undefined {
  const stored = fromL10nValue(value);
  return Object.values(stored).some((text) => text.length > 0) ? stored : undefined;
}

type UpsertArgs = FunctionArgs<typeof api.postsAdmin.upsert>;

export function toUpsertArgs(id: Id<"posts">, form: PostForm, stored: Doc<"posts">): UpsertArgs {
  const metaTitle = optionalL10n(form.metaTitle);
  const metaDescription = optionalL10n(form.metaDescription);
  // The cover doubles as the share image, so the editor has no field for an
  // override; one set elsewhere is kept as stored.
  const ogImage = stored.seo?.ogImage;
  const seo =
    metaTitle !== undefined || metaDescription !== undefined || ogImage !== undefined
      ? {
          ...(metaTitle !== undefined ? { metaTitle } : {}),
          ...(metaDescription !== undefined ? { metaDescription } : {}),
          ...(ogImage !== undefined ? { ogImage } : {}),
        }
      : undefined;
  return {
    id,
    slug: form.slug.trim(),
    title: fromL10nValue(form.title),
    excerpt: fromL10nValue(form.excerpt),
    body: fromL10nValue(form.body),
    ...(form.cover !== undefined ? { cover: form.cover } : {}),
    category: form.category,
    tags: form.tags,
    ...(form.authorAgentId !== undefined ? { authorAgentId: form.authorAgentId } : {}),
    featured: form.featured,
    ...(seo !== undefined ? { seo } : {}),
  };
}
