import type { Metadata } from "next";
import { QueryErrorBoundary } from "@/components/admin/common/QueryErrorBoundary";
import { PostEditor } from "@/components/admin/posts/PostEditor";

export const metadata: Metadata = {
  title: "Uređivanje teksta",
};

/** The journal post editor; an id that is not a post shows "not found". */
export default async function PostEditorPage({ params }: PageProps<"/admin/magazin/[id]">) {
  const { id } = await params;
  return (
    <QueryErrorBoundary backHref="/admin/magazin" backLabel="Nazad na Magazin">
      <PostEditor id={decodeURIComponent(id)} />
    </QueryErrorBoundary>
  );
}
