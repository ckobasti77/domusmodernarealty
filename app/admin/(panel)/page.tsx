import type { Metadata } from "next";
import { Dashboard } from "@/components/admin/dashboard/Dashboard";

export const metadata: Metadata = {
  title: "Kontrolna tabla",
};

/** `/admin` — the dashboard (PRD B2). Data is live from Convex, per role. */
export default function AdminDashboardPage() {
  return <Dashboard />;
}
