"use client";

import {
  DndContext,
  DragOverlay,
  MouseSensor,
  TouchSensor,
  pointerWithin,
  rectIntersection,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type Announcements,
  type CollisionDetection,
  type DragEndEvent,
  type DragStartEvent,
  type ScreenReaderInstructions,
} from "@dnd-kit/core";
import { useQuery } from "convex/react";
import type { FunctionArgs } from "convex/server";
import Link from "next/link";
import { useId, useState, type ReactNode } from "react";
import type { DotTone } from "@/components/admin/common/StatusBadge";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import type { LeadStatus } from "@/convex/lib/validators";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { formatRelative } from "@/lib/admin/format";
import { LEAD_STATUS_LABEL, LEAD_TYPE_LABEL } from "@/lib/admin/labels";
import { cn } from "@/lib/utils";
import { DemoTag, NextActionDate, ResponseTimer } from "./cells";
import { MoveMenu } from "./MoveMenu";
import { PIPELINE, STATUS_TONE, type KanbanColumn, type LeadRow } from "./shared";

const CARDS_PER_COLUMN = 25;

export type KanbanArgs = Omit<FunctionArgs<typeof api.leadsAdmin.kanban>, "limitPerColumn">;

const TONE_DOT: Record<DotTone, string> = {
  success: "bg-success",
  warning: "bg-warning",
  accent: "bg-bronze",
  strong: "bg-foreground",
  muted: "bg-stone",
  danger: "bg-destructive",
};

function isStatus(value: unknown): value is LeadStatus {
  return typeof value === "string" && (PIPELINE as readonly string[]).includes(value);
}

/** Pointer inside a column wins; otherwise the column the card overlaps most. */
const collision: CollisionDetection = (args) => {
  const inside = pointerWithin(args);
  return inside.length > 0 ? inside : rectIntersection(args);
};

const INSTRUCTIONS: ScreenReaderInstructions = {
  draggable:
    "Karticu prevucite mišem u drugu fazu, a na ekranu osetljivom na dodir pritisnite i zadržite pa prevucite. Sa tastature koristite dugme „Premesti u…” na kartici.",
};

/** Keep the previous board on screen while new filters load. */
function useHeld<T>(value: T | undefined): T | undefined {
  const [held, setHeld] = useState(value);
  if (value !== undefined && held !== value) setHeld(value);
  return value ?? held;
}

/**
 * The pipeline (PRD B4): Novi → Kontaktiran → Kvalifikovan → Razgledanje →
 * Ponuda → Dobijen / Izgubljen. Drag a card to another column, or use its
 * "Premesti u…" menu; "Izgubljen" asks for the reason first.
 */
export function LeadsKanban({
  args,
  now,
  showAgent,
  onOpen,
  onMove,
  moreHref,
}: {
  args: KanbanArgs | "skip";
  now: number;
  showAgent: boolean;
  onOpen: (id: Id<"leads">) => void;
  onMove: (lead: LeadRow, status: LeadStatus) => void;
  moreHref: (status: LeadStatus) => string;
}) {
  const live = useQuery(
    api.leadsAdmin.kanban,
    args === "skip" ? "skip" : { ...args, limitPerColumn: CARDS_PER_COLUMN },
  );
  const columns = useHeld(live);
  const refreshing = live === undefined && columns !== undefined;
  const reduced = useReducedMotion();

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    // A long press, so a finger can still scroll the board sideways.
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 8 } }),
  );
  const [active, setActive] = useState<LeadRow | null>(null);

  const cards = new Map<string, LeadRow>();
  for (const column of columns ?? []) for (const item of column.items) cards.set(item._id, item);

  const announcements: Announcements = {
    onDragStart: ({ active: item }) => `Podignuta kartica ${cards.get(String(item.id))?.contactName ?? ""}.`,
    onDragOver: ({ over }) =>
      isStatus(over?.id) ? `Iznad faze „${LEAD_STATUS_LABEL[over.id]}”.` : "Izvan kolona.",
    onDragEnd: ({ over }) =>
      isStatus(over?.id) ? `Kartica spuštena u fazu „${LEAD_STATUS_LABEL[over.id]}”.` : "Kartica vraćena.",
    onDragCancel: () => "Premeštanje otkazano, kartica je vraćena.",
  };

  const onDragStart = (event: DragStartEvent) => {
    setActive(cards.get(String(event.active.id)) ?? null);
  };
  const onDragEnd = (event: DragEndEvent) => {
    setActive(null);
    const lead = cards.get(String(event.active.id));
    const target = event.over?.id;
    if (lead === undefined || !isStatus(target) || target === lead.status) return;
    onMove(lead, target);
  };

  if (columns === undefined) return <BoardSkeleton />;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={collision}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragCancel={() => setActive(null)}
      accessibility={{ announcements, screenReaderInstructions: INSTRUCTIONS }}
    >
      <div
        role="region"
        aria-label="Faze prodaje"
        aria-busy={refreshing}
        tabIndex={0}
        data-testid="leads-kanban"
        className={cn(
          "-mx-1 flex gap-3 overflow-x-auto px-1 pb-3 outline-none focus-visible:ring-3 focus-visible:ring-ring/50 transition-opacity duration-150",
          refreshing && "opacity-60",
        )}
      >
        {columns.map((column) => (
          <Column
            key={column.status}
            column={column}
            now={now}
            showAgent={showAgent}
            draggingId={active?._id}
            onOpen={onOpen}
            onMove={onMove}
            moreHref={moreHref(column.status)}
          />
        ))}
      </div>
      <DragOverlay dropAnimation={reduced ? null : undefined}>
        {active !== null ? (
          <CardBody lead={active} now={now} showAgent={showAgent} overlay />
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

function Column({
  column,
  now,
  showAgent,
  draggingId,
  onOpen,
  onMove,
  moreHref,
}: {
  column: KanbanColumn;
  now: number;
  showAgent: boolean;
  draggingId: string | undefined;
  onOpen: (id: Id<"leads">) => void;
  onMove: (lead: LeadRow, status: LeadStatus) => void;
  moreHref: string;
}) {
  const headingId = useId();
  const { setNodeRef, isOver } = useDroppable({ id: column.status });
  const label = LEAD_STATUS_LABEL[column.status];
  const count = column.capped ? `${column.total}+` : String(column.total);
  const hidden = column.total - column.items.length;

  return (
    <section
      ref={setNodeRef}
      aria-labelledby={headingId}
      data-testid={`kanban-column-${column.status}`}
      data-count={column.total}
      className={cn(
        "flex w-64 shrink-0 flex-col rounded-lg border bg-muted/40 transition-colors duration-150",
        isOver && "border-primary/60 bg-primary/5",
      )}
    >
      <header className="flex items-center justify-between gap-2 border-b px-3 py-2">
        <h2 id={headingId} className="flex items-center gap-2 text-sm font-semibold">
          <span aria-hidden="true" className={cn("size-1.5 rounded-full", TONE_DOT[STATUS_TONE[column.status]])} />
          {label}
        </h2>
        <span className="rounded-full bg-background px-1.5 text-xs font-medium tabular-nums">
          <span aria-hidden="true">{count}</span>
          <span className="sr-only">{`${count} upita`}</span>
        </span>
      </header>
      <ul className="flex min-h-24 flex-col gap-2 p-2 md:max-h-[calc(100svh-19rem)] md:overflow-y-auto" aria-label={label}>
        {column.items.length === 0 ? (
          <li className="rounded-md border border-dashed px-3 py-6 text-center text-xs text-muted-foreground">
            Nema upita
          </li>
        ) : null}
        {column.items.map((lead) => (
          <DraggableCard
            key={lead._id}
            lead={lead}
            now={now}
            showAgent={showAgent}
            dragging={draggingId === lead._id}
            onOpen={onOpen}
            onMove={onMove}
          />
        ))}
      </ul>
      {hidden > 0 || column.capped ? (
        <Link
          href={moreHref}
          className="border-t px-3 py-2 text-xs text-muted-foreground transition-colors duration-150 outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          {column.capped ? "Još upita u listi" : `Još ${hidden} u listi`}
          <span className="sr-only"> ({label})</span>
        </Link>
      ) : null}
    </section>
  );
}

function DraggableCard({
  lead,
  now,
  showAgent,
  dragging,
  onOpen,
  onMove,
}: {
  lead: LeadRow;
  now: number;
  showAgent: boolean;
  dragging: boolean;
  onOpen: (id: Id<"leads">) => void;
  onMove: (lead: LeadRow, status: LeadStatus) => void;
}) {
  // Only the pointer listeners: keyboard users open the card and move it
  // through "Premesti u…", so the card itself is not a focus stop.
  const { setNodeRef, listeners } = useDraggable({ id: lead._id });
  return (
    <li
      ref={setNodeRef}
      {...listeners}
      data-testid="lead-card"
      data-lead-id={lead._id}
      data-status={lead.status}
      className={cn("touch-manipulation select-none", dragging && "opacity-40")}
    >
      <CardBody
        lead={lead}
        now={now}
        showAgent={showAgent}
        onOpen={() => onOpen(lead._id)}
        menu={
          // Pressing the menu must never start a drag.
          <span onMouseDown={(event) => event.stopPropagation()} onTouchStart={(event) => event.stopPropagation()}>
            <MoveMenu current={lead.status} contactName={lead.contactName} onMove={(status) => onMove(lead, status)} />
          </span>
        }
      />
    </li>
  );
}

function CardBody({
  lead,
  now,
  showAgent,
  onOpen,
  menu,
  overlay = false,
}: {
  lead: LeadRow;
  now: number;
  showAgent: boolean;
  onOpen?: () => void;
  menu?: ReactNode;
  overlay?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-md border bg-card p-2.5 text-card-foreground shadow-xs transition-shadow duration-150 hover:shadow-sm",
        overlay ? "w-60 cursor-grabbing shadow-lg" : "cursor-grab",
      )}
    >
      <div className="flex items-start justify-between gap-1">
        <div className="min-w-0 flex-1">
          {onOpen !== undefined ? (
            <button
              type="button"
              onClick={onOpen}
              className="block max-w-full truncate rounded-sm text-left text-sm font-medium outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              {lead.contactName}
            </button>
          ) : (
            <p className="truncate text-sm font-medium">{lead.contactName}</p>
          )}
          <p className="mt-0.5 truncate text-xs text-muted-foreground">
            {LEAD_TYPE_LABEL[lead.type]}
            {lead.listingRef !== undefined ? <span className="font-mono">{` · ${lead.listingRef}`}</span> : null}
          </p>
        </div>
        {menu}
      </div>
      {showAgent ? (
        <p className="mt-1 truncate text-xs text-muted-foreground">{lead.agentName ?? "Bez agenta"}</p>
      ) : null}
      {lead.status === "lost" && lead.lossReason !== undefined ? (
        <p className="mt-1 line-clamp-2 text-xs text-muted-foreground italic">{lead.lossReason}</p>
      ) : null}
      <div className="mt-2 flex items-center justify-between gap-2">
        {lead.firstResponseAt === undefined ? (
          <ResponseTimer createdAt={lead.createdAt} firstResponseAt={undefined} now={now} />
        ) : lead.nextActionAt !== undefined ? (
          <span className="text-xs text-muted-foreground">
            Sledeći korak: <NextActionDate at={lead.nextActionAt} now={now} />
          </span>
        ) : (
          <span />
        )}
        <span className="flex items-center gap-1.5">
          {lead.isDemo ? <DemoTag /> : null}
          <time dateTime={new Date(lead.createdAt).toISOString()} className="text-xs whitespace-nowrap text-muted-foreground">
            {formatRelative(lead.createdAt, now)}
          </time>
        </span>
      </div>
    </div>
  );
}

function BoardSkeleton() {
  return (
    <div aria-busy="true" aria-label="Faze se učitavaju" className="flex gap-3 overflow-hidden pb-3">
      {PIPELINE.map((status) => (
        <div key={status} className="w-64 shrink-0 space-y-2 rounded-lg border bg-muted/40 p-2">
          <Skeleton className="h-5 w-24" />
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
      ))}
    </div>
  );
}
