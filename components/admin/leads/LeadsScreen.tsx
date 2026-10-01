"use client";

import { useQuery } from "convex/react";
import { Columns3, List } from "lucide-react";
import { PageHeader } from "@/components/admin/common/PageHeader";
import { QueryErrorBoundary } from "@/components/admin/common/QueryErrorBoundary";
import { RequireRole } from "@/components/admin/common/RequireRole";
import { hasRole, LISTING_ROLES, MANAGER_ROLES, useMe } from "@/components/admin/shell/me";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { LEAD_STATUS_LABEL } from "@/lib/admin/labels";
import { LeadSheet } from "./LeadSheet";
import { LeadsFilters } from "./LeadsFilters";
import { LeadsKanban, type KanbanArgs } from "./LeadsKanban";
import { LeadsList, type ListArgs } from "./LeadsList";
import { UNASSIGNED, leadParamsHref, useLeadParams, type LeadParams } from "./params";
import { PHONE_QUERY, dayEnd, dayStart, useNow } from "./shared";
import { useLeadStatus } from "./useLeadStatus";

/** Timers and relative times refresh twice a minute. */
const NOW_TICK_MS = 30_000;

type AgentOption = { _id: Id<"agents">; name: string };

/**
 * The server filter arguments for the current URL. An agent id from the URL is
 * only sent once it is known to exist (a stale id would fail the validator);
 * agents never send one: the server pins them to their own leads anyway.
 */
function filterArgs(
  params: LeadParams,
  canManage: boolean,
  agents: readonly AgentOption[] | undefined,
): KanbanArgs | "skip" {
  let agent: { agentId: Id<"agents"> } | { unassigned: true } | Record<string, never> = {};
  if (canManage && params.agent !== undefined) {
    if (params.agent === UNASSIGNED) {
      agent = { unassigned: true };
    } else {
      if (agents === undefined) return "skip";
      const found = agents.find((item) => item._id === params.agent);
      if (found !== undefined) agent = { agentId: found._id };
    }
  }
  const createdFrom = dayStart(params.from);
  const createdTo = dayEnd(params.to);
  return {
    ...(params.type !== undefined ? { type: params.type } : {}),
    ...(params.source !== undefined ? { source: params.source } : {}),
    ...(createdFrom !== undefined ? { createdFrom } : {}),
    ...(createdTo !== undefined ? { createdTo } : {}),
    ...agent,
  };
}

function LeadsView() {
  const me = useMe();
  const canManage = hasRole(me, MANAGER_ROLES);
  const now = useNow(NOW_TICK_MS);
  const phone = useMediaQuery(PHONE_QUERY);
  const { params, setParams, clearFilters, hasFilters } = useLeadParams();
  const agents = useQuery(api.agentsAdmin.list, canManage ? {} : "skip");
  const { changeStatus, dialog } = useLeadStatus();

  const board = filterArgs(params, canManage, agents);
  const list: ListArgs | "skip" =
    board === "skip" ? "skip" : { ...board, ...(params.status !== undefined ? { status: params.status } : {}) };
  const openLead = (id: Id<"leads">) => setParams({ id });

  const empty = (partial: boolean) => (
    <div className="mx-auto flex max-w-sm flex-col items-center gap-3 py-6">
      <p className="font-medium text-foreground">
        {partial
          ? "Među do sada učitanim upitima nema poklapanja."
          : hasFilters
            ? "Nijedan upit ne odgovara filterima."
            : "Još nema upita."}
      </p>
      <p className="text-sm text-muted-foreground">
        {partial
          ? "Učitajte još da pretraga nastavi kroz starije upite."
          : hasFilters
            ? "Promenite ili poništite filtere."
            : "Upiti sa sajta, zahtevi za razgledanje i procene stižu ovde."}
      </p>
      {hasFilters ? (
        <Button variant="outline" onClick={clearFilters}>
          Poništi filtere
        </Button>
      ) : null}
    </div>
  );

  return (
    <>
      <PageHeader
        title="Upiti"
        description={
          canManage
            ? "Svi upiti sa sajta i njihove faze prodaje. Odgovorite u roku od sat vremena."
            : "Upiti dodeljeni Vama. Odgovorite u roku od sat vremena."
        }
        actions={
          <ToggleGroup
            type="single"
            variant="outline"
            spacing={0}
            value={params.view}
            aria-label="Prikaz upita"
            onValueChange={(value) => {
              if (value === "list" || value === "kanban") setParams({ view: value });
            }}
          >
            <ToggleGroupItem value="list" data-testid="leads-view-list" aria-label="Lista">
              <List aria-hidden="true" />
              <span className="max-sm:sr-only">Lista</span>
            </ToggleGroupItem>
            <ToggleGroupItem value="kanban" data-testid="leads-view-kanban" aria-label="Faze">
              <Columns3 aria-hidden="true" />
              <span className="max-sm:sr-only">Faze</span>
            </ToggleGroupItem>
          </ToggleGroup>
        }
      />

      {params.view === "list" ? (
        <Card className="gap-0 py-0">
          <LeadsFilters
            params={params}
            onChange={setParams}
            onClear={clearFilters}
            hasFilters={hasFilters}
            agents={agents}
            showAgent={canManage}
            showStatus
            className="border-b p-3"
          />
          <LeadsList
            args={list}
            now={now}
            showAgent={canManage}
            phone={phone}
            onOpen={openLead}
            empty={empty}
          />
        </Card>
      ) : (
        <>
          <LeadsFilters
            params={params}
            onChange={setParams}
            onClear={clearFilters}
            hasFilters={hasFilters}
            agents={agents}
            showAgent={canManage}
            showStatus={false}
            className="mb-4"
          />
          <LeadsKanban
            args={board}
            now={now}
            showAgent={canManage}
            onOpen={openLead}
            onMove={changeStatus}
            moreHref={(status) => leadParamsHref({ ...params, view: "list", status, id: undefined })}
          />
          <p className="mt-2 text-xs text-muted-foreground">
            Karticu prevucite u drugu fazu ili koristite dugme „Premesti u…”. Za fazu „
            {LEAD_STATUS_LABEL.lost}” upisujete razlog.
          </p>
        </>
      )}

      <LeadSheet
        id={params.id}
        onClose={() => setParams({ id: undefined })}
        canManage={canManage}
        agents={agents}
        now={now}
        onStatus={changeStatus}
      />
      {dialog}
    </>
  );
}

/** `/admin/upiti` — the inbox and the pipeline (PRD B4). */
export function LeadsScreen() {
  return (
    <RequireRole roles={LISTING_ROLES}>
      <QueryErrorBoundary backHref="/admin" backLabel="Kontrolna tabla">
        <LeadsView />
      </QueryErrorBoundary>
    </RequireRole>
  );
}
