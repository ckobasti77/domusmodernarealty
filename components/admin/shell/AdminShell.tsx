"use client";

import { useState, type ReactNode } from "react";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "./AppSidebar";
import { AuthGate } from "./AuthGate";
import { BreadcrumbLabelProvider } from "./breadcrumbs";
import { CommandPalette } from "./CommandPalette";
import { Topbar } from "./Topbar";

/** Sidebar + top bar + ⌘K around every signed-in admin screen. */
export function AdminShell({ children }: { children: ReactNode }) {
  const [paletteOpen, setPaletteOpen] = useState(false);
  return (
    <AuthGate>
      <BreadcrumbLabelProvider>
        <SidebarProvider>
          <AppSidebar />
          <SidebarInset>
            <Topbar onOpenPalette={() => setPaletteOpen(true)} />
            <div className="flex-1 px-4 py-6 md:px-8 md:py-8" id="admin-main">
              {children}
            </div>
          </SidebarInset>
          <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
        </SidebarProvider>
      </BreadcrumbLabelProvider>
    </AuthGate>
  );
}
