"use client";

import { useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { ArrowDown, ArrowUp, ExternalLink, Plus, Trash2, TriangleAlert } from "lucide-react";
import { useEffect, useId, useMemo, useRef, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { FormSection, SaveBar } from "@/components/admin/common/form";
import { EMPTY_L10N } from "@/components/admin/common/L10nInput";
import { useLeaveGuard } from "@/components/admin/common/LeaveGuard";
import { DotBadge } from "@/components/admin/common/StatusBadge";
import { useNow } from "@/components/admin/common/use-now";
import { hasRole, MANAGER_ROLES, useMe } from "@/components/admin/shell/me";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/convex/_generated/api";
import type { PageKey } from "@/convex/lib/validators";
import { adminErrorMessage } from "@/lib/admin/errors";
import { formatDateTime, formatRelative } from "@/lib/admin/format";
import { PAGE_KEY_LABEL } from "@/lib/admin/labels";
import { BlockFields } from "./BlockFields";
import { blockInfo } from "./labels";
import {
  fingerprint,
  fromForm,
  newSectionKey,
  PUBLIC_PATH,
  shapeOf,
  toForm,
  validate,
  type BlockForm,
  type BlockShape,
  type FormErrors,
} from "./model";

type EditorPage = FunctionReturnType<typeof api.pagesAdmin.get>;

type Baseline = {
  /** The server version the form started from (sent back as the conflict check). */
  updatedAt: number | null;
  blocks: BlockForm[];
  shapes: Map<string, BlockShape>;
  fingerprint: string;
};

const NO_SHAPE: BlockShape = { title: false, lede: false, sub: false, note: false };

function baselineOf(page: EditorPage): Baseline {
  const plainBody = page.key === "home";
  const blocks = page.blocks.map((block) => toForm(block, plainBody));
  const shapes = new Map(
    page.blocks.map((block) => {
      const shape = shapeOf(block);
      // A legal section's title is optional whatever it had when loaded.
      return [block.key, page.layout === "sections" ? { ...shape, title: false } : shape] as const;
    }),
  );
  return { updatedAt: page.updatedAt, blocks, shapes, fingerprint: fingerprint(blocks, plainBody) };
}

function moveBlock(blocks: readonly BlockForm[], from: number, to: number): BlockForm[] {
  const next = [...blocks];
  const [block] = next.splice(from, 1);
  next.splice(to, 0, block);
  return next;
}

export function EditorSkeleton() {
  return (
    <div className="flex flex-col gap-4" aria-busy="true" aria-label="Učitavanje stranice">
      <Skeleton className="h-8 w-56" />
      {Array.from({ length: 3 }, (_unused, index) => (
        <Skeleton key={index} className="h-56 w-full rounded-xl" />
      ))}
    </div>
  );
}

/** Loads one page and mounts a fresh form per page key. */
export function PageEditor({ pageKey, onDirtyChange }: { pageKey: PageKey; onDirtyChange: (dirty: boolean) => void }) {
  const page = useQuery(api.pagesAdmin.get, { key: pageKey });
  if (page === undefined) return <EditorSkeleton />;
  return <PageForm key={pageKey} page={page} onDirtyChange={onDirtyChange} />;
}

function PageForm({ page, onDirtyChange }: { page: EditorPage; onDirtyChange: (dirty: boolean) => void }) {
  const formId = useId();
  const formRef = useRef<HTMLFormElement>(null);
  const upsert = useMutation(api.pagesAdmin.upsert);
  const now = useNow(60_000);
  const plainBody = page.key === "home";
  const sectionPage = page.layout === "sections";
  const me = useMe();
  // Taking the demo flag off a figure is for admin/manager (the server checks too).
  const canClearDemo = hasRole(me, MANAGER_ROLES);

  const [baseline, setBaseline] = useState(() => baselineOf(page));
  const [blocks, setBlocks] = useState<BlockForm[]>(baseline.blocks);
  const [errors, setErrors] = useState<FormErrors>({});
  const [saving, setSaving] = useState(false);
  const [seenVersion, setSeenVersion] = useState(page.updatedAt);

  const current = useMemo(() => fingerprint(blocks, plainBody), [blocks, plainBody]);
  const dirty = current !== baseline.fingerprint;

  // A new server version (our own save landing, or someone else's): adopt it
  // when nothing is pending here; with unsaved edits, keep them and warn.
  if (page.updatedAt !== seenVersion) {
    setSeenVersion(page.updatedAt);
    const incoming = baselineOf(page);
    if (incoming.fingerprint === baseline.fingerprint) {
      setBaseline({ ...baseline, updatedAt: page.updatedAt });
    } else if (!dirty) {
      setBaseline(incoming);
      setBlocks(incoming.blocks);
      setErrors({});
    }
  }
  const stale = dirty && page.updatedAt !== baseline.updatedAt;

  useEffect(() => {
    onDirtyChange(dirty);
  }, [dirty, onDirtyChange]);
  useEffect(() => () => onDirtyChange(false), [onDirtyChange]);
  useLeaveGuard({ dirty, description: "Izmene na ovoj stranici nisu sačuvane i biće izgubljene." });

  // Ctrl/⌘+S saves, as in the listing editor.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
        event.preventDefault();
        formRef.current?.requestSubmit();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  const update = (index: number, next: BlockForm) => setBlocks((list) => list.map((block, at) => (at === index ? next : block)));

  const reset = () => {
    const fresh = baselineOf(page);
    setBaseline(fresh);
    setBlocks(fresh.blocks);
    setErrors({});
  };

  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!dirty || saving) return;
    const found = validate(blocks, baseline.shapes, plainBody);
    setErrors(found);
    if (Object.keys(found).length > 0) {
      toast.error("Proverite označena polja — srpski tekst je obavezan.");
      requestAnimationFrame(() => formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus());
      return;
    }
    setSaving(true);
    try {
      const result = await upsert({
        key: page.key,
        blocks: blocks.map((block) => fromForm(block, plainBody)),
        expectedUpdatedAt: baseline.updatedAt,
      });
      setBaseline({ updatedAt: result.updatedAt, blocks, shapes: baseline.shapes, fingerprint: current });
      toast.success("Sačuvano. Izmene su odmah vidljive na sajtu.");
    } catch (error) {
      toast.error(adminErrorMessage(error, "Stranica nije sačuvana."));
    } finally {
      setSaving(false);
    }
  };

  const addSection = () =>
    setBlocks((list) => [
      ...list,
      { type: "richText", key: newSectionKey(list.map((block) => block.key)), title: EMPTY_L10N, body: EMPTY_L10N },
    ]);

  const lastEdited =
    page.updatedAt !== null
      ? `Poslednja izmena: ${page.updatedByName !== undefined ? `${page.updatedByName}, ` : ""}${formatRelative(Math.min(page.updatedAt, now), now)}`
      : "Stranica još nije sačuvana.";

  return (
    <form id={formId} ref={formRef} onSubmit={save} noValidate className="flex min-w-0 flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <h2 className="text-lg font-semibold tracking-tight">{PAGE_KEY_LABEL[page.key]}</h2>
            {page.isDemo ? <DotBadge tone="warning">Demo sadržaj</DotBadge> : null}
            {!page.exists ? <DotBadge tone="muted">Nije sačuvana</DotBadge> : null}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {page.updatedAt !== null ? <time dateTime={new Date(page.updatedAt).toISOString()} title={formatDateTime(page.updatedAt)}>{lastEdited}</time> : lastEdited}
          </p>
        </div>
        <Button variant="outline" size="sm" asChild>
          <a href={PUBLIC_PATH[page.key]} target="_blank" rel="noreferrer" data-testid="content-view-on-site">
            Pogledaj na sajtu
            <ExternalLink aria-hidden="true" />
            <span className="sr-only">(otvara se u novom prozoru)</span>
          </a>
        </Button>
      </div>

      {page.isDemo ? (
        <p className="rounded-lg border border-warning/40 bg-warning/10 px-4 py-3 text-sm leading-relaxed">
          Ovo je početni tekst sajta. Kada sačuvate izmene, stranica postaje Vaš sadržaj i oznaka „demo” nestaje. Brojke
          označene kao demo i dalje nose napomenu na sajtu dok ih ne zamenite stvarnim podacima.
        </p>
      ) : null}

      {stale ? (
        <div role="alert" className="flex flex-wrap items-center gap-3 rounded-lg border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm">
          <TriangleAlert className="size-4 shrink-0 text-destructive" aria-hidden="true" />
          <p className="min-w-0 flex-1">
            Ovu stranicu je u međuvremenu sačuvao neko drugi. Vaše izmene nisu izgubljene, ali čuvanje će biti odbijeno
            dok ne učitate novu verziju.
          </p>
          <Button type="button" variant="outline" size="sm" onClick={reset}>
            Učitajte novu verziju
          </Button>
        </div>
      ) : null}

      {blocks.map((block, index) => {
        const srTitle = "title" in block ? block.title.sr : "";
        const info = blockInfo(page.key, block, index, srTitle);
        const preview = page.mediaPreviews.find((item) => item.key === block.key)?.url;
        return (
          <div key={block.key} data-testid={`block-${block.key}`}>
            <FormSection
              title={info.title}
              description={info.description}
              columns={1}
              actions={
                sectionPage ? (
                  <div className="flex items-center gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label={`Pomeri sekciju gore: ${info.title}`}
                      disabled={index === 0}
                      onClick={() => setBlocks((list) => moveBlock(list, index, index - 1))}
                    >
                      <ArrowUp aria-hidden="true" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label={`Pomeri sekciju dole: ${info.title}`}
                      disabled={index === blocks.length - 1}
                      onClick={() => setBlocks((list) => moveBlock(list, index, index + 1))}
                    >
                      <ArrowDown aria-hidden="true" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label={`Uklonite sekciju: ${info.title}`}
                      disabled={blocks.length <= 1}
                      onClick={() => setBlocks((list) => list.filter((other) => other.key !== block.key))}
                    >
                      <Trash2 aria-hidden="true" />
                    </Button>
                  </div>
                ) : undefined
              }
            >
              <BlockFields
                block={block}
                onChange={(next) => update(index, next)}
                info={info}
                shape={baseline.shapes.get(block.key) ?? NO_SHAPE}
                sectionPage={sectionPage}
                fixedItems={page.fixedItems}
                plainBody={plainBody}
                canClearDemo={canClearDemo}
                errors={errors}
                ctaTargets={page.ctaTargets}
                mediaPreview={preview}
              />
            </FormSection>
          </div>
        );
      })}

      {sectionPage ? (
        <div>
          <Button type="button" variant="outline" onClick={addSection} data-testid="content-add-section">
            <Plus aria-hidden="true" />
            Dodajte sekciju
          </Button>
        </div>
      ) : null}

      <SaveBar dirty={dirty} saving={saving} onReset={reset} form={formId} extra={lastEdited} />
    </form>
  );
}
