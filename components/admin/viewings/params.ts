import { useSearchParams } from "next/navigation";
import { useCallback, useMemo } from "react";
import type { ViewingStatus } from "@/convex/lib/validators";
import { VIEWING_STATUS_ORDER } from "./status";

const VIEWINGS_PATH = "/admin/razgledanja";

export type ViewKind = "week" | "day" | "list" | "availability";
export type ListWhen = "upcoming" | "past";

const VIEWS: readonly ViewKind[] = ["week", "day", "list", "availability"];

/**
 * The screen's state, kept in the query string so every view is linkable:
 * `?view=week|day|list|availability&date=YYYY-MM-DD&id=<viewing>&agent=<agent>
 * &when=past&status=confirmed&new=1&lead=<lead>`.
 */
type ViewingsParams = {
  /** Undefined: the default for the device (week on desktop, day on a phone). */
  view: ViewKind | undefined;
  /** Belgrade day; validated where it is read (`wallOfDayKey`). */
  date: string | undefined;
  /** The viewing open in the detail sheet. */
  id: string | undefined;
  /** Agent filter (admin/manager) and the agent whose hours are edited. */
  agent: string | undefined;
  when: ListWhen;
  status: ViewingStatus | undefined;
  /** "Novo razgledanje" dialog open, optionally for a lead. */
  create: boolean;
  lead: string | undefined;
};

type ParamReader = { get(name: string): string | null };

function text(value: string | null): string | undefined {
  const trimmed = value?.trim();
  return trimmed !== undefined && trimmed.length > 0 ? trimmed : undefined;
}

function pick<T extends string>(allowed: readonly T[], value: string | null): T | undefined {
  return value === null ? undefined : allowed.find((item) => item === value);
}

function parseParams(params: ParamReader): ViewingsParams {
  return {
    view: pick(VIEWS, params.get("view")),
    date: text(params.get("date")),
    id: text(params.get("id")),
    agent: text(params.get("agent")),
    when: params.get("when") === "past" ? "past" : "upcoming",
    status: pick(VIEWING_STATUS_ORDER, params.get("status")),
    create: params.get("new") === "1",
    lead: text(params.get("lead")),
  };
}

function paramsHref(state: ViewingsParams): string {
  const params = new URLSearchParams();
  if (state.view !== undefined) params.set("view", state.view);
  if (state.date !== undefined) params.set("date", state.date);
  if (state.agent !== undefined) params.set("agent", state.agent);
  if (state.when === "past") params.set("when", "past");
  if (state.status !== undefined) params.set("status", state.status);
  if (state.id !== undefined) params.set("id", state.id);
  if (state.create) params.set("new", "1");
  if (state.lead !== undefined) params.set("lead", state.lead);
  const query = params.toString();
  return query.length > 0 ? `${VIEWINGS_PATH}?${query}` : VIEWINGS_PATH;
}

/**
 * Reads the state from the URL and writes it back with
 * `history.replaceState`, which the App Router mirrors into
 * `useSearchParams` without a server round trip (same idiom as the listings
 * table filters).
 */
export function useViewingsParams() {
  const search = useSearchParams();
  const params = useMemo(() => parseParams(search), [search]);

  const setParams = useCallback((patch: Partial<ViewingsParams>) => {
    // The live URL, not the render's snapshot: two updates can land between renders.
    const current = parseParams(new URLSearchParams(window.location.search));
    window.history.replaceState(null, "", paramsHref({ ...current, ...patch }));
  }, []);

  return { params, setParams };
}
