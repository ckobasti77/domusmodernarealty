"use client";

import { useMutation, useQuery } from "convex/react";
import { Loader2, X } from "lucide-react";
import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { describedBy, FieldShell } from "@/components/admin/common/form";
import { useMutationAction } from "@/components/admin/common/useMutationAction";
import { formatDuration } from "@/components/admin/dashboard/format";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import type { ViewingMode } from "@/convex/lib/validators";
import { LEAD_STATUS_LABEL, VIEWING_MODE_LABEL } from "@/lib/admin/labels";
import { instantOfDayAndTime, MINUTE_MS, minutesOfHm } from "./time";
import type { AgentOption } from "./types";

const DURATIONS = [30, 45, 60, 90, 120, 180] as const;
const NO_LEAD = "__none__";
const SEARCH_DEBOUNCE_MS = 250;

type PickedListing = { _id: Id<"listings">; ref: string; title: string };
type Errors = Partial<Record<"listing" | "agent" | "date" | "time", string>>;

function useDebounced<T>(value: T, ms: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), ms);
    return () => window.clearTimeout(timer);
  }, [value, ms]);
  return debounced;
}

/** Moves focus between the result buttons with the arrow keys. */
function moveFocus(event: KeyboardEvent<HTMLElement>, list: HTMLElement | null) {
  if (list === null || (event.key !== "ArrowDown" && event.key !== "ArrowUp")) return;
  const buttons = Array.from(list.querySelectorAll("button"));
  if (buttons.length === 0) return;
  event.preventDefault();
  const current = buttons.findIndex((button) => button === document.activeElement);
  const next =
    event.key === "ArrowDown"
      ? Math.min(current + 1, buttons.length - 1)
      : current <= 0
        ? -1
        : current - 1;
  if (next === -1) {
    list.parentElement?.querySelector("input")?.focus();
    return;
  }
  buttons[next].focus();
}

/**
 * "Novo razgledanje": a phone booking or walk-in entered by the office
 * (`viewingsAdmin.create`, confirmed at once). The listing is found by
 * reference or title (`listingsAdmin.quickFind`); an open lead on that listing
 * can be attached so the client's contact travels with the viewing. Opened
 * from a lead as `?new=1&lead=<id>`, it starts prefilled.
 */
export function NewViewingDialog({
  open,
  onOpenChange,
  leadParam,
  defaultDate,
  canManage,
  ownAgentId,
  agents,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  leadParam: string | undefined;
  /** `YYYY-MM-DD` the dialog starts on (the day in view, or today). */
  defaultDate: string;
  canManage: boolean;
  /** The signed-in agent's profile; an agent books only for themselves. */
  ownAgentId: Id<"agents"> | undefined;
  agents: AgentOption[] | undefined;
  onCreated: (id: Id<"viewings">, dateKey: string) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="max-h-[calc(100svh-2rem)] overflow-y-auto sm:max-w-lg"
        data-testid="new-viewing-dialog"
      >
        <DialogHeader>
          <DialogTitle>Novo razgledanje</DialogTitle>
          <DialogDescription>
            Termin dogovoren telefonom ili u agenciji. Upisuje se kao potvrđen; vreme je beogradsko.
          </DialogDescription>
        </DialogHeader>
        {open ? (
          !canManage && ownAgentId === undefined ? (
            <p className="text-sm text-muted-foreground">
              Vaš nalog nije povezan sa profilom agenta, pa ne možete zakazivati razgledanja. Obratite se administratoru.
            </p>
          ) : (
            <NewViewingForm
              leadParam={leadParam}
              defaultDate={defaultDate}
              canManage={canManage}
              ownAgentId={ownAgentId}
              agents={agents}
              onCancel={() => onOpenChange(false)}
              onCreated={onCreated}
            />
          )
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function NewViewingForm({
  leadParam,
  defaultDate,
  canManage,
  ownAgentId,
  agents,
  onCancel,
  onCreated,
}: {
  leadParam: string | undefined;
  defaultDate: string;
  canManage: boolean;
  ownAgentId: Id<"agents"> | undefined;
  agents: AgentOption[] | undefined;
  onCancel: () => void;
  onCreated: (id: Id<"viewings">, dateKey: string) => void;
}) {
  const [listing, setListing] = useState<PickedListing | null>(null);
  const [search, setSearch] = useState("");
  const [leadId, setLeadId] = useState<string>(NO_LEAD);
  const [agentChoice, setAgentChoice] = useState<Id<"agents"> | undefined>(undefined);
  const [date, setDate] = useState(defaultDate);
  const [time, setTime] = useState("10:00");
  const [duration, setDuration] = useState<number>(60);
  const [mode, setMode] = useState<ViewingMode>("in_person");
  const [errors, setErrors] = useState<Errors>({});
  const [prefilled, setPrefilled] = useState(false);
  const resultsRef = useRef<HTMLUListElement>(null);

  const q = useDebounced(search.trim(), SEARCH_DEBOUNCE_MS);
  const hits = useQuery(api.listingsAdmin.quickFind, listing === null && q.length > 0 ? { q } : "skip");
  const context = useQuery(api.viewingsAdmin.bookingContext, listing !== null ? { listingId: listing._id } : "skip");
  const lead = useQuery(api.viewingsAdmin.leadForBooking, leadParam !== undefined ? { id: leadParam } : "skip");
  const create = useMutationAction(useMutation(api.viewingsAdmin.create), "Razgledanje je zakazano.");

  // `?lead=` prefill, once: the lead's listing, the lead itself and its agent.
  if (!prefilled && lead !== undefined) {
    setPrefilled(true);
    if (lead !== null) {
      setLeadId(lead._id);
      if (lead.listingId !== undefined) {
        setListing({ _id: lead.listingId, ref: lead.listingRef ?? "", title: lead.listingTitleSr ?? "" });
      }
      if (lead.agentId !== undefined) setAgentChoice(lead.agentId);
    }
  }

  // The listing's own agent until the user picks someone else.
  const agentId = canManage ? (agentChoice ?? context?.listingAgentId) : ownAgentId;
  const leadOptions = [
    ...(lead !== undefined && lead !== null && !context?.leads.some((item) => item._id === lead._id)
      ? [{ _id: lead._id, label: lead.contactName }]
      : []),
    ...(context?.leads ?? []).map((item) => ({
      _id: item._id,
      label: `${item.contactName} · ${LEAD_STATUS_LABEL[item.status]}`,
    })),
  ];

  const submit = async () => {
    const next: Errors = {};
    if (listing === null) next.listing = "Izaberite nekretninu.";
    if (agentId === undefined) next.agent = "Izaberite agenta.";
    const minutes = minutesOfHm(time);
    if (minutes === null) next.time = "Unesite vreme u formatu SS:MM.";
    else if (minutes % 15 !== 0) next.time = "Vreme se unosi u koracima od 15 minuta.";
    const start = instantOfDayAndTime(date, time);
    if (start === null && next.time === undefined) next.date = "Unesite ispravan datum.";
    setErrors(next);
    if (Object.keys(next).length > 0 || listing === null || agentId === undefined || start === null) return;

    const attached = leadOptions.find((option) => option._id === leadId)?._id;
    const result = await create.run({
      listingId: listing._id,
      agentId,
      ...(attached !== undefined ? { leadId: attached } : {}),
      start,
      end: start + duration * MINUTE_MS,
      mode,
    });
    if (result !== undefined) onCreated(result.id, date);
  };

  return (
    <form
      className="grid gap-4"
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
    >
      <FieldShell
        id="nv-listing"
        label="Nekretnina"
        hint={listing === null ? "Pretražite po šifri (npr. ME-2031) ili nazivu." : undefined}
        error={errors.listing}
      >
        {listing !== null ? (
          <div className="flex items-center gap-2 rounded-lg border px-3 py-2">
            <span className="min-w-0 flex-1 text-sm">
              <span className="block font-mono text-xs text-muted-foreground">{listing.ref}</span>
              <span className="block truncate">{listing.title}</span>
            </span>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="Promenite nekretninu"
              onClick={() => {
                setListing(null);
                setLeadId(NO_LEAD);
                setAgentChoice(undefined);
              }}
            >
              <X aria-hidden="true" />
            </Button>
          </div>
        ) : (
          <div>
            <Input
              id="nv-listing"
              type="search"
              autoComplete="off"
              value={search}
              placeholder="Šifra ili naziv"
              aria-invalid={errors.listing !== undefined || undefined}
              aria-describedby={describedBy("nv-listing", true, errors.listing !== undefined)}
              onChange={(event) => setSearch(event.target.value)}
              onKeyDown={(event) => moveFocus(event, resultsRef.current)}
            />
            <p className="sr-only" aria-live="polite">
              {q.length > 0 && hits !== undefined ? `Pronađeno: ${hits.length}` : ""}
            </p>
            {q.length > 0 && hits !== undefined ? (
              hits.length === 0 ? (
                <p className="mt-2 text-sm text-muted-foreground">Nijedna nekretnina ne odgovara pretrazi.</p>
              ) : (
                <ul
                  ref={resultsRef}
                  aria-label="Rezultati pretrage"
                  className="mt-2 max-h-56 divide-y overflow-y-auto rounded-lg border"
                  onKeyDown={(event) => moveFocus(event, resultsRef.current)}
                >
                  {hits.map((hit) => (
                    <li key={hit._id}>
                      <button
                        type="button"
                        className="flex min-h-11 w-full flex-col px-3 py-2 text-left text-sm outline-none hover:bg-muted/60 focus-visible:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:ring-inset"
                        onClick={() => {
                          setListing({ _id: hit._id, ref: hit.ref, title: hit.title });
                          setSearch("");
                          setErrors((current) => ({ ...current, listing: undefined }));
                        }}
                      >
                        <span className="font-mono text-xs text-muted-foreground">{hit.ref}</span>
                        <span className="truncate">{hit.title}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )
            ) : null}
          </div>
        )}
      </FieldShell>

      <FieldShell
        id="nv-lead"
        label="Upit (opciono)"
        hint={
          listing === null
            ? "Otvoreni upiti se nude kada izaberete nekretninu."
            : "Povezani upit donosi ime i telefon klijenta u razgledanje."
        }
      >
        <Select value={leadId} onValueChange={setLeadId} disabled={listing === null && leadOptions.length === 0}>
          <SelectTrigger id="nv-lead" className="w-full" aria-describedby={describedBy("nv-lead", true, false)}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NO_LEAD}>Bez upita</SelectItem>
            {leadOptions.map((option) => (
              <SelectItem key={option._id} value={option._id}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FieldShell>

      {canManage ? (
        <FieldShell id="nv-agent" label="Agent" error={errors.agent}>
          <Select
            value={agentId ?? ""}
            onValueChange={(value) => setAgentChoice(agents?.find((agent) => agent._id === value)?._id)}
          >
            <SelectTrigger
              id="nv-agent"
              className="w-full"
              aria-invalid={errors.agent !== undefined || undefined}
              aria-describedby={describedBy("nv-agent", false, errors.agent !== undefined)}
            >
              <SelectValue placeholder={agents === undefined ? "Učitavanje…" : "Izaberite agenta"} />
            </SelectTrigger>
            <SelectContent>
              {(agents ?? []).map((agent) => (
                <SelectItem key={agent._id} value={agent._id}>
                  {agent.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FieldShell>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-3">
        <FieldShell id="nv-date" label="Datum" error={errors.date}>
          <Input
            id="nv-date"
            type="date"
            value={date}
            required
            aria-invalid={errors.date !== undefined || undefined}
            aria-describedby={describedBy("nv-date", false, errors.date !== undefined)}
            onChange={(event) => setDate(event.target.value)}
          />
        </FieldShell>
        <FieldShell id="nv-time" label="Početak" error={errors.time}>
          <Input
            id="nv-time"
            type="time"
            step={15 * 60}
            value={time}
            required
            aria-invalid={errors.time !== undefined || undefined}
            aria-describedby={describedBy("nv-time", false, errors.time !== undefined)}
            onChange={(event) => setTime(event.target.value)}
          />
        </FieldShell>
        <FieldShell id="nv-duration" label="Trajanje">
          <Select value={String(duration)} onValueChange={(value) => setDuration(Number(value))}>
            <SelectTrigger id="nv-duration" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DURATIONS.map((minutes) => (
                <SelectItem key={minutes} value={String(minutes)}>
                  {formatDuration(minutes)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FieldShell>
      </div>

      <fieldset className="grid gap-2">
        <legend className="mb-1.5 text-sm leading-snug font-medium">Način</legend>
        <RadioGroup
          value={mode}
          onValueChange={(value) => setMode(value === "video" ? "video" : "in_person")}
          className="flex flex-wrap gap-x-6 gap-y-2"
        >
          {(["in_person", "video"] as const).map((value) => (
            <div key={value} className="flex min-h-11 items-center gap-2 md:min-h-0">
              <RadioGroupItem id={`nv-mode-${value}`} value={value} />
              <Label htmlFor={`nv-mode-${value}`} className="font-normal">
                {VIEWING_MODE_LABEL[value]}
              </Label>
            </div>
          ))}
        </RadioGroup>
      </fieldset>

      <DialogFooter className="mt-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          Odustani
        </Button>
        <Button type="submit" disabled={create.pending} data-testid="new-viewing-submit">
          {create.pending ? <Loader2 className="animate-spin" aria-hidden="true" /> : null}
          Zakaži razgledanje
        </Button>
      </DialogFooter>
    </form>
  );
}
