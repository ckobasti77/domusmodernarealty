"use client";

import { Loader2 } from "lucide-react";
import { useState, type ReactNode } from "react";
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

/**
 * A confirmation for anything irreversible or public-facing (status changes,
 * deletes, bulk actions). `onConfirm` may be async; the dialog stays open with
 * a spinner until it settles, and closes only on success.
 *
 * Controlled (`open` + `onOpenChange`) or uncontrolled with a `trigger`.
 */
export function ConfirmDialog({
  trigger,
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  cancelLabel = "Otkaži",
  destructive = false,
  onConfirm,
  children,
}: {
  trigger?: ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  title: ReactNode;
  description?: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  destructive?: boolean;
  /** Return `false` to keep the dialog open (e.g. the action was refused). */
  onConfirm: () => Promise<boolean | void> | boolean | void;
  children?: ReactNode;
}) {
  const [innerOpen, setInnerOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const isOpen = open ?? innerOpen;
  const setOpen = (next: boolean) => {
    if (pending) return;
    onOpenChange?.(next);
    if (open === undefined) setInnerOpen(next);
  };

  return (
    <AlertDialog open={isOpen} onOpenChange={setOpen}>
      {trigger !== undefined ? <AlertDialogTrigger asChild>{trigger}</AlertDialogTrigger> : null}
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          {description !== undefined ? <AlertDialogDescription>{description}</AlertDialogDescription> : null}
        </AlertDialogHeader>
        {children}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>{cancelLabel}</AlertDialogCancel>
          <Button
            variant={destructive ? "destructive" : "default"}
            disabled={pending}
            data-testid="confirm-dialog-action"
            onClick={async () => {
              setPending(true);
              try {
                const result = await onConfirm();
                if (result !== false) {
                  onOpenChange?.(false);
                  if (open === undefined) setInnerOpen(false);
                }
              } finally {
                setPending(false);
              }
            }}
          >
            {pending ? <Loader2 className="animate-spin" aria-hidden="true" /> : null}
            {confirmLabel}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
