import type { Metadata } from "next";
import { Suspense } from "react";
import { ViewingsScreen } from "@/components/admin/viewings/ViewingsScreen";

export const metadata: Metadata = {
  title: "Razgledanja",
};

/**
 * Viewings (PRD B5): week/day calendar, list, detail sheet and agent
 * availability. The view lives in the query string
 * (`?view=week&date=2026-10-01&id=…`), and `useSearchParams` needs a Suspense
 * boundary.
 */
export default function ViewingsPage() {
  return (
    <Suspense fallback={null}>
      <ViewingsScreen />
    </Suspense>
  );
}
