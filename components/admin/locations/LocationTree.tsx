"use client";

import { ArrowDown, ArrowUp, ChevronRight, MoreHorizontal, Pencil, Plus, Star } from "lucide-react";
import type { MouseEvent } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { LocationKind } from "@/convex/lib/validators";
import { LOCATION_KIND_LABEL } from "@/lib/admin/labels";
import { formatCount } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  ADD_LABEL,
  CHILD_KINDS,
  childrenOf,
  sheetHref,
  siblingsOf,
  type LocationId,
  type TreeIndex,
  type TreeRow,
} from "./model";

export type TreeActions = {
  onToggle: (id: LocationId) => void;
  onOpen: (id: LocationId) => void;
  onAdd: (kind: LocationKind, parentId: LocationId) => void;
  onMove: (row: TreeRow, direction: "up" | "down") => void;
};

type TreeProps = TreeActions & {
  index: TreeIndex;
  /** Ids a name filter keeps visible; null = no filter. */
  visible: Set<LocationId> | null;
  expanded: Set<LocationId>;
  /** Moving is off while filtering (hidden siblings) or while a move is saving. */
  canMove: boolean;
};

function counts(row: TreeRow): string {
  if (row.saleCount + row.rentCount === 0) return "Bez objavljenih nekretnina";
  return `${formatCount(row.saleCount, "sr-Latn")} u prodaji · ${formatCount(row.rentCount, "sr-Latn")} za izdavanje`;
}

/** A plain click opens the sheet in place; modified clicks keep the real link. */
function openInPlace(event: MouseEvent<HTMLAnchorElement>, open: () => void) {
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
  event.preventDefault();
  open();
}

/**
 * City → municipality → neighborhood as nested lists with disclosure buttons.
 * Every action is a real button (keyboard first; no drag), and on phones the
 * rows wrap instead of scrolling sideways: the up/down pair moves into the
 * row's menu and the counts under the name.
 */
export function LocationTree(props: TreeProps) {
  const roots = props.index.roots.filter((row) => props.visible === null || props.visible.has(row._id));
  return (
    <ul data-testid="location-tree" aria-label="Stablo lokacija" className="flex flex-col gap-px">
      {roots.map((row) => (
        <TreeNode key={row._id} row={row} {...props} />
      ))}
    </ul>
  );
}

function TreeNode({ row, ...props }: TreeProps & { row: TreeRow }) {
  const { index, visible, expanded, canMove, onToggle, onOpen, onAdd, onMove } = props;
  const kids = childrenOf(index, row._id).filter((child) => visible === null || visible.has(child._id));
  const open = kids.length > 0 && (visible !== null || expanded.has(row._id));
  const siblings = siblingsOf(index, row);
  const position = siblings.findIndex((item) => item._id === row._id);
  const first = position <= 0;
  const last = position === siblings.length - 1;
  const name = row.name.sr;
  const listId = `location-children-${row._id}`;
  const childKinds = CHILD_KINDS[row.kind];

  return (
    <li>
      <div
        data-testid="location-node"
        data-location-id={row._id}
        data-kind={row.kind}
        className="flex items-center gap-1 rounded-md py-0.5 pr-0.5 transition-colors duration-150 hover:bg-muted/60 md:gap-2"
      >
        {kids.length > 0 ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-expanded={open}
            aria-controls={open ? listId : undefined}
            aria-label={`${open ? "Sklopi" : "Rasklopi"} „${name}”`}
            disabled={visible !== null}
            onClick={() => onToggle(row._id)}
          >
            <ChevronRight
              aria-hidden="true"
              className={cn("transition-transform duration-150 motion-reduce:transition-none", open && "rotate-90")}
            />
          </Button>
        ) : (
          <span aria-hidden="true" className="size-8 shrink-0 max-md:size-11" />
        )}

        <div className="min-w-0 flex-1 py-1 md:flex md:items-center md:gap-3">
          <a
            href={sheetHref({ mode: "edit", id: row._id })}
            onClick={(event) => openInPlace(event, () => onOpen(row._id))}
            className={cn(
              "block truncate rounded-sm text-sm underline-offset-4 hover:underline md:max-w-[22rem]",
              row.kind === "city" ? "font-semibold" : "font-medium",
            )}
          >
            {name}
          </a>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground md:mt-0">
            <span>{LOCATION_KIND_LABEL[row.kind]}</span>
            {row.featured ? (
              <span className="inline-flex items-center gap-1 text-foreground">
                <Star aria-hidden="true" className="size-3 fill-bronze text-bronze" />
                Istaknuta
              </span>
            ) : null}
            {row.isDemo ? (
              <Badge variant="outline" className="h-4 px-1.5 text-[0.65rem] font-normal text-muted-foreground">
                Demo
              </Badge>
            ) : null}
            <span className="tabular-nums md:hidden">{counts(row)}</span>
          </div>
        </div>

        <span className="hidden shrink-0 text-right text-xs text-muted-foreground tabular-nums md:block">
          {counts(row)}
        </span>

        <div className="flex shrink-0 items-center">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="max-md:hidden"
            data-move={`${row._id}:up`}
            aria-label={`Pomeri „${name}” gore`}
            disabled={!canMove || first}
            onClick={() => onMove(row, "up")}
          >
            <ArrowUp aria-hidden="true" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="max-md:hidden"
            data-move={`${row._id}:down`}
            aria-label={`Pomeri „${name}” dole`}
            disabled={!canMove || last}
            onClick={() => onMove(row, "down")}
          >
            <ArrowDown aria-hidden="true" />
          </Button>

          {childKinds.length === 1 && childKinds[0] !== undefined ? (
            <AddButton kind={childKinds[0]} name={name} onAdd={(kind) => onAdd(kind, row._id)} />
          ) : childKinds.length > 1 ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button type="button" variant="ghost" size="icon" aria-label={`Dodaj lokaciju u „${name}”`}>
                  <Plus aria-hidden="true" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {childKinds.map((kind) => (
                  <DropdownMenuItem key={kind} onSelect={() => onAdd(kind, row._id)}>
                    {ADD_LABEL[kind]}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <span aria-hidden="true" className="size-8 shrink-0 max-md:size-11" />
          )}

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="md:hidden"
                data-menu={row._id}
                aria-label={`Radnje za „${name}”`}
              >
                <MoreHorizontal aria-hidden="true" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={() => onOpen(row._id)}>
                <Pencil aria-hidden="true" />
                Uredi
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem disabled={!canMove || first} onSelect={() => onMove(row, "up")}>
                <ArrowUp aria-hidden="true" />
                Pomeri gore
              </DropdownMenuItem>
              <DropdownMenuItem disabled={!canMove || last} onSelect={() => onMove(row, "down")}>
                <ArrowDown aria-hidden="true" />
                Pomeri dole
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {open ? (
        <ul id={listId} className="mt-px ml-[15px] flex flex-col gap-px border-l pl-1 max-md:ml-[21px] md:pl-2">
          {kids.map((child) => (
            <TreeNode key={child._id} row={child} {...props} />
          ))}
        </ul>
      ) : null}
    </li>
  );
}

function AddButton({ kind, name, onAdd }: { kind: LocationKind; name: string; onAdd: (kind: LocationKind) => void }) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      aria-label={`${ADD_LABEL[kind]} u „${name}”`}
      onClick={() => onAdd(kind)}
    >
      <Plus aria-hidden="true" />
    </Button>
  );
}
