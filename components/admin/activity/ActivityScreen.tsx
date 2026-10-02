"use client";

import { usePaginatedQuery, useQuery } from "convex/react";
import { ChevronDown, History } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Fragment, useCallback, useId, useState } from "react";
import { activitySummary } from "@/components/admin/dashboard/activity-labels";
import { PHONE_QUERY } from "@/components/admin/common/breakpoints";
import { EmptyState, ListToolbar, LoadMore } from "@/components/admin/common/ListToolbar";
import { PageHeader } from "@/components/admin/common/PageHeader";
import { QueryErrorBoundary } from "@/components/admin/common/QueryErrorBoundary";
import { RequireRole } from "@/components/admin/common/RequireRole";
import { ADMIN_ROLES, hasRole, MANAGER_ROLES, useMe } from "@/components/admin/shell/me";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { belgradeMidnight, DAY_MS } from "@/convex/lib/belgradeTime";
import type { ActivityEntity } from "@/convex/lib/validators";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { formatDateTime, formatRelative, fromDateInput } from "@/lib/admin/format";
import { ACTIVITY_ENTITY_LABEL, ROLE_LABEL } from "@/lib/admin/labels";
import { cn } from "@/lib/utils";
import { DiffTable } from "./DiffTable";
import { actionLabel, targetHref, type ActivityRow } from "./labels";

const PAGE_SIZE = 30;
const ALL = "__all__";

function isEntity(value: string): value is ActivityEntity {
  return Object.hasOwn(ACTIVITY_ENTITY_LABEL, value);
}

type Filters = { entity?: ActivityEntity; user?: string; from: string; to: string };

/** Filters live in the URL (`?entity=lead&user=…&from=2026-09-01&to=2026-09-30`). */
function useActivityFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const rawEntity = params.get("entity") ?? "";
  const filters: Filters = {
    ...(isEntity(rawEntity) ? { entity: rawEntity } : {}),
    ...(params.get("user") !== null ? { user: params.get("user") ?? "" } : {}),
    from: params.get("from") ?? "",
    to: params.get("to") ?? "",
  };

  const set = useCallback(
    (next: Partial<Record<"entity" | "user" | "from" | "to", string | undefined>>) => {
      const query = new URLSearchParams(params.toString());
      for (const [key, value] of Object.entries(next)) {
        if (value === undefined || value === "") query.delete(key);
        else query.set(key, value);
      }
      const search = query.toString();
      router.replace(search.length > 0 ? `${pathname}?${search}` : pathname, { scroll: false });
    },
    [params, pathname, router],
  );

  const hasFilters = filters.entity !== undefined || filters.user !== undefined || filters.from !== "" || filters.to !== "";
  return { filters, set, hasFilters, clear: () => router.replace(pathname, { scroll: false }) };
}

/** `yyyy-mm-dd` (Belgrade) → that day's midnight; `endOfDay` gives the next midnight. */
function dayBound(value: string, endOfDay: boolean): number | undefined {
  const noon = fromDateInput(value);
  if (noon === undefined) return undefined;
  return belgradeMidnight(endOfDay ? noon + DAY_MS : noon);
}

function ActivityView() {
  const [clock] = useState(() => Date.now());
  const phone = useMediaQuery(PHONE_QUERY);
  const { filters, set, hasFilters, clear } = useActivityFilters();
  const staff = useQuery(api.activity.staff, {});
  // Account and invitation rows are admin-only (the server refuses the filter).
  const admin = hasRole(useMe(), ADMIN_ROLES);
  const entity = filters.entity === "user" && !admin ? undefined : filters.entity;
  const entityOptions = (Object.keys(ACTIVITY_ENTITY_LABEL) as ActivityEntity[]).filter(
    (option) => admin || option !== "user",
  );

  // A user id from the URL is sent only once it is a known staff member (a
  // stale or edited id would fail the argument validator).
  const userId: Id<"users"> | undefined =
    filters.user !== undefined ? staff?.find((user) => user._id === filters.user)?._id : undefined;
  const waitForStaff = filters.user !== undefined && staff === undefined;
  const from = dayBound(filters.from, false);
  const to = dayBound(filters.to, true);
  const badRange = from !== undefined && to !== undefined && from >= to;

  const args = waitForStaff
    ? ("skip" as const)
    : {
        ...(entity !== undefined ? { entity } : {}),
        ...(userId !== undefined ? { by: userId } : {}),
        ...(from !== undefined && !badRange ? { from } : {}),
        ...(to !== undefined && !badRange ? { to } : {}),
      };

  const { results, status, loadMore } = usePaginatedQuery(api.activity.list, args, { initialNumItems: PAGE_SIZE });

  return (
    <>
      <PageHeader
        title="Aktivnost"
        description="Ko je, kada i šta menjao u panelu. Izmene sa poljima se otvaraju u tabeli „pre / posle”."
      />
      <ActivityFilters
        filters={filters}
        entityOptions={entityOptions}
        staff={staff}
        badRange={badRange}
        hasFilters={hasFilters}
        onChange={set}
        onClear={clear}
      />
      {status === "LoadingFirstPage" ? (
        <Card className="gap-0 p-3" aria-busy="true">
          {Array.from({ length: 8 }, (_, index) => (
            <Skeleton key={index} className="my-1.5 h-10 w-full" />
          ))}
        </Card>
      ) : results.length === 0 ? (
        <EmptyState
          icon={<History />}
          title={hasFilters ? "Nijedna aktivnost ne odgovara filterima." : "Još nema zabeležene aktivnosti."}
          description={
            hasFilters
              ? status === "CanLoadMore"
                ? "Među do sada pregledanim zapisima nema poklapanja; učitajte još za starije unose."
                : "Promenite ili poništite filtere."
              : undefined
          }
          action={
            status === "CanLoadMore" ? (
              <Button variant="outline" onClick={() => loadMore(PAGE_SIZE)}>
                Učitaj još
              </Button>
            ) : hasFilters ? (
              <Button variant="outline" onClick={clear}>
                Poništi filtere
              </Button>
            ) : undefined
          }
        />
      ) : (
        <>
          <Card className="gap-0 overflow-hidden py-0">
            {phone ? <ActivityList rows={results} clock={clock} /> : <ActivityTable rows={results} clock={clock} />}
          </Card>
          <LoadMore status={status} onLoadMore={() => loadMore(PAGE_SIZE)} shown={results.length} />
        </>
      )}
    </>
  );
}

function ActivityFilters({
  filters,
  entityOptions,
  staff,
  badRange,
  hasFilters,
  onChange,
  onClear,
}: {
  filters: Filters;
  entityOptions: readonly ActivityEntity[];
  staff: readonly { _id: Id<"users">; name: string; role: keyof typeof ROLE_LABEL }[] | undefined;
  badRange: boolean;
  hasFilters: boolean;
  onChange: (next: Partial<Record<"entity" | "user" | "from" | "to", string | undefined>>) => void;
  onClear: () => void;
}) {
  const id = useId();
  return (
    <ListToolbar>
      <div className="flex flex-col gap-1">
        <span id={`${id}-entity`} className="text-xs text-muted-foreground">
          Vrsta zapisa
        </span>
        <Select
          value={filters.entity !== undefined && entityOptions.includes(filters.entity) ? filters.entity : ALL}
          onValueChange={(value) => onChange({ entity: value === ALL ? undefined : value })}
        >
          <SelectTrigger aria-labelledby={`${id}-entity`} className="w-full min-w-40 sm:w-auto" data-testid="activity-filter-entity">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Sve vrste</SelectItem>
            {entityOptions.map((entity) => (
              <SelectItem key={entity} value={entity}>
                {ACTIVITY_ENTITY_LABEL[entity]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex flex-col gap-1">
        <span id={`${id}-user`} className="text-xs text-muted-foreground">
          Korisnik
        </span>
        <Select
          value={filters.user ?? ALL}
          disabled={staff === undefined}
          onValueChange={(value) => onChange({ user: value === ALL ? undefined : value })}
        >
          <SelectTrigger aria-labelledby={`${id}-user`} className="w-full min-w-44 sm:w-auto" data-testid="activity-filter-user">
            <SelectValue placeholder="Učitavanje…" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Svi korisnici</SelectItem>
            {(staff ?? []).map((user) => (
              <SelectItem key={user._id} value={user._id}>
                {user.name} <span className="text-muted-foreground">· {ROLE_LABEL[user.role]}</span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor={`${id}-from`} className="text-xs text-muted-foreground">
          Od datuma
        </label>
        <Input
          id={`${id}-from`}
          type="date"
          value={filters.from}
          max={filters.to !== "" ? filters.to : undefined}
          onChange={(event) => onChange({ from: event.target.value })}
          className="w-full sm:w-40"
          aria-invalid={badRange || undefined}
          aria-describedby={badRange ? `${id}-range` : undefined}
          data-testid="activity-filter-from"
        />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor={`${id}-to`} className="text-xs text-muted-foreground">
          Do datuma
        </label>
        <Input
          id={`${id}-to`}
          type="date"
          value={filters.to}
          min={filters.from !== "" ? filters.from : undefined}
          onChange={(event) => onChange({ to: event.target.value })}
          className="w-full sm:w-40"
          aria-invalid={badRange || undefined}
          aria-describedby={badRange ? `${id}-range` : undefined}
          data-testid="activity-filter-to"
        />
      </div>
      {hasFilters ? (
        <Button variant="ghost" onClick={onClear}>
          Poništi filtere
        </Button>
      ) : null}
      {badRange ? (
        <p id={`${id}-range`} role="alert" className="w-full text-xs font-medium text-destructive">
          Početni datum je posle krajnjeg; filter po datumu nije primenjen.
        </p>
      ) : null}
    </ListToolbar>
  );
}

/* ------------------------------------------------------------- rows */

function EntityCell({ row }: { row: ActivityRow }) {
  const label = ACTIVITY_ENTITY_LABEL[row.entity];
  if (row.target === undefined) return <span className="text-muted-foreground">{label}</span>;
  return (
    <Link
      href={targetHref(row.target)}
      className="rounded-sm underline decoration-foreground/25 underline-offset-2 transition-colors duration-150 outline-none hover:decoration-primary focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      {label}
      <span className="sr-only"> — otvorite zapis</span>
    </Link>
  );
}

function When({ at, clock }: { at: number; clock: number }) {
  return (
    <time dateTime={new Date(at).toISOString()} className="block whitespace-nowrap tabular-nums">
      {formatDateTime(at)}
      <span className="block text-xs text-muted-foreground">{formatRelative(Math.min(at, clock), clock)}</span>
    </time>
  );
}

function DiffToggle({
  count,
  open,
  controls,
  onToggle,
}: {
  count: number;
  open: boolean;
  controls: string;
  onToggle: () => void;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      aria-expanded={open}
      aria-controls={controls}
      onClick={onToggle}
      className="whitespace-nowrap"
    >
      Izmene ({count})
      <ChevronDown className={cn("transition-transform duration-150", open && "rotate-180")} aria-hidden="true" />
    </Button>
  );
}

function useExpanded() {
  const [open, setOpen] = useState<ReadonlySet<string>>(() => new Set());
  const toggle = (id: string) =>
    setOpen((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  return { open, toggle };
}

function ActivityTable({ rows, clock }: { rows: readonly ActivityRow[]; clock: number }) {
  const { open, toggle } = useExpanded();
  return (
    <table className="w-full text-sm">
      <caption className="sr-only">Aktivnost u panelu, najnovije prvo</caption>
      <thead>
        <tr className="border-b bg-muted/40 text-left text-xs text-muted-foreground">
          <th scope="col" className="px-3 py-2 font-medium">
            Vreme
          </th>
          <th scope="col" className="px-3 py-2 font-medium">
            Korisnik
          </th>
          <th scope="col" className="px-3 py-2 font-medium">
            Zapis
          </th>
          <th scope="col" className="px-3 py-2 font-medium">
            Radnja
          </th>
          <th scope="col" className="px-3 py-2 font-medium">
            Opis
          </th>
          <th scope="col" className="px-3 py-2 text-right font-medium">
            <span className="sr-only">Izmene</span>
          </th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => {
          const expanded = open.has(row._id);
          const diffId = `diff-${row._id}`;
          const summary = activitySummary(row.action, row.summary);
          return (
            <Fragment key={row._id}>
              <tr
                data-testid="activity-row"
                data-entity={row.entity}
                className={cn("border-b align-top last:border-0", expanded && "border-b-0 bg-muted/30")}
              >
                <td className="w-40 px-3 py-2.5">
                  <When at={row.at} clock={clock} />
                </td>
                <td className="w-40 px-3 py-2.5 break-words">{row.byName ?? "sistem"}</td>
                <td className="w-32 px-3 py-2.5">
                  <EntityCell row={row} />
                </td>
                <td className="px-3 py-2.5 font-medium">
                  <span title={row.action}>{actionLabel(row.action)}</span>
                </td>
                <td className="px-3 py-2.5 break-words text-muted-foreground">{summary ?? "—"}</td>
                <td className="w-32 px-3 py-1.5 text-right">
                  {row.diff !== undefined && row.diff.length > 0 ? (
                    <DiffToggle count={row.diff.length} open={expanded} controls={diffId} onToggle={() => toggle(row._id)} />
                  ) : null}
                </td>
              </tr>
              {expanded && row.diff !== undefined ? (
                <tr className="border-b bg-muted/30 last:border-0">
                  <td colSpan={6} className="px-3 pt-0 pb-3">
                    <DiffTable diff={row.diff} id={diffId} />
                  </td>
                </tr>
              ) : null}
            </Fragment>
          );
        })}
      </tbody>
    </table>
  );
}

function ActivityList({ rows, clock }: { rows: readonly ActivityRow[]; clock: number }) {
  const { open, toggle } = useExpanded();
  return (
    <ul className="divide-y">
      {rows.map((row) => {
        const expanded = open.has(row._id);
        const diffId = `diff-${row._id}`;
        const summary = activitySummary(row.action, row.summary);
        return (
          <li key={row._id} data-testid="activity-row" data-entity={row.entity} className="flex flex-col gap-1.5 px-3 py-3">
            <p className="text-sm font-medium">{actionLabel(row.action)}</p>
            {summary !== undefined ? <p className="text-sm break-words text-muted-foreground">{summary}</p> : null}
            <p className="flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
              <EntityCell row={row} />
              <span aria-hidden="true">·</span>
              <span>{row.byName ?? "sistem"}</span>
              <span aria-hidden="true">·</span>
              <time dateTime={new Date(row.at).toISOString()} className="tabular-nums">
                {formatDateTime(row.at)} ({formatRelative(Math.min(row.at, clock), clock)})
              </time>
            </p>
            {row.diff !== undefined && row.diff.length > 0 ? (
              <div>
                <DiffToggle count={row.diff.length} open={expanded} controls={diffId} onToggle={() => toggle(row._id)} />
                {expanded ? (
                  <div className="mt-2">
                    <DiffTable diff={row.diff} id={diffId} />
                  </div>
                ) : null}
              </div>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}

/** `/admin/aktivnost` — the activity log (PRD B13). Managers and admins. */
export function ActivityScreen() {
  return (
    <RequireRole roles={MANAGER_ROLES}>
      <QueryErrorBoundary backHref="/admin" backLabel="Kontrolna tabla">
        <ActivityView />
      </QueryErrorBoundary>
    </RequireRole>
  );
}
