"use client";

import { useQuery } from "convex/react";
import { CircleCheck, Loader2, TriangleAlert } from "lucide-react";
import { PageHeader } from "@/components/admin/common/PageHeader";
import { QueryErrorBoundary } from "@/components/admin/common/QueryErrorBoundary";
import { RequireRole } from "@/components/admin/common/RequireRole";
import { useNow } from "@/components/admin/common/use-now";
import { DashCard } from "@/components/admin/dashboard/DashCard";
import { formatCount, pluralSr } from "@/components/admin/dashboard/format";
import { ADMIN_ROLES } from "@/components/admin/shell/me";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/convex/_generated/api";
import { formatDateTime } from "@/lib/admin/format";
import { DemoCountsTable } from "./DemoCountsTable";
import { purgeStateOf, type PurgeState } from "./labels";
import { PurgeDemoDialog } from "./PurgeDemoDialog";

/** `/admin/demo` (PRD B14): demo record counts and the one-click purge. Admin only. */
export function DemoPanel() {
  return (
    <RequireRole roles={ADMIN_ROLES}>
      <PageHeader
        title="Demo sadržaj"
        description="Primeri nekretnina, tekstova i upita za pregled sajta. Svaki demo zapis je označen i uklanja se jednim brisanjem, bez diranja Vaših pravih podataka."
      />
      <QueryErrorBoundary backHref="/admin" backLabel="Kontrolna tabla">
        <DemoContent />
      </QueryErrorBoundary>
    </RequireRole>
  );
}

function DemoContent() {
  const counts = useQuery(api.demo.counts, {});
  const runs = useQuery(api.activity.list, {
    entity: "demo",
    paginationOpts: { numItems: 1, cursor: null },
  });
  const clock = useNow(15_000);
  const state = runs === undefined ? undefined : purgeStateOf(runs.page[0], clock);
  const total = counts?.total;

  return (
    <div className="grid max-w-5xl items-start gap-4 lg:grid-cols-[minmax(0,1fr)_22rem]">
      <DashCard title="Demo zapisi" description="Broj zapisa označenih kao demo, po vrsti sadržaja">
        {counts === undefined ? (
          <div aria-busy="true" className="space-y-2">
            {Array.from({ length: 11 }, (_, index) => (
              <Skeleton key={index} className="h-8 w-full" />
            ))}
          </div>
        ) : (
          <>
            {counts.settingsIsDemo ? (
              <p className="mb-3 flex gap-2 rounded-lg border border-warning/40 bg-warning/10 px-3 py-2 text-sm">
                <TriangleAlert className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden="true" />
                <span>
                  Podešavanja agencije još imaju demo vrednosti (PIB, broj iz registra) — izmenite ih u
                  Podešavanjima.
                </span>
              </p>
            ) : null}
            <DemoCountsTable rows={counts.rows} total={counts.total} />
          </>
        )}
      </DashCard>

      <DashCard title="Brisanje" description="Uklanja sav demo sadržaj odjednom">
        <div className="space-y-4 text-sm">
          <p className="text-muted-foreground">
            Brišu se demo nekretnine sa fotografijama, 360° scenama i statistikom, kao i demo upiti,
            razgledanja, kontakti, tekstovi, utisci, stranice, agenti i lokacije. Demo agenti i
            lokacije koje koriste Vaše prave nekretnine ostaju. Podešavanja agencije se ne menjaju.
          </p>
          <div aria-live="polite" className="min-h-10">
            {state === undefined || total === undefined ? (
              <Skeleton className="h-10 w-full" />
            ) : (
              <PurgeStatus state={state} total={total} />
            )}
          </div>
          <PurgeDemoDialog
            total={total ?? 0}
            disabled={total === undefined || total === 0 || state === undefined || state.kind === "running"}
          />
        </div>
      </DashCard>
    </div>
  );
}

function PurgeStatus({ state, total }: { state: PurgeState; total: number }) {
  const remaining = `${formatCount(total)} ${pluralSr(total, "demo zapis", "demo zapisa")}`;

  if (state.kind === "running") {
    return (
      <p className="flex items-start gap-2" data-testid="demo-purge-running">
        <Loader2 className="mt-0.5 size-4 shrink-0 text-primary motion-safe:animate-spin" aria-hidden="true" />
        <span>
          Brisanje u toku…{" "}
          {total > 0 ? (
            <span className="text-muted-foreground" data-numeric>
              Preostalo: {remaining}.
            </span>
          ) : null}
        </span>
      </p>
    );
  }

  if (state.kind === "stalled") {
    return (
      <p className="flex items-start gap-2">
        <TriangleAlert className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden="true" />
        <span>
          Brisanje pokrenuto{" "}
          <span data-numeric>{formatDateTime(state.since)}</span> nije potvrđeno kao završeno.
          {total > 0 ? " Možete ga pokrenuti ponovo." : null}
        </span>
      </p>
    );
  }

  if (total === 0) {
    return (
      <p className="flex items-start gap-2">
        <CircleCheck className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
        <span>
          Nema demo sadržaja.
          {state.kind === "finished" ? (
            <span className="text-muted-foreground">
              {" "}
              Poslednje brisanje: <span data-numeric>{formatDateTime(state.at)}</span>.
            </span>
          ) : null}
        </span>
      </p>
    );
  }

  if (state.kind === "finished") {
    return (
      <p className="text-muted-foreground">
        Poslednje brisanje je završeno <span data-numeric>{formatDateTime(state.at)}</span>. Preostalo
        je {remaining} — demo agenti i lokacije koje koriste prave nekretnine, ili sadržaj dodat
        posle brisanja.
      </p>
    );
  }

  return (
    <p className="text-muted-foreground" data-numeric>
      Trenutno: {remaining}.
    </p>
  );
}
