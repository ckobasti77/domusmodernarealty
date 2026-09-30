"use client";

import { useAuthActions } from "@convex-dev/auth/react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useConvexAuth, useQuery } from "convex/react";
import { Loader2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AuthCard } from "./AuthCard";
import { PasswordInput } from "./PasswordInput";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/convex/_generated/api";
import { errorData } from "@/lib/admin/errors";

const schema = z
  .object({
    name: z.string().trim().min(2, "Unesite ime i prezime.").max(120, "Najviše 120 znakova."),
    password: z
      .string()
      .min(10, "Lozinka mora imati najmanje 10 znakova.")
      .max(128, "Najviše 128 znakova."),
    confirm: z.string(),
  })
  .refine((values) => values.password === values.confirm, {
    path: ["confirm"],
    message: "Lozinke se ne poklapaju.",
  });
type Values = z.infer<typeof schema>;

/**
 * Invite acceptance: the token from the e-mailed link is sent with
 * `flow: "signUp"`, and `convex/auth.ts::createOrUpdateUser` accepts the new
 * account only when that token matches an open invite for this address.
 */
const LEDE = "Postavite lozinku za svoj nalog. Uloga i ovlašćenja dolaze iz pozivnice.";
const FOOTER = "Pozivnica važi 7 dana i može se iskoristiti samo jednom.";

export function InviteScreen({ token }: { token: string }) {
  // A query must not read the clock, so the page passes "now" in once.
  const [now] = useState(() => Date.now());
  const invite = useQuery(api.invites.checkToken, { token, now });
  const { isAuthenticated } = useConvexAuth();
  const { signIn, signOut } = useAuthActions();
  const router = useRouter();
  const [formError, setFormError] = useState<string | null>(null);
  const [accepted, setAccepted] = useState(false);

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    values: { name: invite?.valid === true ? (invite.name ?? "") : "", password: "", confirm: "" },
    resetOptions: { keepDirtyValues: true },
  });
  const { errors, isSubmitting } = form.formState;

  if (invite === undefined) {
    return (
      <AuthCard eyebrow="Pozivnica u tim" lede={LEDE} footer={FOOTER}>
        <div className="space-y-4" aria-busy="true" aria-label="Provera pozivnice">
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      </AuthCard>
    );
  }

  if (!invite.valid && !accepted) {
    return (
      <AuthCard
        eyebrow="Pozivnica nije važeća"
        lede="Link koji ste otvorili ne može da otvori nalog. Pozivnica je možda istekla, već je iskorišćena ili link nije kopiran ceo."
      >
        <div role="alert" data-testid="invite-invalid" className="space-y-5">
          <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {invite.reason}
          </p>
          <p className="text-sm text-muted-foreground">
            Zatražite novu pozivnicu od administratora agencije.
          </p>
          <Button asChild size="lg" className="h-10 w-full">
            <Link href="/admin/login">Na prijavu</Link>
          </Button>
        </div>
      </AuthCard>
    );
  }

  if (isAuthenticated && !accepted) {
    return (
      <AuthCard eyebrow="Pozivnica u tim" lede={LEDE}>
        <div className="space-y-5">
          <p className="text-sm text-muted-foreground">
            Već ste prijavljeni drugim nalogom. Odjavite se da biste prihvatili ovu pozivnicu.
          </p>
          <Button variant="outline" className="w-full" onClick={() => void signOut()}>
            Odjavite se
          </Button>
        </div>
      </AuthCard>
    );
  }

  const email = invite.valid ? invite.email : "";

  const onSubmit = form.handleSubmit(async (values) => {
    setFormError(null);
    try {
      await signIn("password", {
        email,
        password: values.password,
        name: values.name,
        inviteToken: token,
        flow: "signUp",
      });
      setAccepted(true);
      router.replace("/admin");
    } catch (error) {
      const data = errorData(error);
      setFormError(
        data?.message ??
          "Nalog nije otvoren. Pozivnica je možda istekla ili je već iskorišćena.",
      );
    }
  });

  return (
    <AuthCard eyebrow="Pozivnica u tim" lede={LEDE} footer={FOOTER}>
    <form className="space-y-5" onSubmit={onSubmit} noValidate data-testid="invite-form">
      <div className="space-y-2">
        <Label htmlFor="invite-email">E-pošta</Label>
        <Input id="invite-email" type="email" value={email} readOnly autoComplete="username" className="bg-muted" />
      </div>

      <div className="space-y-2">
        <Label htmlFor="invite-name">Ime i prezime</Label>
        <Input
          id="invite-name"
          autoComplete="name"
          aria-invalid={errors.name !== undefined}
          aria-describedby={errors.name ? "invite-name-error" : undefined}
          {...form.register("name")}
        />
        {errors.name ? (
          <p id="invite-name-error" className="text-xs text-destructive">
            {errors.name.message}
          </p>
        ) : null}
      </div>

      <div className="space-y-2">
        <Label htmlFor="invite-password">Nova lozinka</Label>
        <PasswordInput
          id="invite-password"
          autoComplete="new-password"
          aria-invalid={errors.password !== undefined}
          aria-describedby="invite-password-hint"
          {...form.register("password")}
        />
        <p id="invite-password-hint" className={errors.password ? "text-xs text-destructive" : "text-xs text-muted-foreground"}>
          {errors.password?.message ?? "Najmanje 10 znakova."}
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="invite-confirm">Ponovite lozinku</Label>
        <PasswordInput
          id="invite-confirm"
          autoComplete="new-password"
          aria-invalid={errors.confirm !== undefined}
          aria-describedby={errors.confirm ? "invite-confirm-error" : undefined}
          {...form.register("confirm")}
        />
        {errors.confirm ? (
          <p id="invite-confirm-error" className="text-xs text-destructive">
            {errors.confirm.message}
          </p>
        ) : null}
      </div>

      {formError !== null ? (
        <p role="alert" className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {formError}
        </p>
      ) : null}

      <Button type="submit" size="lg" className="h-10 w-full" disabled={isSubmitting || accepted}>
        {isSubmitting || accepted ? <Loader2 className="animate-spin" aria-hidden="true" /> : null}
        Aktivirajte nalog
      </Button>
    </form>
    </AuthCard>
  );
}
