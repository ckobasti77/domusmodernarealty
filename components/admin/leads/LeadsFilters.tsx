"use client";

import { X } from "lucide-react";
import { useId } from "react";
import { FilterSelect, ListToolbar, optionsFrom } from "@/components/admin/common/ListToolbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LEAD_SOURCE_LABEL, LEAD_STATUS_LABEL, LEAD_TYPE_LABEL } from "@/lib/admin/labels";
import { cn } from "@/lib/utils";
import { UNASSIGNED, type LeadParams } from "./params";

const TYPE_OPTIONS = optionsFrom(LEAD_TYPE_LABEL);
const STATUS_OPTIONS = optionsFrom(LEAD_STATUS_LABEL);
const SOURCE_OPTIONS = optionsFrom(LEAD_SOURCE_LABEL);

export type AgentOption = { _id: string; name: string };

function DateField({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  value: string;
  min?: string;
  max?: string;
  onChange: (value: string) => void;
}) {
  const id = useId();
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-xs text-muted-foreground">
        {label}
      </label>
      <Input
        id={id}
        type="date"
        value={value}
        min={min}
        max={max}
        onChange={(event) => onChange(event.target.value)}
        className="w-full sm:w-38"
      />
    </div>
  );
}

/** Type, stage (list only), agent (managers), source and a created-date range. */
export function LeadsFilters({
  params,
  onChange,
  onClear,
  hasFilters,
  agents,
  showAgent,
  showStatus,
  className,
}: {
  params: LeadParams;
  onChange: (patch: Partial<LeadParams>) => void;
  onClear: () => void;
  hasFilters: boolean;
  agents: readonly AgentOption[] | undefined;
  showAgent: boolean;
  showStatus: boolean;
  className?: string;
}) {
  const agentOptions = [
    { value: UNASSIGNED, label: "Bez agenta" },
    ...(agents ?? []).map((agent) => ({ value: agent._id, label: agent.name })),
  ];

  return (
    <ListToolbar className={cn("mb-0", className)}>
      <FilterSelect
        label="Vrsta"
        value={params.type}
        options={TYPE_OPTIONS}
        allLabel="Sve vrste"
        onChange={(type) => onChange({ type })}
      />
      {showStatus ? (
        <FilterSelect
          label="Faza"
          value={params.status}
          options={STATUS_OPTIONS}
          allLabel="Sve faze"
          onChange={(status) => onChange({ status })}
        />
      ) : null}
      {showAgent ? (
        <FilterSelect
          label="Agent"
          value={params.agent}
          options={agentOptions}
          allLabel="Svi agenti"
          onChange={(agent) => onChange({ agent })}
        />
      ) : null}
      <FilterSelect
        label="Izvor"
        value={params.source}
        options={SOURCE_OPTIONS}
        allLabel="Svi izvori"
        onChange={(source) => onChange({ source })}
      />
      <DateField
        label="Primljen od"
        value={params.from}
        max={params.to.length > 0 ? params.to : undefined}
        onChange={(from) => onChange({ from })}
      />
      <DateField
        label="do"
        value={params.to}
        min={params.from.length > 0 ? params.from : undefined}
        onChange={(to) => onChange({ to })}
      />
      {hasFilters ? (
        <Button variant="ghost" onClick={onClear} className="sm:mb-0">
          <X aria-hidden="true" />
          Poništi filtere
        </Button>
      ) : null}
    </ListToolbar>
  );
}
