"use client";

import { useQuery } from "convex/react";
import { Building2, CornerDownLeft, Plus } from "lucide-react";
import { useDeferredValue, useEffect, useState } from "react";
import { useGuardedNavigation } from "@/components/admin/common/LeaveGuard";
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandShortcut,
} from "@/components/ui/command";
import { api } from "@/convex/_generated/api";
import { STATUS_LABEL } from "@/lib/admin/labels";
import { hasRole, LISTING_ROLES, useMe } from "./me";
import { navFor } from "./nav";

/**
 * ⌘K / Ctrl+K. Opened dozens of times a day, so it has no open animation
 * (Emil Kowalski: never animate what the keyboard summons).
 */
export function CommandPalette({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const me = useMe();
  const { navigate } = useGuardedNavigation();
  const [search, setSearch] = useState("");
  const deferred = useDeferredValue(search.trim());
  const canListings = hasRole(me, LISTING_ROLES);

  const hits = useQuery(
    api.listingsAdmin.quickFind,
    open && canListings && deferred.length >= 2 ? { q: deferred } : "skip",
  );

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() === "k" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        onOpenChange(!open);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onOpenChange]);

  // Through the leave guard: an editor with unsaved changes saves or asks first.
  const go = (href: string) => {
    onOpenChange(false);
    setSearch("");
    navigate(href);
  };

  const needle = search.trim().toLowerCase();
  const pages = navFor(me.role)
    .flatMap((group) => group.items)
    .filter((item) => needle.length === 0 || item.label.toLowerCase().includes(needle));

  return (
    <CommandDialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) setSearch("");
      }}
      title="Brza pretraga"
      description="Pronađite nekretninu po šifri ili naslovu, ili otvorite deo panela."
      className="duration-0 data-open:animate-none data-closed:animate-none sm:max-w-xl"
    >
      <Command shouldFilter={false}>
      <CommandInput
        placeholder="Šifra (ME-1042) ili naslov nekretnine…"
        value={search}
        onValueChange={setSearch}
      />
      <CommandList>
        <CommandEmpty>
          {deferred.length >= 2 && hits === undefined ? "Tražim…" : "Nema rezultata."}
        </CommandEmpty>

        {hits !== undefined && hits.length > 0 ? (
          <CommandGroup heading="Nekretnine">
            {hits.map((hit) => (
              <CommandItem
                key={hit._id}
                value={`listing-${hit._id}`}
                onSelect={() => go(`/admin/nekretnine/${hit._id}`)}
              >
                <Building2 aria-hidden="true" />
                <span className="font-mono text-xs text-muted-foreground">{hit.ref}</span>
                <span className="truncate">{hit.title}</span>
                <CommandShortcut>{STATUS_LABEL[hit.status]}</CommandShortcut>
              </CommandItem>
            ))}
          </CommandGroup>
        ) : null}

        {canListings && (needle.length === 0 || "nova nekretnina".includes(needle)) ? (
          <CommandGroup heading="Radnje">
            <CommandItem value="action-new-listing" onSelect={() => go("/admin/nekretnine/nova")}>
              <Plus aria-hidden="true" />
              Nova nekretnina
              <CommandShortcut>
                <CornerDownLeft className="size-3" aria-hidden="true" />
              </CommandShortcut>
            </CommandItem>
          </CommandGroup>
        ) : null}

        {pages.length > 0 ? (
          <CommandGroup heading="Idi na">
            {pages.map((item) => {
              const Icon = item.icon;
              return (
                <CommandItem key={item.href} value={`page-${item.href}`} onSelect={() => go(item.href)}>
                  <Icon aria-hidden="true" />
                  {item.label}
                </CommandItem>
              );
            })}
          </CommandGroup>
        ) : null}
      </CommandList>
      </Command>
    </CommandDialog>
  );
}
