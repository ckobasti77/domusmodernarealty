"use client";

import { useMutation } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { Crosshair, Eye, Link2, Loader2, Plus, Trash2, X } from "lucide-react";
import dynamic from "next/dynamic";
import { useId, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { L10nInput, fromL10nValue, toL10nValue, type L10nValue } from "@/components/admin/common/L10nInput";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { TOUR_LIMITS } from "@/convex/lib/tours";
import { adminErrorMessage } from "@/lib/admin/errors";
import { deepEqual } from "@/lib/admin/listing-form";
import { DecimalInput } from "./DecimalField";
import { normalizeYaw } from "./numbers";
import type { PanoControls, PanoMarker } from "./PanoPreview";

const PanoPreview = dynamic(() => import("./PanoPreview"), {
  ssr: false,
  loading: () => <div aria-hidden="true" className="aspect-[3/2] w-full animate-pulse rounded-lg border bg-muted @lg:aspect-[2/1]" />,
});

export type SceneRow = FunctionReturnType<typeof api.toursAdmin.scenes>[number];

/** `toursAdmin.upsertScene` limits. */
const TITLE_MAX = 80;
const CREDIT_MAX = 300;

type Angle = number | null;
export type LinkDraft = { key: string; toSceneId: Id<"tourScenes"> | ""; yaw: Angle; pitch: Angle };
/** One scene as the editor holds it: angles in radians, `null` for an empty input. */
export type SceneDraft = {
  title: L10nValue;
  credit: string;
  view: { yaw: Angle; pitch: Angle };
  links: LinkDraft[];
};

let linkSeq = 0;
function linkKey(): string {
  linkSeq += 1;
  return `link-${linkSeq}`;
}

export function draftOf(scene: SceneRow): SceneDraft {
  return {
    title: toL10nValue(scene.title),
    credit: scene.credit ?? "",
    view: { yaw: scene.initialView?.yaw ?? null, pitch: scene.initialView?.pitch ?? null },
    links: scene.links.map((link) => ({
      key: linkKey(),
      toSceneId: link.toSceneId,
      yaw: link.yaw ?? null,
      pitch: link.pitch ?? null,
    })),
  };
}

export function sceneTitle(scene: SceneRow, position: number): string {
  return scene.title.sr.trim() || `Scena ${position}`;
}

function finite(value: Angle): value is number {
  return value !== null && Number.isFinite(value);
}

/** The Serbian problem with an angle input, or null. `limit` bounds a pitch to ±90°. */
function angleProblem(value: Angle, limit: boolean): string | null {
  if (value === null) return "Obavezno polje.";
  if (!Number.isFinite(value)) return "Unesite broj.";
  if (limit && Math.abs(value) > Math.PI / 2) return "Nagib je između −90° i 90°.";
  return null;
}

type Problems = {
  title?: string;
  viewYaw?: string;
  viewPitch?: string;
  links: { target?: string; yaw?: string; pitch?: string }[];
};

/** `targets`: the scenes a link may point at (a deleted one is no longer among them). */
function problemsOf(draft: SceneDraft, targets: ReadonlySet<string>): Problems {
  const out: Problems = { links: [] };
  if (draft.title.sr.trim() === "") out.title = "Unesite naziv scene na srpskom.";
  const { yaw, pitch } = draft.view;
  if (yaw !== null || pitch !== null) {
    out.viewYaw = angleProblem(yaw, false) ?? undefined;
    out.viewPitch = angleProblem(pitch, true) ?? undefined;
  }
  out.links = draft.links.map((link) => ({
    target: link.toSceneId === "" || !targets.has(link.toSceneId) ? "Izaberite scenu." : undefined,
    yaw: angleProblem(link.yaw, false) ?? undefined,
    pitch: angleProblem(link.pitch, true) ?? undefined,
  }));
  return out;
}

function hasProblems(problems: Problems): boolean {
  return (
    problems.title !== undefined ||
    problems.viewYaw !== undefined ||
    problems.viewPitch !== undefined ||
    problems.links.some((link) => link.target !== undefined || link.yaw !== undefined || link.pitch !== undefined)
  );
}

/**
 * Editing one 360° scene: its name in four languages, the source note, where
 * the visitor first looks, and the links to other scenes (target + direction).
 * The preview reads the camera for "Postavi iz trenutnog prikaza". Changes are
 * saved together with "Sačuvaj scenu" (`toursAdmin.upsertScene` + `setLinks`).
 */
export function SceneEditor({
  listingId,
  scene,
  position,
  scenes,
  draft,
  baseline,
  onDraft,
  onSaved,
  onClose,
}: {
  listingId: Id<"listings">;
  scene: SceneRow;
  position: number;
  scenes: readonly SceneRow[];
  draft: SceneDraft;
  baseline: SceneDraft;
  onDraft: (next: SceneDraft) => void;
  onSaved: (saved: SceneDraft) => void;
  onClose: () => void;
}) {
  const upsertScene = useMutation(api.toursAdmin.upsertScene);
  const setLinks = useMutation(api.toursAdmin.setLinks);
  const controlRef = useRef<PanoControls | null>(null);
  const baseId = useId();
  const [saving, setSaving] = useState(false);
  const [initialView] = useState(() =>
    finite(draft.view.yaw) && finite(draft.view.pitch) ? { yaw: draft.view.yaw, pitch: draft.view.pitch } : null,
  );

  const name = sceneTitle(scene, position);
  const titleOf = useMemo(
    () => new Map(scenes.map((item, index) => [item._id, sceneTitle(item, index + 1)])),
    [scenes],
  );
  const targets = scenes.filter((item) => item._id !== scene._id);
  const problems = problemsOf(draft, new Set(targets.map((item) => item._id)));
  const dirty = !deepEqual(draft, baseline);
  const previewUrl = scene.panoMobileUrl ?? scene.panoUrl;

  const markers = useMemo<PanoMarker[]>(
    () =>
      draft.links.flatMap((link) =>
        link.toSceneId !== "" && finite(link.yaw) && finite(link.pitch)
          ? [{ id: link.key, yaw: link.yaw, pitch: link.pitch, label: titleOf.get(link.toSceneId) ?? "Scena" }]
          : [],
      ),
    [draft.links, titleOf],
  );

  /** The view at the preview's crosshair, or null (with a note) while it loads. */
  const currentView = (): { yaw: number; pitch: number } | null => {
    const camera = controlRef.current?.getPosition();
    if (camera === undefined) {
      toast.info("Pregled panorame se još učitava.");
      return null;
    }
    return { yaw: Number(normalizeYaw(camera.yaw).toFixed(4)), pitch: Number(camera.pitch.toFixed(4)) };
  };

  const lookAt = (yaw: Angle, pitch: Angle) => {
    if (finite(yaw)) controlRef.current?.lookAt({ yaw, pitch: finite(pitch) ? pitch : 0 });
  };

  const setLink = (key: string, patch: Partial<Omit<LinkDraft, "key">>) =>
    onDraft({ ...draft, links: draft.links.map((link) => (link.key === key ? { ...link, ...patch } : link)) });

  const used = new Set(draft.links.map((link) => link.toSceneId));
  const free = targets.filter((item) => !used.has(item._id));

  const addLink = () => {
    const view = controlRef.current?.getPosition();
    onDraft({
      ...draft,
      links: [
        ...draft.links,
        {
          key: linkKey(),
          toSceneId: free[0]?._id ?? "",
          yaw: view !== undefined ? Number(normalizeYaw(view.yaw).toFixed(4)) : 0,
          pitch: view !== undefined ? Number(view.pitch.toFixed(4)) : 0,
        },
      ],
    });
  };

  const save = async () => {
    if (hasProblems(problems) || saving) return;
    setSaving(true);
    try {
      const metaChanged =
        !deepEqual(draft.title, baseline.title) ||
        draft.credit !== baseline.credit ||
        !deepEqual(draft.view, baseline.view);
      if (metaChanged) {
        const { yaw, pitch } = draft.view;
        await upsertScene({
          listingId,
          sceneId: scene._id,
          title: fromL10nValue(draft.title),
          pano: scene.pano,
          credit: draft.credit.trim(),
          initialView: finite(yaw) && finite(pitch) ? { yaw, pitch } : null,
        });
      }
      if (!deepEqual(draft.links, baseline.links)) {
        await setLinks({
          listingId,
          sceneId: scene._id,
          links: draft.links.flatMap((link) =>
            link.toSceneId !== "" && finite(link.yaw) && finite(link.pitch)
              ? [{ toSceneId: link.toSceneId, yaw: link.yaw, pitch: link.pitch }]
              : [],
          ),
        });
      }
      onSaved(draft);
      toast.success(`Scena „${draft.title.sr.trim()}” je sačuvana.`);
    } catch (error) {
      toast.error(adminErrorMessage(error, "Scena nije sačuvana. Pokušajte ponovo."));
    } finally {
      setSaving(false);
    }
  };

  const creditId = `${baseId}-credit`;
  const headingId = `${baseId}-heading`;

  return (
    <section
      aria-labelledby={headingId}
      data-testid="scene-editor"
      data-scene-id={scene._id}
      className="flex min-w-0 flex-col gap-4 rounded-xl border border-primary/40 bg-card p-3 ring-1 ring-primary/10 md:p-4"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h4 id={headingId} className="truncate text-sm font-semibold">
            Scena {position}: {name}
          </h4>
          <p className="text-xs text-muted-foreground">
            {dirty ? "Ima nesačuvanih izmena." : "Sve izmene su sačuvane."}
          </p>
        </div>
        <Button type="button" variant="ghost" size="icon-sm" aria-label="Zatvori uređivanje scene" onClick={onClose}>
          <X aria-hidden="true" />
        </Button>
      </div>

      <div className="grid min-w-0 gap-4 @3xl:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
        <div className="flex min-w-0 flex-col gap-2">
          {previewUrl !== undefined ? (
            <PanoPreview
              url={previewUrl}
              initialView={initialView}
              markers={markers}
              controlRef={controlRef}
              label={`Pregled panorame: ${name}`}
            />
          ) : (
            <div className="flex aspect-[3/2] items-center justify-center rounded-lg border bg-muted text-xs text-muted-foreground @lg:aspect-[2/1]">
              Pregled nije dostupan.
            </div>
          )}
          <p className="text-xs text-muted-foreground">
            Prevucite pregled da pogledate okolo. Krstić u sredini je tačka koju beleže dugmad „Postavi iz trenutnog
            prikaza”.
          </p>
          <fieldset className="flex min-w-0 flex-col gap-2 rounded-lg border bg-background p-3">
            <legend className="px-1 text-sm font-medium">Početni pogled</legend>
            <p className="text-xs text-muted-foreground">Smer u kome posetilac gleda kada uđe u scenu.</p>
            <div className="grid grid-cols-2 gap-2">
              <AngleInput
                id={`${baseId}-view-yaw`}
                label="Ugao (yaw)"
                value={draft.view.yaw}
                error={problems.viewYaw}
                onChange={(yaw) => onDraft({ ...draft, view: { ...draft.view, yaw } })}
              />
              <AngleInput
                id={`${baseId}-view-pitch`}
                label="Nagib (pitch)"
                value={draft.view.pitch}
                error={problems.viewPitch}
                onChange={(pitch) => onDraft({ ...draft, view: { ...draft.view, pitch } })}
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  const view = currentView();
                  if (view !== null) onDraft({ ...draft, view });
                }}
              >
                <Crosshair aria-hidden="true" />
                Postavi početni pogled
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={!finite(draft.view.yaw)}
                onClick={() => lookAt(draft.view.yaw, draft.view.pitch)}
              >
                <Eye aria-hidden="true" />
                Prikaži
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={draft.view.yaw === null && draft.view.pitch === null}
                onClick={() => onDraft({ ...draft, view: { yaw: null, pitch: null } })}
              >
                <Trash2 aria-hidden="true" />
                Ukloni
              </Button>
            </div>
          </fieldset>
        </div>

        <div className="flex min-w-0 flex-col gap-4">
          <L10nInput
            label="Naziv scene"
            value={draft.title}
            onChange={(title) => onDraft({ ...draft, title })}
            required
            maxLength={TITLE_MAX}
            error={problems.title}
            hint="Npr. Dnevna soba. Prikazuje se u turi i na strelicama veza."
            testId="scene-title"
          />
          <div className="flex min-w-0 flex-col gap-1.5">
            <Label htmlFor={creditId}>Izvor / napomena</Label>
            <Input
              id={creditId}
              value={draft.credit}
              maxLength={CREDIT_MAX}
              autoComplete="off"
              placeholder="npr. Snimak: agencija, 2026."
              aria-describedby={`${creditId}-hint`}
              onChange={(event) => onDraft({ ...draft, credit: event.target.value })}
            />
            <p id={`${creditId}-hint`} className="text-xs text-muted-foreground">
              Autor ili licenca panorame. Prikazuje se posetiocima uz turu; adresu izvora dodajte na kraj (https://…).
            </p>
          </div>
        </div>
      </div>

      <div className="flex min-w-0 flex-col gap-3">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div className="min-w-0">
            <h5 className="text-sm font-medium">
              Veze ka drugim scenama{" "}
              <span className="font-normal text-muted-foreground tabular-nums">
                ({draft.links.length}/{TOUR_LIMITS.linksPerScene})
              </span>
            </h5>
            <p className="text-xs text-muted-foreground">
              Okrenite pregled ka vratima i dodajte vezu: strelica se postavlja tamo gde je krstić.
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={free.length === 0 || draft.links.length >= TOUR_LIMITS.linksPerScene}
            onClick={addLink}
            data-testid="scene-link-add"
          >
            <Plus aria-hidden="true" />
            Dodaj vezu
          </Button>
        </div>
        {targets.length === 0 ? (
          <p className="text-xs text-muted-foreground">Dodajte još jednu scenu da biste ih povezali.</p>
        ) : null}
        {draft.links.length > 0 ? (
          <ol className="flex flex-col gap-2">
            {draft.links.map((link, index) => {
              const linkProblems = problems.links[index] ?? {};
              const rowId = `${baseId}-${link.key}`;
              const targetErrorId = `${rowId}-target-error`;
              return (
                <li
                  key={link.key}
                  data-testid="scene-link"
                  className="grid min-w-0 grid-cols-2 gap-2 rounded-lg border bg-background p-3 @2xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)] @2xl:items-start"
                >
                  <div className="col-span-2 flex min-w-0 flex-col gap-1.5 @2xl:col-span-1">
                    <Label htmlFor={`${rowId}-target`} className="inline-flex items-center gap-1.5">
                      <Link2 aria-hidden="true" className="size-3.5 text-muted-foreground" />
                      Veza {index + 1}: vodi u scenu
                    </Label>
                    <Select
                      value={link.toSceneId}
                      onValueChange={(value) => {
                        const target = targets.find((item) => item._id === value);
                        if (target !== undefined) setLink(link.key, { toSceneId: target._id });
                      }}
                    >
                      <SelectTrigger
                        id={`${rowId}-target`}
                        className="w-full"
                        aria-invalid={linkProblems.target !== undefined ? true : undefined}
                        aria-describedby={linkProblems.target !== undefined ? targetErrorId : undefined}
                        data-testid="scene-link-target"
                      >
                        <SelectValue placeholder="Izaberite scenu…" />
                      </SelectTrigger>
                      <SelectContent position="popper">
                        {targets.map((item) => (
                          <SelectItem
                            key={item._id}
                            value={item._id}
                            disabled={item._id !== link.toSceneId && used.has(item._id)}
                          >
                            {titleOf.get(item._id)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {linkProblems.target !== undefined ? (
                      <p id={targetErrorId} className="text-xs font-medium text-destructive">
                        {linkProblems.target}
                      </p>
                    ) : null}
                  </div>
                  <AngleInput
                    id={`${rowId}-yaw`}
                    label="Ugao (yaw)"
                    value={link.yaw}
                    error={linkProblems.yaw}
                    onChange={(yaw) => setLink(link.key, { yaw })}
                    testId="scene-link-yaw"
                  />
                  <AngleInput
                    id={`${rowId}-pitch`}
                    label="Nagib (pitch)"
                    value={link.pitch}
                    error={linkProblems.pitch}
                    onChange={(pitch) => setLink(link.key, { pitch })}
                    testId="scene-link-pitch"
                  />
                  <div className="col-span-2 flex flex-wrap gap-2 @2xl:col-span-3">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const view = currentView();
                        if (view !== null) setLink(link.key, view);
                      }}
                    >
                      <Crosshair aria-hidden="true" />
                      Postavi iz trenutnog prikaza
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={!finite(link.yaw)}
                      onClick={() => lookAt(link.yaw, link.pitch)}
                    >
                      <Eye aria-hidden="true" />
                      Prikaži
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="text-muted-foreground pointer-fine:hover:text-destructive"
                      onClick={() => onDraft({ ...draft, links: draft.links.filter((item) => item.key !== link.key) })}
                    >
                      <Trash2 aria-hidden="true" />
                      Ukloni vezu {index + 1}
                    </Button>
                  </div>
                </li>
              );
            })}
          </ol>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center justify-end gap-2 border-t pt-3">
        <Button type="button" variant="ghost" disabled={!dirty || saving} onClick={() => onDraft(baseline)}>
          Poništi izmene
        </Button>
        <Button
          type="button"
          disabled={!dirty || saving || hasProblems(problems)}
          onClick={() => void save()}
          data-testid="scene-save"
        >
          {saving ? <Loader2 aria-hidden="true" className="animate-spin" /> : null}
          Sačuvaj scenu
        </Button>
      </div>
    </section>
  );
}

function AngleInput({
  id,
  label,
  value,
  error,
  onChange,
  testId,
}: {
  id: string;
  label: string;
  value: Angle;
  error: string | undefined;
  onChange: (next: Angle) => void;
  testId?: string;
}) {
  const errorId = `${id}-error`;
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <DecimalInput
        id={id}
        value={value}
        onChange={onChange}
        angle
        invalid={error !== undefined}
        describedById={error !== undefined ? errorId : undefined}
        testId={testId}
      />
      {error !== undefined ? (
        <p id={errorId} className="text-xs font-medium text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}
