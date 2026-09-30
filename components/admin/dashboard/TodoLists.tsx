"use client";

import { useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { CircleCheck } from "lucide-react";
import Link from "next/link";
import { useId, type ReactNode } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/convex/_generated/api";
import type { L10nKey } from "@/convex/lib/validators";
import { formatDate, formatRelative } from "@/lib/admin/format";
import { L10N_SHORT } from "@/lib/admin/labels";
import { DashCard } from "./DashCard";
import { formatCount, isoOf, LEAD_TYPE_LABEL } from "./format";

type Todos = FunctionReturnType<typeof api.listingsAdmin.todos>;
type AwaitingLead = FunctionReturnType<typeof api.leadsAdmin.awaitingResponse>[number];

/** `listingsAdmin.todos` returns at most this many rows per problem. */
const SERVER_CAP = 20;
const GROUP_ROWS = 6;
const LEAD_ROWS = 8;

/**
 * The three work queues (PRD B2). Agents get only their own leads and
 * listings — the server scopes both queries by role.
 */
export function TodoLists({ now, clock, showAgent }: { now: number; clock: number; showAgent: boolean }) {
  const leads = useQuery(api.leadsAdmin.awaitingResponse, { now });
  const todos = useQuery(api.listingsAdmin.todos, { now });

  return (
    <section aria-labelledby="todo-heading" data-testid="todo-lists">
      <h2 id="todo-heading" className="sr-only">
        Zadaci
      </h2>
      <div className="grid gap-4 lg:grid-cols-3">
        <LeadsCard leads={leads} clock={clock} showAgent={showAgent} />
        <ListingFixesCard todos={todos} />
        <MandatesCard rows={todos?.mandateExpiring} clock={clock} />
      </div>
    </section>
  );
}

function LeadsCard({
  leads,
  clock,
  showAgent,
}: {
  leads: AwaitingLead[] | undefined;
  clock: number;
  showAgent: boolean;
}) {
  return (
    <DashCard
      title="Upiti bez odgovora duže od 1 h"
      description="Novi upiti na koje još niko nije odgovorio"
      action={leads !== undefined && leads.length > 0 ? <CountPill count={leads.length} capped={leads.length >= SERVER_CAP} /> : undefined}
    >
      {leads === undefined ? (
        <RowsSkeleton rows={4} />
      ) : leads.length === 0 ? (
        <AllClear>Svi upiti imaju odgovor.</AllClear>
      ) : (
        <>
          <ul className="divide-y">
            {leads.slice(0, LEAD_ROWS).map((lead) => (
              <li key={lead._id} className="flex items-start justify-between gap-3 py-2 first:pt-0">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{lead.contactName}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {LEAD_TYPE_LABEL[lead.type]}
                    {lead.listingRef !== undefined ? (
                      <>
                        {" · "}
                        <span data-numeric>{lead.listingRef}</span>
                      </>
                    ) : null}
                    {showAgent && lead.agentName !== undefined ? ` · ${lead.agentName}` : null}
                  </p>
                </div>
                <time
                  dateTime={isoOf(lead.createdAt)}
                  className="shrink-0 pt-0.5 text-xs whitespace-nowrap text-muted-foreground"
                  data-numeric
                >
                  {formatRelative(lead.createdAt, clock)}
                </time>
              </li>
            ))}
          </ul>
          <MoreRows total={leads.length} shown={LEAD_ROWS} capped={leads.length >= SERVER_CAP} />
        </>
      )}
    </DashCard>
  );
}

function ListingFixesCard({ todos }: { todos: Todos | undefined }) {
  const total =
    todos === undefined
      ? 0
      : todos.missingFloorPlan.length + todos.missingPhotos.length + todos.missingTranslations.length;
  return (
    <DashCard
      title="Nekretnine za doradu"
      description="Objavljeni oglasi kojima nešto nedostaje"
    >
      {todos === undefined ? (
        <RowsSkeleton rows={5} />
      ) : total === 0 ? (
        <AllClear>Sve je sređeno.</AllClear>
      ) : (
        <div className="space-y-4">
          <FixGroup
            title="Bez osnove stana"
            rows={todos.missingFloorPlan.map((row) => ({ id: row.id, ref: row.ref, detail: null }))}
          />
          <FixGroup
            title="Manje od 8 fotografija"
            rows={todos.missingPhotos.map((row) => ({
              id: row.id,
              ref: row.ref,
              detail: (
                <span data-numeric>
                  {row.count} od 8
                </span>
              ),
            }))}
          />
          <FixGroup
            title="Nedostaju prevodi"
            rows={todos.missingTranslations.map((row) => ({
              id: row.id,
              ref: row.ref,
              detail: row.locales.map(localeShort).join(", "),
            }))}
          />
        </div>
      )}
    </DashCard>
  );
}

function isL10nKey(value: string): value is L10nKey {
  return Object.hasOwn(L10N_SHORT, value);
}

function localeShort(locale: string): string {
  return isL10nKey(locale) ? L10N_SHORT[locale] : locale.toUpperCase();
}

type FixRow = { id: string; ref: string; detail: ReactNode };

function FixGroup({ title, rows }: { title: string; rows: FixRow[] }) {
  const headingId = useId();
  if (rows.length === 0) return null;
  return (
    <section aria-labelledby={headingId}>
      <h3 id={headingId} className="mb-1 flex items-baseline justify-between text-xs font-medium text-muted-foreground">
        <span>{title}</span>
        <span data-numeric>
          {formatCount(rows.length)}
          {rows.length >= SERVER_CAP ? "+" : ""}
        </span>
      </h3>
      <ul className="divide-y">
        {rows.slice(0, GROUP_ROWS).map((row) => (
          <li key={row.id}>
            <ListingLink id={row.id} listingRef={row.ref} detail={row.detail} />
          </li>
        ))}
      </ul>
      <MoreRows total={rows.length} shown={GROUP_ROWS} capped={rows.length >= SERVER_CAP} />
    </section>
  );
}

function MandatesCard({
  rows,
  clock,
}: {
  rows: Todos["mandateExpiring"] | undefined;
  clock: number;
}) {
  const sorted = rows === undefined ? undefined : [...rows].sort((a, b) => a.end - b.end);
  return (
    <DashCard
      title="Ugovori ističu u 14 dana"
      description="Ugovori o posredovanju za objavljene oglase"
      action={sorted !== undefined && sorted.length > 0 ? <CountPill count={sorted.length} capped={sorted.length >= SERVER_CAP} /> : undefined}
    >
      {sorted === undefined ? (
        <RowsSkeleton rows={3} />
      ) : sorted.length === 0 ? (
        <AllClear>Nijedan ugovor ne ističe uskoro.</AllClear>
      ) : (
        <ul className="divide-y">
          {sorted.map((row) => (
            <li key={row.id}>
              <ListingLink
                id={row.id}
                listingRef={row.ref}
                detail={
                  <time dateTime={isoOf(row.end)} data-numeric>
                    {formatDate(row.end)} · {formatRelative(row.end, clock)}
                  </time>
                }
              />
            </li>
          ))}
        </ul>
      )}
    </DashCard>
  );
}

function ListingLink({ id, listingRef, detail }: { id: string; listingRef: string; detail: ReactNode }) {
  return (
    <Link
      href={`/admin/nekretnine/${id}`}
      className="-mx-2 flex items-baseline justify-between gap-3 rounded-md px-2 py-1.5 text-sm transition-colors duration-150 outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      <span className="font-medium" data-numeric>
        {listingRef}
      </span>
      {detail !== null ? <span className="truncate text-xs text-muted-foreground">{detail}</span> : null}
    </Link>
  );
}

function CountPill({ count, capped }: { count: number; capped: boolean }) {
  return (
    <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary/10 px-1.5 text-xs font-medium text-foreground" data-numeric>
      {formatCount(count)}
      {capped ? "+" : ""}
    </span>
  );
}

function MoreRows({ total, shown, capped }: { total: number; shown: number; capped: boolean }) {
  if (total <= shown) return null;
  return (
    <p className="mt-1 text-xs text-muted-foreground" data-numeric>
      +{formatCount(total - shown)} još{capped ? " (i više)" : ""}
    </p>
  );
}

function AllClear({ children }: { children: ReactNode }) {
  return (
    <p className="flex items-center gap-2 py-2 text-sm text-muted-foreground">
      <CircleCheck className="size-4 shrink-0 text-primary" aria-hidden="true" />
      {children}
    </p>
  );
}

function RowsSkeleton({ rows }: { rows: number }) {
  return (
    <div aria-busy="true" className="space-y-2">
      {Array.from({ length: rows }, (_, index) => (
        <Skeleton key={index} className="h-9 w-full" />
      ))}
    </div>
  );
}
