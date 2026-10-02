"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useAction } from "convex/react";
import { Loader2 } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { PasswordInput } from "@/components/admin/auth/PasswordInput";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { api } from "@/convex/_generated/api";
import { PASSWORD_MAX, PASSWORD_MIN } from "@/convex/lib/password";
import { adminErrorMessage, errorData } from "@/lib/admin/errors";
import { z } from "@/lib/admin/zod";

const schema = z
  .object({
    currentPassword: z.string().min(1, "Unesite trenutnu lozinku."),
    newPassword: z
      .string()
      .min(PASSWORD_MIN, `Lozinka mora imati najmanje ${PASSWORD_MIN} znakova.`)
      .max(PASSWORD_MAX, `Najviše ${PASSWORD_MAX} znakova.`),
    confirm: z.string(),
  })
  .refine((values) => values.newPassword === values.confirm, {
    path: ["confirm"],
    message: "Lozinke se ne poklapaju.",
  })
  .refine((values) => values.newPassword !== values.currentPassword, {
    path: ["newPassword"],
    message: "Nova lozinka mora da se razlikuje od trenutne.",
  });
type Values = z.infer<typeof schema>;

const EMPTY: Values = { currentPassword: "", newPassword: "", confirm: "" };
const WRONG_CURRENT = "Trenutna lozinka nije tačna.";

/**
 * "Promenite lozinku" from the top-bar user menu. The server
 * (`users.changeOwnPassword`) checks the current password with the sign-in
 * rules, stores the new one and ends the account's other sessions.
 */
export function ChangePasswordDialog({
  open,
  onOpenChange,
  email,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  email: string | undefined;
}) {
  const change = useAction(api.users.changeOwnPassword);
  const [formError, setFormError] = useState<string | null>(null);
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: EMPTY });
  const { errors, isSubmitting } = form.formState;

  function changeOpen(next: boolean) {
    if (isSubmitting) return;
    if (!next) {
      form.reset(EMPTY);
      setFormError(null);
    }
    onOpenChange(next);
  }

  const onSubmit = form.handleSubmit(async (values) => {
    setFormError(null);
    try {
      const { endedSessions } = await change({
        currentPassword: values.currentPassword,
        newPassword: values.newPassword,
      });
      toast.success("Lozinka je promenjena.", {
        description:
          endedSessions > 0
            ? "Ostale prijave na ovaj nalog su odjavljene."
            : "Novu lozinku koristite od sledeće prijave.",
      });
      form.reset(EMPTY);
      onOpenChange(false);
    } catch (error) {
      if (errorData(error)?.message === WRONG_CURRENT) {
        form.setError("currentPassword", { message: WRONG_CURRENT }, { shouldFocus: true });
        return;
      }
      setFormError(adminErrorMessage(error, "Lozinka nije promenjena. Pokušajte ponovo."));
    }
  });

  return (
    <Dialog open={open} onOpenChange={changeOpen}>
      <DialogContent className="sm:max-w-md" data-testid="change-password-dialog">
        <form className="grid gap-5" onSubmit={onSubmit} noValidate>
          <DialogHeader>
            <DialogTitle>Promena lozinke</DialogTitle>
            <DialogDescription>
              Posle promene ostaćete prijavljeni ovde, a sve ostale prijave na ovaj nalog biće odjavljene.
            </DialogDescription>
          </DialogHeader>

          {/* Lets password managers file the new password under the right account. */}
          <input type="email" name="username" autoComplete="username" value={email ?? ""} readOnly hidden />

          <div className="space-y-2">
            <Label htmlFor="current-password">Trenutna lozinka</Label>
            <PasswordInput
              id="current-password"
              autoComplete="current-password"
              aria-invalid={errors.currentPassword !== undefined}
              aria-describedby={errors.currentPassword ? "current-password-error" : undefined}
              {...form.register("currentPassword")}
            />
            {errors.currentPassword ? (
              <p id="current-password-error" className="text-xs text-destructive">
                {errors.currentPassword.message}
              </p>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="new-password">Nova lozinka</Label>
            <PasswordInput
              id="new-password"
              autoComplete="new-password"
              aria-invalid={errors.newPassword !== undefined}
              aria-describedby="new-password-hint"
              {...form.register("newPassword")}
            />
            <p
              id="new-password-hint"
              className={errors.newPassword ? "text-xs text-destructive" : "text-xs text-muted-foreground"}
            >
              {errors.newPassword?.message ?? `Od ${PASSWORD_MIN} do ${PASSWORD_MAX} znakova.`}
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirm-password">Ponovite novu lozinku</Label>
            <PasswordInput
              id="confirm-password"
              autoComplete="new-password"
              aria-invalid={errors.confirm !== undefined}
              aria-describedby={errors.confirm ? "confirm-password-error" : undefined}
              {...form.register("confirm")}
            />
            {errors.confirm ? (
              <p id="confirm-password-error" className="text-xs text-destructive">
                {errors.confirm.message}
              </p>
            ) : null}
          </div>

          {formError !== null ? (
            <p
              role="alert"
              className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
            >
              {formError}
            </p>
          ) : null}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => changeOpen(false)} disabled={isSubmitting}>
              Otkažite
            </Button>
            <Button type="submit" disabled={isSubmitting} data-testid="change-password-submit">
              {isSubmitting ? <Loader2 className="animate-spin" aria-hidden="true" /> : null}
              Sačuvajte lozinku
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
