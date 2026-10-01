"use client";

import { useSearchParams } from "next/navigation";
import { useCallback, useMemo } from "react";
import type { LeadSource, LeadStatus, LeadType } from "@/convex/lib/validators";
import { LEAD_SOURCE_LABEL, LEAD_STATUS_LABEL, LEAD_TYPE_LABEL } from "@/lib/admin/labels";
import { LEADS_PATH } from "./shared";

export type LeadView = "list" | "kanban";

/** The agent filter: an `agents` id, or `none` for leads nobody owns yet. */
export const UNASSIGNED = "none";

/**
 * The inbox view lives in the query string so a link opens exactly it and
 * `?id=` keeps the open lead linkable:
 * `?view=kanban&type=valuation&agent=…&source=web&from=2026-09-01&to=…&id=…`.
 */
export type LeadParams = {
  view: LeadView;
  status: LeadStatus | undefined;
  type: LeadType | undefined;
  agent: string | undefined;
  source: LeadSource | undefined;
  /** `yyyy-mm-dd`, Belgrade calendar days, inclusive. */
  from: string;
  to: string;
  id: string | undefined;
};

type ParamReader = { get(name: string): string | null };

function pick<T extends string>(labels: Record<T, string>, value: string | null): T | undefined {
  if (value === null) return undefined;
  return (Object.keys(labels) as T[]).find((key) => key === value);
}

function day(value: string | null): string {
  return value !== null && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : "";
}

function text(value: string | null): string | undefined {
  const trimmed = value?.trim();
  return trimmed !== undefined && trimmed.length > 0 ? trimmed : undefined;
}

export function parseLeadParams(params: ParamReader): LeadParams {
  return {
    view: params.get("view") === "kanban" ? "kanban" : "list",
    status: pick(LEAD_STATUS_LABEL, params.get("status")),
    type: pick(LEAD_TYPE_LABEL, params.get("type")),
    agent: text(params.get("agent")),
    source: pick(LEAD_SOURCE_LABEL, params.get("source")),
    from: day(params.get("from")),
    to: day(params.get("to")),
    id: text(params.get("id")),
  };
}

export function leadParamsHref(value: LeadParams): string {
  const params = new URLSearchParams();
  if (value.view === "kanban") params.set("view", "kanban");
  if (value.status !== undefined) params.set("status", value.status);
  if (value.type !== undefined) params.set("type", value.type);
  if (value.agent !== undefined) params.set("agent", value.agent);
  if (value.source !== undefined) params.set("source", value.source);
  if (value.from.length > 0) params.set("from", value.from);
  if (value.to.length > 0) params.set("to", value.to);
  if (value.id !== undefined) params.set("id", value.id);
  const query = params.toString();
  return query.length > 0 ? `${LEADS_PATH}?${query}` : LEADS_PATH;
}

/**
 * Reads the view from the URL and writes it back with `history.replaceState`
 * (mirrored into `useSearchParams` by the App Router, no server round trip).
 */
export function useLeadParams() {
  const search = useSearchParams();
  const params = useMemo(() => parseLeadParams(search), [search]);

  const setParams = useCallback((patch: Partial<LeadParams>) => {
    // The live URL, not the render's snapshot: two changes can land between renders.
    const current = parseLeadParams(new URLSearchParams(window.location.search));
    window.history.replaceState(null, "", leadParamsHref({ ...current, ...patch }));
  }, []);

  const clearFilters = useCallback(() => {
    setParams({
      status: undefined,
      type: undefined,
      agent: undefined,
      source: undefined,
      from: "",
      to: "",
    });
  }, [setParams]);

  const hasFilters =
    params.type !== undefined ||
    params.agent !== undefined ||
    params.source !== undefined ||
    params.from.length > 0 ||
    params.to.length > 0 ||
    (params.view === "list" && params.status !== undefined);

  return { params, setParams, clearFilters, hasFilters };
}
