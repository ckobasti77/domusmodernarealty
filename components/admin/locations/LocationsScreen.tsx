"use client";

import { useMutation, useQuery } from "convex/react";
import { ChevronsDownUp, ChevronsUpDown, MapPin, Plus } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";
import { EmptyState, ListToolbar, SearchInput } from "@/components/admin/common/ListToolbar";
import { PageHeader } from "@/components/admin/common/PageHeader";
import { QueryErrorBoundary } from "@/components/admin/common/QueryErrorBoundary";
import { RequireRole } from "@/components/admin/common/RequireRole";
import { hasRole, MANAGER_ROLES, useMe } from "@/components/admin/shell/me";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/convex/_generated/api";
import type { LocationKind, Role } from "@/convex/lib/validators";
import { adminErrorMessage } from "@/lib/admin/errors";
import { LocationSheet } from "./LocationSheet";
import { LocationTree } from "./LocationTree";
import {
  ancestorsOf,
  buildTree,
  filterIds,
  movedOrder,
  siblingsOf,
  useSheetState,
  type LocationId,
  type TreeRow,
} from "./model";

const CONTENT_ROLES = ["admin", "manager", "editor"] as const satisfies readonly Role[];

/** Serbian count forms: 1 grad, 2–4 grada, 5+ gradova (11–14 take the last). */
function plural(n: number, one: string, few: string, many: string): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return `${n} ${one}`;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return `${n} ${few}`;
  return `${n} ${many}`;
}

function summary(rows: readonly TreeRow[]): string {
  const count = (kind: LocationKind) => rows.filter((row) => row.kind === kind).length;
  return [
    plural(count("city"), "grad", "grada", "gradova"),
    plural(count("municipality"), "opština", "opštine", "opština"),
    plural(count("neighborhood"), "naselje", "naselja", "naselja"),
  ].join(" · ");
}

/**
 * After a move the row's DOM node may have been re-inserted, which drops
 * focus. Put it back on the same control (or its twin when the row reached an
 * edge, or the phone menu), unless the user has moved on.
 */
function refocus(id: LocationId, direction: "up" | "down") {
  const active = document.activeElement;
  if (
    active !== null &&
    active !== document.body &&
    active.closest(`[data-location-id="${id}"]`) === null
  ) {
    return;
  }
  const other = direction === "up" ? "down" : "up";
  for (const selector of [`[data-move="${id}:${direction}"]`, `[data-move="${id}:${other}"]`, `[data-menu="${id}"]`]) {
    const element = document.querySelector<HTMLButtonElement>(selector);
    if (element !== null && element.offsetParent !== null && !element.disabled) {
      element.focus();
      return;
    }
  }
}

function TreeSkeleton() {
  return (
    <div className="flex flex-col gap-2" aria-busy="true" aria-label="Učitavanje lokacija">
      {Array.from({ length: 8 }, (_unused, item) => (
        <Skeleton key={item} className={item % 3 === 0 ? "h-9 w-full" : "ml-8 h-9 w-[calc(100%-2rem)]"} />
      ))}
    </div>
  );
}

function LocationsView() {
  const me = useMe();
  const canDelete = hasRole(me, MANAGER_ROLES);
  const rows = useQuery(api.locationsAdmin.tree, {});
  const index = useMemo(() => (rows === undefined ? null : buildTree(rows)), [rows]);
  const { sheet, setSheet } = useSheetState();
  const [query, setQuery] = useState("");
  const [expandedState, setExpanded] = useState<Set<LocationId> | null>(null);
  const [moving, setMoving] = useState(false);
  const [announcement, setAnnouncement] = useState("");

  const reorder = useMutation(api.locationsAdmin.reorder).withOptimisticUpdate((store, args) => {
    const current = store.getQuery(api.locationsAdmin.tree, {});
    if (current === undefined) return;
    const level = current.filter((row) => args.ids.includes(row._id));
    if (level.length !== args.ids.length) return;
    // The same slots the server assigns: the level's orders, made strictly increasing.
    const slots: number[] = [];
    for (const value of level.map((row) => row.order).sort((a, b) => a - b)) {
      const previous = slots.at(-1);
      slots.push(previous === undefined ? value : Math.max(value, previous + 1));
    }
    const next = new Map(args.ids.map((id, position) => [id, slots[position]]));
    store.setQuery(
      api.locationsAdmin.tree,
      {},
      current.map((row) => {
        const order = next.get(row._id);
        return order === undefined ? row : { ...row, order };
      }),
    );
  });

  // Cities start open; the user's own toggles win from then on.
  const defaultExpanded = useMemo(() => new Set(index?.roots.map((row) => row._id) ?? []), [index]);
  const expanded = expandedState ?? defaultExpanded;
  const visible = useMemo(() => (index === null ? null : filterIds(index, query)), [index, query]);

  const onToggle = useCallback(
    (id: LocationId) => {
      setExpanded((prev) => {
        const next = new Set(prev ?? defaultExpanded);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      });
    },
    [defaultExpanded],
  );

  const expandAll = () => {
    if (index === null) return;
    setExpanded(new Set([...index.children.keys()].filter((key): key is LocationId => key !== "root")));
  };

  const onMove = async (row: TreeRow, direction: "up" | "down") => {
    if (index === null || moving) return;
    const ids = movedOrder(siblingsOf(index, row), row._id, direction);
    if (ids === null) return;
    setMoving(true);
    try {
      await reorder({ ...(row.parentId !== undefined ? { parentId: row.parentId } : {}), ids });
      setAnnouncement(`„${row.name.sr}” je sada na ${ids.indexOf(row._id) + 1}. mestu od ${ids.length}.`);
      window.requestAnimationFrame(() => refocus(row._id, direction));
    } catch (error) {
      toast.error(adminErrorMessage(error));
    } finally {
      setMoving(false);
    }
  };

  const onCreated = (id: LocationId, parentId: LocationId | undefined) => {
    setSheet({ mode: "edit", id });
    if (index === null || parentId === undefined) return;
    const parent = index.byId.get(parentId);
    if (parent === undefined) return;
    setExpanded((prev) => {
      const next = new Set(prev ?? defaultExpanded);
      for (const item of [...ancestorsOf(index, parent), parent]) next.add(item._id);
      return next;
    });
  };

  const addCity = (testId?: string) => (
    <Button
      type="button"
      data-testid={testId}
      onClick={() => setSheet({ mode: "new", kind: "city", parentId: undefined })}
    >
      <Plus aria-hidden="true" />
      Dodaj grad
    </Button>
  );

  const shownCount = visible?.size ?? 0;

  return (
    <>
      <PageHeader
        title="Lokacije"
        description="Gradovi, opštine i naselja za pretragu i stranice lokacija. Redosled u stablu važi i na sajtu; brojevi prikazuju objavljene nekretnine."
        actions={addCity("location-add-city")}
      />

      <ListToolbar>
        <SearchInput
          value={query}
          onChange={setQuery}
          label="Pretraga lokacija"
          placeholder="Pretraga po nazivu…"
        />
        <div className="flex gap-1">
          <Button type="button" variant="outline" size="sm" onClick={expandAll} disabled={index === null || visible !== null}>
            <ChevronsUpDown aria-hidden="true" />
            Rasklopi sve
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setExpanded(new Set())}
            disabled={index === null || visible !== null}
          >
            <ChevronsDownUp aria-hidden="true" />
            Sklopi sve
          </Button>
        </div>
        {rows !== undefined ? (
          <p className="text-xs text-muted-foreground sm:ml-auto sm:self-center" aria-live="polite">
            {visible !== null ? `Pronađeno: ${shownCount}` : summary(rows)}
          </p>
        ) : null}
      </ListToolbar>

      {visible !== null ? (
        <p className="mb-2 text-xs text-muted-foreground">
          Dok je pretraga uključena, redosled se ne menja i sve grane su otvorene.
        </p>
      ) : null}

      {index === null ? (
        <TreeSkeleton />
      ) : index.byId.size === 0 ? (
        <EmptyState
          icon={<MapPin aria-hidden="true" />}
          title="Još nema lokacija."
          description="Dodajte grad, pa u njemu opštine i naselja. Nekretnine se vezuju za ove lokacije."
          action={addCity()}
        />
      ) : visible !== null && visible.size === 0 ? (
        <EmptyState title="Nijedna lokacija ne odgovara pretrazi." description="Proverite naziv ili obrišite pretragu." />
      ) : (
        <div className="rounded-xl border bg-card p-1.5 md:p-2">
          <LocationTree
            index={index}
            visible={visible}
            expanded={expanded}
            canMove={visible === null && !moving}
            onToggle={onToggle}
            onOpen={(id) => setSheet({ mode: "edit", id })}
            onAdd={(kind, parentId) => setSheet({ mode: "new", kind, parentId })}
            onMove={(row, direction) => void onMove(row, direction)}
          />
        </div>
      )}

      <p className="sr-only" aria-live="polite">
        {announcement}
      </p>

      <LocationSheet
        sheet={sheet}
        index={index}
        canDelete={canDelete}
        onClose={() => setSheet({ mode: "closed" })}
        onCreated={onCreated}
      />
    </>
  );
}

/** `/admin/lokacije` (PRD B8): the location tree and its editor. */
export function LocationsScreen() {
  return (
    <RequireRole roles={CONTENT_ROLES}>
      <QueryErrorBoundary>
        <LocationsView />
      </QueryErrorBoundary>
    </RequireRole>
  );
}
