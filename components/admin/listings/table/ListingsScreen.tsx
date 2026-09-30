"use client";

import { usePaginatedQuery, useQuery } from "convex/react";
import { Loader2, Plus } from "lucide-react";
import Link from "next/link";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { PageHeader } from "@/components/admin/common/PageHeader";
import { QueryErrorBoundary } from "@/components/admin/common/QueryErrorBoundary";
import { RequireRole } from "@/components/admin/common/RequireRole";
import { hasRole, LISTING_ROLES, MANAGER_ROLES, useMe } from "@/components/admin/shell/me";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { api } from "@/convex/_generated/api";
import type { ListingStatus } from "@/convex/lib/validators";
import { STATUS_LABEL } from "@/lib/admin/labels";
import { formatCount } from "@/lib/format";
import { useListingFilters } from "./filters";
import { ListingsFilters } from "./ListingsFilters";
import { ListingsTable } from "./ListingsTable";
import { StatusTabs } from "./StatusTabs";
import { PAGE_SIZE } from "./types";

const NEW_LISTING_HREF = "/admin/nekretnine/nova";

/**
 * Filters that the server applies after reading a page (transaction, demo,
 * status while searching) can return short pages. Top the first screen up to
 * PAGE_SIZE rows, but give up after this many extra pages so a filter that
 * matches nothing does not walk the whole table.
 */
const MAX_AUTO_LOADS = 8;
/** Relative "updated" times refresh once a minute. */
const NOW_TICK_MS = 60_000;

function useNow(tickMs: number): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), tickMs);
    return () => window.clearInterval(timer);
  }, [tickMs]);
  return now;
}

/**
 * While a new filter's first page loads, keep showing the previous result
 * instead of flashing an empty table. `usePaginatedQuery` memoizes `results`,
 * so the reference only changes when the data does.
 */
function useHeldWhileLoading<T>(value: T, loading: boolean): T {
  const [held, setHeld] = useState(value);
  if (!loading && held !== value) setHeld(value);
  return loading ? held : value;
}

function emptyCopy({
  partial,
  hasFilters,
  status,
}: {
  partial: boolean;
  hasFilters: boolean;
  status: ListingStatus | undefined;
}): { title: string; hint: string } {
  if (partial) {
    return {
      title: "Među do sada učitanim nekretninama nema poklapanja.",
      hint: "Učitajte još da pretraga nastavi kroz starije unose.",
    };
  }
  if (hasFilters) {
    return {
      title: "Nijedna nekretnina ne odgovara filterima.",
      hint: "Promenite ili poništite filtere.",
    };
  }
  if (status !== undefined) {
    return {
      title: `Nema nekretnina sa statusom „${STATUS_LABEL[status]}”.`,
      hint: "Izaberite drugi status ili dodajte novu nekretninu.",
    };
  }
  return {
    title: "Još nema nekretnina.",
    hint: "Kreirajte nacrt, dopunite ga i objavite kada prođe kontrolnu listu.",
  };
}

function NewListingButton({ testId }: { testId?: string }) {
  return (
    <Button asChild>
      <Link href={NEW_LISTING_HREF} data-testid={testId}>
        <Plus aria-hidden="true" />
        Nova nekretnina
      </Link>
    </Button>
  );
}

function ListingsView() {
  const me = useMe();
  const canManage = hasRole(me, MANAGER_ROLES);
  const now = useNow(NOW_TICK_MS);
  const { filters, hrefWith, setFilters, clearFilters, hasFilters } = useListingFilters();

  const counts = useQuery(api.listingsAdmin.counts, {});
  // Agents are pinned to their own listings server-side; only managers filter
  // by agent or assign in bulk.
  const agents = useQuery(api.agentsAdmin.list, canManage ? {} : "skip");

  const requestedAgent = canManage ? filters.agent : undefined;
  const agentId =
    requestedAgent === undefined
      ? undefined
      : agents?.find((agent) => agent._id === requestedAgent)?._id;
  // A URL agent id is only sent once it is known to exist (a stale or edited
  // id would fail the argument validator).
  const waitForAgents = requestedAgent !== undefined && agents === undefined;
  const q = filters.q.trim();

  const args = waitForAgents
    ? ("skip" as const)
    : {
        ...(filters.status !== undefined ? { status: filters.status } : {}),
        ...(q.length > 0 ? { q } : {}),
        ...(agentId !== undefined ? { agentId } : {}),
        ...(filters.type !== undefined ? { propertyType: filters.type } : {}),
        ...(filters.tx !== undefined ? { transaction: filters.tx } : {}),
        ...(filters.demo ? { onlyDemo: true } : {}),
      };
  const argsKey = JSON.stringify(args);

  const { results, status, loadMore } = usePaginatedQuery(api.listingsAdmin.list, args, {
    initialNumItems: PAGE_SIZE,
  });

  // A layout effect, so a short page is topped up before the browser paints
  // the momentary "no results" state.
  const autoLoads = useRef({ key: "", count: 0 });
  useLayoutEffect(() => {
    if (status !== "CanLoadMore" || results.length >= PAGE_SIZE) return;
    if (autoLoads.current.key !== argsKey) autoLoads.current = { key: argsKey, count: 0 };
    if (autoLoads.current.count >= MAX_AUTO_LOADS) return;
    autoLoads.current.count += 1;
    loadMore(PAGE_SIZE);
  }, [status, results.length, argsKey, loadMore]);

  const waiting =
    status === "LoadingFirstPage" || (status === "LoadingMore" && results.length === 0);
  const rows = useHeldWhileLoading(results, waiting);
  const loading = waiting && rows.length === 0;
  const refreshing = waiting && rows.length > 0;
  const canLoadMore = status === "CanLoadMore" || status === "LoadingMore";

  const copy = emptyCopy({ partial: status === "CanLoadMore", hasFilters, status: filters.status });
  const empty = (
    <div className="mx-auto flex max-w-sm flex-col items-center gap-3 py-6">
      <p className="font-medium text-foreground">{copy.title}</p>
      <p className="text-sm text-muted-foreground">{copy.hint}</p>
      <div className="flex flex-wrap justify-center gap-2">
        {hasFilters ? (
          <Button variant="outline" onClick={clearFilters}>
            Poništi filtere
          </Button>
        ) : null}
        <NewListingButton />
      </div>
    </div>
  );

  return (
    <>
      <PageHeader
        title="Nekretnine"
        description={
          canManage
            ? "Sve nekretnine agencije: nacrti, oglasi na sajtu i arhiva."
            : "Vaše nekretnine: nacrti, oglasi na sajtu i arhiva."
        }
        actions={<NewListingButton testId="new-listing" />}
      />
      <StatusTabs
        current={filters.status}
        counts={counts}
        hrefFor={(next) => hrefWith({ status: next })}
      />
      <Card className="gap-0 py-0">
        <ListingsFilters
          filters={filters}
          agentId={agentId}
          agents={agents}
          showAgentFilter={canManage}
          hasFilters={hasFilters}
          onChange={setFilters}
          onClear={clearFilters}
        />
        <ListingsTable
          rows={rows}
          loading={loading}
          refreshing={refreshing}
          now={now}
          canManage={canManage}
          agents={agents}
          selectionKey={argsKey}
          empty={empty}
        />
        {!loading && (rows.length > 0 || canLoadMore) ? (
          <div className="flex flex-wrap items-center justify-between gap-2 border-t px-3 py-2 text-sm text-muted-foreground">
            <p className="tabular-nums" aria-live="polite">
              Prikazano: {formatCount(rows.length, "sr-Latn")}
              {status === "Exhausted" ? "" : " (ima još)"}
            </p>
            {canLoadMore ? (
              <Button
                variant="outline"
                size="sm"
                disabled={status === "LoadingMore"}
                onClick={() => loadMore(PAGE_SIZE)}
              >
                {status === "LoadingMore" ? <Loader2 className="animate-spin" aria-hidden="true" /> : null}
                {status === "LoadingMore" ? "Učitavanje…" : "Učitaj još"}
              </Button>
            ) : null}
          </div>
        ) : null}
      </Card>
    </>
  );
}

/** `/admin/nekretnine` — the listings table (PRD B3). */
export function ListingsScreen() {
  return (
    <RequireRole roles={LISTING_ROLES}>
      <QueryErrorBoundary backHref="/admin" backLabel="Kontrolna tabla">
        <ListingsView />
      </QueryErrorBoundary>
    </RequireRole>
  );
}
