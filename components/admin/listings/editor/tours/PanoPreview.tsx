"use client";

import "@photo-sphere-viewer/core/index.css";
import "@photo-sphere-viewer/markers-plugin/index.css";
import { Viewer } from "@photo-sphere-viewer/core";
import { MarkersPlugin, type MarkerConfig } from "@photo-sphere-viewer/markers-plugin";
import { useEffect, useRef, useState, type RefObject } from "react";
import { useReducedMotion } from "@/hooks/useReducedMotion";

/** What the scene editor reads from and does to the preview. */
export type PanoControls = {
  /** The view at the center crosshair, in radians. */
  getPosition: () => { yaw: number; pitch: number };
  lookAt: (view: { yaw: number; pitch: number }) => void;
};

export type PanoMarker = { id: string; yaw: number; pitch: number; label: string };

/** Photo Sphere Viewer's built-in strings, in Serbian for the admin. */
const LANG = {
  zoom: "Uvećanje",
  zoomOut: "Umanji",
  zoomIn: "Uvećaj",
  moveUp: "Pogled gore",
  moveDown: "Pogled dole",
  moveLeft: "Pogled levo",
  moveRight: "Pogled desno",
  description: "Opis",
  download: "Preuzmi",
  fullscreen: "Ceo ekran",
  loading: "Učitavanje…",
  menu: "Meni",
  close: "Zatvori",
  twoFingers: "Pomerajte pogled sa dva prsta",
  ctrlZoom: "Za uvećanje držite Ctrl i okrećite točkić",
  loadError: "Panorama ne može da se učita",
  webglError: "Pregledač ne podržava WebGL, pa pregled nije dostupan",
};

/** Link markers as text (never HTML: scene titles are typed by staff). */
function markerConfigs(markers: readonly PanoMarker[]): MarkerConfig[] {
  return markers.map((marker) => {
    const element = document.createElement("span");
    element.className =
      "pointer-events-none inline-flex items-center gap-1 rounded-md bg-black/70 px-2 py-1 text-xs font-medium whitespace-nowrap text-white ring-1 ring-white/50";
    element.textContent = `→ ${marker.label}`;
    return {
      id: marker.id,
      element,
      position: { yaw: marker.yaw, pitch: marker.pitch },
      anchor: "center center",
    };
  });
}

/**
 * The scene editor's small 360° preview: Photo Sphere Viewer with the scene's
 * links as labelled markers and a crosshair at the center, so "set from the
 * current view" means "what the crosshair is on". Loaded through
 * `next/dynamic({ ssr: false })` only while a scene is open; destroyed on unmount.
 */
export default function PanoPreview({
  url,
  initialView,
  markers,
  controlRef,
  label,
}: {
  url: string;
  initialView: { yaw: number; pitch: number } | null;
  markers: readonly PanoMarker[];
  controlRef: RefObject<PanoControls | null>;
  label: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<Viewer | null>(null);
  const loadedUrl = useRef<string | null>(null);
  const reduced = useReducedMotion();
  // The first view builds the viewer; later changes go through its API below.
  const [initial] = useState(() => ({ view: initialView, reduced }));
  // Read when the viewer is finally built (a frame after mounting).
  const latest = useRef({ url, markers });
  useEffect(() => {
    latest.current = { url, markers };
  });

  useEffect(() => {
    const container = containerRef.current;
    if (container === null) return;
    let viewer: Viewer | null = null;
    // One frame later: a mount that is torn down at once (React's dev double
    // effect) then never starts a download. three.js shares in-flight requests
    // per URL, so destroying that first viewer would abort the second one's too.
    const frame = requestAnimationFrame(() => {
      const { url: firstUrl, markers: firstMarkers } = latest.current;
      const created = new Viewer({
        container,
        panorama: firstUrl,
        defaultYaw: initial.view?.yaw ?? 0,
        defaultPitch: initial.view?.pitch ?? 0,
        navbar: ["zoom", "move"],
        lang: LANG,
        loadingTxt: LANG.loading,
        // The page scrolls past the preview; zooming needs Ctrl (or pinch).
        mousewheelCtrlKey: true,
        keyboard: false,
        moveInertia: !initial.reduced,
        canvasBackground: "#1a1a1a",
        plugins: [MarkersPlugin.withConfig({ markers: markerConfigs(firstMarkers) })],
      });
      viewer = created;
      viewerRef.current = created;
      loadedUrl.current = firstUrl;
      controlRef.current = {
        getPosition: () => created.getPosition(),
        lookAt: (view) => created.rotate(view),
      };
    });
    return () => {
      cancelAnimationFrame(frame);
      controlRef.current = null;
      viewerRef.current = null;
      viewer?.destroy();
    };
  }, [initial, controlRef]);

  useEffect(() => {
    viewerRef.current?.setOption("moveInertia", !reduced);
  }, [reduced]);

  useEffect(() => {
    const viewer = viewerRef.current;
    if (viewer === null || loadedUrl.current === url) return;
    loadedUrl.current = url;
    void viewer.setPanorama(url, { transition: false, showLoader: true });
  }, [url]);

  useEffect(() => {
    viewerRef.current?.getPlugin<MarkersPlugin>(MarkersPlugin).setMarkers(markerConfigs(markers));
  }, [markers]);

  return (
    <div className="relative aspect-[3/2] w-full overflow-hidden rounded-lg border bg-neutral-900 @lg:aspect-[2/1]">
      <div
        ref={containerRef}
        role="group"
        aria-label={label}
        data-lenis-prevent=""
        data-testid="pano-preview"
        className="absolute inset-0"
      />
      {/* The point "Postavi iz trenutnog prikaza" reads. */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <span className="relative size-6">
          <span className="absolute top-1/2 left-0 h-px w-full -translate-y-1/2 bg-white shadow-[0_0_0_1px_rgb(0_0_0/0.5)]" />
          <span className="absolute top-0 left-1/2 h-full w-px -translate-x-1/2 bg-white shadow-[0_0_0_1px_rgb(0_0_0/0.5)]" />
        </span>
      </div>
    </div>
  );
}
