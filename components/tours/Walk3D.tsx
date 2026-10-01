"use client";

import { CircleHelp } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { Badge } from "@/components/site/Badge";
import { Button } from "@/components/site/Button";
import type { WalkTier } from "@/lib/tours/device";
import { cn } from "@/lib/utils";
import { Credits } from "./Credits";
import { RoomRail } from "./RoomRail";
import type { WalkAsset, WalkData } from "./types";
import { WalkEngine, type EnginePhase } from "./walk/WalkEngine";

/**
 * The 3D walkthrough UI around `WalkEngine`: download progress, the controls
 * help (keys or gestures), room hotspots, the touch joystick, the CC-BY
 * attribution, and the slow-device / lost-context / load-failure states.
 * Loaded only after a click through `next/dynamic({ ssr: false })`; closing
 * the dialog unmounts it, which disposes the renderer and its GPU context.
 */

type Props = {
  walk: WalkData;
  asset: WalkAsset;
  tier: WalkTier;
  touch: boolean;
  title: string;
  /** Present when the listing also has a 360° tour to fall back to. */
  onOpen360?: () => void;
};

const OVERLAY_BUTTON =
  "min-h-11 border px-4 font-sans text-small uppercase tracking-[0.12em] backdrop-blur-[2px] transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-bronze";

export default function Walk3D({ walk, asset, tier, touch, title, onOpen360 }: Props) {
  const t = useTranslations("tours");
  const hostRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<WalkEngine | null>(null);
  const [phase, setPhase] = useState<EnginePhase>("download");
  const [percent, setPercent] = useState(0);
  const [error, setError] = useState<"load" | "context" | null>(null);
  const [slow, setSlow] = useState(false);
  const [helpOpen, setHelpOpen] = useState(true);
  const [attempt, setAttempt] = useState(0);
  const [room, setRoom] = useState<string | undefined>(undefined);

  useEffect(() => {
    const host = hostRef.current;
    if (host === null) return;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let lastPercent = -1;
    const engine = new WalkEngine(
      host,
      { walk, asset, tier, reducedMotion },
      {
        onProgress: (loaded, total) => {
          const next = total > 0 ? Math.min(99, Math.floor((loaded / total) * 100)) : 0;
          if (next !== lastPercent) {
            lastPercent = next;
            setPercent(next);
          }
        },
        onPhase: setPhase,
        onError: setError,
        onSlow: () => setSlow(true),
        onLeaveRoom: () => setRoom(undefined),
      },
    );
    engineRef.current = engine;
    void engine.load();
    return () => {
      engineRef.current = null;
      engine.dispose();
    };
  }, [walk, asset, tier, attempt]);

  const retry = () => {
    setError(null);
    setSlow(false);
    setPercent(0);
    setPhase("download");
    setAttempt((value) => value + 1);
  };

  const ready = phase === "ready" && error === null;

  const roomKey = (index: number) => `room-${index}`;
  const rooms =
    walk.hotspots.length > 0 ? (
      <RoomRail
        label={t("rooms")}
        rooms={walk.hotspots.map((hotspot, index) => ({ key: roomKey(index), label: hotspot.label, lang: hotspot.lang }))}
        current={room}
        onSelect={(key) => {
          const hotspot = walk.hotspots.find((_, index) => roomKey(index) === key);
          if (hotspot === undefined) return;
          engineRef.current?.goTo(hotspot.x, hotspot.z, hotspot.yaw);
          setRoom(key);
        }}
      />
    ) : null;

  return (
    <div className="relative size-full" data-walk3d="" data-walk-phase={error ?? phase}>
      <div ref={hostRef} className="absolute inset-0" role="application" aria-label={t("viewer3d", { title })} />

      {/* Title strip with the room rail under it (top left, as in the 360° tour). */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex flex-col items-start gap-3 bg-gradient-to-b from-ink/85 via-ink/40 to-transparent p-3 pb-10 md:p-5 md:pb-12">
        <div className="flex min-w-0 max-w-full items-center gap-3 pr-28 md:pr-32">
          <Badge tone="dark" className="shrink-0">
            {t("beta")}
          </Badge>
          <p className="hidden truncate font-sans text-small text-ivory md:block">{t("viewer3d", { title })}</p>
        </div>
        {walk.aiGenerated ? <p className="max-w-md text-small text-ivory">{t("aiGenerated")}</p> : null}
        {ready ? rooms : null}
      </div>

      <button
        type="button"
        onClick={() => setHelpOpen(true)}
        aria-label={t("helpOpen")}
        className="absolute top-3 right-16 z-30 flex size-11 items-center justify-center border border-ivory/40 bg-ink/70 text-ivory backdrop-blur-[2px] transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-bronze pointer-fine:hover:border-bronze pointer-fine:hover:text-bronze md:top-5 md:right-[4.5rem]"
      >
        <CircleHelp aria-hidden="true" strokeWidth={1.5} className="size-5" />
      </button>

      {/* Loading */}
      {!ready && error === null ? (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-ink/70 p-6" role="status" aria-live="polite">
          <div className="flex w-full max-w-xs flex-col gap-3 text-center">
            <p className="font-sans text-small uppercase tracking-[0.12em] text-ivory">
              {phase === "download" ? t("loadingModel", { percent }) : t("preparing")}
            </p>
            <div className="h-px w-full bg-ivory/20" aria-hidden="true">
              <div
                className="h-px origin-left bg-bronze transition-transform duration-200"
                style={{ transform: `scaleX(${phase === "download" ? percent / 100 : 1})` }}
              />
            </div>
          </div>
        </div>
      ) : null}

      {/* Errors */}
      {error !== null ? (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-ink/90 p-6" role="alert">
          <div className="flex max-w-md flex-col items-center gap-5 text-center">
            <p className="text-body text-ivory">{error === "context" ? t("contextLost") : t("loadError")}</p>
            <div className="flex flex-wrap justify-center gap-3">
              <button type="button" onClick={retry} className={cn(OVERLAY_BUTTON, "border-ivory/40 text-ivory pointer-fine:hover:border-bronze")}>
                {t("retry")}
              </button>
              {onOpen360 !== undefined ? (
                <button type="button" onClick={onOpen360} className={cn(OVERLAY_BUTTON, "border-bronze text-bronze")}>
                  {t("open360Instead")}
                </button>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      {/* Slow device */}
      {slow && error === null ? (
        <div className="absolute inset-x-3 top-24 z-20 mx-auto flex max-w-lg flex-col gap-3 border border-ivory/30 bg-ink/85 p-4 backdrop-blur-[2px] md:top-28" role="status">
          <p className="text-small text-ivory">{t("slow")}</p>
          <div className="flex flex-wrap gap-2">
            {onOpen360 !== undefined ? (
              <button type="button" onClick={onOpen360} className={cn(OVERLAY_BUTTON, "border-bronze text-bronze")}>
                {t("open360Instead")}
              </button>
            ) : null}
            <button type="button" onClick={() => setSlow(false)} className={cn(OVERLAY_BUTTON, "border-ivory/40 text-ivory")}>
              {t("helpClose")}
            </button>
          </div>
        </div>
      ) : null}

      {ready && touch ? (
        <Joystick label={t("joystick")} onChange={(x, y) => engineRef.current?.setJoystick(x, y)} />
      ) : null}

      {walk.credits !== undefined ? (
        <p
          className={cn(
            "absolute right-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-20 bg-ink/70 px-2 py-1 text-right text-[11px] leading-snug text-ivory/80 md:right-5 md:bottom-5",
            touch ? "max-w-[calc(100vw-12rem)]" : "max-w-[min(70vw,32rem)]",
          )}
        >
          <Credits text={walk.credits} label={(credits) => t("attribution", { credits })} />
        </p>
      ) : null}

      {ready && helpOpen ? <HelpPanel touch={touch} onClose={() => setHelpOpen(false)} /> : null}
    </div>
  );
}

function HelpPanel({ touch, onClose }: { touch: boolean; onClose: () => void }) {
  const t = useTranslations("tours");
  const panelRef = useRef<HTMLElement>(null);
  useEffect(() => {
    panelRef.current?.querySelector("button")?.focus();
  }, []);
  const lines = touch
    ? [t("helpTouchMove"), t("helpTouchLook"), t("helpTouchTap"), t("helpRooms")]
    : [t("helpMove"), t("helpTurn"), t("helpLook"), t("helpClick"), t("helpRooms"), t("helpExit")];
  // Each line is "Action: keys or gesture"; shown as a two-column list.
  const rows = lines.map((line) => {
    const cut = line.indexOf(": ");
    return cut > 0 ? { action: line.slice(0, cut), how: line.slice(cut + 2) } : { action: line, how: "" };
  });
  return (
    <section
      ref={panelRef}
      aria-labelledby="walk-help-title"
      className="absolute inset-x-3 top-1/2 z-30 mx-auto max-w-sm -translate-y-1/2 border border-ivory/30 bg-ink/90 p-5 backdrop-blur-[2px] md:inset-x-auto md:top-auto md:bottom-5 md:left-5 md:w-96 md:translate-y-0"
    >
      <h2 id="walk-help-title" className="font-display text-h3 text-ivory">
        {t("helpHeading")}
      </h2>
      <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-small">
        {rows.map((row) => (
          <div key={row.action} className="contents">
            <dt className="text-mist">{row.action}</dt>
            <dd className="text-ivory">{row.how}</dd>
          </div>
        ))}
      </dl>
      <Button variant="inverse" size="compact" onClick={onClose} className="mt-5 w-full">
        {t("helpClose")}
      </Button>
    </section>
  );
}

/** Touch joystick, bottom left. Pointer-only by design: keyboards have WASD. */
function Joystick({ label, onChange }: { label: string; onChange: (x: number, y: number) => void }) {
  const baseRef = useRef<HTMLDivElement>(null);
  const [knob, setKnob] = useState({ x: 0, y: 0 });
  const pointerRef = useRef<number | null>(null);
  const RADIUS = 44;

  const update = (event: ReactPointerEvent<HTMLDivElement>) => {
    const base = baseRef.current;
    if (base === null) return;
    const rect = base.getBoundingClientRect();
    let dx = event.clientX - (rect.left + rect.width / 2);
    let dy = event.clientY - (rect.top + rect.height / 2);
    const length = Math.hypot(dx, dy);
    if (length > RADIUS) {
      dx = (dx / length) * RADIUS;
      dy = (dy / length) * RADIUS;
    }
    setKnob({ x: dx, y: dy });
    onChange(dx / RADIUS, -dy / RADIUS);
  };

  const release = () => {
    pointerRef.current = null;
    setKnob({ x: 0, y: 0 });
    onChange(0, 0);
  };

  return (
    <div
      ref={baseRef}
      aria-label={label}
      role="img"
      onPointerDown={(event) => {
        pointerRef.current = event.pointerId;
        event.currentTarget.setPointerCapture(event.pointerId);
        update(event);
      }}
      onPointerMove={(event) => {
        if (pointerRef.current === event.pointerId) update(event);
      }}
      onPointerUp={release}
      onPointerCancel={release}
      className="absolute bottom-[max(2rem,env(safe-area-inset-bottom))] left-5 z-20 flex size-32 touch-none items-center justify-center rounded-full border border-ivory/60 bg-ink/55 backdrop-blur-[2px]"
    >
      <span
        aria-hidden="true"
        className="size-14 rounded-full border border-bronze bg-ink/70"
        style={{ transform: `translate(${knob.x}px, ${knob.y}px)` }}
      />
    </div>
  );
}
