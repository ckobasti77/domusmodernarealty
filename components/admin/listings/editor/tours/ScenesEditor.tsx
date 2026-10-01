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
  type ScreenReaderInstructions,
  type UniqueIdentifier,
} from "@dnd-kit/core";
import { restrictToVerticalAxis } from "@dnd-kit/modifiers";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useMutation, useQuery } from "convex/react";
import { ChevronDown, ChevronUp, GripVertical, ImageOff, ImagePlus, Loader2, Pencil, Trash2 } from "lucide-react";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/admin/common/ConfirmDialog";
import { toL10nValue } from "@/components/admin/common/L10nInput";
import { pluralForm } from "@/components/admin/listings/media/shared";
import { UploadError, readImageSize } from "@/components/admin/listings/media/upload";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { TOUR_LIMITS } from "@/convex/lib/tours";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { adminErrorMessage } from "@/lib/admin/errors";
import { deepEqual } from "@/lib/admin/listing-form";
import { cn } from "@/lib/utils";
import { SceneEditor, draftOf, sceneTitle, type SceneDraft, type SceneRow } from "./SceneEditor";
import { PANO_ACCEPT, derivePanoVariants, isTwoToOne, panoProblem, useStorageUploader } from "./uploads";

type SceneId = Id<"tourScenes">;
type Editing = { sceneId: SceneId; baseline: SceneDraft; draft: SceneDraft };
type UploadStatus = { name: string; index: number; total: number; phase: string; percent: number };

const LINK_WORD = { one: "veza", few: "veze", other: "veza" } as const;

const INSTRUCTIONS: ScreenReaderInstructions = {
  draggable:
    "Da biste promenili redosled, pritisnite razmaknicu ili Enter. Strelicama birate novo mesto, razmaknicom ili Enterom potvrđujete, a tasterom Escape otkazujete.",
};

function isDirty(editing: Editing | null): boolean {
  return editing !== null && !deepEqual(editing.draft, editing.baseline);
}

/** Local optimistic order over the server order; scenes added or removed meanwhile are reconciled. */
function mergeOrder(local: readonly SceneId[] | null, scenes: readonly SceneRow[]): SceneId[] {
  const server = scenes.map((scene) => scene._id);
  if (local === null) return server;
  const present = new Set(server);
  const kept = local.filter((id) => present.has(id));
  const keptSet = new Set(kept);
  return [...kept, ...server.filter((id) => !keptSet.has(id))];
}

/**
 * The self-hosted 360° tour: the scene list (drag or the arrow buttons to
 * reorder, delete with confirmation), "Dodaj scenu" (a panorama upload that
 * also makes a phone version and a thumbnail in the browser) and the editor of
 * the open scene. Scenes are saved straight to Convex (`toursAdmin.*`), not
 * through the listing's autosave.
 */
export function ScenesEditor({ listingId, published }: { listingId: Id<"listings">; published: boolean }) {
  const scenes = useQuery(api.toursAdmin.scenes, { listingId });
  const upsertScene = useMutation(api.toursAdmin.upsertScene);
  const reorderScenes = useMutation(api.toursAdmin.reorderScenes);
  const removeScene = useMutation(api.toursAdmin.removeScene);
  const uploadFile = useStorageUploader();
  const reduced = useReducedMotion();
  const dndId = useId();
  const editorId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const [localOrder, setLocalOrder] = useState<readonly SceneId[] | null>(null);
  const [editing, setEditing] = useState<Editing | null>(null);
  const [pendingOpen, setPendingOpen] = useState<{ next: SceneRow | null; open: boolean } | null>(null);
  const [deleting, setDeleting] = useState<{ id: SceneId; title: string; open: boolean } | null>(null);
  const [upload, setUpload] = useState<UploadStatus | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const openId = editing?.sceneId ?? null;
  useEffect(() => {
    if (openId === null) return;
    panelRef.current?.scrollIntoView({ block: "nearest", behavior: reduced ? "auto" : "smooth" });
  }, [openId, reduced]);

  const byId = useMemo(() => new Map((scenes ?? []).map((scene) => [scene._id, scene])), [scenes]);

  if (scenes === undefined) {
    return (
      <div className="flex flex-col gap-2" aria-busy="true">
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
      </div>
    );
  }

  const ids = mergeOrder(localOrder, scenes);
  const ordered = ids.flatMap((id) => {
    const scene = byId.get(id);
    return scene === undefined ? [] : [scene];
  });
  const positionOf = (id: UniqueIdentifier) => ids.indexOf(id as SceneId) + 1;
  const total = ids.length;
  const full = total >= TOUR_LIMITS.scenes;

  const announcements: Announcements = {
    onDragStart: ({ active }) => `Scena ${positionOf(active.id)} je podignuta. Mesto ${positionOf(active.id)} od ${total}.`,
    onDragOver: ({ active, over }) =>
      over !== null
        ? `Scena ${positionOf(active.id)} je iznad mesta ${positionOf(over.id)} od ${total}.`
        : `Scena ${positionOf(active.id)} više nije iznad liste.`,
    onDragEnd: ({ active, over }) =>
      over !== null
        ? `Scena ${positionOf(active.id)} je spuštena na mesto ${positionOf(over.id)} od ${total}.`
        : `Scena ${positionOf(active.id)} je spuštena.`,
    onDragCancel: ({ active }) => `Premeštanje je otkazano. Scena ${positionOf(active.id)} je vraćena na svoje mesto.`,
  };

  const commitOrder = async (next: SceneId[]) => {
    setLocalOrder(next);
    try {
      await reorderScenes({ listingId, ids: next });
    } catch (error) {
      toast.error(adminErrorMessage(error, "Novi redosled nije sačuvan."));
    } finally {
      // The mutation resolves once the scenes query reflects it; on error the server order returns.
      setLocalOrder((current) => (current === next ? null : current));
    }
  };

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (over === null || active.id === over.id) return;
    const from = ids.indexOf(active.id as SceneId);
    const to = ids.indexOf(over.id as SceneId);
    if (from >= 0 && to >= 0) void commitOrder(arrayMove(ids, from, to));
  };

  const move = (index: number, delta: -1 | 1) => {
    const to = index + delta;
    if (to >= 0 && to < ids.length) void commitOrder(arrayMove(ids, index, to));
  };

  const open = (scene: SceneRow | null) => {
    if (scene !== null && scene._id === openId) {
      panelRef.current?.scrollIntoView({ block: "nearest", behavior: reduced ? "auto" : "smooth" });
      return;
    }
    if (isDirty(editing)) {
      setPendingOpen({ next: scene, open: true });
      return;
    }
    if (scene === null) {
      setEditing(null);
      return;
    }
    const draft = draftOf(scene);
    setEditing({ sceneId: scene._id, baseline: draft, draft });
  };

  const addFiles = async (files: File[]) => {
    let count = scenes.length;
    let created: { id: SceneId; title: string } | null = null;
    for (const [index, file] of files.entries()) {
      if (count >= TOUR_LIMITS.scenes) {
        toast.error(`Tura može imati najviše ${TOUR_LIMITS.scenes} scena.`);
        break;
      }
      const problem = panoProblem(file);
      if (problem !== null) {
        toast.error(problem);
        continue;
      }
      const status = { name: file.name, index, total: files.length };
      setUpload({ ...status, phase: "Priprema", percent: 0 });
      const size = await readImageSize(file);
      if (size !== null && !isTwoToOne(size)) {
        toast.warning(
          `Panorama „${file.name}” nije u razmeri 2:1 (${size.w}×${size.h} px), pa će u turi izgledati izobličeno.`,
        );
      }
      const variants = await derivePanoVariants(file, size);
      const parts = [file, variants.mobile, variants.thumb].filter((part): part is File => part !== null);
      const bytes = parts.reduce((sum, part) => sum + part.size, 0);
      let done = 0;
      try {
        const stored: Id<"_storage">[] = [];
        for (const part of parts) {
          const id = await uploadFile(part, (percent) =>
            setUpload({
              ...status,
              phase: "Otpremanje",
              percent: Math.min(99, Math.round(((done + (part.size * percent) / 100) / bytes) * 100)),
            }),
          );
          stored.push(id);
          done += part.size;
        }
        setUpload({ ...status, phase: "Čuvanje", percent: 100 });
        const [panoId, ...rest] = stored;
        if (panoId === undefined) continue;
        const mobileId = variants.mobile !== null ? rest.shift() : undefined;
        const thumbId = variants.thumb !== null ? rest.shift() : undefined;
        const title = `Scena ${count + 1}`;
        const { id } = await upsertScene({
          listingId,
          title: { sr: title },
          pano: { kind: "storage", storageId: panoId },
          ...(mobileId !== undefined ? { panoMobile: { kind: "storage", storageId: mobileId } } : {}),
          ...(thumbId !== undefined ? { thumb: { kind: "storage", storageId: thumbId } } : {}),
        });
        count += 1;
        created = { id, title };
        toast.success(
          variants.thumb === null
            ? `Scena „${title}” je dodata (bez verzije za telefone: pregledač nije mogao da obradi sliku).`
            : `Scena „${title}” je dodata.`,
        );
      } catch (error) {
        toast.error(
          error instanceof UploadError ? error.message : adminErrorMessage(error, `Panorama „${file.name}” nije dodata.`),
        );
      }
    }
    setUpload(null);
    if (created !== null) {
      const draft: SceneDraft = {
        title: toL10nValue({ sr: created.title }),
        credit: "",
        view: { yaw: null, pitch: null },
        links: [],
      };
      const next: Editing = { sceneId: created.id, baseline: draft, draft };
      // Open the new scene unless another one has unsaved changes.
      setEditing((current) => (isDirty(current) ? current : next));
    }
  };

  const openScene = editing !== null ? byId.get(editing.sceneId) : undefined;
  const openPosition = editing !== null ? ids.indexOf(editing.sceneId) + 1 : 0;

  return (
    <div className="flex min-w-0 flex-col gap-3" data-testid="scenes-editor">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h4 className="text-sm font-medium">
            Scene{" "}
            <span className="font-normal text-muted-foreground tabular-nums">
              ({total}/{TOUR_LIMITS.scenes})
            </span>
          </h4>
          <p className="max-w-2xl text-xs text-muted-foreground">
            Panorame u razmeri 2:1 (JPEG, PNG, WebP ili AVIF, do 40 MB). Verzija za telefone (2048×1024) i sličica prave
            se automatski. Prva scena je ulaz u turu.
          </p>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept={PANO_ACCEPT}
          multiple
          className="sr-only"
          tabIndex={-1}
          aria-label="Dodaj scenu: izaberite panoramu"
          data-testid="scene-upload-input"
          onChange={(event) => {
            const files = Array.from(event.target.files ?? []);
            event.target.value = "";
            if (files.length > 0) void addFiles(files);
          }}
        />
        <Button
          type="button"
          size="sm"
          disabled={upload !== null || full}
          onClick={() => inputRef.current?.click()}
          data-testid="scene-add"
        >
          {upload !== null ? <Loader2 aria-hidden="true" className="animate-spin" /> : <ImagePlus aria-hidden="true" />}
          Dodaj scenu
        </Button>
      </div>

      {upload !== null ? (
        <div role="status" aria-live="polite" className="flex flex-col gap-2 rounded-lg border bg-muted/40 p-3">
          <div className="flex items-center justify-between gap-3 text-xs">
            <span className="min-w-0 truncate">
              {upload.phase}: {upload.name}
              {upload.total > 1 ? ` (${upload.index + 1}/${upload.total})` : ""}
            </span>
            <span className="tabular-nums text-muted-foreground">{upload.percent} %</span>
          </div>
          <Progress value={upload.percent} aria-label="Otpremanje panorame" />
        </div>
      ) : null}

      {ordered.length === 0 && upload === null ? (
        <p className="rounded-lg border border-dashed px-3 py-6 text-center text-sm text-muted-foreground">
          Još nema scena. Dodajte prvu panoramu.
          {published ? (
            <span className="mt-1 block text-xs text-warning-text dark:text-warning">
              Tura je označena za objavu, ali se ne prikazuje dok nema bar jednu scenu.
            </span>
          ) : null}
        </p>
      ) : (
        <DndContext
          id={dndId}
          sensors={sensors}
          collisionDetection={closestCenter}
          modifiers={[restrictToVerticalAxis]}
          accessibility={{ announcements, screenReaderInstructions: INSTRUCTIONS }}
          onDragEnd={onDragEnd}
        >
          <SortableContext items={ids} strategy={verticalListSortingStrategy}>
            <ol className="flex flex-col gap-2" aria-label="Scene ture">
              {ordered.map((scene, index) => (
                <SceneItem
                  key={scene._id}
                  scene={scene}
                  position={index + 1}
                  count={ordered.length}
                  reduced={reduced}
                  isOpen={scene._id === openId}
                  editorId={editorId}
                  onMove={(delta) => move(index, delta)}
                  onEdit={() => open(scene)}
                  onDelete={() => setDeleting({ id: scene._id, title: sceneTitle(scene, index + 1), open: true })}
                />
              ))}
            </ol>
          </SortableContext>
        </DndContext>
      )}

      {editing !== null ? (
        <div ref={panelRef} id={editorId} className="scroll-mt-32">
          {openScene !== undefined ? (
            <SceneEditor
              key={editing.sceneId}
              listingId={listingId}
              scene={openScene}
              position={openPosition}
              scenes={ordered}
              draft={editing.draft}
              baseline={editing.baseline}
              onDraft={(draft) => setEditing((current) => (current === null ? null : { ...current, draft }))}
              onSaved={(saved) => setEditing((current) => (current === null ? null : { ...current, baseline: saved }))}
              onClose={() => open(null)}
            />
          ) : (
            <p className="flex items-center gap-2 rounded-lg border px-3 py-4 text-sm text-muted-foreground">
              <Loader2 aria-hidden="true" className="size-4 animate-spin" />
              Učitavanje scene…
            </p>
          )}
        </div>
      ) : null}

      <ConfirmDialog
        open={pendingOpen?.open === true}
        onOpenChange={(next) => setPendingOpen((current) => (current === null ? null : { ...current, open: next }))}
        title="Odbaciti nesačuvane izmene scene?"
        description="Izmene naziva, početnog pogleda i veza otvorene scene još nisu sačuvane."
        confirmLabel="Odbaci izmene"
        cancelLabel="Nastavi uređivanje"
        destructive
        onConfirm={() => {
          const next = pendingOpen?.next ?? null;
          if (next === null) {
            setEditing(null);
          } else {
            const draft = draftOf(next);
            setEditing({ sceneId: next._id, baseline: draft, draft });
          }
        }}
      />

      <ConfirmDialog
        open={deleting?.open === true}
        onOpenChange={(next) => setDeleting((current) => (current === null ? null : { ...current, open: next }))}
        title={`Obrisati scenu „${deleting?.title ?? ""}”?`}
        description="Panorama se trajno briše, a strelice drugih scena koje vode u nju se uklanjaju."
        confirmLabel="Obriši"
        destructive
        onConfirm={async () => {
          if (deleting === null) return false;
          try {
            const removed = deleting.id;
            await removeScene({ listingId, sceneId: removed });
            // The server dropped every link into the removed scene; the open editor follows.
            const drop = (draft: SceneDraft): SceneDraft => ({
              ...draft,
              links: draft.links.filter((link) => link.toSceneId !== removed),
            });
            setEditing((current) =>
              current === null || current.sceneId === removed
                ? null
                : { ...current, baseline: drop(current.baseline), draft: drop(current.draft) },
            );
            toast.success(`Scena „${deleting.title}” je obrisana.`);
            return true;
          } catch (error) {
            toast.error(adminErrorMessage(error, "Brisanje nije uspelo."));
            return false;
          }
        }}
      />
    </div>
  );
}

function SceneItem({
  scene,
  position,
  count,
  reduced,
  isOpen,
  editorId,
  onMove,
  onEdit,
  onDelete,
}: {
  scene: SceneRow;
  position: number;
  count: number;
  reduced: boolean;
  isOpen: boolean;
  editorId: string;
  onMove: (delta: -1 | 1) => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
    id: scene._id,
    attributes: { roleDescription: "scena koja se premešta" },
    transition: reduced ? null : { duration: 180, easing: "cubic-bezier(0.2, 0, 0, 1)" },
  });
  const title = sceneTitle(scene, position);
  const links = scene.links.length;
  const thumb = scene.thumbUrl ?? scene.panoMobileUrl ?? scene.panoUrl;

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      data-testid="scene-item"
      data-scene-id={scene._id}
      className={cn(
        "flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 rounded-lg border bg-background p-2",
        isOpen && "border-primary/60 ring-1 ring-primary/20",
        isDragging && "relative z-10 shadow-lg ring-2 ring-primary",
      )}
    >
      <button
        type="button"
        ref={setActivatorNodeRef}
        {...attributes}
        {...listeners}
        aria-label={`Premesti scenu ${position}: ${title}`}
        className="inline-flex size-11 shrink-0 cursor-grab touch-none items-center justify-center rounded-md text-muted-foreground transition-colors duration-150 outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 active:cursor-grabbing md:size-8 motion-reduce:transition-none"
      >
        <GripVertical aria-hidden="true" className="size-4" />
      </button>
      <div className="aspect-[2/1] w-16 shrink-0 overflow-hidden rounded-md border bg-muted @md:w-24">
        {thumb !== undefined ? (
          // eslint-disable-next-line @next/next/no-img-element -- admin thumbnail of a site or Convex storage URL; next/image adds nothing here
          <img src={thumb} alt="" loading="lazy" decoding="async" draggable={false} className="size-full object-cover" />
        ) : (
          <div className="flex size-full items-center justify-center text-muted-foreground">
            <ImageOff aria-hidden="true" className="size-4" />
          </div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium" data-testid="scene-item-title">
          <span className="text-muted-foreground tabular-nums">{position}.</span> {title}
        </p>
        <p className="text-xs text-muted-foreground" data-testid="scene-item-links">
          {links} {LINK_WORD[pluralForm(links)]}
          {scene.initialView !== undefined ? " · početni pogled" : ""}
        </p>
      </div>
      <div className="ml-auto flex shrink-0 items-center gap-0.5 @max-md:w-full @max-md:justify-end">
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={`Pomeri scenu „${title}” gore`}
          disabled={position === 1}
          onClick={() => onMove(-1)}
        >
          <ChevronUp aria-hidden="true" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={`Pomeri scenu „${title}” dole`}
          disabled={position === count}
          onClick={() => onMove(1)}
        >
          <ChevronDown aria-hidden="true" />
        </Button>
        <Button
          type="button"
          variant={isOpen ? "secondary" : "outline"}
          size="sm"
          aria-expanded={isOpen}
          aria-controls={isOpen ? editorId : undefined}
          aria-label={`Uredi scenu „${title}”`}
          onClick={onEdit}
          data-testid="scene-edit"
        >
          <Pencil aria-hidden="true" />
          Uredi
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={`Obriši scenu „${title}”`}
          className="text-muted-foreground pointer-fine:hover:text-destructive"
          onClick={onDelete}
          data-testid="scene-delete"
        >
          <Trash2 aria-hidden="true" />
        </Button>
      </div>
    </li>
  );
}
