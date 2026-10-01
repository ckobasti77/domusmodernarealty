"use client";

import { useAuthActions } from "@convex-dev/auth/react";
import { useConvexAuth, useQuery } from "convex/react";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/convex/_generated/api";
import { MeProvider } from "./me";

/**
 * Client-side gate for every `/admin/*` screen except login and invite
 * acceptance. It is a convenience, not the security boundary: each Convex
 * admin function checks the role itself (`requireRole`).
 */
export function AuthGate({ children }: { children: ReactNode }) {
  const { isLoading, isAuthenticated } = useConvexAuth();
  const me = useQuery(api.users.getMe, isAuthenticated ? {} : "skip");
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace(`/admin/login?next=${encodeURIComponent(pathname)}`);
    }
  }, [isLoading, isAuthenticated, pathname, router]);

  if (isLoading || !isAuthenticated || me === undefined) return <ShellSkeleton />;
  if (me === null) return <AccountProblem text="Vaš nalog nije pronađen." />;
  if (me.status === "disabled") {
    return <AccountProblem text="Pristup panelu je onemogućen za ovaj nalog." />;
  }
  return <MeProvider me={me}>{children}</MeProvider>;
}

function AccountProblem({ text }: { text: string }) {
  const { signOut } = useAuthActions();
  const router = useRouter();
  return (
    <main className="grid min-h-svh place-items-center px-6 text-center">
      <div className="max-w-sm">
        <p className="font-mono text-label uppercase text-muted-foreground">Mihajlo Estate</p>
        <h1 className="mt-4 text-xl font-semibold">{text}</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Obratite se administratoru agencije.
        </p>
        <Button
          variant="outline"
          className="mt-6"
          onClick={async () => {
            await signOut();
            router.replace("/admin/login");
          }}
        >
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
