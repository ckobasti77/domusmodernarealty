"use client";

import { useMutation, useQuery } from "convex/react";
import { CalendarPlus, CheckCheck, ExternalLink, Loader2, Mail, Phone, X } from "lucide-react";
import Link from "next/link";
import { useId, useState } from "react";
import { toast } from "sonner";
import { DetailSheet, FactList, SheetSection } from "@/components/admin/common/DetailSheet";
import { DotBadge, type DotTone } from "@/components/admin/common/StatusBadge";
import { useMutationAction } from "@/components/admin/common/useMutationAction";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import type { LeadStatus, ViewingStatus } from "@/convex/lib/validators";
import { formatDateTime, formatEur, formatEurPerM2, fromDateInput, toDateInput } from "@/lib/admin/format";
import { LEAD_SOURCE_LABEL, LEAD_STATUS_LABEL, LEAD_TYPE_LABEL, VIEWING_STATUS_LABEL } from "@/lib/admin/labels";
import { DemoTag, LeadStatusBadge, ResponseTimer } from "./cells";
import { answerRows, viewingLine } from "./detail-format";
import { LeadTimeline } from "./LeadTimeline";
import { LOCALE_LABEL, PIPELINE, STATUS_TONE, telHref, type LeadDetail, type LeadRow } from "./shared";

export type AgentChoice = { _id: Id<"agents">; name: string };

const NO_AGENT = "__none__";

/** E-mail and phone values read as links at rest, not only on hover. */
const VALUE_LINK =
  "text-primary underline decoration-primary/30 underline-offset-4 transition-colors duration-150 hover:decoration-primary";

const VIEWING_TONE: Record<ViewingStatus, DotTone> = {
  requested: "accent",
  confirmed: "strong",
  done: "success",
  cancelled: "muted",
  no_show: "muted",
};

/**
 * The lead detail (PRD B4), opened from the list or the board through `?id=`:
 * contact, listing, message and answers, consent, the response timer, stage,
 * assignment, next step, notes, viewings and the full timeline.
 */
export function LeadSheet({
  id,
  onClose,
  canManage,
  agents,
  now,
  onStatus,
}: {
  /** The raw `?id=`; the server answers `null` for an unknown id. */
  id: string | undefined;
  onClose: () => void;
  canManage: boolean;
  agents: readonly AgentChoice[] | undefined;
  now: number;
  onStatus: (lead: LeadRow, status: LeadStatus) => void;
}) {
  const data = useQuery(api.leadsAdmin.get, id === undefined ? "skip" : { id });
  const lead = data?.lead;
  const markResponded = useMutationAction(
    useMutation(api.leadsAdmin.markResponded),
    "Upit je označen kao odgovoren.",
  );

  return (
    <DetailSheet
      open={id !== undefined}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      testId="lead-sheet"
      width="lg"
      title={lead?.contactName ?? (data === null ? "Upit nije dostupan" : "Upit")}
      description={
        lead !== undefined
          ? `${LEAD_TYPE_LABEL[lead.type]} · primljen ${formatDateTime(lead.createdAt)}`
          : undefined
      }
      meta={
        lead !== undefined ? (
          <>
            <LeadStatusBadge status={lead.status} />
            <ResponseTimer createdAt={lead.createdAt} firstResponseAt={lead.firstResponseAt} now={now} long />
            {lead.isDemo ? <DemoTag /> : null}
          </>
        ) : undefined
      }
      footer={
        lead !== undefined ? (
          <>
            {lead.contactEmail !== undefined ? (
              <Button variant="outline" asChild>
                <a href={`mailto:${lead.contactEmail}`}>
                  <Mail aria-hidden="true" />
                  E-pošta
                </a>
              </Button>
            ) : null}
            {lead.contactPhone !== undefined ? (
              <Button variant="outline" asChild>
                <a href={telHref(lead.contactPhone)}>
                  <Phone aria-hidden="true" />
                  Pozovi
                </a>
              </Button>
            ) : null}
            {lead.firstResponseAt === undefined ? (
              <Button
                disabled={markResponded.pending}
                data-testid="lead-mark-responded"
                onClick={() => void markResponded.run({ id: lead._id })}
              >
                {markResponded.pending ? (
                  <Loader2 className="animate-spin" aria-hidden="true" />
                ) : (
                  <CheckCheck aria-hidden="true" />
                )}
                Označi kao odgovoreno
              </Button>
            ) : null}
          </>
        ) : undefined
      }
    >
      {data === undefined ? (
        <SheetSkeleton />
      ) : data === null ? (
        <p className="text-sm text-muted-foreground">
          Upit ne postoji ili nije dodeljen Vama. Proverite link ili se obratite menadžeru.
        </p>
      ) : (
        <LeadBody key={data.lead._id} data={data} canManage={canManage} agents={agents} onStatus={onStatus} />
      )}
    </DetailSheet>
  );
}

function LeadBody({
  data,
  canManage,
  agents,
  onStatus,
}: {
  data: LeadDetail;
  canManage: boolean;
  agents: readonly AgentChoice[] | undefined;
  onStatus: (lead: LeadRow, status: LeadStatus) => void;
}) {
  const { lead } = data;
  const answers = data.answers !== undefined ? answerRows(data.answers) : [];

  return (
    <div>
      <SheetSection title="Obrada">
        <div className="grid gap-4 sm:grid-cols-2">
          <StatusField lead={lead} onStatus={onStatus} />
          <AgentField lead={lead} canManage={canManage} agents={agents} />
          <NextActionField lead={lead} />
          {lead.status === "lost" && lead.lossReason !== undefined ? (
            <div className="grid gap-1.5 sm:col-span-2">
              <span className="text-sm font-medium">Razlog gubitka</span>
              <p className="text-sm text-muted-foreground">{lead.lossReason}</p>
            </div>
          ) : null}
        </div>
      </SheetSection>

      <SheetSection title="Kontakt">
        <FactList
          items={[
            {
              label: "Ime",
              value:
                canManage && !lead.contactAnonymized ? (
                  <Link href={`/admin/kontakti?id=${lead.contactId}`} className="font-medium underline-offset-4 hover:underline">
                    {lead.contactName}
                  </Link>
                ) : (
                  lead.contactName
                ),
            },
            {
              label: "E-pošta",
              value:
                lead.contactEmail !== undefined ? (
                  <a href={`mailto:${lead.contactEmail}`} className={VALUE_LINK}>
                    {lead.contactEmail}
                  </a>
                ) : (
                  "—"
                ),
            },
            {
              label: "Telefon",
              value:
                lead.contactPhone !== undefined ? (
                  <a href={telHref(lead.contactPhone)} className={`tabular-nums ${VALUE_LINK}`}>
                    {lead.contactPhone}
                  </a>
                ) : (
                  "—"
                ),
            },
            ...(lead.submittedPhone !== undefined
              ? [
                  {
                    label: "Telefon iz forme",
                    value: (
                      <span>
                        <a href={telHref(lead.submittedPhone)} className={`tabular-nums ${VALUE_LINK}`}>
                          {lead.submittedPhone}
                        </a>
                        <span className="block text-xs text-muted-foreground">
                          Upisan uz ovaj upit, nije potvrđen. Kontakt menjate samo Vi, ručno.
                        </span>
                      </span>
                    ),
                  },
                ]
              : []),
            { label: "Jezik upita", value: LOCALE_LABEL[lead.locale] },
            {
              label: "Izvor",
              value: [
                LEAD_SOURCE_LABEL[lead.source],
                data.utm?.source,
                data.utm?.campaign !== undefined ? `kampanja ${data.utm.campaign}` : undefined,
              ]
                .filter((item) => item !== undefined)
                .join(" · "),
            },
          ]}
        />
      </SheetSection>

      {lead.listingId !== undefined ? (
        <SheetSection title="Nekretnina">
          <Link
            href={`/admin/nekretnine/${lead.listingId}`}
            className="group flex items-start gap-2 rounded-md border p-3 transition-colors duration-150 outline-none hover:bg-muted/50 focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <span className="min-w-0 flex-1">
              <span className="block font-mono text-xs text-muted-foreground">{lead.listingRef ?? "—"}</span>
              <span className="mt-0.5 block text-sm font-medium">{lead.listingTitle ?? "Nekretnina"}</span>
            </span>
            <ExternalLink className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          </Link>
        </SheetSection>
      ) : null}

      {lead.message !== undefined || answers.length > 0 ? (
        <SheetSection title="Poruka i odgovori iz forme">
          {lead.message !== undefined ? (
            <blockquote className="mb-3 border-l-2 pl-3 text-sm whitespace-pre-wrap">{lead.message}</blockquote>
          ) : null}
          {answers.length > 0 ? <FactList items={answers} /> : null}
        </SheetSection>
      ) : null}

      {data.valuation !== undefined ? (
        <SheetSection title="Procena sa sajta">
          <FactList
            items={[
              {
                label: "Raspon",
                value: `${formatEur(data.valuation.low)} – ${formatEur(data.valuation.high)}`,
              },
              { label: "Sredina", value: formatEur(data.valuation.mid) },
              { label: "Cena po m²", value: formatEurPerM2(data.valuation.pricePerM2) },
              { label: "Osnova", value: data.valuation.basis },
            ]}
          />
        </SheetSection>
      ) : null}

      <SheetSection title="Saglasnost">
        <FactList
          items={[
            { label: "Obrada podataka", value: data.consent.privacy ? "Da" : "Ne" },
            { label: "Marketing", value: data.consent.marketing ? "Da" : "Ne" },
            { label: "Verzija teksta", value: <span className="font-mono text-xs">{data.consent.textVersion}</span> },
            { label: "Data", value: formatDateTime(data.consent.at) },
            { label: "Kanal", value: data.consent.channel ?? "—" },
          ]}
        />
      </SheetSection>

      {lead.listingId !== undefined || data.viewings.length > 0 ? (
        <SheetSection
          title="Razgledanja"
          actions={
            lead.listingId !== undefined ? (
              <Button variant="outline" size="sm" asChild>
                <Link href={`/admin/razgledanja?new=1&lead=${lead._id}`} data-testid="lead-book-viewing">
                  <CalendarPlus aria-hidden="true" />
                  Zakaži razgledanje
                </Link>
              </Button>
            ) : undefined
          }
        >
          {data.viewings.length === 0 ? (
            <p className="text-sm text-muted-foreground">Za ovaj upit još nema zakazanih razgledanja.</p>
          ) : (
            <ul className="divide-y rounded-md border">
              {data.viewings.map((viewing) => (
                <li key={viewing._id}>
                  <Link
                    href={`/admin/razgledanja?id=${viewing._id}`}
                    className="flex items-center justify-between gap-3 px-3 py-2 text-sm transition-colors duration-150 outline-none hover:bg-muted/50 focus-visible:ring-3 focus-visible:ring-ring/50"
                  >
                    <span className="tabular-nums">{viewingLine(viewing)}</span>
                    <DotBadge tone={VIEWING_TONE[viewing.status]}>{VIEWING_STATUS_LABEL[viewing.status]}</DotBadge>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </SheetSection>
      ) : null}

      <NotesSection leadId={lead._id} notes={data.notes} erased={lead.contactAnonymized} />

      <SheetSection title="Istorija">
        <LeadTimeline items={data.timeline} />
      </SheetSection>
    </div>
  );
}

function StatusField({ lead, onStatus }: { lead: LeadRow; onStatus: (lead: LeadRow, status: LeadStatus) => void }) {
  const id = useId();
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id}>Faza</Label>
      <Select
        value={lead.status}
        onValueChange={(value) => {
          const next = PIPELINE.find((status) => status === value);
          if (next !== undefined) onStatus(lead, next);
        }}
      >
        <SelectTrigger id={id} data-testid="lead-status-select" className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {PIPELINE.map((status) => (
            <SelectItem key={status} value={status}>
              <DotBadge tone={STATUS_TONE[status]}>{LEAD_STATUS_LABEL[status]}</DotBadge>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function AgentField({
  lead,
  canManage,
  agents,
}: {
  lead: LeadRow;
  canManage: boolean;
  agents: readonly AgentChoice[] | undefined;
}) {
  const id = useId();
  const assign = useMutationAction(useMutation(api.leadsAdmin.assign), "Agent je dodeljen.");
  if (!canManage) {
    return (
      <div className="grid gap-1.5">
        <span className="text-sm font-medium">Agent</span>
        <p className="flex h-8 items-center text-sm">{lead.agentName ?? "Bez agenta"}</p>
      </div>
    );
  }
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id}>Agent</Label>
      <Select
        value={lead.agentId ?? NO_AGENT}
        disabled={agents === undefined || assign.pending}
        onValueChange={async (value) => {
          const agentId = agents?.find((agent) => agent._id === value)?._id;
          if (value !== NO_AGENT && agentId === undefined) return;
          const result = await assign.run({ id: lead._id, ...(agentId !== undefined ? { agentId } : {}) });
          if (result !== undefined && result.clashedViewings > 0) {
            toast.warning(
              `Razgledanja u sukobu sa rasporedom novog agenta: ${result.clashedViewings}. Ostala su kod prethodnog agenta; zakažite ih ponovo.`,
            );
          }
        }}
      >
        <SelectTrigger id={id} data-testid="lead-agent-select" className="w-full">
          <SelectValue placeholder="Učitavanje…" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={NO_AGENT}>Bez agenta</SelectItem>
          {(agents ?? []).map((agent) => (
            <SelectItem key={agent._id} value={agent._id}>
              {agent.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function NextActionField({ lead }: { lead: LeadRow }) {
  const id = useId();
  const setNextAction = useMutationAction(useMutation(api.leadsAdmin.setNextAction), "Sledeći korak je sačuvan.");
  const server = toDateInput(lead.nextActionAt);
  const [value, setValue] = useState(server);
  const [synced, setSynced] = useState(server);
  if (server !== synced) {
    setSynced(server);
    setValue(server);
  }

  const save = (next: string) => {
    setValue(next);
    const at = next.length > 0 ? fromDateInput(next) : undefined;
    if (next.length > 0 && at === undefined) return;
    void setNextAction.run({ id: lead._id, ...(at !== undefined ? { nextActionAt: at } : {}) });
  };

  return (
    <div className="grid gap-1.5 sm:col-span-2">
      <Label htmlFor={id}>Sledeći korak</Label>
      <div className="flex items-center gap-2">
        <Input
          id={id}
          type="date"
          value={value}
          data-testid="lead-next-action"
          disabled={setNextAction.pending}
          onChange={(event) => save(event.target.value)}
          className="w-full sm:w-44"
          aria-describedby={`${id}-hint`}
        />
        {value.length > 0 ? (
          <Button variant="ghost" size="icon" aria-label="Uklonite datum sledećeg koraka" onClick={() => save("")}>
            <X aria-hidden="true" />
          </Button>
        ) : null}
      </div>
      <p id={`${id}-hint`} className="text-xs text-muted-foreground">
        Kada ponovo kontaktirate klijenta. Upit se tada ističe u listi.
      </p>
    </div>
  );
}

function NotesSection({
  leadId,
  notes,
  erased,
}: {
  leadId: Id<"leads">;
  notes: LeadDetail["notes"];
  /** The contact was anonymized: the server takes no new notes. */
  erased: boolean;
}) {
  const id = useId();
  const [body, setBody] = useState("");
  const addNote = useMutationAction(useMutation(api.leadsAdmin.addNote), "Beleška je dodata.");

  return (
    <SheetSection title="Beleške">
      {erased ? (
        <p className="text-sm text-muted-foreground">
          Kontakt je anonimizovan: beleške su obrisane i nove se ne beleže.
        </p>
      ) : (
        <form
          className="grid gap-2"
          onSubmit={async (event) => {
            event.preventDefault();
            if (body.trim().length === 0) return;
            const result = await addNote.run({ id: leadId, body });
            if (result !== undefined) setBody("");
          }}
        >
          <Label htmlFor={id} className="sr-only">
            Nova beleška
          </Label>
          <Textarea
            id={id}
            data-testid="lead-note-input"
            value={body}
            maxLength={4000}
            rows={3}
            placeholder="Šta je dogovoreno, šta klijent traži, kada se javljate…"
            onChange={(event) => setBody(event.target.value)}
          />
          <div className="flex justify-end">
            <Button
              type="submit"
              size="sm"
              disabled={addNote.pending || body.trim().length === 0}
              data-testid="lead-note-submit"
            >
              {addNote.pending ? <Loader2 className="animate-spin" aria-hidden="true" /> : null}
              Dodaj belešku
            </Button>
          </div>
        </form>
      )}
      {notes.length > 0 ? (
        <ul className="mt-4 space-y-3">
          {notes.map((note) => (
            <li key={note._id} className="rounded-md bg-muted/50 px-3 py-2">
              <p className="text-sm whitespace-pre-wrap">{note.body}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {note.authorName ?? "Član tima"} · {formatDateTime(note.at)}
              </p>
            </li>
          ))}
        </ul>
      ) : erased ? null : (
        <p className="mt-3 text-sm text-muted-foreground">Još nema beleški.</p>
      )}
    </SheetSection>
  );
}

function SheetSkeleton() {
  return (
    <div aria-busy="true" aria-label="Upit se učitava" className="space-y-4">
      <Skeleton className="h-8 w-full" />
      <Skeleton className="h-24 w-full" />
      <Skeleton className="h-16 w-full" />
      <Skeleton className="h-32 w-full" />
    </div>
  );
}
