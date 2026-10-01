import type { FunctionReturnType } from "convex/server";
import { useSearchParams } from "next/navigation";
import { useCallback, useMemo } from "react";
import type { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { foldDiacritics } from "@/convex/lib/slug";
import { L10N_KEYS, type LocationKind } from "@/convex/lib/validators";

/**
 * Pure helpers of the Lokacije screen: the tree built from the flat
 * `locationsAdmin.tree` rows, the name filter, and the `?id=` / `?new=` state.
 */

export type TreeRow = FunctionReturnType<typeof api.locationsAdmin.tree>[number];
export type LocationId = Id<"locations">;

export const LOCATIONS_PATH = "/admin/lokacije";

/** Mirrors `PARENT_KINDS` in `convex/locationsAdmin.ts` (the server enforces it). */
export const PARENT_KINDS: Record<LocationKind, readonly LocationKind[]> = {
  city: [],
  municipality: ["city"],
  neighborhood: ["municipality", "city"],
};

/** What may be added under a node, in menu order. */
export const CHILD_KINDS: Record<LocationKind, readonly LocationKind[]> = {
  city: ["municipality", "neighborhood"],
  municipality: ["neighborhood"],
  neighborhood: [],
};

/** "Dodaj opštinu" — the accusative the menus need. */
export const ADD_LABEL: Record<LocationKind, string> = {
  city: "Dodaj grad",
  municipality: "Dodaj opštinu",
  neighborhood: "Dodaj naselje",
};

export const NEW_TITLE: Record<LocationKind, string> = {
  city: "Novi grad",
  municipality: "Nova opština",
  neighborhood: "Novo naselje",
};

/** The same order as the server index: `order`, then creation time. */
function byOrder(a: TreeRow, b: TreeRow): number {
  return a.order - b.order || a._creationTime - b._creationTime;
}

export type TreeIndex = {
  byId: Map<LocationId, TreeRow>;
  /** Children per parent id; the cities under `ROOT`. */
  children: Map<LocationId | typeof ROOT, TreeRow[]>;
  roots: TreeRow[];
};

export const ROOT = "root" as const;

export function buildTree(rows: readonly TreeRow[]): TreeIndex {
  const byId = new Map(rows.map((row) => [row._id, row]));
  const children = new Map<LocationId | typeof ROOT, TreeRow[]>();
  for (const row of rows) {
    // A row whose parent is gone still shows, at the top level.
    const key = row.parentId !== undefined && byId.has(row.parentId) ? row.parentId : ROOT;
    const list = children.get(key);
    if (list === undefined) children.set(key, [row]);
    else list.push(row);
  }
  for (const list of children.values()) list.sort(byOrder);
  return { byId, children, roots: children.get(ROOT) ?? [] };
}

export function childrenOf(index: TreeIndex, id: LocationId): TreeRow[] {
  return index.children.get(id) ?? [];
}

/** The level a row is ordered in: its siblings, itself included. */
export function siblingsOf(index: TreeIndex, row: TreeRow): TreeRow[] {
  const key = row.parentId !== undefined && index.byId.has(row.parentId) ? row.parentId : ROOT;
  return index.children.get(key) ?? [];
}

/** Root first: `[Beograd, Vračar]` for Neimar. */
export function ancestorsOf(index: TreeIndex, row: TreeRow): TreeRow[] {
  const out: TreeRow[] = [];
  let parentId = row.parentId;
  while (parentId !== undefined && out.length < 4) {
    const parent = index.byId.get(parentId);
    if (parent === undefined) break;
    out.unshift(parent);
    parentId = parent.parentId;
  }
  return out;
}

/**
 * Ids to show for a name filter: every row whose name (any locale) or slug
 * contains the folded query, plus its ancestors so it keeps its place in the
 * tree. `null` when there is no filter.
 */
export function filterIds(index: TreeIndex, query: string): Set<LocationId> | null {
  const needle = foldDiacritics(query.trim());
  if (needle.length === 0) return null;
  const visible = new Set<LocationId>();
  for (const row of index.byId.values()) {
    const haystack = [row.slug, ...L10N_KEYS.map((key) => row.name[key] ?? "")]
      .map((text) => foldDiacritics(text))
      .join(" ");
    if (!haystack.includes(needle)) continue;
    visible.add(row._id);
    for (const parent of ancestorsOf(index, row)) visible.add(parent._id);
  }
  return visible;
}

/** The ids of one level after moving `id` one step up or down; null at an edge. */
export function movedOrder(
  siblings: readonly TreeRow[],
  id: LocationId,
  direction: "up" | "down",
): LocationId[] | null {
  const ids = siblings.map((row) => row._id);
  const from = ids.indexOf(id);
  const to = direction === "up" ? from - 1 : from + 1;
  if (from < 0 || to < 0 || to >= ids.length) return null;
  const target = ids[to];
  if (target === undefined) return null;
  ids[to] = id;
  ids[from] = target;
  return ids;
}

/* ------------------------------------------------------------- URL state */

export type SheetState =
  | { mode: "closed" }
  | { mode: "edit"; id: string }
  | { mode: "new"; kind: LocationKind; parentId: string | undefined };

function parseKind(value: string | null): LocationKind | undefined {
  return value === "city" || value === "municipality" || value === "neighborhood" ? value : undefined;
}

export function sheetHref(state: SheetState): string {
  if (state.mode === "closed") return LOCATIONS_PATH;
  const params = new URLSearchParams();
  if (state.mode === "edit") {
    params.set("id", state.id);
  } else {
    params.set("new", state.kind);
    if (state.parentId !== undefined) params.set("parent", state.parentId);
  }
  return `${LOCATIONS_PATH}?${params.toString()}`;
}

/**
 * The open sheet, kept in the query string so a location is linkable. Written
 * with `history.replaceState`, which the App Router mirrors into
 * `useSearchParams` without a server round trip (same idiom as the listings
 * table filters).
 */
export function useSheetState(): { sheet: SheetState; setSheet: (next: SheetState) => void } {
  const params = useSearchParams();
  const id = params.get("id");
  const kind = parseKind(params.get("new"));
  const parent = params.get("parent");

  const sheet = useMemo<SheetState>(() => {
    if (id !== null && id.length > 0) return { mode: "edit", id };
    if (kind !== undefined) return { mode: "new", kind, parentId: parent ?? undefined };
    return { mode: "closed" };
  }, [id, kind, parent]);

  const setSheet = useCallback((next: SheetState) => {
    window.history.replaceState(null, "", sheetHref(next));
  }, []);

  return { sheet, setSheet };
}

/* --------------------------------------------------------------- numbers */

/**
 * A typed €/m² figure. Accepts Serbian formatting (`3.400`, `12,5`) and plain
 * `3400` / `12.5`. Empty means "not set".
 */
export function parseAmount(text: string): { ok: true; value: number | undefined } | { ok: false } {
  const trimmed = text.replace(/\s/g, "");
  if (trimmed.length === 0) return { ok: true, value: undefined };
  let normalized: string;
  if (trimmed.includes(",")) normalized = trimmed.replace(/\./g, "").replace(",", ".");
  else if (/^\d{1,3}(\.\d{3})+$/.test(trimmed)) normalized = trimmed.replace(/\./g, "");
  else normalized = trimmed;
  if (!/^\d+(\.\d+)?$/.test(normalized)) return { ok: false };
  const value = Number(normalized);
  return Number.isFinite(value) ? { ok: true, value } : { ok: false };
}

/** The editor shows stored amounts the way staff type them (`3400`, `12,5`). */
export function formatAmount(value: number | undefined): string {
  if (value === undefined) return "";
  return String(value).replace(".", ",");
}
