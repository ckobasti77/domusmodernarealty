import type { Metadata } from "next";
import { LoginForm } from "@/components/admin/LoginForm";

export const metadata: Metadata = {
  title: "Prijava",
};

/**
 * Admin sign-in. The form is a client island; step 03 wires it to
 * `useAuthActions().signIn("password", …)` from `@convex-dev/auth/react`.
 */
export default function AdminLoginPage() {
  return (
    <main className="grid min-h-svh place-items-center px-6 py-16">
      <div className="w-full max-w-sm">
        <p className="font-mono text-label uppercase text-muted-foreground">Mihajlo Estate</p>
        <h1 className="mt-3 font-display text-3xl font-normal">Administracija</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Pristup imaju samo članovi tima sa pozivnicom.
        </p>

        <LoginForm />
      </div>
    </main>
  );
}
