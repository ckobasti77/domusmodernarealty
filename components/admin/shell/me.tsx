"use client";

import type { FunctionReturnType } from "convex/server";
import { createContext, useContext, type ReactNode } from "react";
import type { api } from "@/convex/_generated/api";
import type { Role } from "@/convex/lib/validators";

export type Me = NonNullable<FunctionReturnType<typeof api.users.getMe>>;

const MeContext = createContext<Me | null>(null);

export function MeProvider({ me, children }: { me: Me; children: ReactNode }) {
  return <MeContext.Provider value={me}>{children}</MeContext.Provider>;
}

/** The signed-in staff member. Only valid below `AuthGate`. */
export function useMe(): Me {
  const me = useContext(MeContext);
  if (me === null) throw new Error("useMe() must be used inside <AuthGate>.");
  return me;
}

export function hasRole(me: Pick<Me, "role">, roles: readonly Role[]): boolean {
  return roles.includes(me.role);
}

/** Roles that may work with listings (agents: only their own). */
export const LISTING_ROLES = ["admin", "manager", "agent"] as const satisfies readonly Role[];
/** Roles that may see agency-wide KPIs, bulk actions and the activity log. */
export const MANAGER_ROLES = ["admin", "manager"] as const satisfies readonly Role[];
export const ADMIN_ROLES = ["admin"] as const satisfies readonly Role[];
