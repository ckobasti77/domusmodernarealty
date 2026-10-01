"use client";

import { useMutation } from "convex/react";
import type { OptimisticLocalStore } from "convex/browser";
import { useCallback, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import type { LeadStatus } from "@/convex/lib/validators";
import { adminErrorMessage } from "@/lib/admin/errors";
import { LEAD_STATUS_LABEL } from "@/lib/admin/labels";
import { LossReasonDialog } from "./LossReasonDialog";
import type { LeadRow } from "./shared";

type Move = { id: Id<"leads">; status: LeadStatus; lossReason?: string };

/** Newest first, as the server orders a column. */
function insertByDate(items: readonly LeadRow[], card: LeadRow): LeadRow[] {
  const index = items.findIndex((item) => item.createdAt < card.createdAt);
  return index === -1 ? [...items, card] : [...items.slice(0, index), card, ...items.slice(index)];
}

/**
 * Moves the card on every loaded board and updates an open sheet at once;
 * Convex swaps in the server's answer (or rolls back on an error) by itself.
 */
function moveOptimistically(store: OptimisticLocalStore, move: Move): void {
  for (const { args, value } of store.getAllQueries(api.leadsAdmin.kanban)) {
    if (value === undefined) continue;
    let card: LeadRow | undefined;
    const without = value.map((column) => {
      const found = column.items.find((item) => item._id === move.id);
      if (found === undefined) return column;
      card = found;
      return {
        ...column,
        total: Math.max(0, column.total - 1),
        items: column.items.filter((item) => item._id !== move.id),
      };
    });
    if (card === undefined) continue;
    const moved: LeadRow = {
      ...card,
      status: move.status,
      lossReason: move.status === "lost" ? move.lossReason : undefined,
    };
    store.setQuery(
      api.leadsAdmin.kanban,
      args,
      without.map((column) =>
        column.status === move.status
          ? { ...column, total: column.total + 1, items: insertByDate(column.items, moved) }
          : column,
      ),
    );
  }
  for (const { args, value } of store.getAllQueries(api.leadsAdmin.get)) {
    if (value === undefined || value === null || value.lead._id !== move.id) continue;
    store.setQuery(api.leadsAdmin.get, args, {
      ...value,
      lead: {
        ...value.lead,
        status: move.status,
        lossReason: move.status === "lost" ? move.lossReason : undefined,
      },
    });
  }
}

type Target = Pick<LeadRow, "_id" | "contactName" | "status">;

/**
 * One way to change a lead's stage for the board, the card menu and the
 * sheet: "Izgubljen" first asks for the reason, everything else is sent at
 * once with an optimistic move. Render `dialog` once near the root.
 */
export function useLeadStatus(): {
  changeStatus: (lead: Target, status: LeadStatus) => void;
  dialog: ReactNode;
} {
  const setStatus = useMutation(api.leadsAdmin.setStatus).withOptimisticUpdate(moveOptimistically);
  const [losing, setLosing] = useState<Target | null>(null);

  const send = useCallback(
    async (lead: Target, move: Move): Promise<boolean> => {
      try {
        await setStatus(move);
        toast.success(`${lead.contactName}: „${LEAD_STATUS_LABEL[move.status]}”.`);
        return true;
      } catch (error) {
        toast.error(adminErrorMessage(error));
        return false;
      }
    },
    [setStatus],
  );

  const changeStatus = useCallback(
    (lead: Target, status: LeadStatus) => {
      if (status === lead.status) return;
      if (status === "lost") {
        setLosing(lead);
        return;
      }
      void send(lead, { id: lead._id, status });
    },
    [send],
  );

  const dialog = (
    <LossReasonDialog
      open={losing !== null}
      contactName={losing?.contactName ?? ""}
      onCancel={() => setLosing(null)}
      onSubmit={async (reason) => {
        if (losing === null) return false;
        const ok = await send(losing, { id: losing._id, status: "lost", lossReason: reason });
        if (ok) setLosing(null);
        return ok;
      }}
    />
  );

  return { changeStatus, dialog };
}
