"use client";

import { useQuery } from "convex/react";
import { CalendarDays, CalendarRange, Clock, List, Plus } from "lucide-react";
import { useEffect, useState } from "react";
import { FilterSelect } from "@/components/admin/common/ListToolbar";
import { PageHeader } from "@/components/admin/common/PageHeader";
import { QueryErrorBoundary } from "@/components/admin/common/QueryErrorBoundary";
import { RequireRole } from "@/components/admin/common/RequireRole";
import { hasRole, LISTING_ROLES, MANAGER_ROLES, useMe } from "@/components/admin/shell/me";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { api } from "@/convex/_generated/api";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { AvailabilityEditor } from "./AvailabilityEditor";
import { CalendarView } from "./CalendarView";
import { NewViewingDialog } from "./NewViewingDialog";
import { useViewingsParams, type ViewKind } from "./params";
import { todayKey, wallOfDayKey } from "./time";
import { ViewingSheet } from "./ViewingSheet";
import { ViewingsList } from "./ViewingsList";

/** Below Tailwind's `md`: the agenda replaces the week grid, and "day" is the default view. */
const PHONE_QUERY = "(max-width: 767.98px)";
/** The "now" line and the outcome rules move once a minute. */
const NOW_TICK_MS = 60_000;

const VIEW_OPTIONS: readonly { value: ViewKind; label: string; icon: typeof CalendarDays }[] = [
  { value: "week", label: "Nedelja", icon: CalendarRange },
  { value: "day", label: "Dan", icon: CalendarDays },
  { value: "list", label: "Lista", icon: List },
  { value: "availability", label: "Dostupnost", icon: Clock },
];

function useNow(tickMs: number): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), tickMs);
    return () => window.clearInterval(timer);
  }, [tickMs]);
  return now;
}

function ViewingsView() {
  const me = useMe();
  const canManage = hasRole(me, MANAGER_ROLES);
  const phone = useMediaQuery(PHONE_QUERY);
  const now = useNow(NOW_TICK_MS);
  // The list's "upcoming / past" boundary: fixed per visit, so pages don't reset every minute.
  const [listNow] = useState(() => Math.floor(Date.now() / NOW_TICK_MS) * NOW_TICK_MS);
  const { params, setParams } = useViewingsParams();
  const view: ViewKind = params.view ?? (phone ? "day" : "week");

  const agents = useQuery(api.agentsAdmin.list, canManage || view === "availability" ? {} : "skip");
  // A URL agent id is only sent once it is known to exist; agents are pinned
  // to their own viewings on the server whatever they send.
  const agentFilter = canManage ? agents?.find((agent) => agent._id === params.agent)?._id : undefined;
  const waitForAgents = canManage && params.agent !== undefined && agents === undefined;
  const showAgent = canManage && agentFilter === undefined;

  const today = todayKey(now);
  const viewedDate = wallOfDayKey(params.date) !== null ? params.date : undefined;
  const newDefaultDate = viewedDate !== undefined && viewedDate > today ? viewedDate : today;

  const openViewing = (id: string) => setParams({ id });

  return (
    <>
      <PageHeader
        title="Razgledanja"
        description={
          canManage
            ? "Kalendar razgledanja cele agencije, zahtevi sa sajta i radno vreme agenata."
            : "Vaša razgledanja, zahtevi sa sajta i Vaše radno vreme za zakazivanje."
        }
        actions={
          <Button onClick={() => setParams({ create: true })} data-testid="new-viewing">
            <Plus aria-hidden="true" />
            Novo razgledanje
          </Button>
        }
      />

      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <ToggleGroup
          type="single"
          variant="outline"
          spacing={0}
          value={view}
          aria-label="Prikaz"
          onValueChange={(value) => {
            const next = VIEW_OPTIONS.find((option) => option.value === value)?.value;
            if (next !== undefined) setParams({ view: next });
          }}
        >
          {VIEW_OPTIONS.map(({ value, label, icon: Icon }) => (
            <ToggleGroupItem
              key={value}
              value={value}
              data-testid={`viewings-view-${value}`}
              className="px-3 max-md:h-11"
            >
              <Icon aria-hidden="true" className="max-sm:hidden" />
              {label}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>

        {canManage && view !== "availability" ? (
          <FilterSelect
            label="Agent"
            value={agentFilter}
            onChange={(value) => setParams({ agent: value })}
            options={(agents ?? []).map((agent) => ({ value: agent._id, label: agent.name }))}
            allLabel="Svi agenti"
          />
        ) : null}
      </div>

      {waitForAgents ? (
        <Skeleton className="h-[32rem] w-full rounded-xl" />
      ) : view === "week" || view === "day" ? (
        <CalendarView
          view={view}
          dateKey={viewedDate}
          agentId={agentFilter}
          now={now}
          phone={phone}
          showAgent={showAgent}
          onDateChange={(date) => setParams({ date })}
          onOpen={openViewing}
        />
      ) : view === "list" ? (
        <ViewingsList
          when={params.when}
          status={params.status}
          agentId={agentFilter}
          now={listNow}
          phone={phone}
          showAgent={showAgent}
          onWhenChange={(when) => setParams({ when })}
          onStatusChange={(status) => setParams({ status })}
          onOpen={openViewing}
        />
      ) : (
        <AvailabilityEditor
          agents={agents}
          requestedAgent={params.agent}
          canManage={canManage}
          ownAgentId={me.agentId}
          now={now}
          onAgentChange={(agent) => setParams({ agent })}
        />
      )}

      <ViewingSheet id={params.id} now={now} onClose={() => setParams({ id: undefined })} />
      <NewViewingDialog
        open={params.create}
        onOpenChange={(open) => setParams(open ? { create: true } : { create: false, lead: undefined })}
        leadParam={params.lead}
        defaultDate={newDefaultDate}
        canManage={canManage}
        ownAgentId={me.agentId}
        agents={agents}
        onCreated={(id, date) =>
          setParams({ create: false, lead: undefined, id, date: date === today ? undefined : date })
        }
      />
    </>
  );
}

/** `/admin/razgledanja` — viewings calendar, list and agent availability (PRD B5). */
export function ViewingsScreen() {
  return (
    <RequireRole roles={LISTING_ROLES}>
      <QueryErrorBoundary backHref="/admin" backLabel="Kontrolna tabla">
        <ViewingsView />
      </QueryErrorBoundary>
    </RequireRole>
  );
}
