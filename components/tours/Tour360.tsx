"use client";

import "@photo-sphere-viewer/core/index.css";
import "@photo-sphere-viewer/gallery-plugin/index.css";
import "@photo-sphere-viewer/virtual-tour-plugin/index.css";
import { Viewer } from "@photo-sphere-viewer/core";
import { GalleryPlugin } from "@photo-sphere-viewer/gallery-plugin";
import {
  VirtualTourPlugin,
  type VirtualTourNode,
  type VirtualTourTransitionOptions,
} from "@photo-sphere-viewer/virtual-tour-plugin";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { Credits } from "./Credits";
import { RoomRail } from "./RoomRail";
import type { TourScene } from "./types";

/**
 * The self-hosted 360° tour (docs/06-3D-TOURS.md): Photo Sphere Viewer with
 * the virtual-tour plugin in its 2D mode, where every link is a labelled
 * hotspot at the doorway ("Spavaća soba →", so touch users see where it
 * leads), and the gallery plugin (room thumbnails). Loaded
 * only from `Tour360Launcher` through `next/dynamic({ ssr: false })` after a
 * click; destroyed on unmount.
 *
 * Phones get the 2048 px panoramas, desktops the 4096 px ones. With reduced
 * motion there is no rotation or cross-fade between rooms and no inertia.
 */

type Props = { scenes: TourScene[]; title: string };

const PSV_LANG_KEYS = [
  "zoom",
  "zoomOut",
  "zoomIn",
  "moveUp",
  "moveDown",
  "moveLeft",
  "moveRight",
  "fullscreen",
  "loading",
  "menu",
  "close",
  "twoFingers",
  "ctrlZoom",
  "loadError",
  "webglError",
  "gallery",
  "description",
  "download",
] as const;

const DOOR_HEIGHT = 40;

/** The doorway hotspot: the target room's name and an arrow, in the site's type. */
function doorElement(label: string): HTMLElement {
  const box = document.createElement("span");
  box.className = "flex items-center justify-center";
  const pill = document.createElement("span");
  pill.className =
    "inline-flex items-center gap-2 border border-ivory/50 bg-ink/80 px-3 py-2 font-sans text-[12px] font-medium uppercase tracking-[0.12em] whitespace-nowrap text-ivory backdrop-blur-[2px] transition-colors duration-200 pointer-fine:hover:border-bronze";
  pill.textContent = label;
  const arrow = document.createElement("span");
  arrow.setAttribute("aria-hidden", "true");
  arrow.textContent = "→";
  pill.append(arrow);
  box.append(pill);
  return box;
}

/**
 * The gallery plugin writes a node's `name` into innerHTML unescaped, and
 * scene titles are staff input, so they are escaped before PSV sees them.
 */
function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

/** PSV sizes a 2D link box itself: wide enough for the label at 12 px uppercase. */
function doorWidth(label: string): number {
  return Math.round(label.length * 10.5 + 64);
}

export default function Tour360({ scenes, title }: Props) {
  const t = useTranslations("tours");
  const tPsv = useTranslations("tours.psv");
  const containerRef = useRef<HTMLDivElement>(null);
  const tourRef = useRef<VirtualTourPlugin | null>(null);
  const [currentId, setCurrentId] = useState(scenes[0]?.id);

  // Read once per mount: the viewer is rebuilt only when the scenes change.
  const [labels] = useState(() => ({
    psv: Object.fromEntries(PSV_LANG_KEYS.map((key) => [key, tPsv(key)])),
    loading: t("loading"),
  }));

  useEffect(() => {
    const container = containerRef.current;
    if (container === null || scenes.length === 0) return;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const smallScreen = window.matchMedia("(max-width: 767px)").matches;
    const titleOf = new Map(scenes.map((scene) => [scene.id, scene.title]));
    const initialViewOf = new Map(scenes.map((scene) => [scene.id, scene.initialView]));

    const nodes: VirtualTourNode[] = scenes.map((scene) => ({
      id: scene.id,
      panorama: smallScreen && scene.panoMobileUrl !== undefined ? scene.panoMobileUrl : scene.panoUrl,
      name: escapeHtml(scene.title),
      ...(scene.thumbUrl !== undefined ? { thumbnail: scene.thumbUrl } : {}),
      links: scene.links.flatMap((link) => {
        const label = titleOf.get(link.to);
        if (label === undefined) return [];
        return [
          {
            nodeId: link.to,
            position: { yaw: link.yaw, pitch: link.pitch },
            arrowStyle: { element: doorElement(label), size: { width: doorWidth(label), height: DOOR_HEIGHT } },
          },
        ];
      }),
    }));

    const first = scenes[0];
    const transition = (to: VirtualTourNode): VirtualTourTransitionOptions => {
      const view = initialViewOf.get(to.id);
      return {
        showLoader: true,
        effect: reducedMotion ? "none" : "fade",
        rotation: !reducedMotion,
        speed: reducedMotion ? 0 : "20rpm",
        ...(view !== undefined ? { rotateTo: view } : {}),
      };
    };

    const createViewer = (): Viewer => {
      const instance = new Viewer({
        container,
        loadingTxt: labels.loading,
        lang: labels.psv,
        // The room rail is the caption; the gallery adds the thumbnails.
        navbar: smallScreen ? ["gallery", "fullscreen"] : ["zoom", "move", "gallery", "fullscreen"],
        defaultYaw: first.initialView?.yaw ?? 0,
        defaultPitch: first.initialView?.pitch ?? 0,
        keyboard: "always",
        moveInertia: !reducedMotion,
        mousewheelCtrlKey: false,
        touchmoveTwoFingers: false,
        canvasBackground: "#0e0d0b",
        plugins: [
          GalleryPlugin.withConfig({ thumbnailSize: { width: 160, height: 80 }, hideOnClick: true }),
          VirtualTourPlugin.withConfig({
            positionMode: "manual",
            renderMode: "2d",
            nodes,
            startNodeId: first.id,
            preload: true,
            showLinkTooltip: false,
            transitionOptions: transition,
          }),
        ],
      });
      // Typed as always present, but when PSV cannot start (no WebGL, or site
      // storage blocked so its touch probe throws) it shows its own localized
      // error overlay and never creates the plugins.
      const tour: VirtualTourPlugin | undefined = instance.getPlugin<VirtualTourPlugin>(VirtualTourPlugin);
      if (tour !== undefined) {
        tourRef.current = tour;
        tour.addEventListener("node-changed", ({ node }) => setCurrentId(node.id));
      }
      return instance;
    };

    // Created a tick later: Strict Mode's mount → unmount → mount replay then
    // never builds a viewer it would destroy mid-load (PSV's virtual tour
    // rejects an unhandled promise when destroyed while its first node loads).
    let viewer: Viewer | null = null;
    const timer = window.setTimeout(() => {
      viewer = createViewer();
    }, 0);

    // PSV's navbar buttons and gallery thumbnails are focusable <div>s with
    // only a `title`; give each one a button role and a name as it appears.
    const name = () => {
      for (const button of container.querySelectorAll<HTMLElement>(".psv-button:not([role])")) {
        button.setAttribute("role", "button");
        const label = button.getAttribute("title");
        if (label !== null && label !== "") button.setAttribute("aria-label", label);
      }
      for (const item of container.querySelectorAll<HTMLElement>(".psv-gallery-item:not([role])")) {
        item.setAttribute("role", "button");
        const label = titleOf.get(item.dataset.psvGalleryItem ?? "");
        if (label !== undefined) item.setAttribute("aria-label", label);
      }
    };
    const observer = new MutationObserver(name);
    observer.observe(container, { childList: true, subtree: true });

    return () => {
      window.clearTimeout(timer);
      observer.disconnect();
      tourRef.current = null;
      viewer?.destroy();
    };
  }, [scenes, labels]);

  const index = scenes.findIndex((scene) => scene.id === currentId);
  const current = index >= 0 ? scenes[index] : undefined;

  return (
    <div className="relative size-full" data-tour360="" data-current-scene={currentId}>
      <div ref={containerRef} className="size-full" aria-label={t("viewer360", { title })} role="application" />

      <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex flex-col items-start gap-3 bg-gradient-to-b from-ink/85 via-ink/40 to-transparent p-3 pr-16 pb-10 md:p-5 md:pr-20 md:pb-12">
        <p className="font-mono text-label uppercase tracking-[0.08em] text-ivory" aria-live="polite">
          {current !== undefined ? t("sceneOf", { current: index + 1, total: scenes.length }) : null}
        </p>
        {scenes.length > 1 ? (
          <RoomRail
            label={t("rooms")}
            rooms={scenes.map((scene) => ({ key: scene.id, label: scene.title, lang: scene.titleLang }))}
            current={currentId}
            onSelect={(id) => void tourRef.current?.setCurrentNode(id)}
          />
        ) : null}
      </div>

      {current?.credit !== undefined ? (
        <p className="absolute right-3 bottom-14 z-20 max-w-[60vw] bg-ink/70 px-2 py-1 text-right text-[11px] text-ivory/80 md:right-5">
          <Credits text={current.credit} label={(credit) => t("panoCredit", { credit })} />
        </p>
      ) : null}
    </div>
  );
}
