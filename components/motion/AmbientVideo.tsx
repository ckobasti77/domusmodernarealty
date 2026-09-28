"use client";

import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import type { MediaVideo } from "@/lib/media";
import { cn } from "@/lib/utils";

/**
 * A muted, looping mood video layered over a still the parent renders.
 *
 *  - Nothing is requested until the host is within one viewport of the screen;
 *    then the `<video>` mounts with `preload="metadata"`.
 *  - It plays only while at least a tenth of it is visible, and pauses
 *    otherwise — off-screen video decoding is pure battery drain.
 *  - It cross-fades in once it is actually playing, so a slow connection just
 *    keeps the still.
 *  - Reduced motion and data-saver connections never mount it.
 *
 * Decorative by contract: it is `aria-hidden` and carries no controls, so it
 * must never hold information the still and the copy do not.
 */

type SaveDataConnection = { saveData?: boolean };

function prefersLightPayload(): boolean {
  const connection = (navigator as Navigator & { connection?: SaveDataConnection }).connection;
  return connection?.saveData === true;
}

export function AmbientVideo({ video, className }: { video: MediaVideo; className?: string }) {
  const host = useRef<HTMLDivElement>(null);
  const element = useRef<HTMLVideoElement>(null);
  const reduced = useReducedMotion();
  const [mounted, setMounted] = useState(false);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    const target = host.current;
    if (target === null || reduced || prefersLightPayload()) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting !== true) return;
        setMounted(true);
        observer.disconnect();
      },
      { rootMargin: "100% 0px" },
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, [reduced]);

  useEffect(() => {
    const target = host.current;
    const player = element.current;
    if (target === null || player === null) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry === undefined) return;
        if (entry.isIntersecting) void player.play().catch(() => {});
        else player.pause();
      },
      { threshold: 0.1 },
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, [mounted]);

  return (
    <div ref={host} aria-hidden="true" className={cn("pointer-events-none absolute inset-0", className)}>
      {mounted && !reduced ? (
        <video
          ref={element}
          preload="metadata"
          muted
          loop
          playsInline
          disablePictureInPicture
          disableRemotePlayback
          tabIndex={-1}
          onPlaying={() => setPlaying(true)}
          className={cn(
            "size-full object-cover transition-opacity duration-700 ease-out",
            playing ? "opacity-100" : "opacity-0",
          )}
        >
          {video.mobileSrc !== undefined ? (
            <source src={video.mobileSrc} type="video/mp4" media="(max-width: 1279px)" />
          ) : null}
          {video.sources.map((source) => (
            <source key={source.src} src={source.src} type={source.type} />
          ))}
        </video>
      ) : null}
    </div>
  );
}
