"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar";
import { ROLE_LABEL } from "@/lib/admin/labels";
import { useMe } from "./me";
import { isActive, navFor } from "./nav";

export function AppSidebar() {
  const me = useMe();
  const pathname = usePathname();
  const groups = navFor(me.role);

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="px-3 pt-4 pb-2">
        <Link
          href="/admin"
          className="flex flex-col rounded-md px-1 py-1 outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring group-data-[collapsible=icon]:items-center"
        >
          <span className="text-[0.8125rem] font-semibold tracking-[0.18em] uppercase group-data-[collapsible=icon]:hidden">
            Mihajlo Estate
          </span>
          <span className="hidden text-sm font-semibold group-data-[collapsible=icon]:block" aria-hidden="true">
            ME
          </span>
          <span className="text-xs text-muted-foreground group-data-[collapsible=icon]:hidden">
            Administracija
          </span>
        </Link>
      </SidebarHeader>

      <SidebarContent>
        <nav aria-label="Glavni meni" className="contents">
        {groups.map((group) => (
          <SidebarGroup key={group.label}>
            <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const active = isActive(pathname, item.href);
                  return (
                    <SidebarMenuItem key={item.href}>
                      <SidebarMenuButton asChild isActive={active} tooltip={item.label}>
                        <Link href={item.href} aria-current={active ? "page" : undefined}>
                          <Icon aria-hidden="true" />
                          <span>{item.label}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
        </nav>
      </SidebarContent>

      <SidebarFooter className="px-3 pb-4 group-data-[collapsible=icon]:hidden">
        <p className="truncate text-sm font-medium">{me.name ?? me.email}</p>
        <p className="text-xs text-muted-foreground">
          {ROLE_LABEL[me.role]}
          {me.agentName !== undefined ? ` · ${me.agentName}` : ""}
        </p>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
