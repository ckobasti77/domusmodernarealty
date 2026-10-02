"use client";

import { useMutation, useQuery } from "convex/react";
import { CopyPlus, Loader2, Plus, X } from "lucide-react";
import { useEffect, useId, useState } from "react";
import { useLeaveGuard } from "@/components/admin/common/LeaveGuard";
import { useMutationAction } from "@/components/admin/common/useMutationAction";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { BOOKING_LEAD_MS } from "@/convex/lib/belgradeTime";
import { WEEKDAYS_MON_FIRST } from "@/lib/admin/labels";
import { cn } from "@/lib/utils";
import {
  DAY_MS,
  dayKeyOfWall,
  formatHm,
  hmOfMinutes,
  instantOf,
  longDayLabel,
  minutesOfHm,
  wallMidnightOf,
} from "./time";
import type { AgentOption } from "./types";

/** `agentsAdmin.setAvailability` keeps 40 ranges; five a day stays under it. */
const MAX_RANGES_PER_DAY = 5;
const STEP_MIN = 15;
/** One web booking is one hour on the agent's grid (`VIEWING_SLOT_MS`). */
const SLOT_MIN = 60;
const PREVIEW_DAYS = 7;
const WORKDAYS = [2, 3, 4, 5] as const;

type Range = { key: number; from: string; to: string };
type Week = Record<number, Range[]>;
type Check = { error?: string; warning?: string };

let nextKey = 0;
function range(from: string, to: string): Range {
  nextKey += 1;
  return { key: nextKey, from, to };
}

function weekOf(availability: AgentOption["availability"]): Week {
  const week: Week = {};
  for (const { weekday } of WEEKDAYS_MON_FIRST) week[weekday] = [];
  for (const slot of availability) {
    week[slot.weekday]?.push(range(normalize(slot.from), normalize(slot.to)));
  }
  for (const { weekday } of WEEKDAYS_MON_FIRST) {
    week[weekday].sort((a, b) => a.from.localeCompare(b.from));
  }
  return week;
}

/** `9:00` → `09:00`; anything unparsable is kept as typed so it shows as an error. */
function normalize(value: string): string {
  const minutes = minutesOfHm(value);
  return minutes === null ? value : hmOfMinutes(minutes);
}

type Slot = AgentOption["availability"][number];

/** Monday first, each day by start time, times zero-padded: the saved form. */
function sortSlots(slots: Slot[]): Slot[] {
  const order = new Map(WEEKDAYS_MON_FIRST.map(({ weekday }, index) => [weekday, index]));
  return slots
    .map((slot) => ({ weekday: slot.weekday, from: normalize(slot.from), to: normalize(slot.to) }))
    .sort(
      (a, b) =>
        (order.get(a.weekday) ?? 7) - (order.get(b.weekday) ?? 7) || a.from.localeCompare(b.from),
    );
}

function slotsOf(week: Week): Slot[] {
  return sortSlots(
    WEEKDAYS_MON_FIRST.flatMap(({ weekday }) =>
      week[weekday].map((item) => ({ weekday, from: item.from, to: item.to })),
    ),
  );
}

/** Compares a form with the saved hours, ignoring order and zero-padding. */
function signature(slots: Slot[]): string {
  return JSON.stringify(sortSlots(slots));
}

/** Validates one day's ranges: format, 15-minute steps, start before end, no overlaps. */
function checkDay(ranges: Range[]): Map<number, Check> {
  const out = new Map<number, Check>();
  const valid: { key: number; from: number; to: number }[] = [];
  for (const item of ranges) {
    const from = minutesOfHm(item.from);
    const to = minutesOfHm(item.to);
    if (from === null || to === null) {
      out.set(item.key, { error: "Unesite početak i kraj (SS:MM)." });
    } else if (from % STEP_MIN !== 0 || to % STEP_MIN !== 0) {
      out.set(item.key, { error: "Vreme se unosi u koracima od 15 minuta." });
    } else if (from >= to) {
      out.set(item.key, { error: "Kraj mora biti posle početka." });
    } else {
      valid.push({ key: item.key, from, to });
      const length = to - from;
      if (length < SLOT_MIN) {
        out.set(item.key, { warning: "Kraće od sat vremena: sajt ovde ne nudi nijedan termin." });
      } else if (length % SLOT_MIN !== 0) {
        out.set(item.key, {
          warning: `Poslednjih ${length % SLOT_MIN} min ostaje neiskorišćeno: termini traju po sat vremena.`,
        });
      }
    }
  }
  valid.sort((a, b) => a.from - b.from);
  // The furthest end so far, so a range nested in a long one is caught too.
  let reach = Number.NEGATIVE_INFINITY;
  for (const item of valid) {
    if (item.from < reach) {
      out.set(item.key, { error: "Preklapa se sa drugim terminom tog dana." });
    }
    reach = Math.max(reach, item.to);
  }
  return out;
}

/**
 * Weekly viewing hours of one agent (PRD B5), saved through
 * `agentsAdmin.setAvailability`. Agents edit their own; admin and manager
 * pick the agent. Below the form, the next seven days as the public booking
 * widget offers them (`agents.slots`, the saved hours minus booked viewings).
 */
export function AvailabilityEditor({
  agents,
  requestedAgent,
  canManage,
  ownAgentId,
  now,
  onAgentChange,
}: {
  agents: AgentOption[] | undefined;
  /** `?agent=` (admin/manager only). */
  requestedAgent: string | undefined;
  canManage: boolean;
  ownAgentId: Id<"agents"> | undefined;
  now: number;
  onAgentChange: (id: string) => void;
}) {
  const selectId = useId();
  const [dirty, setDirty] = useState(false);

  if (agents === undefined) {
    return (
      <div className="space-y-3" data-testid="availability-editor" aria-busy="true">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-80 w-full rounded-xl" />
      </div>
    );
  }

  const agentId = canManage
    ? (agents.find((agent) => agent._id === requestedAgent)?._id ?? ownAgentId ?? agents[0]?._id)
    : ownAgentId;
  const agent = agents.find((item) => item._id === agentId);

  return (
    <div className="space-y-4" data-testid="availability-editor">
      <p className="max-w-3xl text-sm text-muted-foreground">
        Ovi termini pune widget za zakazivanje na stranicama nekretnina: posetioci biraju jednočasovne termine
        unutar njih, u beogradskom vremenu.
      </p>

      {canManage ? (
        <div className="flex flex-col gap-1">
          <label htmlFor={selectId} className="text-xs text-muted-foreground">
            Agent
          </label>
          <Select value={agent?._id ?? ""} onValueChange={onAgentChange} disabled={dirty}>
            <SelectTrigger id={selectId} className="w-full sm:w-72" aria-describedby={dirty ? `${selectId}-hint` : undefined}>
              <SelectValue placeholder="Izaberite agenta" />
            </SelectTrigger>
            <SelectContent>
              {agents.map((item) => (
                <SelectItem key={item._id} value={item._id}>
                  {item.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {dirty ? (
            <p id={`${selectId}-hint`} className="text-xs text-muted-foreground">
              Sačuvajte ili poništite izmene pre promene agenta.
            </p>
          ) : null}
        </div>
      ) : null}

      {agent === undefined ? (
        <p className="rounded-xl border border-dashed px-4 py-10 text-center text-sm text-muted-foreground">
          {canManage
            ? "Još nema agenata. Dodajte ih u delu Tim."
            : "Vaš nalog nije povezan sa profilom agenta. Obratite se administratoru."}
        </p>
      ) : (
        <>
          <WeekForm key={agent._id} agent={agent} onDirtyChange={setDirty} />
          <PublicPreview agent={agent} now={now} />
        </>
      )}
    </div>
  );
}

function WeekForm({ agent, onDirtyChange }: { agent: AgentOption; onDirtyChange: (dirty: boolean) => void }) {
  const serverSignature = signature(agent.availability);
  const [saved, setSaved] = useState(serverSignature);
  const [week, setWeek] = useState<Week>(() => weekOf(agent.availability));
  const save = useMutationAction(useMutation(api.agentsAdmin.setAvailability), "Radno vreme je sačuvano.");

  const current = signature(slotsOf(week));
  const dirty = current !== serverSignature;
  // A save from elsewhere (another tab, a colleague) replaces an untouched form.
  if (serverSignature !== saved) {
    if (current === saved) setWeek(weekOf(agent.availability));
    setSaved(serverSignature);
  }

  useEffect(() => {
    onDirtyChange(dirty);
  }, [dirty, onDirtyChange]);
  useEffect(() => () => onDirtyChange(false), [onDirtyChange]);
  useLeaveGuard({ dirty, description: "Radno vreme još nije sačuvano. Ako sada napustite stranicu, izmene će biti izgubljene." });

  const checks = new Map<number, Check>();
  for (const { weekday } of WEEKDAYS_MON_FIRST) {
    for (const [key, check] of checkDay(week[weekday])) checks.set(key, check);
  }
  const errorCount = [...checks.values()].filter((check) => check.error !== undefined).length;

  const update = (weekday: number, ranges: Range[]) => setWeek((prev) => ({ ...prev, [weekday]: ranges }));

  const addRange = (weekday: number) => {
    const ranges = week[weekday];
    const last = ranges.length > 0 ? minutesOfHm(ranges[ranges.length - 1].to) : null;
    const from = last !== null && last <= 22 * 60 ? last : 9 * 60;
    const to = Math.min(from + 2 * SLOT_MIN, 23 * 60 + 45);
    update(weekday, [...ranges, range(hmOfMinutes(from), hmOfMinutes(to))]);
  };

  const copyMondayToWorkdays = () =>
    setWeek((prev) => {
      const next = { ...prev };
      for (const weekday of WORKDAYS) {
        next[weekday] = prev[1].map((item) => range(item.from, item.to));
      }
      return next;
    });

  return (
    <form
      className="rounded-xl border bg-card"
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        if (!dirty || errorCount > 0) return;
        void save.run({ id: agent._id, availability: slotsOf(week) });
      }}
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3">
        <h2 className="text-sm font-semibold">Nedeljno radno vreme za razgledanja</h2>
        <Button
          type="button"
          variant="ghost"
          onClick={copyMondayToWorkdays}
          disabled={week[1].length === 0}
          title="Utorak–petak dobijaju iste termine kao ponedeljak"
        >
          <CopyPlus aria-hidden="true" />
          Ponedeljak na utorak–petak
        </Button>
      </div>

      <ul className="divide-y">
        {WEEKDAYS_MON_FIRST.map(({ weekday, label }) => {
          const ranges = week[weekday];
          return (
            <li key={weekday} className="grid gap-2 px-4 py-3 md:grid-cols-[9rem_1fr_auto] md:items-start">
              <p className="pt-1.5 text-sm font-medium" id={`avail-day-${weekday}`}>
                {label}
              </p>
              <div className="space-y-2" role="group" aria-labelledby={`avail-day-${weekday}`}>
                {ranges.length === 0 ? (
                  <p className="pt-1.5 text-sm text-muted-foreground">Bez termina</p>
                ) : (
                  ranges.map((item, index) => {
                    const check = checks.get(item.key);
                    const messageId = `avail-${item.key}-msg`;
                    const invalid = check?.error !== undefined;
                    return (
                      <div key={item.key}>
                        <div className="flex items-center gap-2">
                          <Input
                            type="time"
                            step={STEP_MIN * 60}
                            value={item.from}
                            aria-label={`${label}, termin ${index + 1}: od`}
                            aria-invalid={invalid || undefined}
                            aria-describedby={check !== undefined ? messageId : undefined}
                            className="w-32"
                            onChange={(event) =>
                              update(
                                weekday,
                                ranges.map((other) => (other.key === item.key ? { ...other, from: event.target.value } : other)),
                              )
                            }
                          />
                          <span aria-hidden="true" className="text-muted-foreground">
                            –
                          </span>
                          <Input
                            type="time"
                            step={STEP_MIN * 60}
                            value={item.to}
                            aria-label={`${label}, termin ${index + 1}: do`}
                            aria-invalid={invalid || undefined}
                            aria-describedby={check !== undefined ? messageId : undefined}
                            className="w-32"
                            onChange={(event) =>
                              update(
                                weekday,
                                ranges.map((other) => (other.key === item.key ? { ...other, to: event.target.value } : other)),
                              )
                            }
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            aria-label={`Uklonite ${label.toLowerCase()}, termin ${index + 1}`}
                            onClick={() => update(weekday, ranges.filter((other) => other.key !== item.key))}
                          >
                            <X aria-hidden="true" />
                          </Button>
                        </div>
                        {check !== undefined ? (
                          <p
                            id={messageId}
                            className={cn(
                              "mt-1 text-xs",
                              invalid ? "font-medium text-destructive" : "text-muted-foreground",
                            )}
                          >
                            {check.error ?? check.warning}
                          </p>
                        ) : null}
                      </div>
                    );
                  })
                )}
              </div>
              <Button
                type="button"
                variant="outline"
                className="justify-self-start"
                disabled={ranges.length >= MAX_RANGES_PER_DAY}
                onClick={() => addRange(weekday)}
                aria-label={`Dodajte termin: ${label.toLowerCase()}`}
              >
                <Plus aria-hidden="true" />
                Dodaj
              </Button>
            </li>
          );
        })}
      </ul>

      <div className="flex flex-wrap items-center justify-end gap-2 border-t px-4 py-3">
        <p className="mr-auto text-xs text-muted-foreground" aria-live="polite">
          {save.pending
            ? "Čuvanje…"
            : errorCount > 0
              ? `Ispravite ${errorCount === 1 ? "označeni termin" : "označene termine"} pre čuvanja.`
              : dirty
                ? "Imate nesačuvane izmene."
                : "Sve izmene su sačuvane."}
        </p>
        <Button type="button" variant="ghost" disabled={!dirty || save.pending} onClick={() => setWeek(weekOf(agent.availability))}>
          Poništi izmene
        </Button>
        <Button type="submit" disabled={!dirty || errorCount > 0 || save.pending} data-testid="availability-save">
          {save.pending ? <Loader2 className="animate-spin" aria-hidden="true" /> : null}
          Sačuvaj radno vreme
        </Button>
      </div>
    </form>
  );
}

/** The next seven days as the public widget shows them, from the SAVED hours. */
function PublicPreview({ agent, now }: { agent: AgentOption; now: number }) {
  const todayWall = wallMidnightOf(now);
  const slots = useQuery(api.agents.slots, {
    agentId: agent._id,
    fromDay: instantOf(todayWall),
    days: PREVIEW_DAYS,
  });

  const days = Array.from({ length: PREVIEW_DAYS }, (_, index) => {
    const wall = todayWall + index * DAY_MS;
    const key = dayKeyOfWall(wall);
    const items = (slots ?? []).filter(
      (slot) => slot.start >= now + BOOKING_LEAD_MS && dayKeyOfWall(wallMidnightOf(slot.start)) === key,
    );
    return { key, wall, items };
  });

  return (
    <section aria-labelledby="avail-preview" className="rounded-xl border bg-card">
      <div className="border-b px-4 py-3">
        <h2 id="avail-preview" className="text-sm font-semibold">
          Šta posetioci vide narednih 7 dana
        </h2>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Sačuvano radno vreme, bez već zakazanih razgledanja i termina kraćih od dva sata unapred.
        </p>
      </div>
      {!agent.isPublic ? (
        <p className="px-4 py-6 text-sm text-muted-foreground">
          Profil agenta {agent.name} nije javan, pa sajt ne nudi termine za razgledanje njegovih nekretnina.
        </p>
      ) : slots === undefined ? (
        <div className="space-y-2 p-4" aria-busy="true">
          <Skeleton className="h-6 w-full" />
          <Skeleton className="h-6 w-full" />
          <Skeleton className="h-6 w-2/3" />
        </div>
      ) : (
        <ul className="divide-y">
          {days.map((day) => (
            <li key={day.key} className="grid gap-2 px-4 py-2.5 sm:grid-cols-[14rem_1fr] sm:items-center">
              <span className="text-sm">{longDayLabel(day.wall)}</span>
              {day.items.length === 0 ? (
                <span className="text-sm text-muted-foreground">Nema slobodnih termina</span>
              ) : (
                <ul className="flex flex-wrap gap-1.5" aria-label={`Termini: ${longDayLabel(day.wall)}`}>
                  {day.items.map((slot) => (
                    <li
                      key={slot.start}
                      className={cn(
                        "rounded-md border px-2 py-0.5 text-xs tabular-nums",
                        slot.taken ? "border-dashed text-muted-foreground line-through" : "bg-muted/60",
                      )}
                    >
                      {formatHm(slot.start)}
                      {slot.taken ? <span className="sr-only"> (zauzeto)</span> : null}
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
