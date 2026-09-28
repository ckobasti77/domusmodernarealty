"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * Sign-in form shell. The fields, labels and validation copy are final; step 03
 * replaces `onSubmit` with `useAuthActions().signIn("password", { email,
 * password, flow: "signIn" })` and redirects to `/admin` on success.
 */
export function LoginForm() {
  const [pending, setPending] = useState(false);

  return (
    <form
      className="mt-8 space-y-5"
      onSubmit={(event) => {
        event.preventDefault();
        setPending(true);
        // Auth is wired in step 03 (Convex Auth Password provider).
        setPending(false);
      }}
    >
      <div className="space-y-2">
        <Label htmlFor="admin-email">E-pošta</Label>
        <Input
          id="admin-email"
          name="email"
          type="email"
          autoComplete="username"
          required
          placeholder="ime@mihajloestate.rs"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="admin-password">Lozinka</Label>
        <Input
          id="admin-password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          minLength={8}
        />
      </div>

      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Prijavljivanje…" : "Prijavite se"}
      </Button>
    </form>
  );
}
