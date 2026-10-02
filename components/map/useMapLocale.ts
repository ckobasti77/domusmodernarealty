"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";

/**
 * MapLibre's own UI strings in the page's language: the canvas name (what it
 * is and how to drive it; the wrapping region already names the place),
 * the zoom buttons, the credit toggle, the card's close button and the hints of
 * `cooperativeGestures` ("Ctrl + scroll", "two fingers"), which otherwise show
 * in English on every locale. MapLibre reads them once, when the map is built,
 * so they are built once too.
 */
export function useMapLocale(): Record<string, string> {
  const t = useTranslations("search.map");
  const tCommon = useTranslations("common");
  const tZoom = useTranslations("listing.lightbox");
  const [locale] = useState(() => ({
    "Map.Title": t("canvas"),
    "Popup.Close": tCommon("close"),
    "NavigationControl.ZoomIn": tZoom("zoomIn"),
    "NavigationControl.ZoomOut": tZoom("zoomOut"),
    "AttributionControl.ToggleAttribution": t("attribution"),
    "CooperativeGesturesHandler.WindowsHelpText": t("gesturesWindows"),
    "CooperativeGesturesHandler.MacHelpText": t("gesturesMac"),
    "CooperativeGesturesHandler.MobileHelpText": t("gesturesTouch"),
  }));
  return locale;
}
