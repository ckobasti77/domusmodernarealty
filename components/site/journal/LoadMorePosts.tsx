"use client";

import { useConvex } from "convex/react";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/site/Button";
import { api } from "@/convex/_generated/api";
import type { PostCategory } from "@/convex/lib/validators";
import { cn } from "@/lib/utils";
import { JournalCard } from "./JournalCard";
import { JOURNAL_PAGE_SIZE, POST_GRID, POST_GRID_CONTINUED, type PostCard } from "./shared";

/**
 * "Show older articles" under the server-rendered first page. It continues
 * from the server's `continueCursor` with one-off reads (no live
 * subscription: an archive page does not need to re-render when a post is
 * published), appending each page to a grid that continues the server's.
 *
 * Keyboard and screen-reader users are not left on a button that may vanish:
 * focus moves to the first newly shown article and a polite status line says
 * how many were added. The parent keys this by category, so switching topics
 * starts over.
 */
export function LoadMorePosts({ category, cursor: firstCursor }: { category?: PostCategory; cursor: string }) {
  const convex = useConvex();
  const t = useTranslations("journal");
  const [posts, setPosts] = useState<PostCard[]>([]);
  const [cursor, setCursor] = useState<string | null>(firstCursor);
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [announcement, setAnnouncement] = useState("");
  // An object, so asking for the same index twice still moves focus.
  const [focusTarget, setFocusTarget] = useState<{ index: number } | null>(null);
  const list = useRef<HTMLUListElement>(null);

  useEffect(() => {
    if (focusTarget === null) return;
    list.current?.children.item(focusTarget.index)?.querySelector<HTMLAnchorElement>("a[href]")?.focus();
  }, [focusTarget]);

  async function loadMore() {
    if (cursor === null || status === "loading") return;
    setStatus("loading");
    try {
      const result = await convex.query(api.posts.list, {
        ...(category !== undefined ? { category } : {}),
        paginationOpts: { numItems: JOURNAL_PAGE_SIZE, cursor },
      });
      // The first new article; when the archive turned out to be exhausted
      // (an empty last page), the last one shown, since the button is gone.
      const index = result.page.length > 0 ? posts.length : posts.length - 1;
      setFocusTarget(index >= 0 ? { index } : null);
      setPosts([...posts, ...result.page]);
      setCursor(result.isDone ? null : result.continueCursor);
      setAnnouncement(result.page.length > 0 ? t("loadedMore", { count: result.page.length }) : "");
      setStatus("idle");
    } catch (error) {
      console.error("[journal] posts.list (load more) failed:", error);
      setStatus("error");
    }
  }

  const loading = status === "loading";

  return (
    <>
      {posts.length > 0 ? (
        <ul ref={list} className={cn(POST_GRID, POST_GRID_CONTINUED)}>
          {posts.map((post) => (
            <li key={post._id}>
              <JournalCard post={post} />
            </li>
          ))}
        </ul>
      ) : null}

      <p role="status" className="sr-only">
        {announcement}
      </p>

      {cursor !== null ? (
        <div className="mt-16 flex flex-col items-center gap-4 lg:mt-24">
          {/* Not `disabled` while loading: that would drop keyboard focus. */}
          <Button variant="outline" onClick={loadMore} aria-busy={loading}>
            {loading ? t("loadingMore") : t("loadMore")}
          </Button>
          {status === "error" ? (
            <p role="alert" className="text-small text-danger">
              {t("loadError")}
            </p>
          ) : null}
        </div>
      ) : null}
    </>
  );
}
