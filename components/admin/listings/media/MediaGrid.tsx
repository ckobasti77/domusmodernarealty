"use client";

import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type Announcements,
  type DragEndEvent,
  type PointerSensorOptions,
  type ScreenReaderInstructions,
  type UniqueIdentifier,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useMutation } from "convex/react";
import { GripVertical, ImageOff, Pencil, Star, Trash2, TriangleAlert } from "lucide-react";
import { useId, useMemo, useState, type ComponentProps, type PointerEvent as ReactPointerEvent } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/admin/common/ConfirmDialog";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import type { MediaItem } from "@/convex/lib/validators";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { adminErrorMessage } from "@/lib/admin/errors";
import { ROOM_TAG_LABEL } from "@/lib/admin/labels";
import { cn } from "@/lib/utils";
import { MediaMetaDialog } from "./MediaMetaDialog";
import { isLowRes, thumbUrl, type MediaTarget } from "./shared";

/**
 * Pointer drags start anywhere on a tile with a mouse or pen, but on touch only
 * from the grip, so a finger on a photo still scrolls the page. Events that
 * bubble through React from a portal (dialogs, tooltips) never start a drag.
 */
class TilePointerSensor extends PointerSensor {
  static activators = [
    {
      eventName: "onPointerDown" as const,
      handler: ({ nativeEvent: event, currentTarget }: ReactPointerEvent, { onActivation }: PointerSensorOptions) => {
        if (!event.isPrimary || event.button !== 0) return false;
        const target = event.target;
        if (!(target instanceof Element) || !currentTarget.contains(target)) return false;
        if (event.pointerType === "touch" && target.closest("[data-drag-handle]") === null) return false;
        onActivation?.({ event });
        return true;
      },
    },
  ];
}

/** Grammar for the Serbian drag announcements. */
const WORDS: Record<MediaTarget, { Name: string; name: string; picked: string; dropped: string; returned: string }> = {
  gallery: { Name: "Fotografija", name: "fotografiju", picked: "podignuta", dropped: "spuštena", returned: "vraćena" },
  floorPlans: { Name: "Tlocrt", name: "tlocrt", picked: "podignut", dropped: "spušten", returned: "vraćen" },
};

const INSTRUCTIONS: ScreenReaderInstructions = {
  draggable:
    "Da biste promenili redosled, pritisnite razmaknicu ili Enter. Strelicama birate novo mesto, razmaknicom ili Enterom potvrđujete, a tasterom Escape otkazujete.",
};

/** Local optimistic order laid over the server order; ids added or removed meanwhile are reconciled. */
function mergeOrder(local: readonly string[] | null, items: readonly MediaItem[]): string[] {
  const server = items.map((item) => item.id);
  if (local === null) return server;
  const present = new Set(server);
  const kept = local.filter((id) => present.has(id));
  const keptSet = new Set(kept);
  return [...kept, ...server.filter((id) => !keptSet.has(id))];
}

/** `position` is captured on open, so a closing dialog never shows a stale number. */
type DialogState = { kind: "edit" | "delete"; id: string; position: number; open: boolean } | null;

/**
 * The sortable photo / floor-plan grid. Order, cover and deletes go straight to
 * Convex (`media.*`); the listing query re-renders with the result.
 */
export function MediaGrid({
  listingId,
  target,
  items,
  urls,
}: {
  listingId: Id<"listings">;
  target: MediaTarget;
  /** Already sorted by `order`. */
  items: readonly MediaItem[];
  urls: Record<string, string>;
}) {
  const reorder = useMutation(api.media.reorder);
  const setCover = useMutation(api.media.setCover);
  const remove = useMutation(api.media.remove);
  const reduced = useReducedMotion();
  const dndId = useId();

  const [localOrder, setLocalOrder] = useState<readonly string[] | null>(null);
  const [dialog, setDialog] = useState<DialogState>(null);
  const [coverPending, setCoverPending] = useState<string | null>(null);

  const byId = useMemo(() => new Map(items.map((item) => [item.id, item])), [items]);
  const ids = useMemo(() => mergeOrder(localOrder, items), [localOrder, items]);
  const ordered = ids.flatMap((id) => {
    const item = byId.get(id);
    return item === undefined ? [] : [item];
  });

  const sensors = useSensors(
    useSensor(TilePointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const words = WORDS[target];
  const total = ids.length;
  const positionOf = (id: UniqueIdentifier) => ids.indexOf(String(id)) + 1;
  const announcements: Announcements = {
    onDragStart: ({ active }) =>
      `${words.Name} ${positionOf(active.id)} je ${words.picked}. Mesto ${positionOf(active.id)} od ${total}.`,
    onDragOver: ({ active, over }) =>
      over !== null
        ? `${words.Name} ${positionOf(active.id)} je iznad mesta ${positionOf(over.id)} od ${total}.`
        : `${words.Name} ${positionOf(active.id)} više nije iznad liste.`,
    onDragEnd: ({ active, over }) =>
      over !== null
        ? `${words.Name} ${positionOf(active.id)} je ${words.dropped} na mesto ${positionOf(over.id)} od ${total}.`
        : `${words.Name} ${positionOf(active.id)} je ${words.dropped}.`,
    onDragCancel: ({ active }) =>
      `Premeštanje je otkazano. ${words.Name} ${positionOf(active.id)} je ${words.returned} na svoje mesto.`,
  };

  const handleDragEnd = async ({ active, over }: DragEndEvent) => {
    if (over === null || active.id === over.id) return;
    const from = ids.indexOf(String(active.id));
    const to = ids.indexOf(String(over.id));
    if (from < 0 || to < 0) return;
    const next = arrayMove(ids, from, to);
    setLocalOrder(next);
    try {
      await reorder({ listingId, target, ids: next });
    } catch (error) {
      toast.error(adminErrorMessage(error, "Novi redosled nije sačuvan."));
    } finally {
      // Convex resolves a mutation only once the listing query reflects it, so
      // the server order takes over without a flash; on error it reverts.
      setLocalOrder((current) => (current === next ? null : current));
    }
  };

  const handleSetCover = async (id: string) => {
    if (target !== "gallery" || coverPending !== null) return;
    if (byId.get(id)?.isCover === true) return;
    setCoverPending(id);
    try {
      await setCover({ listingId, itemId: id });
    } catch (error) {
      toast.error(adminErrorMessage(error, "Naslovna fotografija nije promenjena."));
    } finally {
      setCoverPending(null);
    }
  };

  const dialogItem = dialog !== null ? byId.get(dialog.id) : undefined;
  const dialogPosition = dialog?.position ?? 0;
  const closeDialog = (open: boolean) => {
    if (!open) setDialog((current) => (current === null ? null : { ...current, open: false }));
  };

  return (
    <>
      <DndContext
        id={dndId}
        sensors={sensors}
        collisionDetection={closestCenter}
        accessibility={{ announcements, screenReaderInstructions: INSTRUCTIONS }}
        onDragEnd={handleDragEnd}
      >
        <SortableContext items={ids} strategy={rectSortingStrategy}>
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
            {ordered.map((item, index) => (
              <SortableTile
                key={item.id}
                item={item}
                position={index + 1}
                url={urls[item.id]}
                target={target}
                reduced={reduced}
                onSetCover={() => void handleSetCover(item.id)}
                onEdit={() => setDialog({ kind: "edit", id: item.id, position: index + 1, open: true })}
                onDelete={() => setDialog({ kind: "delete", id: item.id, position: index + 1, open: true })}
              />
            ))}
          </ul>
        </SortableContext>
      </DndContext>

      <MediaMetaDialog
        open={dialog?.kind === "edit" && dialog.open}
        onOpenChange={closeDialog}
        listingId={listingId}
        target={target}
        item={dialog?.kind === "edit" ? dialogItem : undefined}
        position={dialogPosition}
        url={dialog !== null ? urls[dialog.id] : undefined}
      />

      <ConfirmDialog
        open={dialog?.kind === "delete" && dialog.open}
        onOpenChange={closeDialog}
        title={`Obrisati ${words.name} ${dialogPosition}?`}
        description={target === "gallery" ? "Fotografija se trajno briše." : "Tlocrt se trajno briše."}
        confirmLabel="Obriši"
        destructive
        onConfirm={async () => {
          if (dialog === null) return false;
          try {
            await remove({ listingId, target, itemId: dialog.id });
            toast.success(target === "gallery" ? "Fotografija je obrisana." : "Tlocrt je obrisan.");
            return true;
          } catch (error) {
            toast.error(adminErrorMessage(error, "Brisanje nije uspelo."));
            return false;
          }
        }}
      >
        {dialog?.kind === "delete" && urls[dialog.id] !== undefined ? (
          <div className="aspect-[4/3] w-40 overflow-hidden rounded-md border bg-muted">
            {/* eslint-disable-next-line @next/next/no-img-element -- admin preview of a Convex storage URL; next/image adds nothing here */}
            <img
              src={thumbUrl(urls[dialog.id])}
              alt=""
              className={cn("size-full", target === "floorPlans" ? "bg-white object-contain" : "object-cover")}
            />
          </div>
        ) : null}
      </ConfirmDialog>
    </>
  );
}

function IconAction({ tooltip, className, ...props }: ComponentProps<typeof Button> & { tooltip: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button type="button" variant="ghost" size="icon-sm" className={className} {...props} />
      </TooltipTrigger>
      <TooltipContent>{tooltip}</TooltipContent>
    </Tooltip>
  );
}

function SortableTile({
  item,
  position,
  url,
  target,
  reduced,
  onSetCover,
  onEdit,
  onDelete,
}: {
  item: MediaItem;
  position: number;
  url: string | undefined;
  target: MediaTarget;
  reduced: boolean;
  onSetCover: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id,
    attributes: { roleDescription: "stavka koja se premešta" },
    transition: reduced ? null : { duration: 180, easing: "cubic-bezier(0.2, 0, 0, 1)" },
  });

  const words = WORDS[target];
  const gallery = target === "gallery";
  const isCover = item.isCover === true;
  const altSr = item.alt.sr.trim();
  const missingAlt = altSr.length === 0;
  const lowRes = isLowRes(item.w, item.h);
  const subject = `${words.name} ${position}`;

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      data-testid="media-item"
      data-media-id={item.id}
      data-cover={isCover ? "true" : "false"}
      className={cn(
        "group relative flex flex-col overflow-hidden rounded-lg border bg-card",
        isDragging && "z-10 opacity-90 shadow-lg ring-2 ring-primary",
      )}
      {...listeners}
    >
      <div className="relative aspect-[4/3] overflow-hidden bg-muted">
        {url !== undefined ? (
          // eslint-disable-next-line @next/next/no-img-element -- admin thumbnail of a Convex storage URL; next/image adds nothing here
          <img
            src={thumbUrl(url)}
            alt={altSr || `${words.Name} ${position}`}
            loading="lazy"
            decoding="async"
            draggable={false}
            className={cn(
              "size-full transition-transform duration-200 ease-out select-none motion-reduce:transition-none pointer-fine:group-hover:scale-[1.03]",
              gallery ? "object-cover" : "bg-white object-contain",
            )}
          />
        ) : (
          <div className="flex size-full flex-col items-center justify-center gap-1 text-muted-foreground">
            <ImageOff aria-hidden="true" className="size-5" />
            <span className="text-xs">Pregled nije dostupan</span>
          </div>
        )}

        <button
          type="button"
          ref={setActivatorNodeRef}
          {...attributes}
          aria-label={`Premesti ${subject}`}
          data-drag-handle=""
          className="absolute top-1.5 left-1.5 inline-flex h-7 cursor-grab touch-none items-center gap-0.5 rounded-md bg-background/90 pr-2 pl-1 text-xs font-semibold tabular-nums shadow-sm ring-1 ring-foreground/10 transition-transform duration-150 outline-none focus-visible:ring-3 focus-visible:ring-ring/50 active:scale-95 active:cursor-grabbing motion-reduce:transition-none"
        >
          <GripVertical aria-hidden="true" className="size-4 text-muted-foreground" />
          <span aria-hidden="true">{position}</span>
        </button>

        {gallery ? (
          <IconAction
            tooltip={isCover ? "Naslovna fotografija" : "Postavi kao naslovnu"}
            aria-label="Postavi kao naslovnu"
            aria-pressed={isCover}
            data-testid="media-cover"
            onClick={onSetCover}
            className={cn(
              "absolute top-1.5 right-1.5 bg-background/90 shadow-sm ring-1 ring-foreground/10 active:scale-95",
              isCover ? "text-primary" : "text-muted-foreground",
            )}
          >
            <Star aria-hidden="true" className={cn(isCover && "fill-current")} />
          </IconAction>
        ) : null}

        {isCover || lowRes ? (
          <div className="pointer-events-none absolute bottom-1.5 left-1.5 flex flex-wrap gap-1">
            {isCover ? (
              <span className="rounded-md bg-primary px-1.5 py-0.5 text-[11px] font-semibold text-primary-foreground">
                Naslovna
              </span>
            ) : null}
            {lowRes ? (
              <span className="inline-flex items-center gap-1 rounded-md bg-background/90 px-1.5 py-0.5 text-[11px] font-medium text-warning-text shadow-sm dark:text-warning">
                <TriangleAlert aria-hidden="true" className="size-3" />
                Mala rezolucija
              </span>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="flex items-center gap-1 py-1 pr-1 pl-2.5">
        <span className={cn("min-w-0 flex-1 truncate text-xs", item.room === undefined && "text-muted-foreground")}>
          {gallery ? (item.room !== undefined ? ROOM_TAG_LABEL[item.room] : "Bez oznake prostorije") : `Tlocrt ${position}`}
        </span>
        <IconAction
          tooltip={missingAlt ? "Uredi opis — nedostaje opis na srpskom" : "Uredi opis"}
          aria-label={`Uredi opis: ${subject}${missingAlt ? " (nedostaje opis na srpskom)" : ""}`}
          data-testid="media-edit"
          onClick={onEdit}
          className="relative"
        >
          <Pencil aria-hidden="true" />
          {missingAlt ? (
            <span
              aria-hidden="true"
              className="absolute top-1 right-1 size-2 rounded-full bg-warning ring-2 ring-card"
            />
          ) : null}
        </IconAction>
        <IconAction
          tooltip="Obriši"
          aria-label={`Obriši ${subject}`}
          data-testid="media-delete"
          onClick={onDelete}
          className="text-muted-foreground pointer-fine:hover:text-destructive"
        >
          <Trash2 aria-hidden="true" />
        </IconAction>
      </div>
    </li>
  );
}
