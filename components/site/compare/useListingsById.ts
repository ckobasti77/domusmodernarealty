"use client";

import { useQueries } from "convex/react";
import type { FunctionReference, FunctionReturnType } from "convex/server";
import { useMemo } from "react";
import type { Id } from "@/convex/_generated/dataModel";

/** `listings.byIds` or `listings.detailsByIds`: ids in, the public ones out. */
type ByIdsQuery = FunctionReference<"query", "public", { ids: Id<"listings">[] }>;

type Item<Q extends ByIdsQuery> = FunctionReturnType<Q> extends readonly (infer T)[] ? T : never;

export type ListingState<T> =
  | { status: "loading" }
  | { status: "found"; listing: T }
  /** Withdrawn, never published, or an id Convex refused. */
  | { status: "missing" };

const LOADING = { status: "loading" } as const;
const MISSING = { status: "missing" } as const;

/**
 * One live subscription PER listing id, rather than one batch query.
 *
 * - Removing a listing (a heart on the favorites page, a column on the compare
 *   page) only drops its own subscription; every other result stays on screen
 *   instead of the whole list falling back to a loading state while a new
 *   batch is fetched.
 * - A withdrawn listing, or an id Convex rejects, affects exactly one entry,
 *   so the page can say precisely which saved listings are gone.
 * - `listings.byIds` caps a batch at 50 while favorites hold up to 200; there
 *   is no batch boundary to fall off.
 *
 * Convex de-duplicates identical subscriptions and caches query results, so a
 * typical list (a handful of ids) costs the same as a batch.
 */
export function useListingsById<Q extends ByIdsQuery>(
  query: Q,
  ids: readonly Id<"listings">[],
): ReadonlyMap<string, ListingState<Item<Q>>> {
  // `useQueries` re-subscribes whenever this object changes identity, so it is
  // rebuilt only when the id list itself changes (the stores hand out a stable
  // frozen array until a write happens).
  const request = useMemo(
    () => Object.fromEntries(ids.map((id) => [id, { query, args: { ids: [id] } }])),
    [query, ids],
  );
  const results = useQueries(request);

  return useMemo(() => {
    const states = new Map<string, ListingState<Item<Q>>>();
    for (const id of ids) {
      // `useQueries` is untyped: a value is `undefined` while loading, an
      // `Error` when the query threw, else the query's own return value.
      const value: unknown = results[id];
      if (value === undefined) {
        states.set(id, LOADING);
      } else if (Array.isArray(value) && value.length > 0) {
        states.set(id, { status: "found", listing: value[0] as Item<Q> });
      } else {
        states.set(id, MISSING);
      }
    }
    return states;
  }, [ids, results]);
}
