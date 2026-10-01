import type { Metadata } from "next";
import { Suspense } from "react";
import { TeamScreen } from "@/components/admin/team/TeamScreen";

export const metadata: Metadata = {
  title: "Tim",
};

/**
 * Team (PRD B7): staff accounts, invites and the agents' public profiles. The
 * tab and the open record live in the query string (`?tab=agents&id=…`), and
 * `useSearchParams` needs a Suspense boundary.
 */
export default function TeamPage() {
  return (
    <Suspense fallback={null}>
      <TeamScreen />
    </Suspense>
  );
}
