"use client";

import { useMutation } from "convex/react";
import { ArrowDown, ArrowUp, Plus, UserRound } from "lucide-react";
import { useLayoutEffect, useRef, useState } from "react";
import { EmptyState } from "@/components/admin/common/ListToolbar";
import { useMutationAction } from "@/components/admin/common/useMutationAction";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { AgentAvatar } from "./AgentAvatar";
import { countNoun, type TeamAgent } from "./labels";

type Direction = "up" | "down";

/**
 * Agent profiles in the order the site shows them (`/agenti`). Order is
 * changed with the arrow buttons (keyboard-friendly; focus follows the moved
 * row), and the public switch hides or shows a profile without opening it.
 */
export function AgentsPanel({
  agents,
  onOpen,
  onNew,
}: {
  agents: readonly TeamAgent[] | undefined;
  onOpen: (id: string) => void;
  onNew: () => void;
}) {
  const listRef = useRef<HTMLUListElement>(null);
  const focusAfterMove = useRef<{ id: Id<"agents">; direction: Direction } | null>(null);
  const [announcement, setAnnouncement] = useState("");

  const reorder = useMutationAction(
    useMutation(api.agentsAdmin.reorder).withOptimisticUpdate((store, args) => {
      const current = store.getQuery(api.agentsAdmin.list, {});
      if (current === undefined) return;
      const position = new Map(args.ids.map((id, index) => [id, index]));
      const next = current
        .map((agent) => ({ ...agent, order: position.get(agent._id) ?? agent.order }))
        .sort((a, b) => a.order - b.order);
      store.setQuery(api.agentsAdmin.list, {}, next);
    }),
  );
  const setPublic = useMutationAction(
    useMutation(api.agentsAdmin.setPublic).withOptimisticUpdate((store, args) => {
      const current = store.getQuery(api.agentsAdmin.list, {});
      if (current === undefined) return;
      store.setQuery(
        api.agentsAdmin.list,
        {},
        current.map((agent) => (agent._id === args.id ? { ...agent, isPublic: args.isPublic } : agent)),
      );
    }),
  );

  // React moves a row's DOM node when the order changes, and a moved node
  // loses focus; put it back on the same arrow (or the other one at an end).
  useLayoutEffect(() => {
    const pending = focusAfterMove.current;
    if (pending === null || agents === undefined) return;
    focusAfterMove.current = null;
    const find = (direction: Direction) =>
      listRef.current?.querySelector<HTMLButtonElement>(
        `[data-agent="${pending.id}"][data-move="${direction}"]`,
      );
    const preferred = find(pending.direction);
    const target =
      preferred !== null && preferred !== undefined && !preferred.disabled
        ? preferred
        : find(pending.direction === "up" ? "down" : "up");
    target?.focus();
  }, [agents]);

  if (agents === undefined) {
    return (
      <div aria-busy="true" aria-label="Profili se učitavaju" className="space-y-2">
        {Array.from({ length: 4 }, (_, index) => (
          <Skeleton key={index} className="h-16 w-full" />
        ))}
      </div>
    );
  }

  const move = (index: number, direction: Direction) => {
    const target = direction === "up" ? index - 1 : index + 1;
    if (target < 0 || target >= agents.length) return;
    const ids = agents.map((agent) => agent._id);
    [ids[index], ids[target]] = [ids[target], ids[index]];
    const moved = agents[index];
    focusAfterMove.current = { id: moved._id, direction };
    setAnnouncement(`${moved.name}: ${target + 1}. mesto od ${agents.length}.`);
    void reorder.run({ ids });
  };

  const toolbar = (
    <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
      <p className="max-w-xl text-sm text-muted-foreground">
        Redosled važi i na stranici Agenti na sajtu. Skriveni profili se ne prikazuju javno, a
        njihove nekretnine nude kontakt agencije.
      </p>
      <Button onClick={onNew} data-testid="agent-new">
        <Plus aria-hidden="true" />
        Novi profil
      </Button>
    </div>
  );

  if (agents.length === 0) {
    return (
      <>
        {toolbar}
        <EmptyState
          icon={<UserRound />}
          title="Još nema profila agenata."
          description="Profil agenta je javna kartica na sajtu i veza naloga sa nekretninama i upitima."
          action={<Button onClick={onNew}>Napravite profil</Button>}
        />
      </>
    );
  }

  return (
    <>
      {toolbar}
      <p className="sr-only" aria-live="polite">
        {announcement}
      </p>
      <ul ref={listRef} aria-label="Profili agenata" className="divide-y rounded-xl border bg-card">
        {agents.map((agent, index) => {
          const switchId = `agent-public-${agent._id}`;
          return (
            <li
              key={agent._id}
              data-testid="agent-row"
              data-slug={agent.slug}
              className="flex flex-wrap items-center gap-x-4 gap-y-2 px-3 py-3 sm:flex-nowrap"
            >
              <div className="flex shrink-0 flex-col" role="group" aria-label={`Redosled: ${agent.name}`}>
                <Button
                  variant="ghost"
                  size="icon-xs"
                  className="max-md:size-9"
                  data-agent={agent._id}
                  data-move="up"
                  disabled={index === 0}
                  onClick={() => move(index, "up")}
                  aria-label={`Pomerite ${agent.name} gore`}
                >
                  <ArrowUp aria-hidden="true" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-xs"
                  className="max-md:size-9"
                  data-agent={agent._id}
                  data-move="down"
                  disabled={index === agents.length - 1}
                  onClick={() => move(index, "down")}
                  aria-label={`Pomerite ${agent.name} dole`}
                >
                  <ArrowDown aria-hidden="true" />
                </Button>
              </div>

              <button
                type="button"
                onClick={() => onOpen(agent._id)}
                className="flex min-w-0 flex-1 basis-56 items-center gap-3 rounded-md text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                <AgentAvatar name={agent.name} photoUrl={agent.photoUrl} />
                <span className="min-w-0">
                  <span className="flex items-center gap-2">
                    <span className="truncate text-sm font-medium hover:underline">{agent.name}</span>
                    {agent.isDemo ? (
                      <span className="inline-flex h-3.5 shrink-0 items-center rounded-[3px] border px-1 font-mono text-[10px] leading-none tracking-wide text-muted-foreground uppercase">
                        Demo
                      </span>
                    ) : null}
                  </span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {agent.role.sr}
                    {agent.userId !== undefined ? " · ima nalog" : ""}
                  </span>
                </span>
              </button>

              <dl className="grid shrink-0 grid-cols-3 gap-x-5 text-xs max-sm:order-last max-sm:w-full max-sm:pl-12">
                <div>
                  <dt className="text-muted-foreground">Jezici</dt>
                  <dd className="font-mono uppercase">{agent.languages.join(" ") || "—"}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Oblasti</dt>
                  <dd>{agent.areas.length}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Nekretnine</dt>
                  <dd>
                    {agent.listingCount}
                    {agent.listingCountCapped ? "+" : ""}
                  </dd>
                </div>
              </dl>

              <div className="flex w-32 shrink-0 items-center justify-end gap-2">
                <label htmlFor={switchId} className="text-xs text-muted-foreground">
                  {agent.isPublic ? "Na sajtu" : "Skriven"}
                </label>
                <Switch
                  id={switchId}
                  checked={agent.isPublic}
                  onCheckedChange={(checked) => void setPublic.run({ id: agent._id, isPublic: checked })}
                  aria-label={`Javni profil: ${agent.name}`}
                  data-testid="agent-public"
                />
              </div>
            </li>
          );
        })}
      </ul>
      <p className="mt-2 text-xs text-muted-foreground">
        {countNoun(agents.length, "profil", "profila", "profila")} ·{" "}
        {countNoun(agents.filter((agent) => agent.isPublic).length, "javni", "javna", "javnih")}
      </p>
    </>
  );
}
