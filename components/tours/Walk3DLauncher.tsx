"use client";

import { Footprints } from "lucide-react";
import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";
import { useState, useSyncExternalStore } from "react";
import { Button } from "@/components/site/Button";
import { detectWalkDevice, type WalkDevice } from "@/lib/tours/device";
import { TourDialog } from "./TourDialog";
import type { TourScene, WalkAsset, WalkData } from "./types";
import { useMegabytes } from "./useMegabytes";
import { ViewerLoading } from "./ViewerLoading";

/** three.js + Spark (≈ 1 MB of JS and WASM) download only after the click. */
const Walk3D = dynamic(() => import("./Walk3D"), { ssr: false, loading: () => <ViewerLoading /> });
const Tour360 = dynamic(() => import("./Tour360"), { ssr: false, loading: () => <ViewerLoading /> });

/** The device does not change during a visit: detect once, then serve the cached result. */
let cachedDevice: WalkDevice | undefined;
const clientDevice = (): WalkDevice => (cachedDevice ??= detectWalkDevice());
const serverDevice = (): WalkDevice | null => null;
const subscribeToNothing = () => () => undefined;

type Props = {
  walk: WalkData;
  title: string;
  /** The listing's 360° scenes: the fallback when the walk cannot run. */
  scenes: TourScene[];
};

/**
 * Starts the splat walkthrough after device tiering (lib/tours/device.ts):
 * no WebGL2 → explain and offer the 360° tour; a light device gets the mobile
 * model, or a size warning when there is none; data saver asks first. The
 * button names the download size, and nothing is fetched before the click.
 */
export function Walk3DLauncher({ walk, title, scenes }: Props) {
  const t = useTranslations("tours");
  const megabytes = useMegabytes();
  // Tiering needs `window`: the server render (and hydration) shows the full model's size.
  const device = useSyncExternalStore(subscribeToNothing, clientDevice, serverDevice);
  const [mode, setMode] = useState<"walk" | "tour360" | null>(null);

  const light = device?.tier === "light";
  const asset: WalkAsset = light && walk.mobile !== undefined ? walk.mobile : walk.desktop;
  const heavyForDevice = light && walk.mobile === undefined;
  const size = asset.bytes !== undefined ? megabytes(asset.bytes) : null;
  const has360 = scenes.length > 0;
  const open360 = has360 ? () => setMode("tour360") : undefined;

  if (device?.tier === "unsupported") {
    return (
      <div className="flex max-w-md flex-col gap-4" data-walk-unsupported="">
        <p className="text-body text-ivory">{open360 !== undefined ? t("unsupported") : t("unsupportedNo360")}</p>
        {open360 !== undefined ? (
          <Button variant="outlineDark" onClick={open360}>
            {t("open360Instead")}
          </Button>
        ) : null}
        {mode === "tour360" ? (
          <TourDialog label={t("viewer360", { title })} onClose={() => setMode(null)}>
            <Tour360 scenes={scenes} title={title} />
          </TourDialog>
        ) : null}
      </div>
    );
  }

  const warning =
    size === null ? null : heavyForDevice ? t("heavyWarning", { size }) : device?.saveData ? t("saveDataWarning", { size }) : null;

  return (
    <div className="flex flex-col items-start gap-4">
      {warning !== null ? <p className="max-w-md text-small text-mist">{warning}</p> : null}
      <div className="flex flex-wrap gap-3">
        <Button
          variant="inverse"
          onClick={() => setMode("walk")}
          data-launch="walk3d"
          className="h-auto min-h-[52px] px-5 py-3 sm:px-8"
        >
          <span className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1">
            <Footprints aria-hidden="true" strokeWidth={1.5} className="hidden size-5 sm:block" />
            <span>{warning !== null ? t("loadAnyway") : t("launch3d")}</span>
            {size !== null ? <span className="whitespace-nowrap text-stone-text">· {size}</span> : null}
          </span>
        </Button>
        {warning !== null && open360 !== undefined ? (
          <Button variant="outlineDark" onClick={open360}>
            {t("open360Instead")}
          </Button>
        ) : null}
      </div>

      {mode === "walk" && device !== null ? (
        <TourDialog label={t("viewer3d", { title })} onClose={() => setMode(null)}>
          <Walk3D walk={walk} asset={asset} tier={device.tier} touch={device.touch} title={title} onOpen360={open360} />
        </TourDialog>
      ) : null}
      {mode === "tour360" ? (
        <TourDialog label={t("viewer360", { title })} onClose={() => setMode(null)}>
          <Tour360 scenes={scenes} title={title} />
        </TourDialog>
      ) : null}
    </div>
  );
}
