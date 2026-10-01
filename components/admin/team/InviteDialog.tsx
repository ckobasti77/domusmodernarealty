"use client";

import { useMutation } from "convex/react";
import { Info, Loader2, X } from "lucide-react";
import { useId, useMemo, useRef, useState, type FormEvent } from "react";
import { describedBy, FieldShell } from "@/components/admin/common/form";
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
import { Input } from "@/components/ui/input";
import { api } from "@/convex/_generated/api";
import type { Role } from "@/convex/lib/validators";
import { useMutationAction } from "@/components/admin/common/useMutationAction";
import { ROLE_LABEL } from "@/lib/admin/labels";
import { InviteLinkBox } from "./InviteLinkBox";
import { inviteState, inviteUrl, ROLE_HINT, type TeamAgent, type TeamInvite } from "./labels";
import { NativeSelect } from "./NativeSelect";

type AgentMode = "none" | "new" | "existing";
type Errors = Partial<Record<"email" | "name" | "agent", string>>;

const ROLES = Object.keys(ROLE_LABEL) as Role[];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

const MODE_LABEL: Record<AgentMode, string> = {
  none: "Bez profila agenta",
  new: "Novi profil agenta",
  existing: "Postojeći profil agenta",
};

/** Which profile choices a role gets; editors never have one. */
function modesFor(role: Role): AgentMode[] {
  if (role === "editor") return [];
  if (role === "agent") return ["new", "existing"];
  return ["none", "new", "existing"];
}

/**
 * "Pozovite člana tima": e-mail, name, role and, for an agent, the profile the
 * account will be linked to. E-mail sending is not configured, so the result
 * is a link the admin copies and sends personally.
 */
export function InviteDialog({
  open,
  onOpenChange,
  agents,
  invites,
  onFinished,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  agents: readonly TeamAgent[] | undefined;
  invites: readonly TeamInvite[] | undefined;
  /** After a link was made and the dialog is closed (e.g. show the Invites tab). */
  onFinished: () => void;
}) {
  const [finished, setFinished] = useState(false);
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next && finished) {
          setFinished(false);
          onFinished();
        }
      }}
    >
      <DialogContent
        showCloseButton={false}
        data-testid="invite-dialog"
        className="max-h-[calc(100svh-2rem)] overflow-y-auto sm:max-w-lg"
      >
        {/* Mounted only while open, so every opening starts from an empty form. */}
        <InviteForm agents={agents} invites={invites} onCreated={() => setFinished(true)} />
        <DialogClose asChild>
          <Button variant="ghost" size="icon-sm" className="absolute top-2 right-2" aria-label="Zatvori">
            <X aria-hidden="true" />
          </Button>
        </DialogClose>
      </DialogContent>
    </Dialog>
  );
}

function InviteForm({
  agents,
  invites,
  onCreated,
}: {
  agents: readonly TeamAgent[] | undefined;
  invites: readonly TeamInvite[] | undefined;
  onCreated: () => void;
}) {
  const baseId = useId();
  const ids = {
    email: `${baseId}-email`,
    name: `${baseId}-name`,
    role: `${baseId}-role`,
    mode: `${baseId}-mode`,
    agent: `${baseId}-agent`,
  };
  const formRef = useRef<HTMLFormElement>(null);
  const [now] = useState(() => Date.now());
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<Role>("agent");
  const [mode, setMode] = useState<AgentMode>("new");
  const [agentName, setAgentName] = useState("");
  const [agentId, setAgentId] = useState("");
  const [errors, setErrors] = useState<Errors>({});
  const [result, setResult] = useState<{ url: string; email: string; name: string; role: Role } | null>(null);
  const create = useMutationAction(useMutation(api.invites.create), "Pozivnica je napravljena.");

  const normalizedEmail = email.trim().toLowerCase();
  /** Profiles nobody signs in with yet and no open invite promises to someone else. */
  const freeProfiles = useMemo(() => {
    if (agents === undefined) return [];
    const promised = new Set(
      (invites ?? [])
        .filter((invite) => inviteState(invite, now) === "pending" && invite.email !== normalizedEmail)
        .map((invite) => invite.agentId)
        .filter((id) => id !== undefined),
    );
    return agents.filter((agent) => agent.userId === undefined && !promised.has(agent._id));
  }, [agents, invites, now, normalizedEmail]);

  const modes = modesFor(role);

  const changeRole = (next: Role) => {
    setRole(next);
    setMode(next === "agent" ? "new" : "none");
    setErrors((current) => ({ ...current, agent: undefined }));
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedName = name.trim().replace(/\s+/g, " ");
    const profileName = agentName.trim().replace(/\s+/g, " ") || trimmedName;
    const chosen = freeProfiles.find((agent) => agent._id === agentId);
    const next: Errors = {};
    if (!EMAIL_RE.test(normalizedEmail)) next.email = "Unesite ispravnu e-adresu.";
    if (trimmedName.length < 2) next.name = "Unesite ime i prezime.";
    if (mode === "new" && profileName.length < 2) next.agent = "Unesite ime za profil agenta.";
    if (mode === "existing" && chosen === undefined) next.agent = "Izaberite profil agenta.";
    setErrors(next);
    if (Object.keys(next).length > 0) {
      formRef.current?.querySelector<HTMLElement>("[aria-invalid='true']")?.focus();
      return;
    }

    const created = await create.run({
      email: normalizedEmail,
      name: trimmedName,
      role,
      ...(mode === "new" ? { agentName: profileName } : {}),
      ...(mode === "existing" && chosen !== undefined ? { agentId: chosen._id } : {}),
    });
    if (created === undefined) return;
    setResult({ url: inviteUrl(created.token), email: normalizedEmail, name: trimmedName, role });
    onCreated();
  };

  if (result !== null) {
    return (
      <>
        <DialogHeader className="pr-8">
          <DialogTitle>Pozivnica je spremna</DialogTitle>
          <DialogDescription>
            Pošaljite link osobi {result.name}. Kada postavi lozinku, ulazi u panel sa ulogom{" "}
            {ROLE_LABEL[result.role]}.
          </DialogDescription>
        </DialogHeader>
        <InviteLinkBox url={result.url} email={result.email} />
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setResult(null);
              setEmail("");
              setName("");
              setAgentName("");
              setAgentId("");
              changeRole("agent");
            }}
          >
            Pozovite još nekog
          </Button>
          <DialogClose asChild>
            <Button type="button">Gotovo</Button>
          </DialogClose>
        </DialogFooter>
      </>
    );
  }

  return (
    <form ref={formRef} onSubmit={(event) => void submit(event)} noValidate className="grid gap-4">
      <DialogHeader className="pr-8">
        <DialogTitle>Pozovite člana tima</DialogTitle>
        <DialogDescription>
          Nalog se otvara tek kada pozvana osoba otvori link i postavi lozinku. Uloga dolazi iz
          pozivnice.
        </DialogDescription>
      </DialogHeader>

      <FieldShell id={ids.email} label="E-adresa" error={errors.email}>
        <Input
          id={ids.email}
          type="email"
          inputMode="email"
          autoComplete="off"
          spellCheck={false}
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          aria-invalid={errors.email !== undefined || undefined}
          aria-describedby={describedBy(ids.email, false, errors.email !== undefined)}
          data-testid="invite-email"
        />
      </FieldShell>

      <FieldShell id={ids.name} label="Ime i prezime" error={errors.name}>
        <Input
          id={ids.name}
          autoComplete="off"
          value={name}
          maxLength={120}
          onChange={(event) => setName(event.target.value)}
          aria-invalid={errors.name !== undefined || undefined}
          aria-describedby={describedBy(ids.name, false, errors.name !== undefined)}
          data-testid="invite-name"
        />
      </FieldShell>

      <FieldShell id={ids.role} label="Uloga" hint={ROLE_HINT[role]}>
        <NativeSelect
          id={ids.role}
          value={role}
          onChange={(event) => {
            const next = ROLES.find((item) => item === event.target.value);
            if (next !== undefined) changeRole(next);
          }}
          aria-describedby={describedBy(ids.role, true, false)}
          data-testid="invite-role"
        >
          {ROLES.map((item) => (
            <option key={item} value={item}>
              {ROLE_LABEL[item]}
            </option>
          ))}
        </NativeSelect>
      </FieldShell>

      {modes.length > 0 ? (
        <fieldset className="grid gap-3 rounded-lg border p-3">
          <legend className="px-1 text-xs font-medium text-muted-foreground">Profil agenta</legend>
          <FieldShell
            id={ids.mode}
            label="Povezivanje sa profilom"
            hint={
              role === "agent"
                ? "Agent vidi samo nekretnine, upite i razgledanja svog profila."
                : "Opciono: menadžer ili administrator koji i sam prodaje."
            }
          >
            <NativeSelect
              id={ids.mode}
              value={mode}
              onChange={(event) => {
                const next = modes.find((item) => item === event.target.value);
                if (next !== undefined) setMode(next);
                setErrors((current) => ({ ...current, agent: undefined }));
              }}
              aria-describedby={describedBy(ids.mode, true, false)}
              data-testid="invite-agent-mode"
            >
              {modes.map((item) => (
                <option key={item} value={item} disabled={item === "existing" && freeProfiles.length === 0}>
                  {MODE_LABEL[item]}
                  {item === "existing" && freeProfiles.length === 0 ? " (nema slobodnih)" : ""}
                </option>
              ))}
            </NativeSelect>
          </FieldShell>

          {mode === "new" ? (
            <FieldShell
              id={ids.agent}
              label="Ime na javnom profilu"
              hint="Profil se pravi skriven sa sajta. Fotografiju, biografiju i kontakte dopunite u kartici Profili agenata."
              error={errors.agent}
            >
              <Input
                id={ids.agent}
                autoComplete="off"
                value={agentName}
                maxLength={80}
                placeholder={name.trim().length > 0 ? name.trim() : "Isto kao ime i prezime"}
                onChange={(event) => setAgentName(event.target.value)}
                aria-invalid={errors.agent !== undefined || undefined}
                aria-describedby={describedBy(ids.agent, true, errors.agent !== undefined)}
                data-testid="invite-agent-name"
              />
            </FieldShell>
          ) : null}

          {mode === "existing" ? (
            <FieldShell
              id={ids.agent}
              label="Profil"
              hint="Samo profili koji još nisu povezani sa nalogom."
              error={errors.agent}
            >
              <NativeSelect
                id={ids.agent}
                value={agentId}
                onChange={(event) => setAgentId(event.target.value)}
                aria-invalid={errors.agent !== undefined || undefined}
                aria-describedby={describedBy(ids.agent, true, errors.agent !== undefined)}
                data-testid="invite-agent-id"
              >
                <option value="">Izaberite profil…</option>
                {freeProfiles.map((agent) => (
                  <option key={agent._id} value={agent._id}>
                    {agent.name}
                    {agent.isDemo ? " (demo)" : ""}
                  </option>
                ))}
              </NativeSelect>
            </FieldShell>
          ) : null}
        </fieldset>
      ) : null}

      <p className="flex gap-2 rounded-lg bg-muted/60 p-3 text-xs leading-relaxed text-muted-foreground">
        <Info className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
        Slanje e-pošte iz panela još nije podešeno. Posle ovog koraka dobićete link koji šaljete
        sami. Link važi 7 dana i može se iskoristiti samo jednom.
      </p>

      <DialogFooter>
        <DialogClose asChild>
          <Button type="button" variant="outline" disabled={create.pending}>
            Otkaži
          </Button>
        </DialogClose>
        <Button type="submit" disabled={create.pending} data-testid="invite-submit">
          {create.pending ? <Loader2 className="animate-spin" aria-hidden="true" /> : null}
          Napravite pozivnicu
        </Button>
      </DialogFooter>
    </form>
  );
}
