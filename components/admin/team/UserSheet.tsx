"use client";

import { useMutation } from "convex/react";
import { Power, PowerOff } from "lucide-react";
import { useId, useState } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/admin/common/ConfirmDialog";
import { DetailSheet, FactList, SheetSection } from "@/components/admin/common/DetailSheet";
import { describedBy, FieldShell } from "@/components/admin/common/form";
import { DotBadge } from "@/components/admin/common/StatusBadge";
import { useMutationAction } from "@/components/admin/common/useMutationAction";
import { Button } from "@/components/ui/button";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import type { Role } from "@/convex/lib/validators";
import { formatDate, formatDateTime, formatRelative } from "@/lib/admin/format";
import { ROLE_LABEL, USER_STATUS_LABEL } from "@/lib/admin/labels";
import {
  inviteState,
  ROLE_HINT,
  USER_STATUS_TONE,
  userLabel,
  type TeamAgent,
  type TeamInvite,
  type TeamUser,
} from "./labels";
import { NativeSelect } from "./NativeSelect";

const ROLES = Object.keys(ROLE_LABEL) as Role[];

/**
 * One staff account (admin only): role, linked agent profile, activation.
 * Every change is confirmed and logged server-side; the server also refuses
 * to leave the agency without an active administrator.
 */
export function UserSheet({
  user,
  users,
  agents,
  invites,
  meId,
  now,
  onClose,
  onOpenAgent,
}: {
  user: TeamUser | undefined;
  users: readonly TeamUser[];
  agents: readonly TeamAgent[] | undefined;
  invites: readonly TeamInvite[] | undefined;
  meId: Id<"users">;
  now: number;
  onClose: () => void;
  onOpenAgent: (id: string) => void;
}) {
  return (
    <DetailSheet
      open={user !== undefined}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title={user !== undefined ? userLabel(user) : "Nalog"}
      description={user?.email}
      meta={
        user !== undefined ? (
          <>
            <span className="text-xs font-medium">{ROLE_LABEL[user.role]}</span>
            <DotBadge tone={USER_STATUS_TONE[user.status]}>{USER_STATUS_LABEL[user.status]}</DotBadge>
            {user._id === meId ? <span className="text-xs text-muted-foreground">Vaš nalog</span> : null}
          </>
        ) : undefined
      }
      width="md"
      testId="user-sheet"
    >
      {user !== undefined ? (
        // Keyed by the server state, so a change made elsewhere resets the controls.
        <UserDetails
          key={`${user._id}:${user.role}:${user.status}:${user.agentId ?? ""}`}
          user={user}
          users={users}
          agents={agents}
          invites={invites}
          meId={meId}
          now={now}
          onOpenAgent={onOpenAgent}
        />
      ) : null}
    </DetailSheet>
  );
}

function UserDetails({
  user,
  users,
  agents,
  invites,
  meId,
  now,
  onOpenAgent,
}: {
  user: TeamUser;
  users: readonly TeamUser[];
  agents: readonly TeamAgent[] | undefined;
  invites: readonly TeamInvite[] | undefined;
  meId: Id<"users">;
  now: number;
  onOpenAgent: (id: string) => void;
}) {
  const roleId = useId();
  const agentFieldId = useId();
  const [role, setRole] = useState<Role>(user.role);
  const [agentId, setAgentId] = useState<string>(user.agentId ?? "");
  const [confirmRole, setConfirmRole] = useState(false);
  const setRoleAction = useMutationAction(useMutation(api.users.setRole), "Uloga je promenjena.");
  const linkAction = useMutationAction(useMutation(api.users.linkAgent), "Profil agenta je povezan.");
  const statusAction = useMutationAction(useMutation(api.users.setStatus));

  const isSelf = user._id === meId;
  const otherActiveAdmins = users.filter(
    (item) => item._id !== user._id && item.role === "admin" && item.status === "active",
  ).length;
  const lastAdmin = user.role === "admin" && user.status === "active" && otherActiveAdmins === 0;

  // Profiles this account may take: free ones, its own, and none promised to
  // somebody else by an open invite (the server refuses those too).
  const promised = new Set(
    (invites ?? [])
      .filter((invite) => inviteState(invite, now) === "pending")
      .map((invite) => invite.agentId)
      .filter((id) => id !== undefined),
  );
  const linkable = (agents ?? []).filter(
    (agent) => (agent.userId === undefined || agent.userId === user._id) && !promised.has(agent._id),
  );
  const chosenAgent = linkable.find((agent) => agent._id === agentId);
  const agentChanged = agentId !== (user.agentId ?? "");
  const unlinkBlocked = agentId === "" && user.role === "agent" && user.status === "active";

  const roleNeedsProfile = role === "agent" && user.agentId === undefined;
  const roleError = roleNeedsProfile
    ? "Nalog sa ulogom Agent mora imati profil agenta. Prvo ga povežite ispod."
    : undefined;
  const roleHint = lastAdmin
    ? "Ovo je jedini aktivni administrator. Ulogu možete promeniti tek kada je dodelite još nekom."
    : ROLE_HINT[role];

  return (
    <div>
      <SheetSection title="Uloga">
        <FieldShell id={roleId} label="Uloga u panelu" hint={roleHint} error={roleError}>
          <NativeSelect
            id={roleId}
            value={role}
            disabled={lastAdmin || setRoleAction.pending}
            onChange={(event) => {
              const next = ROLES.find((item) => item === event.target.value);
              if (next !== undefined) setRole(next);
            }}
            aria-invalid={roleError !== undefined || undefined}
            aria-describedby={describedBy(roleId, true, roleError !== undefined)}
            data-testid="user-role"
          >
            {ROLES.map((item) => (
              <option key={item} value={item}>
                {ROLE_LABEL[item]}
              </option>
            ))}
          </NativeSelect>
        </FieldShell>
        {role !== user.role ? (
          <div className="mt-3 flex flex-wrap justify-end gap-2">
            <Button variant="ghost" onClick={() => setRole(user.role)}>
              Vratite
            </Button>
            <Button disabled={roleNeedsProfile} onClick={() => setConfirmRole(true)} data-testid="user-role-save">
              Promenite ulogu
            </Button>
          </div>
        ) : null}
        <ConfirmDialog
          open={confirmRole}
          onOpenChange={setConfirmRole}
          title={`Promeniti ulogu u „${ROLE_LABEL[role]}”?`}
          description={
            isSelf
              ? `Menjate svoju ulogu. Posle promene imaćete pristup: ${ROLE_HINT[role].toLowerCase()} Nalozi, pozivnice i Podešavanja Vam više neće biti dostupni.`
              : `${userLabel(user)} će odmah dobiti pristup: ${ROLE_HINT[role].toLowerCase()}`
          }
          confirmLabel="Promenite ulogu"
          destructive={user.role === "admin"}
          onConfirm={async () => {
            const done = await setRoleAction.run({ id: user._id, role });
            return done !== undefined;
          }}
        />
      </SheetSection>

      <SheetSection
        title="Profil agenta"
        actions={
          user.agentId !== undefined ? (
            <Button variant="link" size="sm" className="h-auto p-0" onClick={() => onOpenAgent(user.agentId ?? "")}>
              Otvorite profil
            </Button>
          ) : undefined
        }
      >
        <FieldShell
          id={agentFieldId}
          label="Povezani profil"
          hint={
            unlinkBlocked
              ? "Aktivan agent mora imati profil. Izaberite drugi profil ili prvo promenite ulogu."
              : "Nekretnine, upiti i razgledanja ovog profila su „njegovi”; agent vidi samo njih."
          }
        >
          <NativeSelect
            id={agentFieldId}
            value={agentId}
            disabled={agents === undefined || linkAction.pending}
            onChange={(event) => setAgentId(event.target.value)}
            aria-describedby={describedBy(agentFieldId, true, false)}
            data-testid="user-agent"
          >
            <option value="">Bez profila</option>
            {linkable.map((agent) => (
              <option key={agent._id} value={agent._id}>
                {agent.name}
                {agent.isDemo ? " (demo)" : ""}
              </option>
            ))}
          </NativeSelect>
        </FieldShell>
        {agentChanged ? (
          <div className="mt-3 flex flex-wrap justify-end gap-2">
            <Button variant="ghost" onClick={() => setAgentId(user.agentId ?? "")}>
              Vratite
            </Button>
            <Button
              disabled={unlinkBlocked || linkAction.pending}
              onClick={() =>
                void linkAction.run({
                  id: user._id,
                  ...(chosenAgent !== undefined ? { agentId: chosenAgent._id } : {}),
                })
              }
              data-testid="user-agent-save"
            >
              Sačuvajte vezu
            </Button>
          </div>
        ) : null}
      </SheetSection>

      <SheetSection title="Nalog">
        <FactList
          items={[
            { label: "E-adresa", value: user.email ?? "—" },
            { label: "Nalog otvoren", value: formatDate(user.createdAt) },
            {
              label: "Poslednja aktivnost",
              value:
                user.lastSeenAt !== undefined ? (
                  <time dateTime={new Date(user.lastSeenAt).toISOString()} title={formatDateTime(user.lastSeenAt)}>
                    {formatRelative(user.lastSeenAt, now)}
                  </time>
                ) : (
                  "Još se nije prijavio/la"
                ),
            },
          ]}
        />
      </SheetSection>

      <SheetSection title="Pristup">
        {user.status === "disabled" ? (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="max-w-sm text-sm text-muted-foreground">
              Nalog je deaktiviran: prijava nije moguća. Posle aktivacije osoba se prijavljuje
              svojom dosadašnjom lozinkom.
            </p>
            <ConfirmDialog
              trigger={
                <Button variant="outline" data-testid="user-reactivate">
                  <Power aria-hidden="true" />
                  Aktivirajte nalog
                </Button>
              }
              title="Ponovo aktivirati nalog?"
              description={`${userLabel(user)} će ponovo moći da se prijavi sa ulogom ${ROLE_LABEL[user.role]}.`}
              confirmLabel="Aktivirajte"
              onConfirm={async () => {
                const done = await statusAction.run({ id: user._id, status: "active" });
                if (done === undefined) return false;
                toast.success("Nalog je ponovo aktivan.");
                return true;
              }}
            />
          </div>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="max-w-sm text-sm text-muted-foreground">
              {isSelf
                ? "Sopstveni nalog ne možete deaktivirati."
                : lastAdmin
                  ? "Jedini aktivni administrator ne može biti deaktiviran."
                  : "Deaktivacija odmah odjavljuje osobu sa svih uređaja. Podaci ostaju sačuvani."}
            </p>
            <ConfirmDialog
              trigger={
                <Button variant="destructive" disabled={isSelf || lastAdmin} data-testid="user-deactivate">
                  <PowerOff aria-hidden="true" />
                  Deaktivirajte nalog
                </Button>
              }
              title={`Deaktivirati nalog ${userLabel(user)}?`}
              description="Osoba se odmah odjavljuje sa svih uređaja i više ne može da se prijavi. Nekretnine, upiti i razgledanja ostaju na njenom profilu; po potrebi ih prebacite na kolegu."
              confirmLabel="Deaktivirajte"
              destructive
              onConfirm={async () => {
                const done = await statusAction.run({ id: user._id, status: "disabled" });
                if (done === undefined) return false;
                toast.success("Nalog je deaktiviran i odjavljen sa svih uređaja.");
                return true;
              }}
            />
          </div>
        )}
      </SheetSection>
    </div>
  );
}
