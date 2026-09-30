import type { Metadata } from "next";
import { DemoPanel } from "@/components/admin/demo/DemoPanel";

export const metadata: Metadata = {
  title: "Demo sadržaj",
};

/** `/admin/demo` — demo record counts and the purge (PRD B14). Admin only. */
export default function AdminDemoPage() {
  return <DemoPanel />;
}
