"use client";

import { useState, type ReactNode } from "react";
import { LeaveGuardProvider } from "@/components/admin/common/LeaveGuard";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "./AppSidebar";
import { AuthGate } from "./AuthGate";
import { BreadcrumbLabelProvider } from "./breadcrumbs";
import { CommandPalette } from "./CommandPalette";
import { DemoDataBanner } from "./DemoDataBanner";
import { Topbar } from "./Topbar";

/** Sidebar + top bar + ⌘K around every signed-in admin screen, and the guard against leaving unsaved work. */
export function AdminShell({ children }: { children: ReactNode }) {
  const [paletteOpen, setPaletteOpen] = useState(false);
  return (
    <AuthGate>
      <LeaveGuardProvider>
        <BreadcrumbLabelProvider>
          <SidebarProvider>
            <AppSidebar />
            {/* `min-w-0`: a wide table scrolls inside its card instead of widening the page. */}
            <SidebarInset className="min-w-0">
              <Topbar onOpenPalette={() => setPaletteOpen(true)} />
              <DemoDataBanner />
              <div className="flex-1 px-4 py-6 md:px-8 md:py-8" id="admin-main">
                {children}
              </div>
            </SidebarInset>
            <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
          </SidebarProvider>
        </BreadcrumbLabelProvider>
      </LeaveGuardProvider>
    </AuthGate>
  );
}
