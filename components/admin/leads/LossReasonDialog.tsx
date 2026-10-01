"use client";

import { Loader2 } from "lucide-react";
import { useId, useState } from "react";
import { describedBy } from "@/components/admin/common/form";
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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const MAX = 300;

/** The usual reasons, one tap each; the text stays editable. */
const QUICK_REASONS = [
  "Kupio preko druge agencije",
  "Odustao od kupovine",
  "Budžet nije dovoljan",
  "Ne javlja se",
] as const;

/**
 * Asked whenever a lead moves to "Izgubljen" (drag, menu or status select).
 * Cancelling leaves the lead where it was; nothing is sent until "Sačuvaj".
 */
export function LossReasonDialog({
  open,
  contactName,
  onCancel,
  onSubmit,
}: {
  open: boolean;
  contactName: string;
  onCancel: () => void;
  /** Resolves `true` when the server accepted it. */
  onSubmit: (reason: string) => Promise<boolean>;
}) {
  const id = useId();
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | undefined>(undefined);
  const [pending, setPending] = useState(false);
  const [wasOpen, setWasOpen] = useState(open);
  // A fresh, empty form every time the dialog opens.
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setReason("");
      setError(undefined);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next && !pending) onCancel();
      }}
    >
      <DialogContent className="sm:max-w-md">
        <form
          noValidate
          className="grid gap-4"
          onSubmit={async (event) => {
            event.preventDefault();
            const text = reason.trim();
            if (text.length === 0) {
              setError("Navedite razlog gubitka.");
              return;
            }
            setPending(true);
            try {
              await onSubmit(text);
            } finally {
              setPending(false);
            }
          }}
        >
          <DialogHeader>
            <DialogTitle>Zašto je upit izgubljen?</DialogTitle>
            <DialogDescription>
              Upit „{contactName}” prelazi u fazu „Izgubljen”. Razlog ostaje uz upit i pomaže da vidite
              gde se gube klijenti.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-2">
            <Label htmlFor={id}>Razlog gubitka</Label>
            <Textarea
              id={id}
              data-testid="loss-reason-input"
              value={reason}
              required
              maxLength={MAX}
              rows={3}
              aria-invalid={error !== undefined || undefined}
              aria-describedby={describedBy(id, true, error !== undefined)}
              onChange={(event) => {
                setReason(event.target.value);
                if (error !== undefined) setError(undefined);
              }}
            />
            <div className="flex flex-wrap gap-1.5" role="group" aria-label="Česti razlozi">
              {QUICK_REASONS.map((item) => (
                <Button
                  key={item}
                  type="button"
                  variant="outline"
                  size="xs"
                  aria-pressed={reason.trim() === item}
                  onClick={() => {
                    setReason(item);
                    setError(undefined);
                  }}
                >
                  {item}
                </Button>
              ))}
            </div>
            <p id={`${id}-hint`} className="text-xs text-muted-foreground tabular-nums">
              {reason.length}/{MAX} znakova
            </p>
            {error !== undefined ? (
              <p id={`${id}-error`} role="alert" className="text-xs font-medium text-destructive">
                {error}
              </p>
            ) : null}
          </div>

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline" disabled={pending}>
                Otkaži
              </Button>
            </DialogClose>
            <Button type="submit" disabled={pending} data-testid="loss-reason-submit">
              {pending ? <Loader2 className="animate-spin" aria-hidden="true" /> : null}
              Označi kao izgubljen
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
