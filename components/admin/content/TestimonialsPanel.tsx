"use client";

import { useMutation, useQuery } from "convex/react";
import { ArrowDown, ArrowUp, MessageSquareQuote, Pencil, Plus, Trash2 } from "lucide-react";
import { useId, useState } from "react";
import { ConfirmDialog } from "@/components/admin/common/ConfirmDialog";
import { l10nCompleteness } from "@/components/admin/common/L10nInput";
import { EmptyState } from "@/components/admin/common/ListToolbar";
import { DotBadge } from "@/components/admin/common/StatusBadge";
import { useMutationAction } from "@/components/admin/common/useMutationAction";
import { hasRole, MANAGER_ROLES, useMe } from "@/components/admin/shell/me";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { api } from "@/convex/_generated/api";
import { TestimonialSheet, type TestimonialRow } from "./TestimonialSheet";

/**
 * Client testimonials (PRD B10). The content team writes and orders them;
 * only admin/manager may confirm one — the switch that puts it on the
 * landing — or delete it (the server enforces the same split).
 *
 * The open record lives in the URL (`?preporuka=<id>` / `?preporuka=nova`),
 * handled by the screen.
 */
export function TestimonialsPanel({
  openId,
  onOpen,
}: {
  /** `"nova"` for a new testimonial, an id for an existing one, `null` closed. */
  openId: string | null;
  onOpen: (id: string | null) => void;
}) {
  const me = useMe();
  const canVerify = hasRole(me, MANAGER_ROLES);
  const items = useQuery(api.testimonialsAdmin.listAll, {});
  const move = useMutationAction(useMutation(api.testimonialsAdmin.move));
  const setVerified = useMutationAction(useMutation(api.testimonialsAdmin.setVerified));
  const remove = useMutationAction(useMutation(api.testimonialsAdmin.remove), "Preporuka je obrisana.");
  const [confirmVerify, setConfirmVerify] = useState<TestimonialRow | null>(null);
  const [status, setStatus] = useState("");

  const open = openId === "nova" ? null : (items?.find((item) => item._id === openId) ?? null);
  const sheetOpen = openId === "nova" || open !== null;

  const verifiedCount = items?.filter((item) => item.verified).length ?? 0;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
          <p>
            Na početnoj strani se prikazuju samo <strong className="font-medium text-foreground">potvrđene</strong>{" "}
            preporuke stvarnih klijenata, najviše tri, ovim redosledom. Dok nijedna nije potvrđena, sekcija sa
            preporukama se na sajtu ne prikazuje. Preporuke se nikada ne izmišljaju niti prepravljaju.
          </p>
          {items !== undefined ? (
            <p className="mt-1" aria-live="polite">
              Na sajtu: {verifiedCount} od {items.length}. {status}
            </p>
          ) : null}
        </div>
        <Button onClick={() => onOpen("nova")} data-testid="testimonial-new">
          <Plus aria-hidden="true" />
          Nova preporuka
        </Button>
      </div>

      {items === undefined ? (
        <div className="flex flex-col gap-2" aria-busy="true" aria-label="Učitavanje preporuka">
          {Array.from({ length: 3 }, (_unused, index) => (
            <Skeleton key={index} className="h-24 w-full rounded-lg" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          icon={<MessageSquareQuote aria-hidden="true" />}
          title="Još nema preporuka"
          description="Dodajte preporuku kada Vam klijent da saglasnost da njegove reči objavite."
        />
      ) : (
        <ol className="flex flex-col gap-2">
          {items.map((item, index) => (
            <TestimonialItem
              key={item._id}
              item={item}
              index={index}
              count={items.length}
              canVerify={canVerify}
              busy={move.pending || setVerified.pending || remove.pending}
              onEdit={() => onOpen(item._id)}
              onMove={async (direction) => {
                await move.run({ id: item._id, direction });
                setStatus(`„${item.author}” je pomerena ${direction === "up" ? "gore" : "dole"}.`);
              }}
              onVerify={(next) => {
                if (next) setConfirmVerify(item);
                else {
                  void setVerified.run({ id: item._id, verified: false }).then((result) => {
                    if (result !== undefined) setStatus(`„${item.author}” je skinuta sa sajta.`);
                  });
                }
              }}
              onRemove={async () => {
                const result = await remove.run({ id: item._id });
                if (result === undefined) return false;
                if (openId === item._id) onOpen(null);
              }}
            />
          ))}
        </ol>
      )}

      <ConfirmDialog
        open={confirmVerify !== null}
        onOpenChange={(next) => {
          if (!next) setConfirmVerify(null);
        }}
        title="Potvrditi i objaviti preporuku?"
        description="Potvrđena preporuka se odmah prikazuje na početnoj strani sajta. Potvrdite samo reči koje je stvarni klijent zaista izgovorio ili napisao i pristao da ih objavimo. Preporuke se nikada ne izmišljaju, ne sastavljaju od više izjava i ne prepravljaju."
        confirmLabel="Potvrdi i objavi"
        onConfirm={async () => {
          if (confirmVerify === null) return;
          // The text shown here is what gets confirmed: if it changed in the
          // meantime the server refuses (CONFLICT) and the list shows the new one.
          const result = await setVerified.run({
            id: confirmVerify._id,
            verified: true,
            reviewed: {
              author: confirmVerify.author,
              quote: confirmVerify.quote,
              ...(confirmVerify.context !== undefined ? { context: confirmVerify.context } : {}),
            },
          });
          if (result === undefined) return false;
          setStatus(`„${confirmVerify.author}” je sada na sajtu.`);
        }}
      >
        {confirmVerify !== null ? (
          <figure className="max-h-60 overflow-y-auto rounded-md border bg-muted/40 px-4 py-3 text-sm">
            <blockquote lang="sr-Latn" className="leading-relaxed">
              „{confirmVerify.quote.sr}”
            </blockquote>
            <figcaption className="mt-2 font-medium">
              {confirmVerify.author}
              {confirmVerify.context !== undefined ? (
                <span className="font-normal text-muted-foreground"> · {confirmVerify.context.sr}</span>
              ) : null}
            </figcaption>
          </figure>
        ) : null}
      </ConfirmDialog>

      <TestimonialSheet
        open={sheetOpen}
        onOpenChange={(next) => {
          if (!next) onOpen(null);
        }}
        testimonial={open}
        onSaved={() => onOpen(null)}
      />
    </div>
  );
}

function TestimonialItem({
  item,
  index,
  count,
  canVerify,
  busy,
  onEdit,
  onMove,
  onVerify,
  onRemove,
}: {
  item: TestimonialRow;
  index: number;
  count: number;
  canVerify: boolean;
  busy: boolean;
  onEdit: () => void;
  onMove: (direction: "up" | "down") => Promise<void>;
  onVerify: (next: boolean) => void;
  onRemove: () => Promise<boolean | void>;
}) {
  const switchId = useId();
  const locales = l10nCompleteness(item.quote);
  const verifyHint = item.isDemo
    ? "Demo preporuka se ne može objaviti."
    : canVerify
      ? undefined
      : "Preporuku potvrđuje administrator ili menadžer.";

  return (
    <li data-testid="testimonial-row" className="rounded-lg border bg-card p-3 md:p-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-start">
        <div className="flex shrink-0 gap-1 md:flex-col">
          <Button
            variant="ghost"
            size="icon"
            aria-label={`Pomeri gore: ${item.author}`}
            disabled={index === 0 || busy}
            onClick={() => void onMove("up")}
          >
            <ArrowUp aria-hidden="true" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label={`Pomeri dole: ${item.author}`}
            disabled={index === count - 1 || busy}
            onClick={() => void onMove("down")}
          >
            <ArrowDown aria-hidden="true" />
          </Button>
        </div>

        <div className="min-w-0 flex-1">
          <blockquote className="line-clamp-3 text-sm leading-relaxed" lang="sr-Latn">
            „{item.quote.sr}”
          </blockquote>
          <p className="mt-2 text-sm font-medium">
            {item.author}
            {item.context !== undefined ? (
              <span className="font-normal text-muted-foreground"> · {item.context.sr}</span>
            ) : null}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
            {item.verified ? <DotBadge tone="success">Na sajtu</DotBadge> : <DotBadge tone="muted">Nije na sajtu</DotBadge>}
            {item.isDemo ? <DotBadge tone="warning">Demo</DotBadge> : null}
            <span className="text-xs text-muted-foreground">{locales}/4 jezika</span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 md:flex-col md:items-end">
          <div className="flex items-center gap-2">
            <Switch
              id={switchId}
              checked={item.verified}
              disabled={busy || item.isDemo || !canVerify}
              onCheckedChange={onVerify}
              aria-describedby={verifyHint !== undefined ? `${switchId}-hint` : undefined}
              data-testid="testimonial-verified"
            />
            <Label htmlFor={switchId}>Potvrđena</Label>
          </div>
          {verifyHint !== undefined ? (
            <p id={`${switchId}-hint`} className="text-xs text-muted-foreground md:max-w-48 md:text-right">
              {verifyHint}
            </p>
          ) : null}
          <div className="flex gap-1">
            <Button variant="outline" size="sm" onClick={onEdit} data-testid="testimonial-edit">
              <Pencil aria-hidden="true" />
              Izmeni
            </Button>
            {canVerify ? (
              <ConfirmDialog
                trigger={
                  <Button variant="ghost" size="sm" aria-label={`Obriši preporuku: ${item.author}`} disabled={busy}>
                    <Trash2 aria-hidden="true" />
                    Obriši
                  </Button>
                }
                title="Obrisati preporuku?"
                description={`Preporuka klijenta „${item.author}” biće trajno obrisana${item.verified ? " i nestaće sa sajta" : ""}.`}
                confirmLabel="Obriši"
                destructive
                onConfirm={onRemove}
              />
            ) : null}
          </div>
        </div>
      </div>
    </li>
  );
}
