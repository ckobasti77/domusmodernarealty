"use client";

import { useMutation, useQuery } from "convex/react";
import { ArrowUpRight, Loader2 } from "lucide-react";
import Link from "next/link";
import { useId, useState } from "react";
import { DetailSheet, FactList, SheetSection } from "@/components/admin/common/DetailSheet";
import { useMutationAction } from "@/components/admin/common/useMutationAction";
import { formatDuration } from "@/components/admin/dashboard/format";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import type { ViewingStatus } from "@/convex/lib/validators";
import { formatDateTime } from "@/lib/admin/format";
import { VIEWING_MODE_LABEL, VIEWING_STATUS_LABEL } from "@/lib/admin/labels";
import { VIEWING_STATUS_ORDER, ViewingStatusBadge } from "./status";
import { formatSpan, longDayLabel, MINUTE_MS, wallMidnightOf } from "./time";
import type { ViewingDetail } from "./types";

const FEEDBACK_MAX = 4000;
const OUTCOMES: readonly ViewingStatus[] = ["done", "no_show"];

/**
 * One viewing (`?id=`): when and where, who comes, the status workflow and the
 * post-viewing notes. Loads by id, so a link from a lead or the dashboard
 * opens it even outside the week on screen.
 */
export function ViewingSheet({
  id,
  now,
  onClose,
}: {
  id: string | undefined;
  now: number;
  onClose: () => void;
}) {
  const detail = useQuery(api.viewingsAdmin.get, id !== undefined ? { id } : "skip");

  return (
    <DetailSheet
      open={id !== undefined}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title={detail ? `Razgledanje · ${detail.listingRef}` : "Razgledanje"}
      description={detail ? `${longDayLabel(wallMidnightOf(detail.start))} · ${formatSpan(detail.start, detail.end)}` : undefined}
      meta={
        detail ? (
          <>
            <ViewingStatusBadge status={detail.status} />
            <span className="text-xs text-muted-foreground">{VIEWING_MODE_LABEL[detail.mode]}</span>
            {detail.isDemo ? (
              <span className="rounded-sm border px-1.5 py-0.5 text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
                Demo
              </span>
            ) : null}
          </>
        ) : undefined
      }
      width="md"
      testId="viewing-sheet"
    >
      {detail === undefined ? (
        <div className="space-y-3" aria-busy="true" aria-label="Učitavanje razgledanja">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      ) : detail === null ? (
        <p className="text-sm text-muted-foreground">
          Razgledanje nije pronađeno ili nemate pristup. Možda je obrisano ili je dodeljeno drugom agentu.
        </p>
      ) : (
        <SheetBody key={detail._id} detail={detail} now={now} />
      )}
    </DetailSheet>
  );
}

function SheetBody({ detail, now }: { detail: ViewingDetail; now: number }) {
  return (
    <>
      <SheetSection title="Status">
        <StatusControl detail={detail} now={now} />
      </SheetSection>

      <SheetSection title="Termin">
        <FactList
          items={[
            { label: "Datum", value: longDayLabel(wallMidnightOf(detail.start)) },
            {
              label: "Vreme",
              value: (
                <span className="tabular-nums">
                  {formatSpan(detail.start, detail.end)}{" "}
                  <span className="text-muted-foreground">
                    ({formatDuration((detail.end - detail.start) / MINUTE_MS)})
                  </span>
                </span>
              ),
            },
            { label: "Način", value: VIEWING_MODE_LABEL[detail.mode] },
            { label: "Agent", value: detail.agentName },
            { label: "Zakazano", value: formatDateTime(detail.createdAt) },
          ]}
        />
      </SheetSection>

      <SheetSection title="Nekretnina">
        <Link
          href={`/admin/nekretnine/${detail.listingId}`}
          className="group inline-flex max-w-full items-start gap-2 rounded-sm text-sm outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <span className="min-w-0">
            <span className="block font-mono text-xs text-muted-foreground">{detail.listingRef}</span>
            <span className="block">{detail.listingTitleSr}</span>
          </span>
          <ArrowUpRight className="mt-4 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        </Link>
      </SheetSection>

      <SheetSection
        title="Klijent"
        actions={
          detail.leadId !== undefined ? (
            <Button variant="outline" asChild>
              <Link href={`/admin/upiti?id=${detail.leadId}`}>Otvori upit</Link>
            </Button>
          ) : undefined
        }
      >
        {detail.leadId === undefined ? (
          <p className="text-sm text-muted-foreground">
            Razgledanje nije vezano za upit, pa kontakt klijenta nije sačuvan uz njega.
          </p>
        ) : (
          <FactList
            items={[
              { label: "Ime", value: detail.contactName ?? "—" },
              {
                label: "Telefon",
                value:
                  detail.contactPhone !== undefined ? (
                    <a className="tabular-nums underline-offset-2 hover:underline" href={`tel:${detail.contactPhone.replace(/\s+/g, "")}`}>
                      {detail.contactPhone}
                    </a>
                  ) : (
                    "—"
                  ),
              },
              {
                label: "E-pošta",
                value:
                  detail.contactEmail !== undefined ? (
                    <a className="underline-offset-2 hover:underline" href={`mailto:${detail.contactEmail}`}>
                      {detail.contactEmail}
                    </a>
                  ) : (
                    "—"
                  ),
              },
            ]}
          />
        )}
      </SheetSection>

      <SheetSection title="Utisak posle razgledanja">
        <FeedbackEditor id={detail._id} saved={detail.feedback ?? ""} />
      </SheetSection>
    </>
  );
}

function StatusControl({ detail, now }: { detail: ViewingDetail; now: number }) {
  const id = useId();
  const setStatus = useMutationAction(useMutation(api.viewingsAdmin.setStatus), "Status je promenjen.");
  const started = detail.start <= now;
  const options = [detail.status, ...detail.next];
  const waitsForStart = !started && detail.next.some((status) => OUTCOMES.includes(status));

  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>Promenite status</Label>
      <div className="flex items-center gap-2">
        <Select
          value={detail.status}
          disabled={setStatus.pending || detail.next.length === 0}
          onValueChange={(value) => {
            const next = VIEWING_STATUS_ORDER.find((status) => status === value);
            if (next !== undefined && next !== detail.status) {
              void setStatus.run({ id: detail._id, status: next });
            }
          }}
        >
          <SelectTrigger
            id={id}
            data-testid="viewing-status-select"
            className="w-full sm:w-64"
            aria-describedby={`${id}-hint`}
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {options.map((status) => (
              <SelectItem
                key={status}
                value={status}
                disabled={status !== detail.status && OUTCOMES.includes(status) && !started}
              >
                {VIEWING_STATUS_LABEL[status]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {setStatus.pending ? (
          <Loader2 className="size-4 animate-spin text-muted-foreground" aria-label="Čuvanje statusa" />
        ) : null}
      </div>
      <p id={`${id}-hint`} className="text-xs text-muted-foreground">
        {statusHint(detail.status, waitsForStart)}
      </p>
    </div>
  );
}

function statusHint(status: ViewingStatus, waitsForStart: boolean): string {
  if (waitsForStart) return "„Održano” i „Nije se pojavio” mogu se izabrati kada termin počne.";
  switch (status) {
    case "requested":
      return "Potvrdite termin kada ga dogovorite sa klijentom; potvrda upit pomera u fazu razgledanja.";
    case "confirmed":
      return "Posle termina zabeležite ishod i utisak klijenta.";
    case "cancelled":
      return "Otkazano razgledanje može se ponovo potvrditi dok je termin slobodan.";
    case "done":
    case "no_show":
      return "Ishod možete ispraviti ako je pogrešno zabeležen.";
  }
}

function FeedbackEditor({ id, saved }: { id: Id<"viewings">; saved: string }) {
  const fieldId = useId();
  const [draft, setDraft] = useState(saved);
  const [base, setBase] = useState(saved);
  // Adopt a newer saved text (another tab, a colleague) unless the user is mid-edit.
  if (saved !== base) {
    if (draft === base) setDraft(saved);
    setBase(saved);
  }
  const save = useMutationAction(useMutation(api.viewingsAdmin.setFeedback), "Utisak je sačuvan.");
  const dirty = draft.trim() !== saved;

  return (
    <form
      className="flex flex-col gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        if (dirty) void save.run({ id, feedback: draft });
      }}
    >
      <Label htmlFor={fieldId} className="sr-only">
        Utisak posle razgledanja
      </Label>
      <Textarea
        id={fieldId}
        data-testid="viewing-feedback-input"
        value={draft}
        maxLength={FEEDBACK_MAX}
        rows={5}
        className="min-h-28"
        placeholder="Šta se klijentu dopalo, primedbe, sledeći korak…"
        aria-describedby={`${fieldId}-hint`}
        onChange={(event) => setDraft(event.target.value)}
      />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p id={`${fieldId}-hint`} className="text-xs text-muted-foreground" aria-live="polite">
          {save.pending ? "Čuvanje…" : dirty ? "Imate nesačuvane izmene." : "Vidi ga samo tim agencije."}
          <span className="ml-2 tabular-nums">
            {draft.length}/{FEEDBACK_MAX}
          </span>
        </p>
        <Button type="submit" disabled={!dirty || save.pending} data-testid="viewing-feedback-save">
          {save.pending ? <Loader2 className="animate-spin" aria-hidden="true" /> : null}
          Sačuvaj utisak
        </Button>
      </div>
    </form>
  );
}
