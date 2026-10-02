"use client";

import { useMutation } from "convex/react";
import { Archive, EyeOff, Globe, Trash2, UserRound, X } from "lucide-react";
import { useState, type ReactNode } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/admin/common/ConfirmDialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { adminErrorMessage } from "@/lib/admin/errors";
import { formatCount } from "@/lib/format";
import type { AdminRow, AgentOption } from "./types";

type BulkAction = "publish" | "unpublish" | "archive" | "assign" | "deleteDemo";
type Skipped = { ref: string; reason: string };

const COPY: Record<
  BulkAction,
  { title: string; description: string; confirm: string; destructive?: boolean }
> = {
  publish: {
    title: "Objaviti izabrane nekretnine?",
    description:
      "Na sajtu se pojavljuju samo nekretnine koje prođu kontrolnu listu za objavu. Ostale se preskaču i dobićete razlog za svaku.",
    confirm: "Objavi",
  },
  unpublish: {
    title: "Povući izabrane nekretnine sa sajta?",
    description: "Oglasi prelaze u status „Povučeno” i više nisu dostupni na sajtu.",
    confirm: "Povuci sa sajta",
  },
  archive: {
    title: "Arhivirati izabrane nekretnine?",
    description: "Arhivirane nekretnine nisu na sajtu i sklanjaju se iz radnih pregleda.",
    confirm: "Arhiviraj",
  },
  assign: {
    title: "Dodeliti izabrane nekretnine agentu?",
    description: "Izabrani agent postaje zadužen za ove oglase i prikazuje se kao kontakt na sajtu.",
    confirm: "Dodeli",
  },
  deleteDemo: {
    title: "Obrisati izabrane demo nekretnine?",
    description:
      "Demo oglasi, njihove fotografije i statistika biće trajno obrisani. Ova radnja se ne može poništiti.",
    confirm: "Obriši demo",
    destructive: true,
  },
};

/** `listingsAdmin.bulk` handles at most this many ids per call. */
function chunkSize(action: BulkAction): number {
  return action === "deleteDemo" ? 25 : 100;
}

function reportResult(action: BulkAction, done: number, skipped: readonly Skipped[]) {
  if (done > 0 || skipped.length === 0) {
    const verb = action === "deleteDemo" ? "obrisano" : "izmenjeno";
    toast.success(`${formatCount(done, "sr-Latn")} ${verb}`);
  }
  if (skipped.length > 0) {
    const rest = skipped.length - 3;
    toast.warning(`Preskočeno: ${formatCount(skipped.length, "sr-Latn")}`, {
      description: (
        <ul className="mt-1 space-y-0.5">
          {skipped.slice(0, 3).map((item) => (
            <li key={item.ref}>
              <span className="font-mono">{item.ref}</span>: {item.reason}
            </li>
          ))}
          {rest > 0 ? <li>i još {formatCount(rest, "sr-Latn")}</li> : null}
        </ul>
      ),
    });
  }
}

function BarButton({
  icon,
  children,
  onClick,
  disabled,
  destructive,
  title,
}: {
  icon: ReactNode;
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  destructive?: boolean;
  title?: string;
}) {
  return (
    <Button
      size="sm"
      variant={destructive ? "destructive" : "outline"}
      onClick={onClick}
      disabled={disabled}
      title={title}
    >
      {icon}
      {children}
    </Button>
  );
}

/**
 * Bulk actions over the selected rows (admin/manager). Every action is
 * confirmed; the server re-checks roles and the publish checklist per listing
 * and reports what it skipped.
 */
export function BulkBar({
  selected,
  agents,
  onClear,
  onDone,
}: {
  selected: readonly AdminRow[];
  agents: readonly AgentOption[] | undefined;
  onClear: () => void;
  /** After a run: the ids it did not get to (a failed batch and those after it) stay selected. */
  onDone: (unprocessed: readonly Id<"listings">[]) => void;
}) {
  const bulk = useMutation(api.listingsAdmin.bulk);
  // The action outlives `open` so the dialog text does not change while it
  // animates closed.
  const [action, setAction] = useState<BulkAction>("publish");
  const [open, setOpen] = useState(false);
  const [agentId, setAgentId] = useState<Id<"agents"> | undefined>(undefined);
  const [agentError, setAgentError] = useState(false);

  const allDemo = selected.length > 0 && selected.every((row) => row.isDemo);
  const count = formatCount(selected.length, "sr-Latn");

  const ask = (next: BulkAction) => {
    setAction(next);
    setAgentError(false);
    setOpen(true);
  };

  const run = async (): Promise<boolean> => {
    if (action === "assign" && agentId === undefined) {
      setAgentError(true);
      return false;
    }
    const ids = selected.map((row) => row._id);
    const size = chunkSize(action);
    let done = 0;
    const skipped: Skipped[] = [];
    // Each batch is one transaction: a failed one changed nothing.
    let next = 0;
    try {
      for (; next < ids.length; next += size) {
        const result = await bulk({
          ids: ids.slice(next, next + size),
          action,
          ...(action === "assign" && agentId !== undefined ? { agentId } : {}),
        });
        done += result.done;
        skipped.push(...result.skipped);
      }
    } catch (error) {
      toast.error(adminErrorMessage(error));
      // Nothing was processed: keep the dialog open so the action can be retried.
      if (next === 0) return false;
    }
    reportResult(action, done, skipped);
    onDone(ids.slice(next));
    return true;
  };

  const copy = COPY[action];

  return (
    <div
      data-testid="bulk-bar"
      role="region"
      aria-label="Grupne radnje"
      className="flex flex-wrap items-center gap-2 border-b bg-muted/60 px-3 py-2"
    >
      <p className="mr-1 text-sm font-medium tabular-nums" aria-live="polite">
        Izabrano: {count}
      </p>
      <BarButton icon={<Globe aria-hidden="true" />} onClick={() => ask("publish")}>
        Objavi
      </BarButton>
      <BarButton icon={<EyeOff aria-hidden="true" />} onClick={() => ask("unpublish")}>
        Povuci sa sajta
      </BarButton>
      <BarButton icon={<Archive aria-hidden="true" />} onClick={() => ask("archive")}>
        Arhiviraj
      </BarButton>
      <BarButton icon={<UserRound aria-hidden="true" />} onClick={() => ask("assign")}>
        Dodeli agentu
      </BarButton>
      <BarButton
        icon={<Trash2 aria-hidden="true" />}
        onClick={() => ask("deleteDemo")}
        disabled={!allDemo}
        destructive
        title={allDemo ? undefined : "Dostupno samo kada su sve izabrane nekretnine demo."}
      >
        Obriši demo
      </BarButton>
      <Button size="sm" variant="ghost" onClick={onClear} className="ml-auto text-muted-foreground">
        <X aria-hidden="true" />
        Poništi izbor
      </Button>

      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title={copy.title}
        description={`Izabrano: ${count}. ${copy.description}`}
        confirmLabel={copy.confirm}
        destructive={copy.destructive === true}
        onConfirm={run}
      >
        {action === "assign" ? (
          <div className="grid gap-2">
            <Label htmlFor="bulk-agent">Agent</Label>
            <Select
              value={agentId ?? ""}
              onValueChange={(value) => {
                setAgentId(agents?.find((agent) => agent._id === value)?._id);
                setAgentError(false);
              }}
            >
              <SelectTrigger
                id="bulk-agent"
                className="w-full"
                aria-invalid={agentError}
                aria-describedby={agentError ? "bulk-agent-error" : undefined}
              >
                <SelectValue placeholder="Izaberite agenta" />
              </SelectTrigger>
              <SelectContent position="popper">
                {(agents ?? []).map((agent) => (
                  <SelectItem key={agent._id} value={agent._id}>
                    {agent.isPublic ? agent.name : `${agent.name} (skriven profil)`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {agentError ? (
              <p id="bulk-agent-error" className="text-xs text-destructive">
                Izaberite agenta.
              </p>
            ) : null}
          </div>
        ) : null}
      </ConfirmDialog>
    </div>
  );
}
