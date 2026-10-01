"use client";

import { useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { ArrowUpRight } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { DashCard } from "@/components/admin/dashboard/DashCard";
import { formatCount, pluralSr } from "@/components/admin/dashboard/format";
import { StatusBadge } from "@/components/admin/common/StatusBadge";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { formatRelative } from "@/lib/admin/format";
import { CappedNote, formatShare, tableClass, useTableToggle } from "./shared";
import { ListingPicker } from "./ListingPicker";

type Funnel = NonNullable<FunctionReturnType<typeof api.analytics.listingFunnel>>;

type Stage = {
  key: string;
  label: string;
  value: number;
  /** The step this one converts from, for the percentage. */
  base?: { value: number; label: string };
};

function stagesOf(funnel: Funnel): Stage[] {
  return [
    { key: "views", label: "Pregledi oglasa", value: funnel.views },
    {
      key: "favorites",
      label: "Sačuvano u omiljene",
      value: funnel.favorites,
      base: { value: funnel.views, label: "od pregleda" },
    },
    { key: "leads", label: "Upiti", value: funnel.leads, base: { value: funnel.views, label: "od pregleda" } },
    {
      key: "viewings",
      label: "Razgledanja",
      value: funnel.viewings,
      base: { value: funnel.leads, label: "od upita" },
    },
  ];
}

/**
 * One listing's funnel: views → favorites → leads → viewings, all time.
 * The listing comes from the URL (`?listing=`) or defaults to the most viewed.
 */
export function FunnelCard({
  listingParam,
  onPick,
}: {
  listingParam: string | undefined;
  onPick: (id: Id<"listings">) => void;
}) {
  // Same arguments as the top-listings card, so Convex serves both from one subscription.
  const top = useQuery(api.analytics.topListings, { limit: 10 });
  const listingId = listingParam ?? top?.[0]?.listingId;
  const funnel = useQuery(api.analytics.listingFunnel, listingId !== undefined ? { listingId } : "skip");
  const [clock] = useState(() => Date.now());
  const table = useTableToggle();

  const loading = listingId === undefined ? top === undefined : funnel === undefined;

  return (
    <DashCard
      title="Put do upita"
      description="Pregledi, sačuvani oglasi, upiti i razgledanja jedne nekretnine, od objave do danas"
      action={funnel !== undefined && funnel !== null ? table.toggle : undefined}
      data-testid="analytics-funnel"
    >
      <div className="mb-4">
        <ListingPicker
          current={funnel !== undefined && funnel !== null ? funnel.listing : undefined}
          onPick={onPick}
        />
      </div>
      {loading ? (
        <div aria-busy="true" className="space-y-3">
          {Array.from({ length: 4 }, (_, index) => (
            <Skeleton key={index} className="h-9 w-full" />
          ))}
        </div>
      ) : listingId === undefined ? (
        <p className="text-sm text-muted-foreground">Izaberite nekretninu da vidite njen put do upita.</p>
      ) : funnel === null || funnel === undefined ? (
        <p className="text-sm text-muted-foreground">Nekretnina iz linka ne postoji. Izaberite drugu.</p>
      ) : (
        <FunnelBody funnel={funnel} clock={clock} showTable={table.shown} />
      )}
    </DashCard>
  );
}

function FunnelBody({ funnel, clock, showTable }: { funnel: Funnel; clock: number; showTable: boolean }) {
  const stages = stagesOf(funnel);
  const max = Math.max(1, ...stages.map((stage) => stage.value));
  const summary = `${funnel.listing.ref}: ${formatCount(funnel.views)} ${pluralSr(funnel.views, "pregled", "pregleda")}, ${formatCount(funnel.favorites)} u omiljenima, ${formatCount(funnel.leads)} ${pluralSr(funnel.leads, "upit", "upita")} (${formatShare(funnel.leads, funnel.views)} pregleda), ${formatCount(funnel.viewings)} ${pluralSr(funnel.viewings, "razgledanje", "razgledanja")} (${formatShare(funnel.viewings, funnel.leads)} upita).`;

  return (
    <>
      <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
        <StatusBadge status={funnel.listing.status} />
        {funnel.lastViewedAt !== undefined ? (
          <span>Poslednji pregled {formatRelative(Math.min(funnel.lastViewedAt, clock), clock)}</span>
        ) : null}
        <Link
          href={`/admin/nekretnine/${funnel.listing._id}`}
          className="ml-auto inline-flex items-center gap-1 rounded-sm text-foreground underline decoration-foreground/25 underline-offset-2 transition-colors duration-150 outline-none hover:decoration-primary focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          Otvorite nekretninu
          <ArrowUpRight className="size-3.5" aria-hidden="true" />
        </Link>
      </div>

      <figure>
        <ol aria-hidden="true" className="flex flex-col gap-3">
          {stages.map((stage) => (
            <li key={stage.key} className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-x-3 gap-y-1">
              <span className="text-sm">{stage.label}</span>
              <span className="text-right text-sm">
                <span className="font-medium tabular-nums">{formatCount(stage.value)}</span>
                {stage.base !== undefined ? (
                  <span className="ml-2 text-xs text-muted-foreground tabular-nums">
                    {formatShare(stage.value, stage.base.value)} {stage.base.label}
                  </span>
                ) : null}
              </span>
              <span className="col-span-2 block h-2.5 rounded-full bg-muted">
                <span
                  className="block h-full rounded-full bg-chart-2 dark:bg-chart-1"
                  style={{ width: stage.value > 0 ? `max(${(stage.value / max) * 100}%, 4px)` : 0 }}
                />
              </span>
            </li>
          ))}
        </ol>
        <figcaption className="mt-4 text-xs text-muted-foreground">
          Od toga održano razgledanja: <span className="tabular-nums">{formatCount(funnel.viewingsDone)}</span> ·
          dobijenih upita: <span className="tabular-nums">{formatCount(funnel.leadsWon)}</span>. Pregledi i omiljeni
          se broje samo na javnom sajtu (jednom po poseti); upiti i razgledanja uključuju i one koje je tim uneo.
          <span className="sr-only"> {summary}</span>
        </figcaption>
      </figure>

      <div className={showTable ? undefined : "sr-only"}>
      <table className={tableClass(showTable)}>
        <caption className="sr-only">Put do upita za {funnel.listing.ref}</caption>
        <thead>
          <tr className="border-b text-left text-xs text-muted-foreground">
            <th scope="col" className="py-1.5 font-medium">
              Korak
            </th>
            <th scope="col" className="py-1.5 text-right font-medium">
              Broj
            </th>
            <th scope="col" className="py-1.5 text-right font-medium">
              Konverzija
            </th>
          </tr>
        </thead>
        <tbody>
          {stages.map((stage) => (
            <tr key={stage.key} className="border-b last:border-0">
              <th scope="row" className="py-1.5 text-left font-normal">
                {stage.label}
              </th>
              <td className="py-1.5 text-right tabular-nums">{formatCount(stage.value)}</td>
              <td className="py-1.5 text-right tabular-nums">
                {stage.base !== undefined ? `${formatShare(stage.value, stage.base.value)} ${stage.base.label}` : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>

      {funnel.capped ? (
        <CappedNote>Nekretnina ima više od 500 upita ili razgledanja; prikazani broj je donja granica.</CappedNote>
      ) : null}
    </>
  );
}
