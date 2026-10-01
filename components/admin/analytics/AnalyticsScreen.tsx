"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useState } from "react";
import { PageHeader } from "@/components/admin/common/PageHeader";
import { QueryErrorBoundary } from "@/components/admin/common/QueryErrorBoundary";
import { RequireRole } from "@/components/admin/common/RequireRole";
import { MANAGER_ROLES } from "@/components/admin/shell/me";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { FunnelCard } from "./FunnelCard";
import { LeadsTrendCard } from "./LeadsTrendCard";
import { ResponseTimesCard } from "./ResponseTimesCard";
import { isPeriod, PERIODS, type Period } from "./shared";
import { TopListingsCard } from "./TopListingsCard";

/** The view lives in the URL (`?period=90&listing=<id>`), so it can be shared. */
function useAnalyticsParams() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const raw = Number(params.get("period"));
  const period: Period = isPeriod(raw) ? raw : 30;
  const listing = params.get("listing") ?? undefined;

  const set = useCallback(
    (next: { period?: Period; listing?: string }) => {
      const query = new URLSearchParams(params.toString());
      if (next.period !== undefined) {
        if (next.period === 30) query.delete("period");
        else query.set("period", String(next.period));
      }
      if (next.listing !== undefined) query.set("listing", next.listing);
      const search = query.toString();
      router.replace(search.length > 0 ? `${pathname}?${search}` : pathname, { scroll: false });
    },
    [params, pathname, router],
  );

  return { period, listing, set };
}

function AnalyticsView() {
  // Query arguments keep the mount-time clock so subscriptions do not churn.
  const [now] = useState(() => Date.now());
  const { period, listing, set } = useAnalyticsParams();

  return (
    <>
      <PageHeader
        title="Analitika"
        description="Kako oglasi privlače posetioce i koliko brzo tim odgovara na upite."
        actions={
          <div className="flex items-center gap-2">
            <span id="analytics-period" className="text-xs text-muted-foreground">
              Period
            </span>
            <ToggleGroup
              type="single"
              variant="outline"
              size="sm"
              spacing={0}
              value={String(period)}
              aria-labelledby="analytics-period"
              onValueChange={(value) => {
                const next = Number(value);
                if (isPeriod(next)) set({ period: next });
              }}
            >
              {PERIODS.map((days) => (
                <ToggleGroupItem key={days} value={String(days)} className="px-3">
                  {days} dana
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </div>
        }
      />
      <div className="grid max-w-7xl gap-4 xl:grid-cols-2">
        <FunnelCard listingParam={listing} onPick={(id) => set({ listing: id })} />
        <TopListingsCard now={now} period={period} />
        <LeadsTrendCard now={now} period={period} className="xl:col-span-2" />
        <ResponseTimesCard now={now} period={period} className="xl:col-span-2" />
      </div>
    </>
  );
}

/** `/admin/analitika` — agency analytics (PRD B12). Managers and admins. */
export function AnalyticsScreen() {
  return (
    <RequireRole roles={MANAGER_ROLES}>
      <QueryErrorBoundary backHref="/admin" backLabel="Kontrolna tabla">
        <AnalyticsView />
      </QueryErrorBoundary>
    </RequireRole>
  );
}
