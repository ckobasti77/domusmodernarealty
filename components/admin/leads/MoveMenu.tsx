"use client";

import { ArrowRightLeft } from "lucide-react";
import { DotBadge } from "@/components/admin/common/StatusBadge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { LeadStatus } from "@/convex/lib/validators";
import { LEAD_STATUS_LABEL } from "@/lib/admin/labels";
import { PIPELINE, STATUS_TONE } from "./shared";

/**
 * "Premesti u…": the single-pointer and keyboard alternative to dragging a
 * card (WCAG 2.1.1, 2.5.7). Lists every other stage.
 */
export function MoveMenu({
  current,
  contactName,
  onMove,
}: {
  current: LeadStatus;
  contactName: string;
  onMove: (status: LeadStatus) => void;
}) {
  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          data-testid="lead-card-move"
          aria-label={`Premesti u… (${contactName})`}
          title="Premesti u…"
          className="max-md:size-11"
        >
          <ArrowRightLeft aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-44">
        <DropdownMenuLabel className="text-xs text-muted-foreground">Premesti u…</DropdownMenuLabel>
        {PIPELINE.filter((status) => status !== current).map((status) => (
          <DropdownMenuItem key={status} onSelect={() => onMove(status)}>
            <DotBadge tone={STATUS_TONE[status]}>{LEAD_STATUS_LABEL[status]}</DotBadge>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
