import type { Metadata } from "next";
import { Suspense } from "react";
import { AnalyticsScreen } from "@/components/admin/analytics/AnalyticsScreen";

export const metadata: Metadata = {
  title: "Analitika",
};

/**
 * Agency analytics (PRD B12). The period and the funnel's listing live in the
 * query string, and `useSearchParams` needs a Suspense boundary.
 */
export default function AnalyticsPage() {
  return (
    <Suspense fallback={null}>
      <AnalyticsScreen />
    </Suspense>
  );
}
