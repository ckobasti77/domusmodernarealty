import { notFound } from "next/navigation";

/**
 * Any path under a locale that no route matches (`/ru/net-takoy`). Without
 * this catch-all Next falls through to `app/global-not-found.tsx`, which has
 * no locale and speaks Serbian and English at once; calling `notFound()` here
 * renders `[locale]/not-found.tsx` inside the locale layout instead — the
 * visitor's language, header, footer and search box. The layout has already
 * rejected an unknown locale segment.
 */
export default function UnknownPath(): never {
  notFound();
}
