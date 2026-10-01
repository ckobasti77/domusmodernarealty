import type { Metadata } from "next";
import { Suspense } from "react";
import { ActivityScreen } from "@/components/admin/activity/ActivityScreen";

export const metadata: Metadata = {
  title: "Aktivnost",
};

/**
 * The activity log (PRD B13). Filters live in the query string, and
 * `useSearchParams` needs a Suspense boundary.
 */
export default function ActivityPage() {
  return (
    <Suspense fallback={null}>
      <ActivityScreen />
    </Suspense>
  );
}
