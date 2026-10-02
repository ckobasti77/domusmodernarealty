"use client";

import { usePaginatedQuery } from "convex/react";
import { Loader2 } from "lucide-react";
import { useState } from "react";
import { PHONE_QUERY } from "@/components/admin/common/breakpoints";
import { SearchInput } from "@/components/admin/common/ListToolbar";
import { PageHeader } from "@/components/admin/common/PageHeader";
import { QueryErrorBoundary } from "@/components/admin/common/QueryErrorBoundary";
import { RequireRole } from "@/components/admin/common/RequireRole";
import { useNow } from "@/components/admin/common/use-now";
import { MANAGER_ROLES } from "@/components/admin/shell/me";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { api } from "@/convex/_generated/api";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { formatCount } from "@/lib/format";
import { ContactSheet } from "./ContactSheet";
import { ContactsList } from "./ContactsList";
import { ExportButton } from "./ExportButton";
import { useContactParams } from "./shared";

const PAGE_SIZE = 30;

/** Keep the previous rows on screen while a new search loads. */
function useHeldWhileLoading<T>(value: T, loading: boolean): T {
  const [held, setHeld] = useState(value);
  if (!loading && held !== value) setHeld(value);
  return loading ? held : value;
}

function ContactsView() {
  const now = useNow(60_000);
  const phone = useMediaQuery(PHONE_QUERY);
  const { params, setParams } = useContactParams();
  const q = params.q.trim();

  const { results, status, loadMore } = usePaginatedQuery(
    api.contacts.list,
    q.length > 0 ? { q } : {},
    { initialNumItems: PAGE_SIZE },
  );
  const waiting = status === "LoadingFirstPage";
  const rows = useHeldWhileLoading(results, waiting);
  const loading = waiting && rows.length === 0;
  const refreshing = waiting && rows.length > 0;
  const canLoadMore = status === "CanLoadMore" || status === "LoadingMore";

  const empty = (
    <div className="mx-auto flex max-w-sm flex-col items-center gap-2 py-6">
      <p className="font-medium text-foreground">
        {q.length > 0 ? `Nijedan kontakt ne odgovara pretrazi „${q}”.` : "Još nema kontakata."}
      </p>
      <p className="text-sm text-muted-foreground">
        {q.length > 0
          ? "Probajte deo imena, e-pošte ili broja telefona."
          : "Kontakti nastaju iz upita sa sajta i iz podataka o vlasnicima nekretnina."}
      </p>
    </div>
  );

  return (
    <>
      <PageHeader
        title="Kontakti"
        description="Svaka osoba jednom, sa svim upitima i zabeleženim saglasnostima. Na zahtev klijenta anonimizujte podatke."
        actions={<ExportButton />}
      />
      <Card className="gap-0 py-0">
        <div role="toolbar" aria-label="Pretraga kontakata" className="flex flex-wrap items-end gap-2 border-b p-3">
          <SearchInput
            value={params.q}
            onChange={(value) => setParams({ q: value })}
            label="Pretraga kontakata"
            placeholder="Ime, e-pošta ili telefon…"
            className="sm:w-80"
          />
          {q.length > 0 ? (
            <p className="text-xs text-muted-foreground" aria-live="polite">
              {status === "LoadingFirstPage" ? "Pretraga…" : `Najbolja poklapanja: ${formatCount(rows.length, "sr-Latn")}`}
            </p>
          ) : null}
        </div>
        <ContactsList
          rows={rows}
          loading={loading}
          refreshing={refreshing}
          now={now}
          phone={phone}
          onOpen={(id) => setParams({ id })}
          empty={empty}
        />
        {!loading && q.length === 0 && (rows.length > 0 || canLoadMore) ? (
          <div className="flex flex-wrap items-center justify-between gap-2 border-t px-3 py-2 text-sm text-muted-foreground">
            <p className="tabular-nums" aria-live="polite">
              Prikazano {formatCount(rows.length, "sr-Latn")}
              {status === "Exhausted" ? "" : " (ima još)"}
            </p>
            {canLoadMore ? (
              <Button variant="outline" size="sm" disabled={status === "LoadingMore"} onClick={() => loadMore(PAGE_SIZE)}>
                {status === "LoadingMore" ? <Loader2 className="animate-spin" aria-hidden="true" /> : null}
                {status === "LoadingMore" ? "Učitavanje…" : "Učitaj još"}
              </Button>
            ) : null}
          </div>
        ) : null}
      </Card>

      <ContactSheet id={params.id} onClose={() => setParams({ id: undefined })} />
    </>
  );
}

/** `/admin/kontakti` — contacts and consent (PRD B6), admin and manager only. */
export function ContactsScreen() {
  return (
    <RequireRole roles={MANAGER_ROLES}>
      <QueryErrorBoundary backHref="/admin" backLabel="Kontrolna tabla">
        <ContactsView />
      </QueryErrorBoundary>
    </RequireRole>
  );
}
