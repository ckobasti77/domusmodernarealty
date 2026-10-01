"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useState } from "react";
import { PageHeader } from "@/components/admin/common/PageHeader";
import { QueryErrorBoundary } from "@/components/admin/common/QueryErrorBoundary";
import { RequireRole } from "@/components/admin/common/RequireRole";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { PageKey, Role } from "@/convex/lib/validators";
import { PAGE_KEY_LABEL } from "@/lib/admin/labels";
import { PagesPanel } from "./PagesPanel";
import { TestimonialsPanel } from "./TestimonialsPanel";

const CONTENT_ROLES = ["admin", "manager", "editor"] as const satisfies readonly Role[];

type Tab = "stranice" | "preporuke";

function pageKeyOf(value: string | null): PageKey {
  const keys = Object.keys(PAGE_KEY_LABEL) as PageKey[];
  return keys.find((key) => key === value) ?? "home";
}

/**
 * Sadržaj sajta (PRD B10): the editable copy of the public pages and the
 * client testimonials. The view lives in the URL — `?tab=preporuke`,
 * `?stranica=privacy`, `?preporuka=<id>` — so a page or a testimonial can be
 * linked and survives a reload.
 */
export function ContentScreen() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const tab: Tab = params.get("tab") === "preporuke" ? "preporuke" : "stranice";
  const page = pageKeyOf(params.get("stranica"));
  const testimonial = params.get("preporuka");
  const [dirty, setDirty] = useState(false);

  const setParams = useCallback(
    (patch: Record<string, string | null>) => {
      const next = new URLSearchParams(params.toString());
      for (const [key, value] of Object.entries(patch)) {
        if (value === null) next.delete(key);
        else next.set(key, value);
      }
      const query = next.toString();
      router.replace(query.length > 0 ? `${pathname}?${query}` : pathname, { scroll: false });
    },
    [params, pathname, router],
  );

  return (
    <RequireRole roles={CONTENT_ROLES}>
      <PageHeader
        title="Sadržaj sajta"
        description="Tekstovi javnih stranica na četiri jezika i preporuke klijenata. Sačuvane izmene su odmah vidljive na sajtu."
      />
      <Tabs
        value={tab}
        onValueChange={(next) => setParams({ tab: next === "preporuke" ? "preporuke" : null, preporuka: null })}
        className="gap-5"
      >
        <TabsList aria-label="Sadržaj sajta">
          <TabsTrigger value="stranice" data-testid="content-tab-pages">
            Stranice
            {dirty ? (
              <>
                <span aria-hidden="true" className="size-1.5 rounded-full bg-warning" />
                <span className="sr-only">(nesačuvane izmene)</span>
              </>
            ) : null}
          </TabsTrigger>
          <TabsTrigger value="preporuke" data-testid="content-tab-testimonials">
            Preporuke
          </TabsTrigger>
        </TabsList>

        {/* Kept mounted while the testimonials are open, so unsaved page edits survive the switch. */}
        <TabsContent value="stranice" forceMount className="data-[state=inactive]:hidden">
          <QueryErrorBoundary>
            <PagesPanel selected={page} onSelect={(key) => setParams({ stranica: key === "home" ? null : key })} onDirtyChange={setDirty} />
          </QueryErrorBoundary>
        </TabsContent>
        <TabsContent value="preporuke">
          <QueryErrorBoundary>
            <TestimonialsPanel openId={testimonial} onOpen={(id) => setParams({ preporuka: id })} />
          </QueryErrorBoundary>
        </TabsContent>
      </Tabs>
    </RequireRole>
  );
}
