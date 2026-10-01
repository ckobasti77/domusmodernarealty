"use client";

import { useMutation } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { Archive, CalendarClock, Check, ExternalLink, Loader2, Send, Trash2, TriangleAlert, Undo2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/admin/common/ConfirmDialog";
import { DotBadge } from "@/components/admin/common/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/convex/_generated/api";
import { belgradeWall, DAY_MS, fromBelgradeWall } from "@/convex/lib/belgradeTime";
import { adminErrorMessage, publishBlockers } from "@/lib/admin/errors";
import { formatDateTime } from "@/lib/admin/format";
import { cn } from "@/lib/utils";
import { PHASE_LABEL, PHASE_TONE, phaseOf, POSTS_PATH, publicPostPath } from "./shared";

type EditorData = NonNullable<FunctionReturnType<typeof api.postsAdmin.get>>;

const HOUR_MS = 3_600_000;
const MIN_LEAD_MS = 2 * 60_000;
const DEFAULT_HOUR = 9;

/** `yyyy-mm-dd` and `hh:mm` of an instant in Belgrade wall time. */
function wallInputs(at: number): { date: string; time: string } {
  const iso = new Date(belgradeWall(at)).toISOString();
  return { date: iso.slice(0, 10), time: iso.slice(11, 16) };
}

/** The instant a Belgrade date + time names, or null when incomplete. */
function fromWallInputs(date: string, time: string): number | null {
  const day = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  const clock = /^(\d{2}):(\d{2})$/.exec(time);
  if (day === null || clock === null) return null;
  return fromBelgradeWall(
    Date.UTC(Number(day[1]), Number(day[2]) - 1, Number(day[3]), Number(clock[1]), Number(clock[2])),
  );
}

/** Tomorrow at 09:00 in Belgrade. */
function defaultSlot(now: number): number {
  const wall = belgradeWall(now);
  return fromBelgradeWall(wall - (wall % DAY_MS) + DAY_MS + DEFAULT_HOUR * HOUR_MS);
}

/**
 * Status, publish / schedule / unpublish / archive / delete, and the publish
 * conditions of the saved version. Publishing saves pending edits first.
 */
export function PublishCard({
  data,
  dirty,
  save,
  canDelete,
  onDeleting,
}: {
  data: EditorData;
  dirty: boolean;
  /** Saves the form; resolves false when it could not. */
  save: () => Promise<boolean>;
  canDelete: boolean;
  /** Called before the delete runs (true) and if it fails (false), so the editor does not flash "not found". */
  onDeleting: (deleting: boolean) => void;
}) {
  const router = useRouter();
  const post = data.post;
  const phase = phaseOf(post);
  const publish = useMutation(api.postsAdmin.publish);
  const schedule = useMutation(api.postsAdmin.schedule);
  const unpublish = useMutation(api.postsAdmin.unpublish);
  const archive = useMutation(api.postsAdmin.archive);
  const remove = useMutation(api.postsAdmin.remove);
  const [blockers, setBlockers] = useState<string[]>([]);
  const [scheduling, setScheduling] = useState<{ date: string; time: string } | null>(null);
  const [busy, setBusy] = useState(false);

  /** Saves first when needed, then runs the status change; false keeps a dialog open. */
  const perform = async (action: () => Promise<unknown>, success: string): Promise<boolean> => {
    setBusy(true);
    try {
      if (dirty && !(await save())) return false;
      await action();
      setBlockers([]);
      toast.success(success);
      return true;
    } catch (error) {
      const reasons = publishBlockers(error);
      if (reasons !== null) {
        setBlockers(reasons);
        toast.error("Tekst još nije spreman za objavu. Pogledajte uslove ispod.");
      } else {
        toast.error(adminErrorMessage(error));
      }
      return false;
    } finally {
      setBusy(false);
    }
  };

  const items = data.checklist;
  const required = items.filter((item) => item.warning !== true);
  const done = required.filter((item) => item.ok).length;

  return (
    <section aria-labelledby="post-publish-title" className="rounded-xl border bg-card text-sm" data-testid="post-publish-card">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b px-4 py-3">
        <h2 id="post-publish-title" className="text-sm font-semibold">
          Objava
        </h2>
        <span data-testid="post-status" data-status={phase}>
          <DotBadge tone={PHASE_TONE[phase]}>{PHASE_LABEL[phase]}</DotBadge>
        </span>
        <span className="ml-auto text-xs text-muted-foreground tabular-nums">
          {done}/{required.length} uslova
        </span>
      </div>

      <div className="flex flex-col gap-3 px-4 py-3">
        <p className="text-xs leading-relaxed text-muted-foreground" aria-live="polite">
          {phase === "published" && post.publishedAt !== undefined
            ? `Objavljeno ${formatDateTime(post.publishedAt)}.`
            : phase === "scheduled" && post.scheduledAt !== undefined
              ? `Zakazano za ${formatDateTime(post.scheduledAt)} (beogradsko vreme).`
              : phase === "archived"
                ? "Arhivirano; tekst nije na sajtu."
                : "Nacrt; tekst nije na sajtu."}
        </p>
        {phase === "published" ? (
          <Button variant="outline" size="sm" asChild className="w-fit">
            <a href={publicPostPath(post.slug)} target="_blank" rel="noopener noreferrer">
              <ExternalLink aria-hidden="true" />
              Pogledajte na sajtu
              <span className="sr-only"> (otvara se u novoj kartici)</span>
            </a>
          </Button>
        ) : null}

        <div className="flex flex-wrap gap-2">
          {phase !== "published" ? (
            <ConfirmDialog
              trigger={
                <Button type="button" size="sm" disabled={busy} data-testid="post-publish-now">
                  <Send aria-hidden="true" />
                  Objavi sada
                </Button>
              }
              title="Objaviti tekst odmah?"
              description={
                dirty
                  ? "Izmene će prvo biti sačuvane, a tekst će odmah postati vidljiv na sajtu."
                  : "Tekst će odmah postati vidljiv na sajtu, u Magazinu."
              }
              confirmLabel="Objavi"
              onConfirm={() => perform(() => publish({ id: post._id }), "Tekst je objavljen.")}
            />
          ) : null}
          {phase !== "published" ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={busy}
              aria-expanded={scheduling !== null}
              aria-controls="post-schedule-form"
              onClick={() =>
                setScheduling((open) =>
                  open !== null ? null : wallInputs(post.scheduledAt ?? defaultSlot(Date.now())),
                )
              }
            >
              <CalendarClock aria-hidden="true" />
              {phase === "scheduled" ? "Promeni termin" : "Zakaži"}
            </Button>
          ) : null}
          {phase === "published" ? (
            <ConfirmDialog
              trigger={
                <Button type="button" size="sm" variant="outline" disabled={busy}>
                  <Undo2 aria-hidden="true" />
                  Vrati u nacrt
                </Button>
              }
              title="Skloniti tekst sa sajta?"
              description="Tekst postaje nacrt i više se ne vidi u Magazinu. Možete ga ponovo objaviti kad god želite."
              confirmLabel="Vrati u nacrt"
              onConfirm={() => perform(() => unpublish({ id: post._id }), "Tekst je vraćen u nacrt.")}
            />
          ) : phase === "scheduled" ? (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={busy}
              onClick={() => void perform(() => unpublish({ id: post._id }), "Zakazana objava je otkazana.")}
            >
              <X aria-hidden="true" />
              Otkaži zakazivanje
            </Button>
          ) : phase === "archived" ? (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={busy}
              onClick={() => void perform(() => unpublish({ id: post._id }), "Tekst je vraćen u nacrt.")}
            >
              <Undo2 aria-hidden="true" />
              Vrati u nacrt
            </Button>
          ) : null}
          {phase !== "archived" ? (
            <ConfirmDialog
              trigger={
                <Button type="button" size="sm" variant="ghost" disabled={busy}>
                  <Archive aria-hidden="true" />
                  Arhiviraj
                </Button>
              }
              title="Arhivirati tekst?"
              description={
                phase === "published"
                  ? "Tekst se uklanja sa sajta i čuva u arhivi."
                  : phase === "scheduled"
                    ? "Zakazana objava se otkazuje, a tekst se čuva u arhivi."
                    : "Nacrt se čuva u arhivi i ne prikazuje se među nacrtima."
              }
              confirmLabel="Arhiviraj"
              onConfirm={() => perform(() => archive({ id: post._id }), "Tekst je arhiviran.")}
            />
          ) : null}
        </div>

        {scheduling !== null ? (
          <ScheduleForm
            value={scheduling}
            onChange={setScheduling}
            busy={busy}
            dirty={dirty}
            onCancel={() => setScheduling(null)}
            onSubmit={async (at) => {
              const ok = await perform(
                () => schedule({ id: post._id, at }),
                `Objava je zakazana za ${formatDateTime(at)}.`,
              );
              if (ok) setScheduling(null);
            }}
          />
        ) : null}
      </div>

      <div className="border-t px-4 py-3">
        <h3 className="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">Uslovi za objavu</h3>
        <ul className="flex flex-col gap-1.5" data-testid="post-checklist">
          {items.map((item) => (
            <li
              key={item.code}
              data-ok={item.ok ? "true" : "false"}
              className={cn(
                "flex items-start gap-2 rounded-md px-1.5 py-1 leading-snug",
                !item.ok && blockers.includes(item.label) && "bg-destructive/10",
              )}
            >
              {item.ok ? (
                <Check aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-emerald-700 dark:text-emerald-400" />
              ) : item.warning === true ? (
                <TriangleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400" />
              ) : (
                <X aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-destructive" />
              )}
              <span>
                <span className="sr-only">
                  {item.ok ? "Ispunjeno: " : item.warning === true ? "Preporuka: " : "Nije ispunjeno: "}
                </span>
                {item.label}
                {item.warning === true && !item.ok ? (
                  <span className="block text-xs text-muted-foreground">Ne blokira objavu.</span>
                ) : null}
              </span>
            </li>
          ))}
        </ul>
        {dirty ? (
          <p className="mt-2 text-xs text-muted-foreground">Uslovi se odnose na poslednju sačuvanu verziju.</p>
        ) : null}
      </div>

      {canDelete ? (
        <div className="border-t px-4 py-3">
          <ConfirmDialog
            trigger={
              <Button type="button" size="sm" variant="ghost" className="text-destructive hover:text-destructive" disabled={busy}>
                <Trash2 aria-hidden="true" />
                Obrišite tekst
              </Button>
            }
            title="Trajno obrisati tekst?"
            description="Brišu se tekst na svim jezicima, naslovna slika i slike iz teksta. Ova radnja se ne može poništiti."
            confirmLabel="Obriši"
            destructive
            onConfirm={async () => {
              onDeleting(true);
              try {
                await remove({ id: post._id });
                toast.success("Tekst je obrisan.");
                router.replace(POSTS_PATH);
                return true;
              } catch (error) {
                onDeleting(false);
                toast.error(adminErrorMessage(error));
                return false;
              }
            }}
          />
        </div>
      ) : null}
    </section>
  );
}

function ScheduleForm({
  value,
  onChange,
  busy,
  dirty,
  onCancel,
  onSubmit,
}: {
  value: { date: string; time: string };
  onChange: (value: { date: string; time: string }) => void;
  busy: boolean;
  dirty: boolean;
  onCancel: () => void;
  onSubmit: (at: number) => Promise<void>;
}) {
  const id = useId();
  const [error, setError] = useState<string | null>(null);

  const submit = () => {
    const at = fromWallInputs(value.date, value.time);
    if (at === null) {
      setError("Unesite datum i vreme objave.");
      return;
    }
    if (at < Date.now() + MIN_LEAD_MS) {
      setError("Izaberite vreme najmanje dva minuta od sada.");
      return;
    }
    setError(null);
    void onSubmit(at);
  };

  return (
    <fieldset
      id="post-schedule-form"
      className="flex flex-col gap-3 rounded-lg border bg-muted/30 p-3"
      onKeyDown={(event) => {
        // Enter schedules instead of submitting (saving) the whole post form.
        if (event.key === "Enter" && event.target instanceof HTMLInputElement) {
          event.preventDefault();
          submit();
        }
      }}
    >
      <legend className="sr-only">Zakazivanje objave</legend>
      <div className="grid grid-cols-2 gap-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`${id}-date`}>Datum</Label>
          <Input
            id={`${id}-date`}
            type="date"
            value={value.date}
            onChange={(event) => onChange({ ...value, date: event.target.value })}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`${id}-time`}>Vreme</Label>
          <Input
            id={`${id}-time`}
            type="time"
            step={300}
            value={value.time}
            onChange={(event) => onChange({ ...value, time: event.target.value })}
          />
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        Beogradsko vreme.{dirty ? " Izmene će prvo biti sačuvane." : ""}
      </p>
      {error !== null ? (
        <p role="alert" className="text-xs font-medium text-destructive">
          {error}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" disabled={busy} onClick={submit} data-testid="post-schedule-confirm">
          {busy ? <Loader2 className="animate-spin" aria-hidden="true" /> : <CalendarClock aria-hidden="true" />}
          Zakaži objavu
        </Button>
        <Button type="button" size="sm" variant="ghost" disabled={busy} onClick={onCancel}>
          Otkaži
        </Button>
      </div>
    </fieldset>
  );
}
