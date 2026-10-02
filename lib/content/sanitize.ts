import DOMPurify from "isomorphic-dompurify";
import {
  isAllowedRemoteImage,
  isSafeHref,
  PAGE_LINK_SCHEMES,
  POST_LINK_SCHEMES,
} from "@/convex/lib/html";

/**
 * Rich text staff store as HTML is sanitized every time it is rendered (admin
 * preview, public pages), on top of the server's allowlist check
 * (`convex/lib/html.ts`). Each profile mirrors what its editor can produce,
 * attribute by attribute, so anything pasted or injected is dropped:
 * - journal post bodies (Tiptap): `sanitizePostHtml`;
 * - legal page sections (`pages` rich text): `sanitizePageHtml`.
 */
type Profile = {
  /** Tag → the attributes it may keep. */
  allowed: Readonly<Record<string, readonly string[]>>;
  linkSchemes: readonly string[];
};

const POST_PROFILE: Profile = {
  allowed: {
    p: [],
    h2: [],
    h3: [],
    strong: [],
    em: [],
    u: [],
    s: [],
    a: ["href", "title", "target", "rel"],
    ul: [],
    ol: ["start", "type"],
    li: [],
    blockquote: [],
    img: ["src", "alt", "width", "height"],
    br: [],
    hr: [],
  },
  linkSchemes: POST_LINK_SCHEMES,
};

/** The server's `PAGE_HTML` list: no headings above h3, no images. */
const PAGE_PROFILE: Profile = {
  allowed: {
    p: [],
    h3: [],
    ul: [],
    ol: ["start", "type"],
    li: [],
    strong: [],
    em: [],
    a: ["href", "target", "rel"],
    blockquote: [],
    br: [],
  },
  linkSchemes: PAGE_LINK_SCHEMES,
};

const DIMENSION = /^\d{1,4}$/;
const LIST_START = /^\d{1,3}$/;
const LIST_TYPE = /^[1aAiI]$/;

/**
 * Link targets the journal editor accepts and the sanitizer keeps: http(s),
 * mailto, site-relative paths and in-page anchors that stay on this origin.
 * Tabs and line breaks are stripped first, as browsers do. The same rule
 * guards `postsAdmin.upsert` (`convex/lib/html.ts`).
 */
export function isAllowedHref(href: string): boolean {
  return isSafeHref(href, POST_LINK_SCHEMES);
}

/**
 * The storage host of this app's own Convex deployment. `NEXT_PUBLIC_CONVEX_URL`
 * is inlined into the browser bundle and present on the Next server, so the
 * admin preview and the public page agree; read at call time so tests can
 * stub it. Without it, no storage image passes.
 */
function convexHost(): string | null {
  const configured = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (configured === undefined || configured.length === 0) return null;
  try {
    return new URL(configured).hostname;
  } catch {
    return null;
  }
}

/**
 * Images the site may load: https Unsplash photos, or files in this
 * deployment's Convex storage (`/api/storage/…` on its own host, not any
 * `*.convex.cloud`). Everything else is removed rather than shown broken.
 */
export function isAllowedImageSrc(src: string): boolean {
  if (isAllowedRemoteImage(src.trim())) return true;
  try {
    const url = new URL(src.trim());
    return url.protocol === "https:" && url.hostname === convexHost() && url.pathname.startsWith("/api/storage/");
  } catch {
    return false;
  }
}

function fixLink(link: Element, schemes: readonly string[]): void {
  const href = link.getAttribute("href");
  if (href === null || !isSafeHref(href, schemes)) {
    // Keep the words, lose the link.
    link.replaceWith(...Array.from(link.childNodes));
    return;
  }
  if (link.getAttribute("target") === "_blank") {
    const rel = new Set((link.getAttribute("rel") ?? "").split(/\s+/).filter((token) => token.length > 0));
    rel.add("noopener");
    rel.add("noreferrer");
    link.setAttribute("rel", [...rel].join(" "));
  } else {
    link.removeAttribute("target");
  }
}

function fixImage(image: Element): void {
  const src = image.getAttribute("src");
  if (src === null || !isAllowedImageSrc(src)) {
    image.remove();
    return;
  }
  for (const name of ["width", "height"]) {
    const value = image.getAttribute(name);
    if (value !== null && !DIMENSION.test(value)) image.removeAttribute(name);
  }
  if (!image.hasAttribute("alt")) image.setAttribute("alt", "");
}

function fixList(list: Element): void {
  const start = list.getAttribute("start");
  if (start !== null && !LIST_START.test(start)) list.removeAttribute("start");
  const type = list.getAttribute("type");
  if (type !== null && !LIST_TYPE.test(type)) list.removeAttribute("type");
}

function sanitizeWith(html: string, profile: Profile): string {
  if (html.trim().length === 0) return "";
  const fragment = DOMPurify.sanitize(html, {
    ALLOWED_TAGS: Object.keys(profile.allowed),
    ALLOWED_ATTR: [...new Set(Object.values(profile.allowed).flat())],
    ALLOW_DATA_ATTR: false,
    ALLOW_ARIA_ATTR: false,
    ALLOW_UNKNOWN_PROTOCOLS: false,
    RETURN_DOM_FRAGMENT: true,
  });
  for (const element of Array.from(fragment.querySelectorAll("*"))) {
    const tag = element.tagName.toLowerCase();
    const allowed = profile.allowed[tag] ?? [];
    for (const attribute of Array.from(element.attributes)) {
      if (!allowed.includes(attribute.name)) element.removeAttribute(attribute.name);
    }
    if (tag === "a") fixLink(element, profile.linkSchemes);
    else if (tag === "img") fixImage(element);
    else if (tag === "ol") fixList(element);
  }
  const container = fragment.ownerDocument.createElement("div");
  container.append(fragment);
  return container.innerHTML;
}

/** Sanitized journal post HTML, safe for `dangerouslySetInnerHTML`. */
export function sanitizePostHtml(html: string): string {
  return sanitizeWith(html, POST_PROFILE);
}

/** Sanitized legal page section HTML, safe for `dangerouslySetInnerHTML`. */
export function sanitizePageHtml(html: string): string {
  return sanitizeWith(html, PAGE_PROFILE);
}
