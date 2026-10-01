import type { Metadata } from "next";
import { Suspense } from "react";
import { ContentScreen } from "@/components/admin/content/ContentScreen";

export const metadata: Metadata = {
  title: "Sadržaj sajta",
};

/**
 * Site content and testimonials (PRD B10). The open page / tab / testimonial
 * live in the query string, and `useSearchParams` needs a Suspense boundary.
 */
export default function ContentPage() {
  return (
    <Suspense fallback={null}>
      <ContentScreen />
    </Suspense>
  );
}
