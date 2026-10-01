"use client";

import { useAuthActions } from "@convex-dev/auth/react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useConvexAuth } from "convex/react";
import { Loader2 } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "@/lib/admin/zod";
import { safeNext } from "@/components/admin/shell/AuthGate";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/admin/auth/PasswordInput";
import { Label } from "@/components/ui/label";
import { errorData } from "@/lib/admin/errors";

const schema = z.object({
  email: z.string().trim().min(1, "Unesite e-poštu.").email("Unesite ispravnu e-poštu."),
  password: z.string().min(1, "Unesite lozinku."),
});
type Values = z.infer<typeof schema>;

/**
 * Convex Auth reports a wrong email or password as a generic server error; only
 * a disabled account comes back as a typed `FORBIDDEN` with our own message.
 */
function signInMessage(error: unknown): string {
  const data = errorData(error);
  if (data?.code === "FORBIDDEN" && data.message !== undefined) return data.message;
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    return "Nema internet veze. Proverite vezu i pokušajte ponovo.";
  }
  return "Pogrešna e-pošta ili lozinka.";
}

export function LoginForm() {
  const { signIn } = useAuthActions();
  const { isAuthenticated, isLoading } = useConvexAuth();
  const router = useRouter();
  const params = useSearchParams();
  const next = safeNext(params.get("next"));
  const [formError, setFormError] = useState<string | null>(null);

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { email: "", password: "" },
  });
  const { errors, isSubmitting } = form.formState;

  // Already signed in (or just signed in): go where the gate sent us from.
  useEffect(() => {
    if (!isLoading && isAuthenticated) router.replace(next);
  }, [isLoading, isAuthenticated, next, router]);

  const onSubmit = form.handleSubmit(async (values) => {
    setFormError(null);
    try {
      await signIn("password", { email: values.email, password: values.password, flow: "signIn" });
    } catch (error) {
      setFormError(signInMessage(error));
      form.setFocus("password");
    }
  });

  return (
    <form className="space-y-5" onSubmit={onSubmit} noValidate aria-describedby={formError ? "login-error" : undefined}>
      <div className="space-y-2">
        <Label htmlFor="admin-email">E-pošta</Label>
        <Input
          id="admin-email"
          type="email"
          autoComplete="username"
          className="h-10"
          aria-invalid={errors.email !== undefined}
          aria-describedby={errors.email ? "admin-email-error" : undefined}
          {...form.register("email")}
        />
        {errors.email ? (
          <p id="admin-email-error" className="text-xs text-destructive">
            {errors.email.message}
          </p>
        ) : null}
      </div>

      <div className="space-y-2">
        <Label htmlFor="admin-password">Lozinka</Label>
        <PasswordInput
          id="admin-password"
          autoComplete="current-password"
          className="h-10"
          aria-invalid={errors.password !== undefined}
          aria-describedby={errors.password ? "admin-password-error" : undefined}
          {...form.register("password")}
        />
        {errors.password ? (
          <p id="admin-password-error" className="text-xs text-destructive">
            {errors.password.message}
          </p>
        ) : null}
      </div>

      {formError !== null ? (
        <p id="login-error" role="alert" className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {formError}
        </p>
      ) : null}

      <Button type="submit" size="lg" className="h-10 w-full" disabled={isSubmitting}>
        {isSubmitting ? <Loader2 className="animate-spin" aria-hidden="true" /> : null}
        {isSubmitting ? "Prijavljivanje…" : "Prijavite se"}
      </Button>
    </form>
  );
}
