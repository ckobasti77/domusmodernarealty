"use client";

import { UserPlus, Users } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";
import { PHONE_QUERY } from "@/components/admin/common/breakpoints";
import { EmptyState, FilterSelect, ListToolbar, optionsFrom, SearchInput } from "@/components/admin/common/ListToolbar";
import { DotBadge } from "@/components/admin/common/StatusBadge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { Id } from "@/convex/_generated/dataModel";
import type { Role, UserStatus } from "@/convex/lib/validators";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { formatRelative } from "@/lib/admin/format";
import { ROLE_LABEL, USER_STATUS_LABEL } from "@/lib/admin/labels";
import { foldDiacritics } from "@/convex/lib/slug";
import { AgentAvatar } from "./AgentAvatar";
import { USER_STATUS_TONE, userLabel, type TeamUser } from "./labels";

const ROLE_ORDER: readonly Role[] = ["admin", "manager", "agent", "editor"];
const STATUS_OPTIONS = optionsFrom<Exclude<UserStatus, "invited">>({
  active: USER_STATUS_LABEL.active,
  disabled: USER_STATUS_LABEL.disabled,
});
function sortUsers(users: readonly TeamUser[]): TeamUser[] {
  return [...users].sort(
    (a, b) =>
      Number(a.status !== "active") - Number(b.status !== "active") ||
      ROLE_ORDER.indexOf(a.role) - ROLE_ORDER.indexOf(b.role) ||
      userLabel(a).localeCompare(userLabel(b), "sr-Latn"),
  );
}

function lastSeen(user: TeamUser, now: number): string {
  return user.lastSeenAt !== undefined ? formatRelative(user.lastSeenAt, now) : "Još se nije prijavio/la";
}

/** Staff accounts: who can sign in, with which role, and when they last did. */
export function UsersPanel({
  users,
  now,
  meId,
  onOpen,
  onInvite,
}: {
  users: readonly TeamUser[] | undefined;
  now: number;
  meId: Id<"users">;
  onOpen: (id: string) => void;
  onInvite: () => void;
}) {
  const phone = useMediaQuery(PHONE_QUERY);
  const [q, setQ] = useState("");
  const [role, setRole] = useState<Role | undefined>(undefined);
  const [status, setStatus] = useState<Exclude<UserStatus, "invited"> | undefined>(undefined);

  const rows = useMemo(() => {
    if (users === undefined) return undefined;
    const needle = foldDiacritics(q.trim());
    return sortUsers(users).filter(
      (user) =>
        (role === undefined || user.role === role) &&
        (status === undefined || user.status === status) &&
        (needle.length === 0 ||
          foldDiacritics(`${user.name ?? ""} ${user.email ?? ""} ${user.agentName ?? ""}`).includes(needle)),
    );
  }, [users, q, role, status]);

  const filtered = q.trim().length > 0 || role !== undefined || status !== undefined;

  let body: ReactNode;
  if (rows === undefined) {
    body = (
      <div aria-busy="true" aria-label="Nalozi se učitavaju" className="space-y-2">
        {Array.from({ length: 4 }, (_, index) => (
          <Skeleton key={index} className="h-12 w-full" />
        ))}
      </div>
    );
  } else if (rows.length === 0) {
    body = filtered ? (
      <EmptyState
        title="Nijedan nalog ne odgovara filterima."
        action={
          <Button
            variant="outline"
            onClick={() => {
              setQ("");
              setRole(undefined);
              setStatus(undefined);
            }}
          >
            Poništite filtere
          </Button>
        }
      />
    ) : (
      <EmptyState
        icon={<Users />}
        title="Još nema drugih naloga."
        description="Pozovite kolege: svako dobija svoj nalog i ulogu."
        action={
          <Button onClick={onInvite}>
            <UserPlus aria-hidden="true" />
            Pozovite člana tima
          </Button>
        }
      />
    );
  } else if (phone) {
    body = (
      <ul aria-label="Nalozi" className="divide-y rounded-xl border bg-card">
        {rows.map((user) => (
          <li key={user._id} data-testid="team-user-row" data-email={user.email}>
            <button
              type="button"
              onClick={() => onOpen(user._id)}
              className="flex w-full items-center gap-3 px-3 py-3 text-left transition-colors duration-150 outline-none hover:bg-muted/50 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:ring-inset"
            >
              <AgentAvatar name={userLabel(user)} size="sm" />
              <span className="min-w-0 flex-1">
                <span className="flex items-center justify-between gap-2">
                  <span className="truncate text-sm font-medium">
                    {userLabel(user)}
                    {user._id === meId ? <span className="text-muted-foreground"> (Vi)</span> : null}
                  </span>
                  <DotBadge tone={USER_STATUS_TONE[user.status]}>{USER_STATUS_LABEL[user.status]}</DotBadge>
                </span>
                <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                  {ROLE_LABEL[user.role]} · {user.email}
                </span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    );
  } else {
    body = (
      <div className="overflow-hidden rounded-xl border bg-card">
        <Table data-testid="team-users-table" className="table-fixed [&_td]:px-3 [&_th]:px-3">
          <caption className="sr-only">Nalozi zaposlenih. Izaberite ime da otvorite detalje.</caption>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-[34%]">Korisnik</TableHead>
              <TableHead className="w-[14%]">Uloga</TableHead>
              <TableHead className="w-[14%]">Status</TableHead>
              <TableHead className="w-[20%]">Profil agenta</TableHead>
              <TableHead className="w-[18%]">Poslednja aktivnost</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((user) => (
              <TableRow
                key={user._id}
                data-testid="team-user-row"
                data-email={user.email}
                className="cursor-pointer"
                onClick={() => onOpen(user._id)}
              >
                <TableCell>
                  <div className="flex min-w-0 items-center gap-3">
                    <AgentAvatar name={userLabel(user)} size="sm" />
                    <div className="min-w-0">
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          onOpen(user._id);
                        }}
                        className="block max-w-full truncate rounded-sm text-left font-medium outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
                      >
                        {userLabel(user)}
                        {user._id === meId ? <span className="font-normal text-muted-foreground"> (Vi)</span> : null}
                      </button>
                      <span className="block truncate text-xs text-muted-foreground">{user.email}</span>
                    </div>
                  </div>
                </TableCell>
                <TableCell>{ROLE_LABEL[user.role]}</TableCell>
                <TableCell>
                  <DotBadge tone={USER_STATUS_TONE[user.status]}>{USER_STATUS_LABEL[user.status]}</DotBadge>
                </TableCell>
                <TableCell className="truncate">
                  {user.agentName ?? <span className="text-muted-foreground">—</span>}
                </TableCell>
                <TableCell className="text-muted-foreground">{lastSeen(user, now)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    );
  }

  return (
    <>
      <ListToolbar>
        <SearchInput value={q} onChange={setQ} label="Pretraga naloga" placeholder="Ime ili e-adresa…" />
        <FilterSelect label="Uloga" value={role} onChange={setRole} options={optionsFrom(ROLE_LABEL)} allLabel="Sve uloge" />
        <FilterSelect label="Status" value={status} onChange={setStatus} options={STATUS_OPTIONS} allLabel="Svi statusi" />
      </ListToolbar>
      {body}
    </>
  );
}
