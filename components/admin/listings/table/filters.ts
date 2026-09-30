import { useSearchParams } from "next/navigation";
import { useCallback, useMemo } from "react";
import type { ListingStatus, PropertyType, Transaction } from "@/convex/lib/validators";
import { PROPERTY_TYPE_LABEL, STATUS_ORDER, TRANSACTION_LABEL } from "@/lib/admin/labels";

export const LISTINGS_PATH = "/admin/nekretnine";

/** Label maps are exhaustive `Record`s, so their keys are the enum values. */
export const PROPERTY_TYPES = Object.keys(PROPERTY_TYPE_LABEL) as PropertyType[];
export const TRANSACTIONS = Object.keys(TRANSACTION_LABEL) as Transaction[];

function pick<T extends string>(allowed: readonly T[], value: string | null): T | undefined {
  return value === null ? undefined : allowed.find((item) => item === value);
}

export function isPropertyType(value: unknown): value is PropertyType {
  return typeof value === "string" && pick(PROPERTY_TYPES, value) !== undefined;
}

export function isTransaction(value: unknown): value is Transaction {
  return typeof value === "string" && pick(TRANSACTIONS, value) !== undefined;
}

/**
 * The table's view, kept in the query string so a link such as
 * `/admin/nekretnine?status=published` opens that view and "back" from the
 * editor restores it: `?status=…&q=…&agent=…&type=…&tx=…&demo=1`.
 */
export type ListingFilters = {
  status: ListingStatus | undefined;
  q: string;
  /** An `agents` id; validated against `agentsAdmin.list` before it is sent. */
  agent: string | undefined;
  type: PropertyType | undefined;
  tx: Transaction | undefined;
  demo: boolean;
};

type ParamReader = { get(name: string): string | null };

export function parseFilters(params: ParamReader): ListingFilters {
  const agent = params.get("agent")?.trim();
  return {
    status: pick(STATUS_ORDER, params.get("status")),
    q: params.get("q") ?? "",
    agent: agent !== undefined && agent.length > 0 ? agent : undefined,
    type: pick(PROPERTY_TYPES, params.get("type")),
    tx: pick(TRANSACTIONS, params.get("tx")),
    demo: params.get("demo") === "1",
  };
}

/** A stable, minimal URL for a view (empty filters are left out). */
export function filtersHref(filters: ListingFilters): string {
  const params = new URLSearchParams();
  if (filters.status !== undefined) params.set("status", filters.status);
  const q = filters.q.trim();
  if (q.length > 0) params.set("q", q);
  if (filters.agent !== undefined) params.set("agent", filters.agent);
  if (filters.type !== undefined) params.set("type", filters.type);
  if (filters.tx !== undefined) params.set("tx", filters.tx);
  if (filters.demo) params.set("demo", "1");
  const query = params.toString();
  return query.length > 0 ? `${LISTINGS_PATH}?${query}` : LISTINGS_PATH;
}

export function hasActiveFilters(filters: ListingFilters): boolean {
  return (
    filters.q.trim().length > 0 ||
    filters.agent !== undefined ||
    filters.type !== undefined ||
    filters.tx !== undefined ||
    filters.demo
  );
}

/**
 * Reads the view from the URL and writes it back with `history.replaceState`,
 * which the App Router mirrors into `useSearchParams` (see "Native History API"
 * in the Next.js linking guide). Unlike `router.replace` it costs no server
 * round trip, so typing in the search box never waits on the network. Replace,
 * not push: filtering must not flood the history stack.
 */
export function useListingFilters() {
  const params = useSearchParams();
  const filters = useMemo(() => parseFilters(params), [params]);

  const hrefWith = useCallback(
    (patch: Partial<ListingFilters>) => filtersHref({ ...filters, ...patch }),
    [filters],
  );

  const setFilters = useCallback((patch: Partial<ListingFilters>) => {
    // Read the live URL, not the render's snapshot: a debounced search and a
    // select change can land between two renders.
    const current = parseFilters(new URLSearchParams(window.location.search));
    window.history.replaceState(null, "", filtersHref({ ...current, ...patch }));
  }, []);

  const clearFilters = useCallback(() => {
    setFilters({ q: "", agent: undefined, type: undefined, tx: undefined, demo: false });
  }, [setFilters]);

  return { filters, hrefWith, setFilters, clearFilters, hasFilters: hasActiveFilters(filters) };
}
