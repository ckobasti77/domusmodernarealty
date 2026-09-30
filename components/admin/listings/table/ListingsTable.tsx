"use client";

import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type Header,
  type RowSelectionState,
  type SortDirection,
  type SortingState,
  type VisibilityState,
} from "@tanstack/react-table";
import { useMemo, useState, type ReactNode } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { BulkBar } from "./BulkBar";
import { buildColumns, columnClass } from "./columns";
import type { AdminRow, AgentOption } from "./types";

const SKELETON_ROWS = 8;
/** The hidden "leads" column only exists to sort by (see `columns.tsx`). */
const COLUMN_VISIBILITY: VisibilityState = { leads: false };

function ariaSort(sorted: false | SortDirection): "ascending" | "descending" | "none" {
  if (sorted === "asc") return "ascending";
  if (sorted === "desc") return "descending";
  return "none";
}

/** `aria-sort` for a header; the merged "Pregledi / upiti" column reports either half. */
function headerSort(header: Header<AdminRow, unknown>): "ascending" | "descending" | "none" | undefined {
  const { column } = header;
  if (column.id === "views") {
    const leads = header.getContext().table.getColumn("leads");
    return ariaSort(column.getIsSorted() || (leads?.getIsSorted() ?? false));
  }
  return column.getCanSort() ? ariaSort(column.getIsSorted()) : undefined;
}

/**
 * The listings grid: TanStack Table over the loaded rows. Sorting is
 * client-side within what is loaded; the server order is "last updated first"
 * (or relevance while searching).
 */
export function ListingsTable({
  rows,
  loading,
  refreshing,
  now,
  canManage,
  agents,
  selectionKey,
  empty,
}: {
  rows: AdminRow[];
  /** First page still loading and nothing to show yet: skeleton rows. */
  loading: boolean;
  /** A new filter is loading while the previous rows stay on screen. */
  refreshing: boolean;
  now: number;
  canManage: boolean;
  agents: readonly AgentOption[] | undefined;
  /** Selection is dropped whenever this changes (i.e. the filters). */
  selectionKey: string;
  empty: ReactNode;
}) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [selectionFor, setSelectionFor] = useState(selectionKey);
  if (selectionFor !== selectionKey) {
    setSelectionFor(selectionKey);
    setRowSelection({});
  }

  const columns = useMemo(
    () => buildColumns({ now, selectable: canManage, canDelete: canManage }),
    [now, canManage],
  );
  // eslint-disable-next-line react-hooks/incompatible-library -- TanStack Table returns fresh functions each render by design; nothing here is memoized on them.
  const table = useReactTable({
    data: rows,
    columns,
    state: { sorting, rowSelection, columnVisibility: COLUMN_VISIBILITY },
    getRowId: (row) => row._id,
    enableRowSelection: canManage,
    onSortingChange: setSorting,
    onRowSelectionChange: setRowSelection,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  const selected = table.getSelectedRowModel().rows.map((row) => row.original);
  const columnCount = table.getVisibleLeafColumns().length;
  const tableRows = table.getRowModel().rows;

  return (
    <>
      {canManage && selected.length > 0 ? (
        <BulkBar selected={selected} agents={agents} onClear={() => table.resetRowSelection()} />
      ) : null}
      <div
        role="region"
        aria-label="Tabela nekretnina"
        // Scrollable regions must be reachable by keyboard (WCAG 2.1.1).
        tabIndex={0}
        className="relative overflow-auto outline-none focus-visible:ring-3 focus-visible:ring-ring/50 md:max-h-[max(20rem,calc(100svh-20rem))]"
      >
        <table
          data-testid="listings-table"
          data-slot="table"
          aria-busy={loading || refreshing}
          className={cn(
            // Fixed layout: set widths everywhere but the title column, which
            // takes the rest. Below 880 px the region scrolls sideways and the
            // actions column stays pinned (sticky) on the right.
            "w-full min-w-[880px] table-fixed caption-bottom text-sm transition-opacity duration-150",
            refreshing && "opacity-60",
          )}
        >
          <caption className="sr-only">
            Nekretnine. Sortirati se mogu cena, pregledi, upiti i datum izmene.
          </caption>
          <TableHeader className="sticky top-0 z-10 bg-card shadow-[inset_0_-1px_0_var(--border)] [&_tr]:border-b-0">
            {table.getHeaderGroups().map((group) => (
              <TableRow key={group.id} className="hover:bg-transparent">
                {group.headers.map((header) => (
                  <TableHead
                    key={header.id}
                    scope="col"
                    aria-sort={headerSort(header)}
                    className={cn("h-9 text-xs font-medium text-muted-foreground", columnClass(header.column.id))}
                  >
                    {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {loading
              ? Array.from({ length: SKELETON_ROWS }, (_, index) => (
                  <TableRow key={`skeleton-${index}`} className="h-14 hover:bg-transparent" aria-hidden="true">
                    {table.getVisibleLeafColumns().map((column) => (
                      <TableCell key={column.id} className={columnClass(column.id)}>
                        <Skeleton className={column.id === "cover" ? "h-10 w-14" : "h-4 w-full min-w-6"} />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              : null}
            {!loading && tableRows.length === 0 ? (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={columnCount} className="h-48 text-center whitespace-normal">
                  {empty}
                </TableCell>
              </TableRow>
            ) : null}
            {!loading
              ? tableRows.map((row) => (
                  <TableRow
                    key={row.id}
                    data-testid="listing-row"
                    data-ref={row.original.ref}
                    data-status={row.original.status}
                    data-state={row.getIsSelected() ? "selected" : undefined}
                    className="group/row h-14"
                  >
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id} className={cn("py-1.5", columnClass(cell.column.id))}>
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              : null}
          </TableBody>
        </table>
      </div>
    </>
  );
}
