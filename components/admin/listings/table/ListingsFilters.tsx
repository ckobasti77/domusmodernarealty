"use client";

import { Search, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { PROPERTY_TYPE_LABEL, TRANSACTION_LABEL } from "@/lib/admin/labels";
import { cn } from "@/lib/utils";
import {
  isPropertyType,
  isTransaction,
  PROPERTY_TYPES,
  TRANSACTIONS,
  type ListingFilters,
} from "./filters";
import type { AgentOption } from "./types";

/** Radix Select forbids an empty-string value, so "no filter" is this sentinel. */
const ALL = "all";
const SEARCH_DEBOUNCE_MS = 300;

type Option = { value: string; label: string };

function FilterSelect({
  id,
  label,
  value,
  allLabel,
  options,
  onChange,
  className,
}: {
  id: string;
  label: string;
  value: string | undefined;
  allLabel: string;
  options: readonly Option[];
  onChange: (value: string | undefined) => void;
  className?: string;
}) {
  return (
    <div className={cn("flex min-w-0 items-center", className)}>
      <Label htmlFor={id} className="sr-only">
        {label}
      </Label>
      <Select value={value ?? ALL} onValueChange={(next) => onChange(next === ALL ? undefined : next)}>
        <SelectTrigger id={id} className="h-8 w-full sm:w-auto sm:min-w-36">
          <SelectValue />
        </SelectTrigger>
        <SelectContent position="popper" align="start">
          <SelectItem value={ALL}>{allLabel}</SelectItem>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

/**
 * The search box keeps its own draft and writes to the URL 300 ms after the
 * last keystroke. When the URL's `q` moves for another reason (sidebar link,
 * "Poništi filtere"), the draft follows it.
 */
function SearchBox({ value, onCommit }: { value: string; onCommit: (q: string) => void }) {
  const [draft, setDraft] = useState(value);
  const [seen, setSeen] = useState(value);
  if (value !== seen) {
    setSeen(value);
    if (value !== draft.trim()) setDraft(value);
  }

  useEffect(() => {
    const next = draft.trim();
    if (next === value) return;
    const timer = window.setTimeout(() => onCommit(next), SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [draft, value, onCommit]);

  return (
    <div className="col-span-2 w-full sm:w-72">
      <Label htmlFor="listings-search" className="sr-only">
        Pretraga nekretnina
      </Label>
      {/* Same 44 px touch height as the selects below `md`. */}
      <InputGroup className="max-md:h-11">
        <InputGroupAddon>
          <Search aria-hidden="true" />
        </InputGroupAddon>
        <InputGroupInput
          id="listings-search"
          data-testid="listings-search"
          type="search"
          autoComplete="off"
          spellCheck={false}
          placeholder="Šifra, naslov ili lokacija…"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") onCommit(draft.trim());
          }}
        />
      </InputGroup>
    </div>
  );
}

const TRANSACTION_OPTIONS: readonly Option[] = TRANSACTIONS.map((value) => ({
  value,
  label: TRANSACTION_LABEL[value],
}));

const TYPE_OPTIONS: readonly Option[] = PROPERTY_TYPES.map((value) => ({
  value,
  label: PROPERTY_TYPE_LABEL[value],
}));

export function ListingsFilters({
  filters,
  agentId,
  agents,
  showAgentFilter,
  hasFilters,
  onChange,
  onClear,
}: {
  filters: ListingFilters;
  /** The agent filter actually applied (a URL id that matches no agent is dropped). */
  agentId: string | undefined;
  agents: readonly AgentOption[] | undefined;
  showAgentFilter: boolean;
  hasFilters: boolean;
  onChange: (patch: Partial<ListingFilters>) => void;
  onClear: () => void;
}) {
  // Stable, so a live data update re-rendering the table does not restart the
  // search debounce.
  const commitSearch = useCallback((q: string) => onChange({ q }), [onChange]);
  const agentOptions: Option[] = (agents ?? []).map((agent) => ({
    value: agent._id,
    label: agent.isPublic ? agent.name : `${agent.name} (skriven profil)`,
  }));

  return (
    // Phones: a two-column grid (search and the demo switch on full rows);
    // from `sm` one wrapping row.
    <div className="grid grid-cols-2 gap-2 border-b p-3 sm:flex sm:flex-wrap sm:items-center">
      <SearchBox value={filters.q} onCommit={commitSearch} />
      <FilterSelect
        id="filter-transaction"
        label="Transakcija"
        value={filters.tx}
        allLabel="Prodaja i izdavanje"
        options={TRANSACTION_OPTIONS}
        onChange={(value) => onChange({ tx: isTransaction(value) ? value : undefined })}
      />
      <FilterSelect
        id="filter-type"
        label="Tip nekretnine"
        value={filters.type}
        allLabel="Svi tipovi"
        options={TYPE_OPTIONS}
        onChange={(value) => onChange({ type: isPropertyType(value) ? value : undefined })}
      />
      {showAgentFilter ? (
        <FilterSelect
          id="filter-agent"
          label="Agent"
          value={agentId}
          allLabel="Svi agenti"
          options={agentOptions}
          onChange={(value) => onChange({ agent: value })}
          className="col-span-2"
        />
      ) : null}
      <div className="col-span-2 flex h-8 items-center gap-2 px-1">
        <Switch
          id="filter-demo"
          checked={filters.demo}
          onCheckedChange={(checked) => onChange({ demo: checked })}
        />
        <Label htmlFor="filter-demo" className="font-normal">
          Samo demo
        </Label>
      </div>
      {hasFilters ? (
        <Button
          variant="ghost"
          size="sm"
          onClick={onClear}
          className="col-span-2 justify-self-start text-muted-foreground"
        >
          <X aria-hidden="true" />
          Poništi filtere
        </Button>
      ) : null}
    </div>
  );
}
