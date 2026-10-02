"use client";

import { useAuthActions } from "@convex-dev/auth/react";
import { useConvexAuth, useQuery } from "convex/react";
import { usePathname, useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useRef, type ReactNode } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/convex/_generated/api";
import { adminErrorMessage } from "@/lib/admin/errors";
import { MeProvider } from "./me";

const SignOutContext = createContext<(() => Promise<void>) | null>(null);

/** Signs out on purpose: straight to the login page, with no `next` back to this one. */
export function useSignOut(): () => Promise<void> {
  const signOut = useContext(SignOutContext);
  if (signOut === null) throw new Error("useSignOut() must be used inside <AuthGate>.");
  return signOut;
}

/**
 * Client-side gate for every `/admin/*` screen except login and invite
 * acceptance. It is a convenience, not the security boundary: each Convex
 * admin function checks the role itself (`requireRole`).
 */
export function AuthGate({ children }: { children: ReactNode }) {
  const { isLoading, isAuthenticated } = useConvexAuth();
  const { signOut } = useAuthActions();
  const me = useQuery(api.users.getMe, isAuthenticated ? {} : "skip");
  const router = useRouter();
  const pathname = usePathname();
  // Set while signing out on purpose: the next person to sign in on this
  // browser should land on the dashboard, not on the page left behind.
  const signingOut = useRef(false);

  useEffect(() => {
    if (isLoading || isAuthenticated || signingOut.current) return;
    // An expired session: back to this very view (filters, open record) after signing in.
    router.replace(`/admin/login?next=${encodeURIComponent(`${pathname}${window.location.search}`)}`);
  }, [isLoading, isAuthenticated, pathname, router]);

  const signOutNow = useCallback(async () => {
    signingOut.current = true;
    try {
      await signOut();
    } catch (error) {
      signingOut.current = false;
      toast.error(adminErrorMessage(error, "Odjava nije uspela. Pokušajte ponovo."));
      return;
    }
    router.replace("/admin/login");
  }, [signOut, router]);

  if (isLoading || !isAuthenticated || me === undefined) return <ShellSkeleton />;
  if (me === null) return <AccountProblem text="Vaš nalog nije pronađen." onSignOut={signOutNow} />;
  if (me.status === "disabled") {
    return <AccountProblem text="Pristup panelu je onemogućen za ovaj nalog." onSignOut={signOutNow} />;
  }
  return (
    <SignOutContext.Provider value={signOutNow}>
      <MeProvider me={me}>{children}</MeProvider>
    </SignOutContext.Provider>
  );
}

function AccountProblem({ text, onSignOut }: { text: string; onSignOut: () => Promise<void> }) {
  return (
    <main className="grid min-h-svh place-items-center px-6 text-center">
      <div className="max-w-sm">
        <p className="font-mono text-label uppercase text-muted-foreground">Mihajlo Estate</p>
        <h1 className="mt-4 text-xl font-semibold">{text}</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Obratite se administratoru agencije.
        </p>
        <Button variant="outline" className="mt-6" onClick={() => void onSignOut()}>
          Odjavite se
        </Button>
      </div>
    </main>
  );
}

/** The shell's silhouette while the session resolves, so nothing jumps. */
function ShellSkeleton() {
  return (
    <div className="flex min-h-svh" aria-busy="true" aria-label="Učitavanje panela">
      <div className="hidden w-64 shrink-0 border-r bg-sidebar p-4 md:block">
        <Skeleton className="h-6 w-36" />
        <div className="mt-8 space-y-3">
          {Array.from({ length: 7 }, (_, index) => (
            <Skeleton key={index} className="h-7 w-full" />
          ))}
        </div>
      </div>
      <div className="flex-1">
        <div className="flex h-14 items-center border-b px-4">
          <Skeleton className="h-5 w-48" />
        </div>
        <div className="space-y-4 p-6">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-40 w-full" />
        </div>
      </div>
    </div>
  );
}
