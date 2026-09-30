"use client";

import { ShieldAlert } from "lucide-react";
import type { ReactNode } from "react";
import type { Role } from "@/convex/lib/validators";
import { hasRole, useMe } from "@/components/admin/shell/me";

/**
 * Hides a screen from roles that cannot use it. A courtesy only: the Convex
 * functions behind the screen refuse the call anyway.
 */
export function RequireRole({ roles, children }: { roles: readonly Role[]; children: ReactNode }) {
  const me = useMe();
  if (hasRole(me, roles)) return children;
  return (
    <div role="alert" data-testid="admin-forbidden" className="mx-auto mt-10 max-w-md rounded-lg border bg-card p-8 text-center">
      <ShieldAlert className="mx-auto size-8 text-muted-foreground" aria-hidden="true" />
      <h1 className="mt-4 text-lg font-semibold">Nemate pristup</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Ovaj deo panela nije dostupan za Vašu ulogu. Obratite se administratoru.
      </p>
    </div>
  );
}
