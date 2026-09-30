"use client";

import { useAction } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { Loader2, Search } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/convex/_generated/api";
import { adminErrorMessage, errorData } from "@/lib/admin/errors";

export type GeocodeHit = FunctionReturnType<typeof api.geocode.search>[number];

/** Nominatim's policy is one request per second for the whole app; the server enforces it too. */
const COOLDOWN_MS = 1_000;
const MIN_QUERY = 3;

type SearchState =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "results"; q: string; hits: GeocodeHit[] }
  | { kind: "error"; message: string };

function primaryLine(hit: GeocodeHit): string {
  if (hit.street !== undefined) return hit.streetNo !== undefined ? `${hit.street} ${hit.streetNo}` : hit.street;
  return hit.label.split(",")[0]?.trim() || hit.label;
}

/**
 * Address lookup for the pin picker, through `geocode.search` (a staff-only
 * Convex action that calls Nominatim with the app's User-Agent). No
 * search-as-you-type: one explicit search at a time, at most one per second.
 */
export function AddressSearch({
  initialQuery,
  onPick,
}: {
  initialQuery: string;
  onPick: (hit: GeocodeHit) => void;
}) {
  const search = useAction(api.geocode.search);
  const inputId = useId();
  const statusId = useId();
  const [query, setQuery] = useState(initialQuery);
  const [state, setState] = useState<SearchState>({ kind: "idle" });
  const [coolingDown, setCoolingDown] = useState(false);
  const latestRequest = useRef(0);
  const cooldownTimer = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (cooldownTimer.current !== null) window.clearTimeout(cooldownTimer.current);
    },
    [],
  );

  const startCooldown = (ms: number) => {
    setCoolingDown(true);
    if (cooldownTimer.current !== null) window.clearTimeout(cooldownTimer.current);
    cooldownTimer.current = window.setTimeout(() => {
      cooldownTimer.current = null;
      setCoolingDown(false);
    }, ms);
  };

  const loading = state.kind === "loading";

  const run = async () => {
    const q = query.trim();
    if (q.length < MIN_QUERY) {
      setState({ kind: "error", message: `Unesite najmanje ${MIN_QUERY} znaka.` });
      return;
    }
    if (coolingDown || loading) return;

    latestRequest.current += 1;
    const requestId = latestRequest.current;
    startCooldown(COOLDOWN_MS);
    setState({ kind: "loading" });
    try {
      const hits = await search({ q });
      if (requestId !== latestRequest.current) return;
      setState({ kind: "results", q, hits });
    } catch (error) {
      if (requestId !== latestRequest.current) return;
      const data = errorData(error);
      if (data?.code === "RATE_LIMITED") startCooldown(Math.max(COOLDOWN_MS, data.retryAfter ?? COOLDOWN_MS));
      setState({
        kind: "error",
        message: adminErrorMessage(error, "Pretraga adrese trenutno nije dostupna. Postavite pin na mapi ili unesite koordinate."),
      });
    }
  };

  return (
    <div role="search" aria-label="Pretraga adrese" className="grid gap-2.5">
      <Label htmlFor={inputId}>Adresa</Label>
      <div className="flex gap-2">
        <Input
          id={inputId}
          value={query}
          autoComplete="off"
          placeholder="npr. Kralja Milana 12, Beograd"
          aria-describedby={statusId}
          onChange={(event) => setQuery(event.currentTarget.value)}
          onKeyDown={(event) => {
            if (event.key !== "Enter") return;
            // Never submit an enclosing editor form.
            event.preventDefault();
            event.stopPropagation();
            void run();
          }}
        />
        <Button type="button" onClick={() => void run()} disabled={loading || coolingDown}>
          {loading ? <Loader2 aria-hidden="true" className="animate-spin" /> : <Search aria-hidden="true" />}
          Traži
        </Button>
      </div>

      <div id={statusId} aria-live="polite" className="text-xs">
        {state.kind === "idle" ? (
          <p className="text-muted-foreground">Unesite ulicu, broj i mesto, pa pritisnite Enter.</p>
        ) : null}
        {state.kind === "loading" ? <p className="text-muted-foreground">Tražim adresu…</p> : null}
        {state.kind === "results" && state.hits.length === 0 ? (
          <p className="text-muted-foreground">
            Nema rezultata za „{state.q}”. Proverite naziv ulice ili dodajte mesto.
          </p>
        ) : null}
        {state.kind === "results" && state.hits.length > 0 ? (
          <p className="text-muted-foreground">
            Izaberite adresu — pin će se pomeriti na nju. Proverite ga na mapi.
          </p>
        ) : null}
        {state.kind === "error" ? <p className="text-destructive">{state.message}</p> : null}
      </div>

      {state.kind === "results" && state.hits.length > 0 ? (
        <ul aria-label="Rezultati pretrage adrese" className="-mx-1 max-h-60 space-y-0.5 overflow-y-auto">
          {state.hits.map((hit, index) => (
            <li key={`${hit.lat},${hit.lng},${index}`}>
              <button
                type="button"
                onClick={() => onPick(hit)}
                className="w-full rounded-md px-2 py-1.5 text-left transition-colors duration-150 outline-none focus-visible:ring-3 focus-visible:ring-ring/50 pointer-fine:hover:bg-muted"
              >
                <span className="block text-sm font-medium">{primaryLine(hit)}</span>
                <span className="line-clamp-2 block text-xs text-muted-foreground">{hit.label}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      <p className="border-t pt-2 text-[11px] text-muted-foreground">
        Pretraga adresa: Nominatim ·{" "}
        <a
          href="https://www.openstreetmap.org/copyright"
          target="_blank"
          rel="noopener noreferrer"
          className="underline underline-offset-2 pointer-fine:hover:text-foreground"
        >
          © OpenStreetMap saradnici
          <span className="sr-only"> (otvara se u novom prozoru)</span>
        </a>
      </p>
    </div>
  );
}
