import type { Metadata } from "next";
import { Suspense } from "react";
import { ListingsScreen } from "@/components/admin/listings/table/ListingsScreen";

export const metadata: Metadata = {
  title: "Nekretnine",
};

/**
 * Listings table (PRD B3). The view lives in the query string
 * (`?status=published&q=…`), and `useSearchParams` needs a Suspense boundary.
 */
export default function ListingsPage() {
  return (
    <Suspense fallback={null}>
      <ListingsScreen />
    </Suspense>
  );
}
