"use client";

import { useMutation } from "convex/react";
import { Info, Link2, MailPlus, X } from "lucide-react";
import { useState } from "react";
import { ConfirmDialog } from "@/components/admin/common/ConfirmDialog";
import { EmptyState } from "@/components/admin/common/ListToolbar";
import { DotBadge } from "@/components/admin/common/StatusBadge";
import { useMutationAction } from "@/components/admin/common/useMutationAction";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/convex/_generated/api";
import { formatDate, formatDateTime, formatRelative } from "@/lib/admin/format";
import { ROLE_LABEL } from "@/lib/admin/labels";
import { InviteLinkBox } from "./InviteLinkBox";
import {
  INVITE_STATE_LABEL,
  INVITE_STATE_TONE,
  inviteState,
  inviteUrl,
  type InviteState,
  type TeamInvite,
} from "./labels";

function whenLine(invite: TeamInvite, state: InviteState, now: number): string {
  switch (state) {
    case "pending":
      return `ističe ${formatRelative(invite.expiresAt, now)}`;
    case "expired":
      return `istekla ${formatDate(invite.expiresAt)}`;
    case "accepted":
      return `prihvaćena ${formatDate(invite.acceptedAt ?? invite.createdAt)}`;
    case "revoked":
      return `opozvana ${formatDate(invite.revokedAt ?? invite.createdAt)}`;
  }
}

/**
 * Open invites first (with "Novi link" and "Opozovi"), then the history. E-mail
 * sending is not configured, so links are shared by hand; a lost link is
 * replaced, never shown again (only its hash is stored).
 */
export function InvitesPanel({
  invites,
  now,
  onInvite,
}: {
  invites: readonly TeamInvite[] | undefined;
  now: number;
  onInvite: () => void;
}) {
  const revoke = useMutationAction(useMutation(api.invites.revoke), "Pozivnica je opozvana.");
  const renew = useMutationAction(useMutation(api.invites.renew), "Napravljen je novi link.");
  const [link, setLink] = useState<{ url: string; email: string } | null>(null);

  if (invites === undefined) {
    return (
      <div aria-busy="true" aria-label="Pozivnice se učitavaju" className="space-y-2">
        {Array.from({ length: 3 }, (_, index) => (
          <Skeleton key={index} className="h-16 w-full" />
        ))}
      </div>
    );
  }

  const rows = invites.map((invite) => ({ invite, state: inviteState(invite, now) }));
  const open = rows
    .filter((row) => row.state === "pending" || row.state === "expired")
    .sort((a, b) => a.invite.expiresAt - b.invite.expiresAt);
  const history = rows.filter((row) => row.state === "accepted" || row.state === "revoked");

  const renderRow = ({ invite, state }: { invite: TeamInvite; state: InviteState }) => {
    const actionable = state === "pending" || state === "expired";
    const details = [
      invite.name,
      ROLE_LABEL[invite.role],
      invite.agentName !== undefined ? `profil: ${invite.agentName}` : undefined,
    ].filter((part) => part !== undefined);
    return (
      <li
        key={invite._id}
        data-testid="invite-row"
        data-email={invite.email}
        data-state={state}
        className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3"
      >
        <div className="min-w-0 flex-1 basis-64">
          <p className="truncate text-sm font-medium">{invite.email}</p>
          <p className="truncate text-xs text-muted-foreground">{details.join(" · ")}</p>
        </div>
        <div className="flex min-w-40 flex-col gap-1">
          <DotBadge tone={INVITE_STATE_TONE[state]}>{INVITE_STATE_LABEL[state]}</DotBadge>
          <span
            className="text-xs text-muted-foreground"
            title={`Poslao/la ${invite.createdByName ?? "—"}, ${formatDateTime(invite.createdAt)}`}
          >
            {whenLine(invite, state, now)}
          </span>
        </div>
        {actionable ? (
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={renew.pending}
              onClick={async () => {
                const renewed = await renew.run({ id: invite._id });
                if (renewed !== undefined) setLink({ url: inviteUrl(renewed.token), email: invite.email });
              }}
              aria-label={`Novi link za ${invite.email}`}
            >
              <Link2 aria-hidden="true" />
              Novi link
            </Button>
            <ConfirmDialog
              trigger={
                <Button variant="ghost" size="sm" aria-label={`Opozovite pozivnicu za ${invite.email}`}>
                  <X aria-hidden="true" />
                  Opozovi
                </Button>
              }
              title={`Opozvati pozivnicu za ${invite.email}?`}
              description={
                invite.agentName !== undefined
                  ? `Link prestaje da važi odmah. Profil „${invite.agentName}” ostaje u kartici Profili agenata.`
                  : "Link prestaje da važi odmah."
              }
              confirmLabel="Opozovite"
              destructive
              onConfirm={async () => {
                const done = await revoke.run({ id: invite._id });
                return done !== undefined;
              }}
            />
          </div>
        ) : null}
      </li>
    );
  };

  return (
    <div className="space-y-6">
      <p className="flex max-w-3xl gap-2 rounded-lg border bg-muted/40 p-3 text-sm leading-relaxed text-muted-foreground">
        <Info className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
        <span>
          Slanje e-pošte iz panela još nije podešeno. Link pozivnice kopirajte i pošaljite lično.
          Svaki link važi 7 dana i radi samo jednom; izgubljen link zamenite dugmetom „Novi link”.
        </span>
      </p>

      <section aria-labelledby="invites-open">
        <h2 id="invites-open" className="mb-2 text-sm font-semibold">
          Otvorene pozivnice
        </h2>
        {open.length === 0 ? (
          <EmptyState
            icon={<MailPlus />}
            title="Nema otvorenih pozivnica."
            description="Nova pozivnica daje link za otvaranje naloga sa unapred izabranom ulogom."
            action={<Button onClick={onInvite}>Pozovite člana tima</Button>}
          />
        ) : (
          <ul aria-label="Otvorene pozivnice" className="divide-y rounded-xl border bg-card">
            {open.map(renderRow)}
          </ul>
        )}
      </section>

      {history.length > 0 ? (
        <section aria-labelledby="invites-history">
          <h2 id="invites-history" className="mb-2 text-sm font-semibold">
            Istorija
          </h2>
          <ul aria-label="Prihvaćene i opozvane pozivnice" className="divide-y rounded-xl border bg-card">
            {history.map(renderRow)}
          </ul>
        </section>
      ) : null}

      <Dialog
        open={link !== null}
        onOpenChange={(next) => {
          if (!next) setLink(null);
        }}
      >
        <DialogContent showCloseButton={false} className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Novi link pozivnice</DialogTitle>
            <DialogDescription>
              Prethodni link više ne važi. Novi važi 7 dana od sada.
            </DialogDescription>
          </DialogHeader>
          {link !== null ? <InviteLinkBox url={link.url} email={link.email} /> : null}
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button">Gotovo</Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
