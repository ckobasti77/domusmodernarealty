"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery } from "convex/react";
import { SearchX } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { FormProvider, useForm, useFormState } from "react-hook-form";
import { toast } from "sonner";
import { RequireRole } from "@/components/admin/common/RequireRole";
import { useBreadcrumbLabel } from "@/components/admin/shell/breadcrumbs";
import { LISTING_ROLES, MANAGER_ROLES, hasRole, useMe } from "@/components/admin/shell/me";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { EDITOR_TABS, docToForm, listingFormSchema, type EditorTab, type ListingForm } from "@/lib/admin/listing-form";
import { BasicsTab } from "./BasicsTab";
import { DescriptionTab } from "./DescriptionTab";
import { EditorHeader } from "./EditorHeader";
import { EditorSkeleton } from "./EditorSkeleton";
import { EditorProvider, type EditorData } from "./editor-context";
import { errorsByTab } from "./error-count";
import { FeaturesTab } from "./FeaturesTab";
import { LeaveGuard } from "./LeaveGuard";
import { LegalTab } from "./LegalTab";
import { LocationTab } from "./LocationTab";
import { MediaTab } from "./MediaTab";
import { PriceTab } from "./PriceTab";
import { PublishPanel } from "./PublishPanel";
import { SeoTab } from "./SeoTab";
import { ToursTab } from "./ToursTab";
import { useAutosave } from "./use-autosave";

const TAB_LABEL: Record<EditorTab, string> = {
  osnovno: "Osnovno",
  lokacija: "Lokacija",
  karakteristike: "Karakteristike",
  cena: "Cena",
  opis: "Opis",
  mediji: "Mediji",
  "3d": "360° / 3D",
  pravno: "Pravno",
  seo: "SEO",
};

function parseTab(value: string | undefined): EditorTab {
  return EDITOR_TABS.find((tab) => tab === value) ?? "osnovno";
}

/** `/admin/nekretnine/[id]`: the nine-tab listing editor with autosave and the publish panel. */
export function ListingEditor({ id, initialTab }: { id: string; initialTab?: string }) {
  return (
    <RequireRole roles={LISTING_ROLES}>
      <EditorLoader id={id} initialTab={parseTab(initialTab)} />
    </RequireRole>
  );
}

function EditorLoader({ id, initialTab }: { id: string; initialTab: EditorTab }) {
  const [now] = useState(() => Date.now());
  // The route segment is the listing id; a malformed one fails the query's
  // validator and lands in the page's QueryErrorBoundary.
  const data = useQuery(api.listingsAdmin.get, { id: id as Id<"listings">, now });
  useBreadcrumbLabel(data ? data.listing.ref : null);

  if (data === undefined) return <EditorSkeleton />;
  if (data === null) return <NotFound />;
  // Keyed by id: the form initializes once per listing and survives reactive updates.
  return <EditorShell key={data.listing._id} data={data} now={now} initialTab={initialTab} />;
}

function NotFound() {
  return (
    <div
      role="alert"
      data-testid="listing-not-found"
      className="mx-auto mt-10 max-w-md rounded-lg border bg-card p-8 text-center"
    >
      <SearchX aria-hidden="true" className="mx-auto size-8 text-muted-foreground" />
      <h1 className="mt-4 text-lg font-semibold">Nekretnina nije pronađena</h1>
      <p className="mt-2 text-sm text-muted-foreground">Možda je obrisana, ili je link pogrešan.</p>
      <Button variant="outline" asChild className="mt-6">
        <Link href="/admin/nekretnine">Nazad na nekretnine</Link>
      </Button>
    </div>
  );
}

function EditorShell({ data, now, initialTab }: { data: EditorData; now: number; initialTab: EditorTab }) {
  const me = useMe();
  const [initial] = useState(() => docToForm(data.listing));
  const form = useForm<ListingForm>({
    defaultValues: initial,
    resolver: zodResolver(listingFormSchema),
    mode: "onChange",
  });
  const engine = useAutosave(form, data.listing, initial);
  const listingId = data.listing._id;
  const canAssignAgent = hasRole(me, MANAGER_ROLES);
  const editor = useMemo(
    () => ({ engine, listingId, now, canAssignAgent }),
    [engine, listingId, now, canAssignAgent],
  );

  const [tab, setTab] = useState<EditorTab>(initialTab);
  // Tabs mount on first visit and then stay mounted (hidden), so switching back is instant.
  const [visited, setVisited] = useState<ReadonlySet<EditorTab>>(() => new Set([initialTab]));

  const onTab = (value: string) => {
    const next = EDITOR_TABS.find((item) => item === value);
    if (next === undefined) return;
    setTab(next);
    setVisited((previous) => (previous.has(next) ? previous : new Set([...previous, next])));
    const url = new URL(window.location.href);
    if (next === "osnovno") url.searchParams.delete("tab");
    else url.searchParams.set("tab", next);
    window.history.replaceState(null, "", url);
  };

  const save = useCallback(async () => {
    const result = await engine.flush();
    if (!result.ok) {
      toast.error("Izmene nisu sačuvane.", { description: engine.getSnapshot().error ?? undefined });
    } else if (result.pending.length > 0) {
      toast.warning("Neka polja nisu sačuvana.", {
        description: "Ispravite polja sa greškom (označena tačkom na karticama).",
      });
    }
  }, [engine]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && !event.altKey && event.key.toLowerCase() === "s") {
        event.preventDefault();
        void save();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [save]);

  return (
    <FormProvider {...form}>
      <EditorProvider value={editor}>
        <div
          data-testid="listing-editor"
          data-listing-id={listingId}
          data-slug={data.listing.slug}
          className="mx-auto max-w-[1600px] text-sm"
        >
          <EditorHeader data={data} onSave={() => void save()} />
          <div className="mt-6 grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
            <div className="xl:sticky xl:top-[8.25rem] xl:order-2 xl:max-h-[calc(100svh-9.25rem)] xl:overflow-y-auto xl:overscroll-contain">
              <PublishPanel data={data} />
            </div>
            <Tabs value={tab} onValueChange={onTab} className="min-w-0 gap-4 xl:order-1">
              <EditorTabsList />
              {EDITOR_TABS.map((value) =>
                visited.has(value) ? (
                  <TabsContent key={value} value={value} forceMount className="data-[state=inactive]:hidden">
                    <TabBody tab={value} data={data} />
                  </TabsContent>
                ) : null,
              )}
            </Tabs>
          </div>
          <LeaveGuard engine={engine} />
        </div>
      </EditorProvider>
    </FormProvider>
  );
}

function TabBody({ tab, data }: { tab: EditorTab; data: EditorData }) {
  switch (tab) {
    case "osnovno":
      return <BasicsTab data={data} />;
    case "lokacija":
      return <LocationTab />;
    case "karakteristike":
      return <FeaturesTab />;
    case "cena":
      return <PriceTab data={data} />;
    case "opis":
      return <DescriptionTab />;
    case "mediji":
      return <MediaTab data={data} />;
    case "3d":
      return <ToursTab data={data} />;
    case "pravno":
      return <LegalTab data={data} />;
    case "seo":
      return <SeoTab data={data} />;
  }
}

function errorWord(count: number): string {
  if (count % 10 === 1 && count % 100 !== 11) return "greška";
  if (count % 10 >= 2 && count % 10 <= 4 && (count % 100 < 12 || count % 100 > 14)) return "greške";
  return "grešaka";
}

/** Tab triggers, each with a dot and a count when its fields fail validation. */
function EditorTabsList() {
  const { errors } = useFormState<ListingForm>();
  const counts = errorsByTab(errors);
  return (
    <div className="-mx-1 overflow-x-auto px-1 pb-1">
      <TabsList variant="line" aria-label="Odeljci nekretnine" className="h-9 w-max min-w-full justify-start border-b">
        {EDITOR_TABS.map((value) => {
          const count = counts[value];
          return (
            <TabsTrigger key={value} value={value} data-testid={`tab-${value}`} className="flex-none px-2.5">
              {TAB_LABEL[value]}
              {count > 0 ? (
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-destructive">
                  <span aria-hidden="true" className="size-1.5 rounded-full bg-destructive" />
                  <span className="tabular-nums">{count}</span>
                  <span className="sr-only"> {errorWord(count)}</span>
                </span>
              ) : null}
            </TabsTrigger>
          );
        })}
      </TabsList>
    </div>
  );
}
