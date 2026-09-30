"use client";

import { useQuery } from "convex/react";
import { useState } from "react";
import { api } from "@/convex/_generated/api";
import type { SearchFilters } from "@/convex/lib/validators";

export type ResultCount = { count: number; exact: boolean };

/**
 * The live result count for a filter set (`listings.count`). While new args
 * load it keeps answering with the previous count, flagged `pending`, so a
 * button label never flickers to empty between two numbers.
 */
export function useResultCount(filters: SearchFilters, initial?: ResultCount) {
  const live = useQuery(api.listings.count, { filters });
  const [last, setLast] = useState<ResultCount | undefined>(initial);
  // Derived state, updated during render (no effect round-trip).
  if (live !== undefined && (live.count !== last?.count || live.exact !== last.exact)) setLast(live);
  return { value: live ?? last, pending: live === undefined };
}
