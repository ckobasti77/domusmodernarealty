import type { Metadata } from "next";
import { QueryErrorBoundary } from "@/components/admin/common/QueryErrorBoundary";
import { ListingEditor } from "@/components/admin/listings/editor/ListingEditor";

export const metadata: Metadata = {
  title: "Uređivanje nekretnine",
};

/**
 * The listing editor. An agent opening a colleague's listing gets FORBIDDEN
 * from `listingsAdmin.get`, which the boundary turns into the "Nemate pristup"
 * panel. `?tab=` opens a given tab (the editor keeps it in the URL).
 */
export default async function ListingEditorPage({ params, searchParams }: PageProps<"/admin/nekretnine/[id]">) {
  const { id } = await params;
  const { tab } = await searchParams;
  return (
    <QueryErrorBoundary backHref="/admin/nekretnine" backLabel="Nazad na nekretnine">
      <ListingEditor id={decodeURIComponent(id)} initialTab={typeof tab === "string" ? tab : undefined} />
    </QueryErrorBoundary>
  );
}
