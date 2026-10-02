"use client";

import { useMutation } from "convex/react";
import { Loader2, Trash2 } from "lucide-react";
import { useId, useRef, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { formatCount, pluralSr } from "@/components/admin/dashboard/format";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/convex/_generated/api";
import { adminErrorMessage } from "@/lib/admin/errors";
import { DEMO_CONFIRM } from "./labels";

/**
 * "Obriši sav demo sadržaj" with typed confirmation: the destructive button
 * stays disabled until the field reads exactly `OBRIŠI DEMO`. The server
 * checks the phrase again and schedules the batched delete.
 */
export function PurgeDemoDialog({ total, disabled }: { total: number; disabled: boolean }) {
  const purge = useMutation(api.demo.purge);
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [pending, setPending] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const hintId = useId();
  const matches = text.trim() === DEMO_CONFIRM;

  function changeOpen(next: boolean) {
    if (pending) return;
    setOpen(next);
    if (!next) setText("");
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!matches || pending) return;
    setPending(true);
    try {
      await purge({ confirm: DEMO_CONFIRM });
      toast.success("Brisanje demo sadržaja je pokrenuto.", {
        description: "Brojevi se osvežavaju sami dok brisanje traje.",
      });
      setOpen(false);
      setText("");
    } catch (error) {
      toast.error(adminErrorMessage(error, "Brisanje nije pokrenuto. Pokušajte ponovo."));
    } finally {
      setPending(false);
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={changeOpen}>
      <AlertDialogTrigger asChild>
        <Button variant="destructive" disabled={disabled} data-testid="demo-purge">
          <Trash2 aria-hidden="true" />
          Obriši sav demo sadržaj
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent
        onOpenAutoFocus={(event) => {
          // Straight to the confirmation field; the action stays disabled until it matches.
          event.preventDefault();
          inputRef.current?.focus();
        }}
      >
        <form onSubmit={submit} className="grid gap-4">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-sans font-semibold">Obrisati sav demo sadržaj?</AlertDialogTitle>
            <AlertDialogDescription>
              Trajno se briše{" "}
              <span data-numeric>
                {formatCount(total)} {pluralSr(total, "demo zapis", "demo zapisa")}
              </span>
              , zajedno sa fotografijama i 360° scenama demo nekretnina. Pravni tekstovi (privatnost,
              uslovi, kolačići) ostaju. Ova radnja se ne može poništiti.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="grid gap-2">
            <Label htmlFor="demo-confirm">
              Za potvrdu upišite <span className="font-mono">{DEMO_CONFIRM}</span>
            </Label>
            <Input
              ref={inputRef}
              id="demo-confirm"
              value={text}
              onChange={(event) => setText(event.target.value)}
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              disabled={pending}
              aria-describedby={hintId}
            />
            <p id={hintId} className="text-xs text-muted-foreground">
              Velikim slovima, sa slovom Š.
            </p>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Otkaži</AlertDialogCancel>
            <Button
              type="submit"
              variant="destructive"
              disabled={!matches || pending}
              data-testid="confirm-dialog-action"
            >
              {pending ? <Loader2 className="motion-safe:animate-spin" aria-hidden="true" /> : null}
              Obriši demo sadržaj
            </Button>
          </AlertDialogFooter>
        </form>
      </AlertDialogContent>
    </AlertDialog>
  );
}
