"use client";

import { useEffect } from "react";
import { useConsent } from "@/lib/stores/consent";

export type AnalyticsIds = {
  plausibleDomain?: string;
  ga4Id?: string;
  metaPixelId?: string;
};

/** Appends one script to <head>, once per page (a repeat call is a no-op). */
function inject(id: string, attributes: Record<string, string>, inline?: string): void {
  if (document.getElementById(id) !== null) return;
  const script = document.createElement("script");
  script.id = id;
  for (const [name, value] of Object.entries(attributes)) script.setAttribute(name, value);
  if (inline !== undefined) script.textContent = inline;
  document.head.append(script);
}

/**
 * Third-party measurement from Podešavanja (PRD A1, B11), loaded only after
 * the visitor's consent: Plausible and GA4 need the "analytics" category, the
 * Meta Pixel needs "marketing". Nothing is requested before a decision or
 * after "necessary only". The IDs are validated by `settingsAdmin.update`
 * (G-XXXXXXX, digits, bare domain) and serialized with JSON.stringify, so they
 * cannot break out of the inline snippets. A script that has loaded stays for
 * the rest of the page view; a withdrawn consent applies from the next load.
 */
export function Analytics({ ids }: { ids: AnalyticsIds }) {
  const { categories } = useConsent();
  const { plausibleDomain, ga4Id, metaPixelId } = ids;

  useEffect(() => {
    if (!categories.analytics) return;
    if (plausibleDomain !== undefined) {
      inject("me-plausible", { src: "https://plausible.io/js/script.js", "data-domain": plausibleDomain, defer: "" });
    }
    if (ga4Id !== undefined) {
      inject("me-ga4", { src: `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(ga4Id)}`, async: "" });
      inject(
        "me-ga4-config",
        {},
        `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag("js",new Date());gtag("config",${JSON.stringify(ga4Id)},{anonymize_ip:true});`,
      );
    }
  }, [categories.analytics, plausibleDomain, ga4Id]);

  useEffect(() => {
    if (!categories.marketing || metaPixelId === undefined) return;
    inject(
      "me-meta-pixel",
      {},
      `!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version="2.0";n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,"script","https://connect.facebook.net/en_US/fbevents.js");fbq("init",${JSON.stringify(metaPixelId)});fbq("track","PageView");`,
    );
  }, [categories.marketing, metaPixelId]);

  return null;
}
