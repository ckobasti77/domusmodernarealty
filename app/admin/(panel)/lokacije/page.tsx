import type { Metadata } from "next";
import { Suspense } from "react";
import { LocationsScreen } from "@/components/admin/locations/LocationsScreen";

export const metadata: Metadata = {
  title: "Lokacije",
};

/**
 * Location tree and editor (PRD B8). The open location lives in the query
 * string (`?id=…`, or `?new=municipality&parent=…`), and `useSearchParams`
 * needs a Suspense boundary.
 */
export default function LocationsPage() {
  return (
    <Suspense fallback={null}>
      <LocationsScreen />
    </Suspense>
  );
}
