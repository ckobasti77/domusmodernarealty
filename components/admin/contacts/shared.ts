"use client";

import type { FunctionReturnType } from "convex/server";
import { useSearchParams } from "next/navigation";
import { useCallback, useMemo } from "react";
import type { api } from "@/convex/_generated/api";

export type ContactRow = FunctionReturnType<typeof api.contacts.list>["page"][number];
export type ContactDetail = NonNullable<FunctionReturnType<typeof api.contacts.get>>;

export const CONTACTS_PATH = "/admin/kontakti";

type ContactParams = { q: string; id: string | undefined };

function parse(params: { get(name: string): string | null }): ContactParams {
  const id = params.get("id")?.trim();
  return { q: params.get("q") ?? "", id: id !== undefined && id.length > 0 ? id : undefined };
}

function href(value: ContactParams): string {
  const params = new URLSearchParams();
  const q = value.q.trim();
  if (q.length > 0) params.set("q", q);
  if (value.id !== undefined) params.set("id", value.id);
  const query = params.toString();
  return query.length > 0 ? `${CONTACTS_PATH}?${query}` : CONTACTS_PATH;
}

/** `?q=` (search) and `?id=` (open contact), written with `history.replaceState`. */
export function useContactParams() {
  const search = useSearchParams();
  const params = useMemo(() => parse(search), [search]);
  const setParams = useCallback((patch: Partial<ContactParams>) => {
    const current = parse(new URLSearchParams(window.location.search));
    window.history.replaceState(null, "", href({ ...current, ...patch }));
  }, []);
  return { params, setParams };
}

/** Listing owners (`listingsAdmin.setOwner`) carry this tag; they can only survive a merge. */
export const OWNER_TAG = "vlasnik";
