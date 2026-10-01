"use client";

import { useQuery } from "convex/react";
import { TriangleAlert } from "lucide-react";
import Link from "next/link";
import { api } from "@/convex/_generated/api";
import { ADMIN_ROLES, hasRole, MANAGER_ROLES, useMe } from "./me";

/**
 * Serbian brokerage law Art. 18: every public listing shows the agency name and
 * its "Registar posrednika" number. While settings still hold the seeded demo
 * values, those placeholders are printed on every listing, so managers see this
 * on every screen until the real numbers are entered.
 */
export function DemoDataBanner() {
  const me = useMe();
  const manager = hasRole(me, MANAGER_ROLES);
  const settings = useQuery(api.settings.publicSettings, manager ? {} : "skip");
  if (!manager || settings === undefined || settings === null || !settings.isDemo) return null;

  return (
    <div
      role="status"
      data-testid="demo-data-banner"
      className="flex items-start gap-2.5 border-b border-[color-mix(in_oklab,var(--color-warning)_35%,transparent)] bg-[color-mix(in_oklab,var(--color-warning)_10%,transparent)] px-4 py-2.5 text-sm text-foreground md:px-8"
    >
      <TriangleAlert className="mt-0.5 size-4 shrink-0 text-[var(--color-warning-text)] dark:text-[var(--color-warning)]" aria-hidden="true" />
      <p>
        <span className="font-medium">Podaci agencije su još probni.</span> PIB i broj iz Registra
        posrednika ({settings.registryNo}) prikazuju se na svakom oglasu; pre puštanja sajta u rad{" "}
        {hasRole(me, ADMIN_ROLES) ? (
          <>
            unesite prave vrednosti u{" "}
            <Link href="/admin/podesavanja" className="font-medium underline underline-offset-4">
              Podešavanjima agencije
            </Link>
            .
          </>
        ) : (
          "administrator treba da unese prave vrednosti u Podešavanjima agencije."
        )}
      </p>
    </div>
  );
}
