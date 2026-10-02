"use client";

import { usePaginatedQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { Newspaper, Plus } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useLayoutEffect, useMemo, useRef } from "react";
import { PHONE_QUERY } from "@/components/admin/common/breakpoints";
import { EmptyState, FilterSelect, ListToolbar, LoadMore, optionsFrom, SearchInput } from "@/components/admin/common/ListToolbar";
import { PageHeader } from "@/components/admin/common/PageHeader";
import { QueryErrorBoundary } from "@/components/admin/common/QueryErrorBoundary";
import { RequireRole } from "@/components/admin/common/RequireRole";
import { DotBadge } from "@/components/admin/common/StatusBadge";
import { DemoTag, FeaturedMark } from "@/components/admin/listings/table/cells";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { api } from "@/convex/_generated/api";
import { L10N_KEYS, type PostCategory } from "@/convex/lib/validators";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { formatDate, formatDateTime } from "@/lib/admin/format";
import { L10N_LABEL, POST_CATEGORY_LABEL } from "@/lib/admin/labels";
import { cn } from "@/lib/utils";
import {
  CONTENT_ROLES,
  isPostPhase,
  PHASE_LABEL,
  PHASE_TONE,
  phaseOf,
  postEditorHref,
  POSTS_PATH,
  type PostPhase,
} from "./shared";

type PostRow = FunctionReturnType<typeof api.postsAdmin.list>["page"][number];

const PAGE_SIZE = 25;
/** A title search filters pages on the server; top short pages up, within reason. */
const MAX_AUTO_LOADS = 8;
const NEW_POST_HREF = `${POSTS_PATH}/novi`;
const CATEGORIES = Object.keys(POST_CATEGORY_LABEL) as PostCategory[];
const PHASE_OPTIONS = optionsFrom<PostPhase>({
  draft: PHASE_LABEL.draft,
  scheduled: PHASE_LABEL.scheduled,
  published: PHASE_LABEL.published,
  archived: PHASE_LABEL.archived,
});

type Filters = { q: string; status: PostPhase | undefined; category: PostCategory | undefined };

function parseFilters(params: { get(name: string): string | null }): Filters {
  const status = params.get("status");
  const category = params.get("category");
  return {
    q: params.get("q") ?? "",
    status: isPostPhase(status) ? status : undefined,
    category: CATEGORIES.find((item) => item === category),
  };
}

function filtersHref(filters: Filters): string {
  const params = new URLSearchParams();
  const q = filters.q.trim();
  if (q.length > 0) params.set("q", q);
  if (filters.status !== undefined) params.set("status", filters.status);
  if (filters.category !== undefined) params.set("category", filters.category);
  const query = params.toString();
  return query.length > 0 ? `${POSTS_PATH}?${query}` : POSTS_PATH;
}

/**
 * The view lives in the query string (`?q=…&status=…&category=…`) so "back"
 * from the editor restores it; `history.replaceState` updates it without a
 * server round trip (the App Router mirrors it into `useSearchParams`).
 */
function usePostFilters() {
  const params = useSearchParams();
  const filters = useMemo(() => parseFilters(params), [params]);
  const setFilters = useCallback((patch: Partial<Filters>) => {
    const current = parseFilters(new URLSearchParams(window.location.search));
    window.history.replaceState(null, "", filtersHref({ ...current, ...patch }));
  }, []);
  return { filters, setFilters };
}

function titleOf(row: PostRow): string {
  const title = row.title.sr.trim();
  return title.length > 0 ? title : "Bez naslova";
}

function NewPostButton({ testId }: { testId?: string }) {
  return (
    <Button asChild>
      <Link href={NEW_POST_HREF} data-testid={testId}>
        <Plus aria-hidden="true" />
        Novi tekst
      </Link>
    </Button>
  );
}

/** `/admin/magazin` — the journal posts (PRD B9). */
export function PostsScreen() {
  return (
    <RequireRole roles={CONTENT_ROLES}>
      <QueryErrorBoundary backHref="/admin" backLabel="Kontrolna tabla">
        <PostsView />
      </QueryErrorBoundary>
    </RequireRole>
  );
}

function PostsView() {
  const { filters, setFilters } = usePostFilters();
  const phone = useMediaQuery(PHONE_QUERY);
  const q = filters.q.trim();
  const args = {
    ...(q.length > 0 ? { q } : {}),
    ...(filters.status !== undefined ? { status: filters.status } : {}),
    ...(filters.category !== undefined ? { category: filters.category } : {}),
  };
  const argsKey = JSON.stringify(args);
  const { results, status, loadMore } = usePaginatedQuery(api.postsAdmin.list, args, {
    initialNumItems: PAGE_SIZE,
  });

  // Search and the draft/scheduled split filter on the server after reading a
  // page; top the first screen up before it paints as "no results".
  const autoLoads = useRef({ key: "", count: 0 });
  useLayoutEffect(() => {
    if (status !== "CanLoadMore" || results.length >= PAGE_SIZE) return;
    if (autoLoads.current.key !== argsKey) autoLoads.current = { key: argsKey, count: 0 };
    if (autoLoads.current.count >= MAX_AUTO_LOADS) return;
    autoLoads.current.count += 1;
    loadMore(PAGE_SIZE);
  }, [status, results.length, argsKey, loadMore]);

  const loading = status === "LoadingFirstPage";
  const filtered = q.length > 0 || filters.status !== undefined || filters.category !== undefined;

  const empty = filtered ? (
    <EmptyState
      title={status === "CanLoadMore" ? "Među učitanim tekstovima nema poklapanja." : "Nijedan tekst ne odgovara filterima."}
      description={status === "CanLoadMore" ? "Učitajte još da pretraga nastavi kroz starije tekstove." : "Promenite ili poništite filtere."}
      action={
        <Button variant="outline" onClick={() => setFilters({ q: "", status: undefined, category: undefined })}>
          Poništi filtere
        </Button>
      }
    />
  ) : (
    <EmptyState
      icon={<Newspaper />}
      title="Magazin je još prazan."
      description="Napišite prvi tekst: vodič, priču o kraju ili pregled tržišta."
      action={<NewPostButton />}
    />
  );

  return (
    <>
      <PageHeader
        title="Magazin"
        description="Tekstovi za Magazin na sajtu: nacrti, zakazane objave, objavljeno i arhiva."
        actions={<NewPostButton testId="posts-new" />}
      />
      <ListToolbar>
        <SearchInput
          value={filters.q}
          onChange={(value) => setFilters({ q: value })}
          label="Pretraga po naslovu"
          placeholder="Pretraga po naslovu…"
        />
        <FilterSelect
          label="Status"
          value={filters.status}
          onChange={(value) => setFilters({ status: value })}
          options={PHASE_OPTIONS}
        />
        <FilterSelect
          label="Kategorija"
          value={filters.category}
          onChange={(value) => setFilters({ category: value })}
          options={optionsFrom(POST_CATEGORY_LABEL)}
          allLabel="Sve"
        />
      </ListToolbar>

      {!loading && results.length === 0 && status !== "LoadingMore" ? (
        empty
      ) : (
        <Card className="gap-0 py-0">
          {phone ? <PostsList rows={results} loading={loading} /> : <PostsTable rows={results} loading={loading} />}
        </Card>
      )}
      {results.length > 0 || status === "CanLoadMore" ? (
        <LoadMore status={status} onLoadMore={() => loadMore(PAGE_SIZE)} shown={results.length} />
      ) : null}
    </>
  );
}

/** `3/4` with the missing languages named for screen readers and on hover. */
function Languages({ row }: { row: PostRow }) {
  const missing = L10N_KEYS.filter((key) => !row.filledLocales.includes(key));
  const label =
    missing.length === 0
      ? "Napisano na sva 4 jezika"
      : `Nedostaje: ${missing.map((key) => L10N_LABEL[key].toLowerCase()).join(", ")}`;
  return (
    <span title={label} className={cn("tabular-nums", missing.length > 0 && "text-muted-foreground")}>
      <span aria-hidden="true">{row.filledLocales.length}/4</span>
      <span className="sr-only">{label}</span>
    </span>
  );
}

function Status({ row }: { row: PostRow }) {
  const phase = phaseOf(row);
  return <DotBadge tone={PHASE_TONE[phase]}>{PHASE_LABEL[phase]}</DotBadge>;
}

/** Publish date, or the scheduled moment for a scheduled draft. */
function When({ row }: { row: PostRow }) {
  if (row.status === "draft" && row.scheduledAt !== undefined) {
    return <span className="text-foreground">Zakazano za {formatDateTime(row.scheduledAt)}</span>;
  }
  if (row.publishedAt !== undefined) {
    return <span className="tabular-nums">{formatDate(row.publishedAt)}</span>;
  }
  return <span className="text-muted-foreground">—</span>;
}

function PostsTable({ rows, loading }: { rows: PostRow[]; loading: boolean }) {
  return (
    <Table aria-label="Tekstovi" aria-busy={loading}>
      <TableHeader>
        <TableRow>
          <TableHead className="pl-4">Naslov</TableHead>
          <TableHead>Kategorija</TableHead>
          <TableHead>Autor</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Objava</TableHead>
          <TableHead className="pr-4 text-right">Jezici</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {loading
          ? Array.from({ length: 6 }, (_, index) => (
              <TableRow key={index}>
                <TableCell className="pl-4">
                  <Skeleton className="h-4 w-72" />
                  <Skeleton className="mt-1.5 h-3 w-40" />
                </TableCell>
                {Array.from({ length: 5 }, (__, cell) => (
                  <TableCell key={cell}>
                    <Skeleton className="h-4 w-20" />
                  </TableCell>
                ))}
              </TableRow>
            ))
          : rows.map((row) => (
              <TableRow key={row._id} data-testid="post-row" data-post-id={row._id} className="relative">
                <TableCell className="max-w-[28rem] pl-4 whitespace-normal">
                  <Link
                    href={postEditorHref(row._id)}
                    className="font-medium outline-none after:absolute after:inset-0 hover:underline focus-visible:underline"
                  >
                    {row.featured ? <FeaturedMark /> : null}
                    {titleOf(row)}
                  </Link>
                  <span className="mt-0.5 flex items-center gap-1.5 font-mono text-xs text-muted-foreground">
                    <span className="truncate">/{row.slug}</span>
                    {row.isDemo ? <DemoTag /> : null}
                  </span>
                </TableCell>
                <TableCell>{POST_CATEGORY_LABEL[row.category]}</TableCell>
                <TableCell>{row.authorName ?? <span className="text-muted-foreground">—</span>}</TableCell>
                <TableCell>
                  <Status row={row} />
                </TableCell>
                <TableCell className="text-sm">
                  <When row={row} />
                </TableCell>
                <TableCell className="pr-4 text-right">
                  <Languages row={row} />
                </TableCell>
              </TableRow>
            ))}
      </TableBody>
    </Table>
  );
}

function PostsList({ rows, loading }: { rows: PostRow[]; loading: boolean }) {
  if (loading) {
    return (
      <ul aria-busy="true" aria-label="Tekstovi se učitavaju" className="divide-y">
        {Array.from({ length: 5 }, (_, index) => (
          <li key={index} className="space-y-2 px-3 py-3">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-3 w-32" />
          </li>
        ))}
      </ul>
    );
  }
  return (
    <ul aria-label="Tekstovi" className="divide-y">
      {rows.map((row) => (
        <li key={row._id} data-testid="post-row" data-post-id={row._id}>
          <Link
            href={postEditorHref(row._id)}
            className="block px-3 py-3 transition-colors duration-150 outline-none hover:bg-muted/50 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:ring-inset active:bg-muted"
          >
            <span className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5">
                {POST_CATEGORY_LABEL[row.category]}
                {row.isDemo ? <DemoTag /> : null}
              </span>
              <Status row={row} />
            </span>
            <span className="mt-1 line-clamp-2 block text-sm leading-snug font-medium">
              {row.featured ? <FeaturedMark /> : null}
              {titleOf(row)}
            </span>
            <span className="mt-1 flex items-center justify-between gap-2 text-xs text-muted-foreground">
              <When row={row} />
              <Languages row={row} />
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

