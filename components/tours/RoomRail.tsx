"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

export type Room = { key: string; label: string; lang?: string };

/**
 * The room switcher both viewers share, top left: one hairline-framed rail,
 * the current room marked with the site's bronze underline (as the page tabs
 * are) and `aria-current`. It scrolls sideways on phones, fades out at the
 * right edge as a scroll cue, and keeps the current room in view.
 */
export function RoomRail({
  label,
  rooms,
  current,
  onSelect,
}: {
  label: string;
  rooms: Room[];
  /** Key of the room the visitor is in, if any. */
  current?: string;
  onSelect: (key: string) => void;
}) {
  const listRef = useRef<HTMLUListElement>(null);

  useEffect(() => {
    if (current === undefined) return;
    const active = listRef.current?.querySelector<HTMLElement>('[aria-current="true"]');
    active?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [current]);

  return (
    <nav aria-label={label} className="pointer-events-auto max-w-full">
      <ul
        ref={listRef}
        className="flex max-w-full divide-x divide-ivory/15 overflow-x-auto border border-ivory/20 bg-ink/85 backdrop-blur-[2px] [mask-image:linear-gradient(to_right,#000_85%,transparent)] [scrollbar-width:none] md:w-max md:[mask-image:none]"
      >
        {rooms.map((room) => {
          const active = room.key === current;
          return (
            <li key={room.key} className="shrink-0">
              <button
                type="button"
                lang={room.lang}
                aria-current={active ? "true" : undefined}
                onClick={() => onSelect(room.key)}
                className={cn(
                  "relative min-h-11 whitespace-nowrap px-4 font-sans text-small uppercase tracking-[0.12em] transition-colors duration-200",
                  "after:absolute after:inset-x-4 after:bottom-2 after:h-px after:bg-bronze after:transition-transform after:duration-300",
                  "focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-bronze",
                  active ? "text-ivory after:scale-x-100" : "text-mist after:scale-x-0 pointer-fine:hover:text-ivory",
                )}
              >
                {room.label}
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
