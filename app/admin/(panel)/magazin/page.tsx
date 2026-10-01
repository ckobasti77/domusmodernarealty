import type { Metadata } from "next";
import { Suspense } from "react";
import { PostsScreen } from "@/components/admin/posts/PostsScreen";

export const metadata: Metadata = {
  title: "Magazin",
};

/**
 * Journal posts (PRD B9). The view lives in the query string
 * (`?status=scheduled&q=…`), and `useSearchParams` needs a Suspense boundary.
 */
export default function PostsPage() {
  return (
    <Suspense fallback={null}>
      <PostsScreen />
    </Suspense>
  );
}
