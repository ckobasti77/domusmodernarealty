"use client";

import { useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { Copy, RefreshCw, SearchX } from "lucide-react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useCallback, useEffect, useId, useRef, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { describedBy, FieldShell, FormSection, SaveBar } from "@/components/admin/common/form";
import { ImageField } from "@/components/admin/common/ImageField";
import type { L10nValue } from "@/components/admin/common/L10nInput";
import { PageHeader } from "@/components/admin/common/PageHeader";
import { RequireRole } from "@/components/admin/common/RequireRole";
import { DotBadge } from "@/components/admin/common/StatusBadge";
import { LOCALE_LANG, LocaleTabs } from "@/components/admin/listings/editor/LocaleTabs";
import { useBreadcrumbLabel } from "@/components/admin/shell/breadcrumbs";
import { hasRole, MANAGER_ROLES, useMe } from "@/components/admin/shell/me";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { slugify } from "@/convex/lib/slug";
import type { L10nKey, PostCategory } from "@/convex/lib/validators";
import { adminErrorMessage } from "@/lib/admin/errors";
import { L10N_LABEL, L10N_SHORT, POST_CATEGORY_LABEL } from "@/lib/admin/labels";
import { cn } from "@/lib/utils";
import {
  EXCERPT_MAX,
  EXCERPT_SOFT,
  sameForm,
  slugFollowsTitle,
  TITLE_MAX,
  toForm,
  toUpsertArgs,
  validateForm,
  type PostForm,
} from "./form";
import { LeaveGuard } from "./LeaveGuard";
import { PublishCard } from "./PublishCard";
import { SeoFields } from "./SeoFields";
import { CONTENT_ROLES, PHASE_LABEL, PHASE_TONE, phaseOf, POSTS_PATH } from "./shared";
import { TagsInput } from "./TagsInput";

type EditorData = NonNullable<FunctionReturnType<typeof api.postsAdmin.get>>;

function BodySkeleton() {
  return <Skeleton className="h-[23rem] w-full rounded-lg" />;
}

// Tiptap and the sanitizer (DOMPurify) are client-only and heavy: load them on demand.
const BodyEditor = dynamic(() => import("./BodyEditor").then((module) => module.BodyEditor), {
  ssr: false,
  loading: BodySkeleton,
});
const PostPreview = dynamic(() => import("./PostPreview").then((module) => module.PostPreview), {
  ssr: false,
  loading: BodySkeleton,
});

const NO_AUTHOR = "__none__";
const CATEGORIES = Object.keys(POST_CATEGORY_LABEL) as PostCategory[];

/** `/admin/magazin/[id]` — the journal post editor (PRD B9). */
export function PostEditor({ id }: { id: string }) {
  return (
    <RequireRole roles={CONTENT_ROLES}>
      <PostEditorLoader id={id} />
    </RequireRole>
  );
}

function PostEditorLoader({ id }: { id: string }) {
  const data = useQuery(api.postsAdmin.get, { id });
  const [leaving, setLeaving] = useState(false);
  useBreadcrumbLabel(data ? data.post.title.sr.trim() || "Bez naslova" : null);

  if (data === undefined || (data === null && leaving)) return <EditorSkeleton />;
  if (data === null) return <NotFound />;
  return <EditorForm key={data.post._id} data={data} onDeleting={setLeaving} />;
}

function EditorSkeleton() {
  return (
    <div aria-busy="true" aria-label="Tekst se učitava" className="flex flex-col gap-6">
      <Skeleton className="h-9 w-80 max-w-full" />
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="flex flex-col gap-4">
          <Skeleton className="h-9 w-56" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-24 w-full" />
          <BodySkeleton />
        </div>
        <Skeleton className="h-96 w-full rounded-xl" />
      </div>
    </div>
  );
}

function NotFound() {
  return (
    <div role="alert" className="mx-auto mt-10 max-w-md rounded-lg border bg-card p-8 text-center">
      <SearchX aria-hidden="true" className="mx-auto size-8 text-muted-foreground" />
      <h1 className="mt-4 text-lg font-semibold">Tekst nije pronađen</h1>
      <p className="mt-2 text-sm text-muted-foreground">Možda je obrisan, ili je link pogrešan.</p>
      <Button variant="outline" asChild className="mt-6">
        <Link href={POSTS_PATH}>Nazad na Magazin</Link>
      </Button>
    </div>
  );
}

/** A locale counts as written when its title and body are filled. */
function written(form: PostForm, locale: L10nKey): boolean {
  return form.title[locale].trim().length > 0 && form.body[locale].trim().length > 0;
}

function EditorForm({ data, onDeleting }: { data: EditorData; onDeleting: (deleting: boolean) => void }) {
  const me = useMe();
  const formRef = useRef<HTMLFormElement>(null);
  const upsert = useMutation(api.postsAdmin.upsert);
  const agents = useQuery(api.agentsAdmin.list, {});

  const [form, setForm] = useState<PostForm>(() => toForm(data.post));
  const [baseline, setBaseline] = useState<PostForm>(form);
  const [syncedPost, setSyncedPost] = useState(data.post);
  // What is being saved: the server version replaces it when it lands.
  const [submitted, setSubmitted] = useState<PostForm | null>(null);
  const [slugAuto, setSlugAuto] = useState(() => slugFollowsTitle(data.post));
  const [saving, setSaving] = useState(false);
  const [showErrors, setShowErrors] = useState(false);
  const [locale, setLocale] = useState<L10nKey>("sr");
  const [view, setView] = useState<"text" | "preview">("text");

  // A new server version (our own save, a status change, a colleague's edit):
  // adopt it unless the form holds edits that were not part of it.
  if (data.post !== syncedPost) {
    setSyncedPost(data.post);
    const server = toForm(data.post);
    if (sameForm(form, baseline) || (submitted !== null && sameForm(form, submitted))) setForm(server);
    if (submitted !== null) setSubmitted(null);
    setBaseline(server);
  }

  const dirty = !sameForm(form, baseline);
  const errors = showErrors ? validateForm(form) : {};
  const phase = phaseOf(data.post);
  const canDelete = hasRole(me, MANAGER_ROLES);

  const update = useCallback((patch: Partial<PostForm>) => setForm((current) => ({ ...current, ...patch })), []);

  const setTitle = (title: L10nValue) =>
    setForm((current) => ({
      ...current,
      title,
      slug: slugAuto && title.sr.trim().length > 0 ? slugify(title.sr) : current.slug,
    }));

  const save = useCallback(async (): Promise<boolean> => {
    const problems = validateForm(form);
    setShowErrors(true);
    const first = Object.values(problems)[0];
    if (first !== undefined) {
      toast.error(first);
      return false;
    }
    const sent = form;
    setSubmitted(sent);
    setSaving(true);
    try {
      const result = await upsert(toUpsertArgs(data.post._id, sent, data.post));
      const requested = sent.slug.trim();
      if (requested.length > 0 && result.slug !== requested) {
        toast.info(`Adresa „${requested}” je zauzeta; tekst je sačuvan pod adresom „${result.slug}”.`);
      }
      if (!result.changed) {
        // Only whitespace or order differed: the stored version is already
        // this one, and no new server version will arrive to adopt.
        setSubmitted(null);
        setForm((current) => (sameForm(current, sent) ? baseline : current));
      }
      toast.success("Tekst je sačuvan.");
      return true;
    } catch (error) {
      setSubmitted(null);
      toast.error(adminErrorMessage(error));
      return false;
    } finally {
      setSaving(false);
    }
  }, [form, baseline, upsert, data.post]);

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!saving) void save();
  };

  // Ctrl/⌘+S saves from anywhere on the page.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && !event.altKey && event.key.toLowerCase() === "s") {
        event.preventDefault();
        formRef.current?.requestSubmit();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const savedCover = data.post.cover;
  const coverPreviewUrl =
    form.cover === undefined
      ? undefined
      : form.cover.kind === "url"
        ? form.cover.url
        : savedCover?.kind === "storage" && savedCover.storageId === form.cover.storageId
          ? data.coverUrl
          : undefined;

  const title = data.post.title.sr.trim();

  return (
    <>
      <form ref={formRef} onSubmit={onSubmit} noValidate className="mx-auto max-w-[1600px]">
        <PageHeader
          eyebrow="Magazin"
          title={title.length > 0 ? title : <span className="text-muted-foreground">Bez naslova</span>}
          description={
            data.post.isDemo
              ? "Demo tekst: briše se zajedno sa ostalim demo sadržajem."
              : "Tekst na srpskom je izvor; prevodi su opcioni i na sajtu zamenjuju srpski kada postoje."
          }
          actions={<DotBadge tone={PHASE_TONE[phase]}>{PHASE_LABEL[phase]}</DotBadge>}
        />

        <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
          <Tabs
            value={view}
            onValueChange={(next) => setView(next === "preview" ? "preview" : "text")}
            className="min-w-0 gap-4"
          >
            <TabsList variant="line" aria-label="Prikaz teksta" className="h-9 w-full justify-start border-b">
              <TabsTrigger value="text" className="flex-none px-3" data-testid="post-tab-text">
                Tekst
              </TabsTrigger>
              <TabsTrigger value="preview" className="flex-none px-3" data-testid="post-tab-preview">
                Pregled
              </TabsTrigger>
            </TabsList>

            <TabsContent value="text">
              <LocaleTabs
                label="Jezik teksta"
                value={locale}
                onValueChange={setLocale}
                trigger={(key) => <LocaleTrigger locale={key} done={written(form, key)} />}
              >
                {(key) => (
                  <LocaleFields
                    locale={key}
                    form={form}
                    postId={data.post._id}
                    titleError={key === "sr" ? errors.title : undefined}
                    onTitle={setTitle}
                    onChange={update}
                  />
                )}
              </LocaleTabs>
            </TabsContent>

            <TabsContent value="preview">
              <LocaleTabs
                label="Jezik pregleda"
                value={locale}
                onValueChange={setLocale}
                trigger={(key) => <LocaleTrigger locale={key} done={written(form, key)} />}
              >
                {(key) => (
                  <div className="rounded-xl border bg-card px-4 py-6 md:px-8">
                    <PostPreview
                      form={form}
                      locale={key}
                      coverUrl={coverPreviewUrl}
                      readingMinutes={data.post.readingMinutes}
                    />
                  </div>
                )}
              </LocaleTabs>
            </TabsContent>
          </Tabs>

          <div className="flex min-w-0 flex-col gap-4">
            <PublishCard data={data} dirty={dirty} save={save} canDelete={canDelete} onDeleting={onDeleting} />

            <FormSection title="Adresa i razvrstavanje" columns={1}>
              <SlugField
                value={form.slug}
                auto={slugAuto}
                published={data.post.publishedAt !== undefined}
                error={errors.slug}
                onChange={(slug) => {
                  setSlugAuto(false);
                  update({ slug });
                }}
                onRegenerate={() => {
                  setSlugAuto(true);
                  if (form.title.sr.trim().length > 0) update({ slug: slugify(form.title.sr) });
                }}
              />
              <CategoryField value={form.category} onChange={(category) => update({ category })} />
              <TagsField value={form.tags} onChange={(tags) => update({ tags })} />
              <AuthorField
                value={form.authorAgentId}
                agents={agents}
                onChange={(authorAgentId) => update({ authorAgentId })}
              />
              <FeaturedField value={form.featured} onChange={(featured) => update({ featured })} />
            </FormSection>

            <FormSection
              title="Naslovna slika"
              description="Prikazuje se u listi tekstova, na vrhu članka i pri deljenju na mrežama."
              columns={1}
            >
              <ImageField
                label="Naslovna slika"
                value={form.cover}
                previewUrl={coverPreviewUrl}
                onChange={(cover) => update({ cover })}
                aspect="video"
                testId="post-cover"
              />
            </FormSection>

            <FormSection
              title="Pretraživači (SEO)"
              description="Opciono. Ako ostane prazno, koriste se naslov i kratak opis teksta."
              columns={1}
            >
              <SeoFields
                metaTitle={form.metaTitle}
                metaDescription={form.metaDescription}
                onChange={(next) => update(next)}
              />
            </FormSection>
          </div>
        </div>

        <SaveBar dirty={dirty} saving={saving} onReset={() => setForm(baseline)} />
      </form>
      <LeaveGuard dirty={dirty} />
    </>
  );
}

function LocaleTrigger({ locale, done }: { locale: L10nKey; done: boolean }) {
  return (
    <>
      <span aria-hidden="true">{L10N_SHORT[locale]}</span>
      <span className="sr-only">{L10N_LABEL[locale]}</span>
      {done ? (
        <span aria-hidden="true" className="size-1.5 rounded-full bg-success" />
      ) : null}
      <span className="sr-only">{done ? " (napisano)" : " (nije napisano)"}</span>
    </>
  );
}

function LocaleFields({
  locale,
  form,
  postId,
  titleError,
  onTitle,
  onChange,
}: {
  locale: L10nKey;
  form: PostForm;
  postId: Id<"posts">;
  titleError: string | undefined;
  onTitle: (title: L10nValue) => void;
  onChange: (patch: Partial<PostForm>) => void;
}) {
  const id = useId();
  const lang = LOCALE_LANG[locale];
  const language = L10N_LABEL[locale].toLowerCase();
  const empty = !written(form, locale) && form.excerpt[locale].trim().length === 0;
  const canCopy = locale !== "sr" && empty && written(form, "sr");
  const excerptLength = form.excerpt[locale].length;

  return (
    <div className="flex flex-col gap-5 rounded-xl border bg-card p-4 md:p-5">
      {canCopy ? (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-dashed px-3 py-2 text-xs text-muted-foreground">
          <span>Prevod na {language} još ne postoji.</span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() =>
              onChange({
                title: { ...form.title, [locale]: form.title.sr },
                excerpt: { ...form.excerpt, [locale]: form.excerpt.sr },
                body: { ...form.body, [locale]: form.body.sr },
              })
            }
          >
            <Copy aria-hidden="true" />
            Kopiraj srpski tekst kao polazište
          </Button>
        </div>
      ) : null}

      <FieldShell
        id={`${id}-title`}
        label={
          <>
            Naslov <span className="text-muted-foreground">({language})</span>
            {locale === "sr" ? <span aria-hidden="true"> *</span> : null}
          </>
        }
        error={titleError}
      >
        <Input
          id={`${id}-title`}
          lang={lang}
          value={form.title[locale]}
          maxLength={TITLE_MAX}
          required={locale === "sr"}
          autoComplete="off"
          className="text-base font-medium"
          data-testid={`post-title-${locale}`}
          aria-invalid={titleError !== undefined || undefined}
          aria-describedby={describedBy(`${id}-title`, false, titleError !== undefined)}
          onChange={(event) => onTitle({ ...form.title, [locale]: event.target.value })}
        />
      </FieldShell>

      <FieldShell
        id={`${id}-excerpt`}
        label={
          <>
            Kratak opis <span className="text-muted-foreground">({language})</span>
          </>
        }
        labelAside={
          <span
            className={cn(
              "text-xs tabular-nums",
              excerptLength > EXCERPT_SOFT ? "font-medium text-amber-700 dark:text-amber-300" : "text-muted-foreground",
            )}
          >
            {excerptLength}/{EXCERPT_SOFT}
          </span>
        }
        hint={`Uvod ispod naslova i tekst u listi Magazina; preporuka do ${EXCERPT_SOFT} znakova.`}
      >
        <Textarea
          id={`${id}-excerpt`}
          lang={lang}
          rows={3}
          value={form.excerpt[locale]}
          maxLength={EXCERPT_MAX}
          data-testid={`post-excerpt-${locale}`}
          aria-describedby={describedBy(`${id}-excerpt`, true, false)}
          onChange={(event) => onChange({ excerpt: { ...form.excerpt, [locale]: event.target.value } })}
        />
      </FieldShell>

      <div className="flex flex-col gap-1.5">
        <span id={`${id}-body-label`} className="text-sm leading-snug font-medium">
          Tekst <span className="text-muted-foreground">({language})</span>
        </span>
        <BodyEditor
          postId={postId}
          locale={locale}
          value={form.body[locale]}
          labelId={`${id}-body-label`}
          onChange={(html) => onChange({ body: { ...form.body, [locale]: html } })}
        />
      </div>
    </div>
  );
}

function SlugField({
  value,
  auto,
  published,
  error,
  onChange,
  onRegenerate,
}: {
  value: string;
  auto: boolean;
  published: boolean;
  error: string | undefined;
  onChange: (slug: string) => void;
  onRegenerate: () => void;
}) {
  const id = useId();
  return (
    <FieldShell
      id={id}
      label="Adresa (slug)"
      error={error}
      hint={
        published
          ? "Promena adrese objavljenog teksta menja njegov link; stari link prestaje da radi."
          : auto
            ? "Prati srpski naslov dok je ne izmenite."
            : "Mala slova a–z, cifre i crtice."
      }
      labelAside={
        auto ? null : (
          <Button type="button" variant="ghost" size="sm" className="h-7 text-xs" onClick={onRegenerate}>
            <RefreshCw aria-hidden="true" />
            Iz naslova
          </Button>
        )
      }
    >
      <div className="flex min-w-0 items-center rounded-md border bg-background focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50">
        <span className="shrink-0 pl-2.5 font-mono text-xs text-muted-foreground" aria-hidden="true">
          /magazin/
        </span>
        <input
          id={id}
          value={value}
          maxLength={80}
          autoComplete="off"
          spellCheck={false}
          data-testid="post-slug"
          aria-invalid={error !== undefined || undefined}
          aria-describedby={describedBy(id, true, error !== undefined)}
          className="h-8 min-w-0 flex-1 bg-transparent pr-2.5 font-mono text-sm outline-none max-md:h-11"
          onChange={(event) => onChange(event.target.value)}
          onBlur={(event) => {
            const normalized = slugify(event.target.value);
            if (event.target.value.trim().length > 0 && normalized !== event.target.value) onChange(normalized);
          }}
        />
      </div>
    </FieldShell>
  );
}

function CategoryField({ value, onChange }: { value: PostCategory; onChange: (value: PostCategory) => void }) {
  const id = useId();
  return (
    <FieldShell id={id} label="Kategorija">
      <Select
        value={value}
        onValueChange={(next) => {
          const category = CATEGORIES.find((item) => item === next);
          if (category !== undefined) onChange(category);
        }}
      >
        <SelectTrigger id={id} className="w-full" data-testid="post-category">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {CATEGORIES.map((category) => (
            <SelectItem key={category} value={category}>
              {POST_CATEGORY_LABEL[category]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </FieldShell>
  );
}

function TagsField({ value, onChange }: { value: string[]; onChange: (value: string[]) => void }) {
  const id = useId();
  return (
    <FieldShell id={id} label="Oznake" hint="Enter ili zarez dodaje oznaku.">
      <TagsInput id={id} value={value} onChange={onChange} describedById={`${id}-hint`} />
    </FieldShell>
  );
}

type AgentRow = FunctionReturnType<typeof api.agentsAdmin.list>[number];

function AuthorField({
  value,
  agents,
  onChange,
}: {
  value: Id<"agents"> | undefined;
  agents: AgentRow[] | undefined;
  onChange: (value: Id<"agents"> | undefined) => void;
}) {
  const id = useId();
  const selected = agents?.find((agent) => agent._id === value);
  return (
    <FieldShell
      id={id}
      label="Autor"
      hint={
        selected !== undefined && !selected.isPublic
          ? "Profil ovog agenta nije javan, pa se autor na sajtu ne prikazuje."
          : "Prikazuje se ispod teksta, sa profilom agenta."
      }
    >
      {agents === undefined ? (
        <Skeleton className="h-8 w-full max-md:h-11" />
      ) : (
        <Select
          value={value ?? NO_AUTHOR}
          onValueChange={(next) => onChange(agents.find((agent) => agent._id === next)?._id)}
        >
          <SelectTrigger id={id} className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NO_AUTHOR}>Bez autora</SelectItem>
            {agents.map((agent) => (
              <SelectItem key={agent._id} value={agent._id}>
                {agent.name}
                {agent.isPublic ? "" : " (profil nije javan)"}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </FieldShell>
  );
}

function FeaturedField({ value, onChange }: { value: boolean; onChange: (value: boolean) => void }) {
  const id = useId();
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="flex flex-col gap-1">
        <Label htmlFor={id}>Istaknut tekst</Label>
        <p id={`${id}-hint`} className="text-xs text-muted-foreground">
          Prikazuje se na vrhu Magazina.
        </p>
      </div>
      <Switch
        id={id}
        checked={value}
        onCheckedChange={onChange}
        aria-describedby={`${id}-hint`}
        data-testid="post-featured"
      />
    </div>
  );
}
