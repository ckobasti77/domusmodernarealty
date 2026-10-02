"use client";

import { useState } from "react";
import { QueryErrorBoundary } from "@/components/admin/common/QueryErrorBoundary";
import { useNow } from "@/components/admin/common/use-now";
import { hasRole, LISTING_ROLES, MANAGER_ROLES, useMe } from "@/components/admin/shell/me";
import { EditorWelcome } from "./EditorWelcome";
import { Greeting } from "./Greeting";
import { KpiCards } from "./KpiCards";
import { RecentActivity } from "./RecentActivity";
import { TodoLists } from "./TodoLists";
import { ViewsLeadsCard } from "./ViewsLeadsCard";

/**
 * `/admin` (PRD B2). What renders depends on the role, and each block only
 * subscribes to queries that role may call:
 * - admin / manager: KPIs, work queues, 30-day chart, recent activity;
 * - agent: own work queues;
 * - editor: an overview of the content modules.
 */
export function Dashboard() {
  const me = useMe();
  // One timestamp for query arguments (stable subscriptions) and a ticking
  // clock for "pre 5 minuta" labels.
  const [now] = useState(() => Date.now());
  const clock = useNow(30_000);
  const isManager = hasRole(me, MANAGER_ROLES);
  const worksListings = hasRole(me, LISTING_ROLES);

  return (
    <div className="space-y-8">
      <Greeting me={me} now={now} />

      {isManager ? (
        <QueryErrorBoundary>
          <KpiCards now={now} />
        </QueryErrorBoundary>
      ) : null}

      {worksListings ? (
        <QueryErrorBoundary>
          <TodoLists now={now} clock={clock} showAgent={isManager} />
        </QueryErrorBoundary>
      ) : (
        <EditorWelcome />
      )}

      {isManager ? (
        <div className="grid gap-4 xl:grid-cols-3">
          <QueryErrorBoundary>
            <ViewsLeadsCard now={now} className="xl:col-span-2" />
          </QueryErrorBoundary>
          <QueryErrorBoundary>
            <RecentActivity clock={clock} />
          </QueryErrorBoundary>
        </div>
      ) : null}
    </div>
  );
}
