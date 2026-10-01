"use client";

import { Copy } from "lucide-react";
import { useId, useState } from "react";
import { useFormContext, useWatch } from "react-hook-form";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { deepEqual, parseFloorPolygon, type ListingForm } from "@/lib/admin/listing-form";

const DIRTY = { shouldDirty: true, shouldValidate: true } as const;

/** One point per line, so a pasted or copied polygon stays readable. */
function stringify(points: readonly (readonly number[])[]): string {
  if (points.length === 0) return "";
  return `[\n${points.map((point) => `  [${point.join(", ")}]`).join(",\n")}\n]`;
}

/**
 * The floor polygon as JSON (`[[x, z], …]`), to paste one measured elsewhere
 * or copy it out. A valid text is applied as it is typed; the box follows the
 * drawing whenever it is not being edited.
 */
export function PolygonJson() {
  const { setValue } = useFormContext<ListingForm>();
  const polygon = useWatch<ListingForm, "walk3d.floorPolygon">({ name: "walk3d.floorPolygon" });
  const id = useId();
  const [text, setText] = useState(() => stringify(polygon));
  const [seen, setSeen] = useState(polygon);
  const [editing, setEditing] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  if (!deepEqual(seen, polygon)) {
    setSeen(polygon);
    if (!editing) {
      setText(stringify(polygon));
      setProblem(null);
    }
  }

  const onChange = (next: string) => {
    setText(next);
    const parsed = parseFloorPolygon(next);
    if (!parsed.ok) {
      setProblem(parsed.error);
      return;
    }
    setProblem(null);
    if (!deepEqual(parsed.points, polygon)) {
      setSeen(parsed.points);
      setValue("walk3d.floorPolygon", parsed.points, DIRTY);
    }
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(stringify(polygon));
      toast.success("Tlocrt je kopiran.");
    } catch {
      toast.error("Kopiranje nije uspelo. Označite tekst i kopirajte ga ručno.");
    }
  };

  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <div className="flex min-h-7 items-end justify-between gap-2">
        <Label htmlFor={id}>Tlocrt kao JSON</Label>
        <Button type="button" variant="ghost" size="sm" disabled={polygon.length === 0} onClick={() => void copy()}>
          <Copy aria-hidden="true" />
          Kopiraj
        </Button>
      </div>
      <Textarea
        id={id}
        value={text}
        rows={4}
        spellCheck={false}
        autoComplete="off"
        placeholder="[[-4.7, 2.85], [4.9, 2.85], [4.9, -1.5]]"
        className="max-h-64 font-mono text-xs"
        aria-invalid={problem !== null ? true : undefined}
        aria-describedby={problem !== null ? `${hintId} ${errorId}` : hintId}
        data-testid="floor-polygon-json"
        onFocus={() => setEditing(true)}
        onBlur={() => {
          setEditing(false);
          if (problem === null) setText(stringify(polygon));
        }}
        onChange={(event) => onChange(event.target.value)}
      />
      <p id={hintId} className="text-xs text-muted-foreground">
        Niz tačaka [x, z] u jedinicama modela, od 3 do 64 tačke. Prazno polje briše tlocrt.
      </p>
      {problem !== null ? (
        <p id={errorId} className="text-xs font-medium text-destructive">
          {problem}
        </p>
      ) : null}
    </div>
  );
}
