/**
 * Device tiering for the splat walkthrough, decided before anything is
 * downloaded (docs/06-3D-TOURS.md): no WebGL2 → offer the 360° tour or the
 * photos; iOS, ≤ 4 GB of memory or data saver → the light (mobile) model;
 * otherwise the full model.
 */

export type WalkTier = "unsupported" | "light" | "full";

export type WalkDevice = {
  tier: WalkTier;
  /** The visitor asked the browser to save data: never start a big download unasked. */
  saveData: boolean;
  /** Touch-first device: show the joystick and touch help. */
  touch: boolean;
};

type NavigatorHints = Navigator & {
  deviceMemory?: number;
  connection?: { saveData?: boolean };
};

export function isIos(nav: Navigator): boolean {
  // iPadOS reports itself as a Mac with touch.
  return /iPad|iPhone|iPod/.test(nav.userAgent) || (nav.platform === "MacIntel" && nav.maxTouchPoints > 1);
}

export function hasWebGL2(): boolean {
  try {
    const canvas = document.createElement("canvas");
    const gl = canvas.getContext("webgl2");
    if (gl === null) return false;
    gl.getExtension("WEBGL_lose_context")?.loseContext();
    return true;
  } catch {
    return false;
  }
}

export function detectWalkDevice(): WalkDevice {
  const nav = navigator as NavigatorHints;
  const saveData = nav.connection?.saveData === true;
  const touch = window.matchMedia("(pointer: coarse)").matches;
  if (!hasWebGL2()) return { tier: "unsupported", saveData, touch };
  const lowMemory = typeof nav.deviceMemory === "number" && nav.deviceMemory <= 4;
  const tier: WalkTier = isIos(nav) || lowMemory || saveData ? "light" : "full";
  return { tier, saveData, touch };
}

/** Upper bound for the canvas pixel ratio per tier (phones: ≤ 1.5, per the research). */
export function maxPixelRatio(tier: WalkTier): number {
  return tier === "light" ? 1.5 : 2;
}
