"use client";

import { ExternalLink, LogOut, Moon, Search, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useGuardedNavigation } from "@/components/admin/common/LeaveGuard";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { ROLE_LABEL } from "@/lib/admin/labels";
import { useSignOut } from "./AuthGate";
import { AdminBreadcrumbs } from "./breadcrumbs";
import { useMe } from "./me";

export function Topbar({ onOpenPalette }: { onOpenPalette: () => void }) {
  return (
    <header className="sticky top-0 z-20 flex h-14 shrink-0 items-center gap-2 border-b bg-background/95 px-3 backdrop-blur supports-[backdrop-filter]:bg-background/80 md:px-4">
      <SidebarTrigger aria-label="Prikaži ili sakrij meni" />
      <Separator orientation="vertical" className="mr-1 data-vertical:h-5 data-vertical:self-center" />
      <div className="min-w-0 flex-1">
        <AdminBreadcrumbs />
      </div>

      <Button
        variant="outline"
        size="sm"
        onClick={onOpenPalette}
        className="hidden w-56 justify-start gap-2 text-muted-foreground md:inline-flex"
        aria-label="Brza pretraga (Ctrl+K)"
      >
        <Search aria-hidden="true" />
        <span className="flex-1 text-left">Pretraga…</span>
        <kbd className="rounded border bg-muted px-1.5 font-mono text-[0.6875rem]">Ctrl K</kbd>
      </Button>
      <Button variant="ghost" size="icon" onClick={onOpenPalette} className="md:hidden" aria-label="Brza pretraga">
        <Search aria-hidden="true" />
      </Button>

      <Button variant="ghost" size="sm" asChild className="hidden sm:inline-flex">
        <a href="/sr" target="_blank" rel="noopener">
          Pogledaj sajt
          <ExternalLink aria-hidden="true" />
          <span className="sr-only">(otvara se u novoj kartici)</span>
        </a>
      </Button>

      <ThemeToggle />
      <UserMenu />
    </header>
  );
}

function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const dark = resolvedTheme === "dark";
  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => setTheme(dark ? "light" : "dark")}
      aria-label={dark ? "Svetla tema" : "Tamna tema"}
      title={dark ? "Svetla tema" : "Tamna tema"}
    >
      <Sun aria-hidden="true" className="hidden dark:block" />
      <Moon aria-hidden="true" className="dark:hidden" />
    </Button>
  );
}

function initials(name: string): string {
  // Letters only: "Mihajlo (admin)" must read "MA", not "M(".
  const parts = name.split(/[^\p{L}]+/u).filter(Boolean);
  const letters = parts.slice(0, 2).map((part) => part[0]?.toUpperCase() ?? "");
  return letters.join("") || "?";
}

function UserMenu() {
  const me = useMe();
  const signOut = useSignOut();
  const { leave } = useGuardedNavigation();
  const display = me.name ?? me.email ?? "Korisnik";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="rounded-full" aria-label={`Nalog: ${display}`} data-testid="user-menu">
          <Avatar className="size-8">
            <AvatarFallback className="bg-secondary text-xs font-semibold">{initials(display)}</AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel className="font-normal">
          <p className="truncate text-sm font-medium">{display}</p>
          {me.email !== undefined ? (
            <p className="truncate text-xs text-muted-foreground">{me.email}</p>
          ) : null}
          <p className="mt-1 text-xs text-muted-foreground">{ROLE_LABEL[me.role]}</p>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {/* Unsaved work is saved (or asked about) before the session ends. */}
        <DropdownMenuItem onSelect={() => leave(() => void signOut())}>
          <LogOut aria-hidden="true" />
          Odjavite se
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
