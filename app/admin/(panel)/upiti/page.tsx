import type { Metadata } from "next";
import { Suspense } from "react";
import { LeadsScreen } from "@/components/admin/leads/LeadsScreen";

export const metadata: Metadata = {
  title: "Upiti",
};

/**
 * Leads inbox and pipeline (PRD B4). The view, the filters and the open lead
 * live in the query string (`?view=kanban&type=…&id=…`), and
 * `useSearchParams` needs a Suspense boundary.
 */
export default function LeadsPage() {
  return (
    <Suspense fallback={null}>
      <LeadsScreen />
    </Suspense>
  );
}
