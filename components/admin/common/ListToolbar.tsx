"use client";

import { Search, X } from "lucide-react";
import { useEffect, useId, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

/**
 * The filter row above every admin list: search on the left, selects after
 * it, extra actions at the end. Wraps on narrow screens.
 */
export function ListToolbar({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div role="toolbar" aria-label="Filteri" className={cn("mb-4 flex flex-wrap items-end gap-2", className)}>
      {children}
    </div>
  );
}

/** Debounced search box (300 ms); Escape or the × clears it. */
export function SearchInput({
  value,
  onChange,
  placeholder = "Pretraga…",
  label = "Pretraga",
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  label?: string;
  className?: string;
}) {
  const [text, setText] = useState(value);
  const [synced, setSynced] = useState(value);
  // Adopt outside changes (e.g. "Očisti filtere") without an effect loop.
  if (value !== synced) {
    setSynced(value);
    setText(value);
  }

  useEffect(() => {
    if (text === value) return;
    const timer = window.setTimeout(() => onChange(text), 300);
    return () => window.clearTimeout(timer);
  }, [text, value, onChange]);

  return (
    <div className={cn("relative w-full sm:w-64", className)}>
      <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
      <Input
        type="search"
        aria-label={label}
        placeholder={placeholder}
        value={text}
        onChange={(event) => setText(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Escape" && text.length > 0) {
            event.preventDefault();
            setText("");
            onChange("");
          }
        }}
        className="pr-8 pl-8"
      />
      {text.length > 0 ? (
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label="Obrišite pretragu"
          className="absolute top-1/2 right-1 -translate-y-1/2"
          onClick={() => {
            setText("");
            onChange("");
          }}
        >
          <X aria-hidden="true" />
        </Button>
      ) : null}
    </div>
  );
}

const ALL = "__all__";

/** A labelled select whose first option means "no filter" (`undefined`). */
export function FilterSelect<V extends string>({
  label,
  value,
  onChange,
  options,
  allLabel = "Svi",
  className,
}: {
  label: string;
  value: V | undefined;
  onChange: (value: V | undefined) => void;
  options: readonly { value: V; label: string }[];
  allLabel?: string;
  className?: string;
}) {
  const id = useId();
  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <span id={id} className="text-xs text-muted-foreground">
        {label}
      </span>
      <Select
        value={value ?? ALL}
        onValueChange={(next) => onChange(next === ALL ? undefined : options.find((option) => option.value === next)?.value)}
      >
        <SelectTrigger aria-labelledby={id} className="w-full min-w-36 sm:w-auto">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
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

/** Options from a label map, in its declaration order. */
export function optionsFrom<K extends string>(labels: Record<K, string>): { value: K; label: string }[] {
  return (Object.keys(labels) as K[]).map((value) => ({ value, label: labels[value] }));
}

/** An empty list or an empty search result, with an optional next step. */
export function EmptyState({
  title,
  description,
  action,
  icon,
  className,
}: {
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  icon?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center rounded-xl border border-dashed px-6 py-12 text-center", className)}>
      {icon !== undefined ? <div className="mb-3 text-muted-foreground [&_svg]:size-8">{icon}</div> : null}
      <p className="text-sm font-medium">{title}</p>
      {description !== undefined ? <p className="mt-1 max-w-sm text-sm text-muted-foreground">{description}</p> : null}
      {action !== undefined ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

/** "Učitaj još" under a paginated list. */
export function LoadMore({
  status,
  onLoadMore,
  shown,
}: {
  status: "LoadingFirstPage" | "CanLoadMore" | "LoadingMore" | "Exhausted";
  onLoadMore: () => void;
  shown: number;
}) {
  if (status === "LoadingFirstPage") return null;
  return (
    <div className="mt-4 flex items-center justify-between gap-2 text-xs text-muted-foreground">
      <span aria-live="polite">Prikazano: {shown}</span>
      {status === "Exhausted" ? null : (
        <Button variant="outline" size="sm" disabled={status === "LoadingMore"} onClick={onLoadMore}>
          {status === "LoadingMore" ? "Učitavanje…" : "Učitaj još"}
        </Button>
      )}
    </div>
  );
}
