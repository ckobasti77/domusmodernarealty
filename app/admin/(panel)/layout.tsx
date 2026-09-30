import type { ReactNode } from "react";
import { AdminShell } from "@/components/admin/shell/AdminShell";

/**
 * Every signed-in admin screen. Login and invite acceptance live outside this
 * route group, so they render without the shell and without the auth gate.
 */
export default function PanelLayout({ children }: { children: ReactNode }) {
  return <AdminShell>{children}</AdminShell>;
}
