"use client";

import { useQuery } from "convex/react";
import { ChevronsUpDown } from "lucide-react";
import { useDeferredValue, useState } from "react";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { STATUS_LABEL } from "@/lib/admin/labels";

/** Search a listing by ref (`ME-1042`, `1042`) or title, as in ⌘K. */
export function ListingPicker({
  current,
  onPick,
}: {
  current: { ref: string; title: string } | undefined;
  onPick: (id: Id<"listings">) => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const deferred = useDeferredValue(search.trim());
  const hits = useQuery(api.listingsAdmin.quickFind, open && deferred.length >= 2 ? { q: deferred } : "skip");

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setSearch("");
      }}
    >
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          aria-label={current !== undefined ? `Nekretnina: ${current.ref}, promenite` : "Izaberite nekretninu"}
          className="h-auto min-h-9 w-full justify-between gap-2 py-1.5 text-left font-normal sm:max-w-md"
          data-testid="analytics-listing-picker"
        >
          {current !== undefined ? (
            <span className="flex min-w-0 items-baseline gap-2">
              <span className="font-mono text-xs text-muted-foreground">{current.ref}</span>
              <span className="truncate">{current.title}</span>
            </span>
          ) : (
            <span className="text-muted-foreground">Izaberite nekretninu…</span>
          )}
          <ChevronsUpDown className="shrink-0 opacity-50" aria-hidden="true" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[min(28rem,calc(100vw-2rem))] p-0">
        <Command shouldFilter={false}>
          <CommandInput placeholder="Šifra ili naslov nekretnine…" value={search} onValueChange={setSearch} />
          <CommandList>
            <CommandEmpty>
              {deferred.length < 2
                ? "Unesite bar dva znaka."
                : hits === undefined
                  ? "Tražim…"
                  : "Nema nekretnina za ovu pretragu."}
            </CommandEmpty>
            {hits !== undefined && hits.length > 0 ? (
              <CommandGroup heading="Nekretnine">
                {hits.map((hit) => (
                  <CommandItem
                    key={hit._id}
                    value={hit._id}
                    onSelect={() => {
                      onPick(hit._id);
                      setOpen(false);
                      setSearch("");
                    }}
                  >
                    <span className="font-mono text-xs text-muted-foreground">{hit.ref}</span>
                    <span className="min-w-0 flex-1 truncate">{hit.title}</span>
                    <span className="text-xs text-muted-foreground">{STATUS_LABEL[hit.status]}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            ) : null}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
