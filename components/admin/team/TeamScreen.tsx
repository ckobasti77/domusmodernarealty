"use client";

import { useQuery } from "convex/react";
import { UserPlus } from "lucide-react";
import { useEffect, useState } from "react";
import { PageHeader } from "@/components/admin/common/PageHeader";
import { QueryErrorBoundary } from "@/components/admin/common/QueryErrorBoundary";
import { RequireRole } from "@/components/admin/common/RequireRole";
import { ADMIN_ROLES, hasRole, MANAGER_ROLES, useMe } from "@/components/admin/shell/me";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { api } from "@/convex/_generated/api";
import { AgentSheet } from "./AgentSheet";
import { AgentsPanel } from "./AgentsPanel";
import { InviteDialog } from "./InviteDialog";
import { InvitesPanel } from "./InvitesPanel";
import { inviteState } from "./labels";
import { NEW_AGENT_ID, TEAM_TABS, useTeamParams, type TeamTab } from "./params";
import { UserSheet } from "./UserSheet";
import { UsersPanel } from "./UsersPanel";

/** Relative times ("ističe za 3 dana", "pre 2 sata") refresh once a minute. */
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
 * Team (PRD B7). Admins manage accounts, invites and roles; managers see and
 * edit the agents' public profiles only (accounts are admin business, PRD B1).
 * The server enforces the same split; this screen only mirrors it.
 */
export function TeamScreen() {
  return (
    <RequireRole roles={MANAGER_ROLES}>
      <QueryErrorBoundary>
        <TeamView />
      </QueryErrorBoundary>
    </RequireRole>
  );
}

function Count({ value }: { value: number | undefined }) {
  if (value === undefined || value === 0) return null;
  return (
    <span className="rounded-full bg-muted px-1.5 text-[11px] leading-4 font-medium text-muted-foreground tabular-nums">
      {value}
    </span>
  );
}

function TeamView() {
  const me = useMe();
  const isAdmin = hasRole(me, ADMIN_ROLES);
  const now = useNow(NOW_TICK_MS);
  const { params, setParams } = useTeamParams();

  const users = useQuery(api.users.list, isAdmin ? {} : "skip");
  const invites = useQuery(api.invites.list, isAdmin ? {} : "skip");
  const agents = useQuery(api.agentsAdmin.list, {});

  const tabs: readonly TeamTab[] = isAdmin ? TEAM_TABS : ["agents"];
  const tab: TeamTab = params.tab !== undefined && tabs.includes(params.tab) ? params.tab : tabs[0];

  const openUser = tab === "users" && params.id !== undefined ? users?.find((user) => user._id === params.id) : undefined;
  const agentSheetOpen =
    tab === "agents" &&
    params.id !== undefined &&
    (params.id === NEW_AGENT_ID || agents?.some((agent) => agent._id === params.id) === true);
  const openAgent = agentSheetOpen ? agents?.find((agent) => agent._id === params.id) : undefined;

  const pendingInvites = invites?.filter((invite) => inviteState(invite, now) === "pending").length;
  const activeUsers = users?.filter((user) => user.status === "active").length;

  const openInvite = () => setParams({ invite: true });

  return (
    <>
      <PageHeader
        title="Tim"
        description={
          isAdmin
            ? "Nalozi zaposlenih, pozivnice i javni profili agenata."
            : "Javni profili agenata: fotografija, biografija, jezici, kontakti i oblasti."
        }
        actions={
          isAdmin ? (
            <Button onClick={openInvite} data-testid="invite-open">
              <UserPlus aria-hidden="true" />
              Pozovite člana tima
            </Button>
          ) : undefined
        }
      />

      <Tabs
        value={tab}
        onValueChange={(next) => {
          const picked = TEAM_TABS.find((item) => item === next);
          if (picked !== undefined) setParams({ tab: picked, id: undefined });
        }}
        className="gap-4"
      >
        {tabs.length > 1 ? (
          <TabsList variant="line" aria-label="Delovi stranice Tim" className="h-9 max-w-full">
            <TabsTrigger value="users" data-testid="team-tab-users" className="flex-none px-3">
              Korisnici <Count value={activeUsers} />
            </TabsTrigger>
            <TabsTrigger value="invites" data-testid="team-tab-invites" className="flex-none px-3">
              Pozivnice <Count value={pendingInvites} />
            </TabsTrigger>
            <TabsTrigger value="agents" data-testid="team-tab-agents" className="flex-none px-3">
              Profili agenata <Count value={agents?.length} />
            </TabsTrigger>
          </TabsList>
        ) : null}

        {isAdmin ? (
          <TabsContent value="users">
            <UsersPanel
              users={users}
              now={now}
              meId={me._id}
              onOpen={(id) => setParams({ tab: "users", id })}
              onInvite={openInvite}
            />
          </TabsContent>
        ) : null}
        {isAdmin ? (
          <TabsContent value="invites">
            <InvitesPanel invites={invites} now={now} onInvite={openInvite} />
          </TabsContent>
        ) : null}
        <TabsContent value="agents">
          <AgentsPanel
            agents={agents}
            onOpen={(id) => setParams({ tab: "agents", id })}
            onNew={() => setParams({ tab: "agents", id: NEW_AGENT_ID })}
          />
        </TabsContent>
      </Tabs>

      {isAdmin && users !== undefined ? (
        <UserSheet
          user={openUser}
          users={users}
          agents={agents}
          invites={invites}
          meId={me._id}
          now={now}
          onClose={() => setParams({ id: undefined })}
          onOpenAgent={(id) => setParams({ tab: "agents", id })}
        />
      ) : null}

      <AgentSheet
        open={agentSheetOpen}
        agent={openAgent}
        onClose={() => setParams({ id: undefined })}
        onCreated={(id) => setParams({ tab: "agents", id })}
      />

      {isAdmin ? (
        <InviteDialog
          open={params.invite}
          onOpenChange={(open) => setParams({ invite: open })}
          agents={agents}
          invites={invites}
          onFinished={() => setParams({ tab: "invites", id: undefined })}
        />
      ) : null}
    </>
  );
}
