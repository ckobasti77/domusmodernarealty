"use client";

import { useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { CircleCheck, Mail, Phone } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/convex/_generated/api";
import type { L10nKey } from "@/convex/lib/validators";
import { formatDate, formatRelative } from "@/lib/admin/format";
import { L10N_SHORT, LEAD_TYPE_LABEL } from "@/lib/admin/labels";
import { DashCard } from "./DashCard";
import { formatCount, isoOf, pluralSr } from "./format";

type Todos = FunctionReturnType<typeof api.listingsAdmin.todos>;
type AwaitingLead = FunctionReturnType<typeof api.leadsAdmin.awaitingResponse>[number];

/** `listingsAdmin.todos` returns at most this many rows per problem. */
const SERVER_CAP = 20;
/** Recommended gallery size; the server flags published listings below it. */
const PHOTO_TARGET = 8;
const FIX_ROWS = 6;
const LEAD_ROWS = 8;

/**
 * The work queues (PRD B2). Agents get only their own leads and listings —
 * the server scopes both queries by role. Leads and expiring contracts share
 * a column (both are usually short); listing fixes get their own. Side by
 * side, both columns end on one line: the contracts card takes up the slack.
 */
export function TodoLists({ now, clock, showAgent }: { now: number; clock: number; showAgent: boolean }) {
  const leads = useQuery(api.leadsAdmin.awaitingResponse, { now });
  const todos = useQuery(api.listingsAdmin.todos, { now });

  return (
    <section aria-labelledby="todo-heading" data-testid="todo-lists">
      <h2 id="todo-heading" className="sr-only">
        Zadaci
      </h2>
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="grid min-w-0 grid-rows-[auto_1fr] gap-4">
          <LeadsCard leads={leads} clock={clock} showAgent={showAgent} />
          <MandatesCard rows={todos?.mandateExpiring} clock={clock} />
        </div>
        <ListingFixesCard todos={todos} />
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ leads */

/** `+381 64 123 4567` → `tel:+381641234567`. */
function telHref(phone: string): string {
  return `tel:${phone.replace(/[^\d+]/g, "")}`;
}

/**
 * Compact text links whose hit area reaches past the text: 32px tall on a
 * desktop, 44px on phones and touch screens.
 */
const CONTACT_LINK =
  "-mx-2 inline-flex min-h-8 items-center gap-1.5 rounded-md px-2 text-xs font-medium text-primary underline decoration-primary/30 underline-offset-2 transition-colors duration-150 outline-none hover:decoration-primary focus-visible:ring-3 focus-visible:ring-ring/50 max-sm:min-h-11 pointer-coarse:min-h-11";

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
      action={
        leads !== undefined && leads.length > 0 ? (
          <CountPill count={leads.length} capped={leads.length >= SERVER_CAP} />
        ) : undefined
      }
    >
      {leads === undefined ? (
        <RowsSkeleton rows={3} />
      ) : leads.length === 0 ? (
        <AllClear>Svi upiti imaju odgovor.</AllClear>
      ) : (
        <>
          <ul className="divide-y">
            {leads.slice(0, LEAD_ROWS).map((lead) => (
              <li key={lead._id} className="flex items-start justify-between gap-3 py-2 first:pt-0 last:pb-0">
                <div className="min-w-0">
                  <Link
                    href={`/admin/upiti?id=${lead._id}`}
                    className="block truncate text-sm font-medium underline-offset-4 hover:underline"
                  >
                    {lead.contactName}
                  </Link>
                  <p className="truncate text-xs text-muted-foreground">
                    {LEAD_TYPE_LABEL[lead.type]}
                    {lead.listingRef !== undefined ? (
                      <>
                        <span aria-hidden="true">{" · "}</span>
                        <span className="font-mono whitespace-nowrap">{lead.listingRef}</span>
                      </>
                    ) : null}
                    {showAgent && lead.agentName !== undefined ? (
                      <>
                        <span aria-hidden="true">{" · "}</span>
                        {lead.agentName}
                      </>
                    ) : null}
                  </p>
                  {lead.contactEmail !== undefined || lead.contactPhone !== undefined ? (
                    <p className="flex flex-wrap gap-x-4">
                      {lead.contactEmail !== undefined ? (
                        <a href={`mailto:${lead.contactEmail}`} className={CONTACT_LINK}>
                          <Mail className="size-3.5 shrink-0" aria-hidden="true" />
                          <span>
                            E-pošta<span className="sr-only">: {lead.contactName}</span>
                          </span>
                        </a>
                      ) : null}
                      {lead.contactPhone !== undefined ? (
                        <a href={telHref(lead.contactPhone)} className={CONTACT_LINK}>
                          <Phone className="size-3.5 shrink-0" aria-hidden="true" />
                          <span>
                            Pozovi<span className="sr-only"> {lead.contactName}</span>
                          </span>
                        </a>
                      ) : null}
                    </p>
                  ) : null}
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
          <MoreRows hidden={leads.length - LEAD_ROWS} />
        </>
      )}
    </DashCard>
  );
}

/* ----------------------------------------------------------- listing fixes */

function isL10nKey(value: string): value is L10nKey {
  return Object.hasOwn(L10N_SHORT, value);
}

function localeShort(locale: string): string {
  return isL10nKey(locale) ? L10N_SHORT[locale] : locale.toUpperCase();
}

type TodoRow = { id: string; ref: string; title: string };

type Fix = TodoRow & {
  noFloorPlan: boolean;
  /** Photo count when below the recommendation. */
  photos: number | null;
  /** Locales missing a title or description. */
  locales: string[];
};

function problemCount(fix: Fix): number {
  return Number(fix.noFloorPlan) + Number(fix.photos !== null) + Number(fix.locales.length > 0);
}

/**
 * The server lists each problem separately; one listing can be in all three.
 * Merge them into one row per listing, most problems first (the server's
 * "recently updated first" order breaks ties).
 */
function mergeFixes(todos: Todos): { fixes: Fix[]; capped: boolean } {
  const byId = new Map<string, Fix>();
  const entry = ({ id, ref, title }: TodoRow): Fix => {
    const existing = byId.get(id);
    if (existing !== undefined) return existing;
    const created: Fix = { id, ref, title, noFloorPlan: false, photos: null, locales: [] };
    byId.set(id, created);
    return created;
  };
  for (const row of todos.missingFloorPlan) entry(row).noFloorPlan = true;
  for (const row of todos.missingPhotos) entry(row).photos = row.count;
  for (const row of todos.missingTranslations) entry(row).locales = row.locales;
  const fixes = [...byId.values()].sort((a, b) => problemCount(b) - problemCount(a));
  const capped =
    todos.missingFloorPlan.length >= SERVER_CAP ||
    todos.missingPhotos.length >= SERVER_CAP ||
    todos.missingTranslations.length >= SERVER_CAP;
  return { fixes, capped };
}

function ListingFixesCard({ todos }: { todos: Todos | undefined }) {
  const merged = todos === undefined ? undefined : mergeFixes(todos);
  return (
    <DashCard
      title="Nekretnine za doradu"
      description={`Objavljeni oglasi bez osnove, sa manje fotografija od preporučenih ${PHOTO_TARGET}+ ili bez prevoda`}
      action={
        merged !== undefined && merged.fixes.length > 0 ? (
          <CountPill count={merged.fixes.length} capped={merged.capped} />
        ) : undefined
      }
    >
      {merged === undefined ? (
        <RowsSkeleton rows={5} />
      ) : merged.fixes.length === 0 ? (
        <AllClear>Sve je sređeno.</AllClear>
      ) : (
        <>
          <ul className="divide-y">
            {merged.fixes.slice(0, FIX_ROWS).map((fix) => (
              <li key={fix.id}>
                <FixRow fix={fix} />
              </li>
            ))}
          </ul>
          <MoreRows hidden={merged.fixes.length - FIX_ROWS} />
        </>
      )}
    </DashCard>
  );
}

/** A to-do row's listing: its Serbian title (truncated), then its ref in mono. */
function ListingName({ row }: { row: TodoRow }) {
  return (
    <span className="flex min-w-0 items-baseline gap-2">
      <span className="truncate text-sm font-medium">{row.title.length > 0 ? row.title : "Bez naslova"}</span>
      <span className="shrink-0 font-mono text-xs text-muted-foreground">{row.ref}</span>
    </span>
  );
}

function FixRow({ fix }: { fix: Fix }) {
  return (
    <Link
      href={`/admin/nekretnine/${fix.id}`}
      className="-mx-2 flex flex-col gap-1 rounded-md px-2 py-2 transition-colors duration-150 outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 sm:flex-row sm:items-center sm:justify-between sm:gap-3"
    >
      <ListingName row={fix} />
      <span className="flex flex-wrap gap-1 sm:shrink-0 sm:justify-end">
        {fix.noFloorPlan ? <FixTag>Bez osnove</FixTag> : null}
        {fix.photos !== null ? (
          <FixTag
            label={`${fix.photos} ${pluralSr(fix.photos, "fotografija", "fotografija", "fotografije")}, preporuka ${PHOTO_TARGET}+`}
          >
            {fix.photos}/{PHOTO_TARGET} foto
          </FixTag>
        ) : null}
        {fix.locales.length > 0 ? (
          <FixTag label={`Nedostaju prevodi: ${fix.locales.map(localeShort).join(", ")}`}>
            {fix.locales.map(localeShort).join(" ")}
          </FixTag>
        ) : null}
      </span>
    </Link>
  );
}

/** A small hairline tag; `label` replaces the terse visible text for assistive tech. */
function FixTag({ children, label }: { children: ReactNode; label?: string }) {
  return (
    <span
      className="inline-flex h-5 items-center rounded-sm border px-1.5 text-[11px] whitespace-nowrap text-muted-foreground tabular-nums"
      title={label}
    >
      {label !== undefined ? (
        <>
          <span aria-hidden="true">{children}</span>
          <span className="sr-only">{label}</span>
        </>
      ) : (
        children
      )}
    </span>
  );
}

/* --------------------------------------------------------------- mandates */

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
      action={
        sorted !== undefined && sorted.length > 0 ? (
          <CountPill count={sorted.length} capped={sorted.length >= SERVER_CAP} />
        ) : undefined
      }
    >
      {sorted === undefined ? (
        <RowsSkeleton rows={2} />
      ) : sorted.length === 0 ? (
        <AllClear>Nijedan ugovor ne ističe uskoro.</AllClear>
      ) : (
        <ul className="divide-y">
          {sorted.map((row) => (
            <li key={row.id}>
              <Link
                href={`/admin/nekretnine/${row.id}`}
                className="-mx-2 flex flex-col gap-0.5 rounded-md px-2 py-2 transition-colors duration-150 outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 sm:flex-row sm:items-baseline sm:justify-between sm:gap-3"
              >
                <ListingName row={row} />
                <time
                  dateTime={isoOf(row.end)}
                  className="text-xs whitespace-nowrap text-muted-foreground sm:shrink-0"
                  data-numeric
                >
                  {formatDate(row.end)} · {formatRelative(row.end, clock)}
                </time>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </DashCard>
  );
}

/* ----------------------------------------------------------------- shared */

function CountPill({ count, capped }: { count: number; capped: boolean }) {
  return (
    <span
      className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary/10 px-1.5 text-xs font-medium text-foreground"
      data-numeric
    >
      {formatCount(count)}
      {capped ? "+" : ""}
    </span>
  );
}

/** Rows past the list's length. A capped total already reads `27+` in the card's pill. */
function MoreRows({ hidden }: { hidden: number }) {
  if (hidden <= 0) return null;
  return (
    <p className="mt-2 text-xs text-muted-foreground" data-numeric>
      +{formatCount(hidden)} još
    </p>
  );
}

function AllClear({ children }: { children: ReactNode }) {
  return (
    <p className="flex items-center gap-2 py-1 text-sm text-muted-foreground">
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
