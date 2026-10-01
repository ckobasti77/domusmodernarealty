import { useSearchParams } from "next/navigation";
import { useCallback, useMemo } from "react";

export const TEAM_PATH = "/admin/tim";

export const TEAM_TABS = ["users", "invites", "agents"] as const;
export type TeamTab = (typeof TEAM_TABS)[number];

/** `?tab=agents&id=novi` opens an empty agent profile. */
export const NEW_AGENT_ID = "novi";

/**
 * The Team screen's state in the query string, so a tab or an open record can
 * be linked: `?tab=users|invites|agents&id=<user or agent id>&pozovi=1`.
 */
export type TeamParams = {
  /** Undefined: the first tab this role may see. */
  tab: TeamTab | undefined;
  /** The user (Users tab) or agent profile (Agents tab) open in the sheet. */
  id: string | undefined;
  /** The "Pozovite člana tima" dialog is open. */
  invite: boolean;
};

type ParamReader = { get(name: string): string | null };

function parseParams(params: ParamReader): TeamParams {
  const tab = params.get("tab");
  const id = params.get("id")?.trim();
  return {
    tab: TEAM_TABS.find((item) => item === tab),
    id: id !== undefined && id.length > 0 ? id : undefined,
    invite: params.get("pozovi") === "1",
  };
}

function paramsHref(state: TeamParams): string {
  const params = new URLSearchParams();
  if (state.tab !== undefined) params.set("tab", state.tab);
  if (state.id !== undefined) params.set("id", state.id);
  if (state.invite) params.set("pozovi", "1");
  const query = params.toString();
  return query.length > 0 ? `${TEAM_PATH}?${query}` : TEAM_PATH;
}

/**
 * Reads the state from the URL and writes it back with
 * `history.replaceState`, which the App Router mirrors into
 * `useSearchParams` without a server round trip (the listings table idiom).
 */
export function useTeamParams() {
  const search = useSearchParams();
  const params = useMemo(() => parseParams(search), [search]);

  const setParams = useCallback((patch: Partial<TeamParams>) => {
    const current = parseParams(new URLSearchParams(window.location.search));
    window.history.replaceState(null, "", paramsHref({ ...current, ...patch }));
  }, []);

  return { params, setParams };
}
