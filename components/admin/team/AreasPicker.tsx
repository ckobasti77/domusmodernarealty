"use client";

import { useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { ChevronsUpDown, X } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { foldDiacritics } from "@/convex/lib/slug";
import { LOCATION_KIND_LABEL } from "@/lib/admin/labels";

type LocationRow = FunctionReturnType<typeof api.locationsAdmin.tree>[number];
type Entry = { node: LocationRow; depth: number; path: string };

/** The server caps an agent at 20 areas. */
export const MAX_AREAS = 20;

/** City → municipality → neighborhood, depth first, each level in its saved order. */
function flatten(nodes: readonly LocationRow[]): Entry[] {
  const children = new Map<string, LocationRow[]>();
  for (const node of nodes) {
    const key = node.parentId ?? "";
    const list = children.get(key) ?? [];
    list.push(node);
    children.set(key, list);
  }
  for (const list of children.values()) {
    list.sort((a, b) => a.order - b.order || a._creationTime - b._creationTime);
  }
  const out: Entry[] = [];
  const walk = (parent: string, depth: number, prefix: string) => {
    if (depth > 3) return;
    for (const node of children.get(parent) ?? []) {
      const path = prefix.length > 0 ? `${prefix} › ${node.name.sr}` : node.name.sr;
      out.push({ node, depth, path });
      walk(node._id, depth + 1, path);
    }
  };
  walk("", 0, "");
  return out;
}

/**
 * The areas an agent covers (shown on their public profile): a searchable
 * list of every location with checkmarks, and the choice as removable chips.
 */
export function AreasPicker({
  id,
  value,
  onChange,
  describedBy,
}: {
  id: string;
  value: readonly Id<"locations">[];
  onChange: (next: Id<"locations">[]) => void;
  describedBy?: string;
}) {
  const nodes = useQuery(api.locationsAdmin.tree, {});
  const [open, setOpen] = useState(false);
  const entries = useMemo(() => (nodes === undefined ? [] : flatten(nodes)), [nodes]);
  const byId = useMemo(() => new Map(entries.map((entry) => [entry.node._id, entry])), [entries]);
  const full = value.length >= MAX_AREAS;

  const toggle = (locationId: Id<"locations">) => {
    if (value.includes(locationId)) onChange(value.filter((item) => item !== locationId));
    else if (!full) onChange([...value, locationId]);
  };

  return (
    <div className="flex flex-col gap-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            id={id}
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            aria-describedby={describedBy}
            disabled={nodes === undefined}
            className="w-full justify-between font-normal sm:w-80"
          >
            {nodes === undefined
              ? "Učitavanje lokacija…"
              : value.length === 0
                ? "Izaberite oblasti…"
                : `Izabrano: ${value.length}`}
            <ChevronsUpDown className="opacity-50" aria-hidden="true" />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-(--radix-popover-trigger-width) min-w-72 p-0">
          <Command>
            <CommandInput placeholder="Pretraga lokacija…" aria-label="Pretraga lokacija" />
            <CommandList>
              <CommandEmpty>Nema takve lokacije.</CommandEmpty>
              <CommandGroup>
                {entries.map(({ node, depth, path }) => {
                  const selected = value.includes(node._id);
                  return (
                    <CommandItem
                      key={node._id}
                      value={`${path} ${node._id}`}
                      keywords={[foldDiacritics(path)]}
                      data-checked={selected}
                      disabled={!selected && full}
                      onSelect={() => toggle(node._id)}
                    >
                      <span className="min-w-0 truncate" style={{ paddingLeft: `${depth * 0.875}rem` }}>
                        {node.name.sr}
                      </span>
                      <span className="text-xs text-muted-foreground">{LOCATION_KIND_LABEL[node.kind]}</span>
                      {selected ? <span className="sr-only">(izabrano)</span> : null}
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {value.length > 0 ? (
        <ul aria-label="Izabrane oblasti" className="flex flex-wrap gap-1.5">
          {value.map((locationId) => {
            const entry = byId.get(locationId);
            const label = entry?.path ?? "Nepoznata lokacija";
            return (
              <li
                key={locationId}
                className="inline-flex h-7 items-center gap-1 rounded-md border bg-muted/40 pr-0.5 pl-2 text-xs"
              >
                {label}
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  onClick={() => toggle(locationId)}
                  aria-label={`Uklonite oblast ${label}`}
                >
                  <X aria-hidden="true" />
                </Button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
