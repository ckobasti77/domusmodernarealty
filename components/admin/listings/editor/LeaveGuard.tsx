"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ConfirmDialog } from "@/components/admin/common/ConfirmDialog";
import type { AutosaveEngine } from "./autosave-engine";

/**
 * Keeps unsaved work from being lost when leaving the editor:
 * - closing or reloading the tab while dirty or saving asks the browser to confirm;
 * - an in-app link click (same origin, plain left click) first flushes the
 *   autosave and navigates once it has landed; if it fails or fields remain
 *   unsaved (validation errors), the user chooses to stay or to leave.
 * Route changes that are not link clicks (⌘K) rely on the unmount flush in `useAutosave`.
 */
export function LeaveGuard({ engine }: { engine: AutosaveEngine }) {
  const router = useRouter();
  const [pendingHref, setPendingHref] = useState<string | null>(null);

  useEffect(() => {
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!engine.isBusy() || engine.isDiscarded) return;
      event.preventDefault();
      // Legacy browsers only show the prompt when returnValue is set.
      event.returnValue = "";
    };

    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const target = event.target;
      if (!(target instanceof Element)) return;
      const anchor = target.closest("a[href]");
      if (!(anchor instanceof HTMLAnchorElement)) return;
      if ((anchor.target !== "" && anchor.target !== "_self") || anchor.hasAttribute("download")) return;
      const url = new URL(anchor.href, window.location.href);
      if (url.origin !== window.location.origin) return;
      if (url.pathname === window.location.pathname && url.search === window.location.search) return;
      if (engine.isDiscarded || !engine.isBusy()) return;

      // Capture phase on document: runs before React's root listener, so the
      // Link never sees this click.
      event.preventDefault();
      event.stopPropagation();
      const href = `${url.pathname}${url.search}${url.hash}`;
      void engine.flush().then((result) => {
        if (result.ok && result.pending.length === 0) router.push(href);
        else setPendingHref(href);
      });
    };

    window.addEventListener("beforeunload", onBeforeUnload);
    document.addEventListener("click", onClick, true);
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      document.removeEventListener("click", onClick, true);
    };
  }, [engine, router]);

  return (
    <ConfirmDialog
      open={pendingHref !== null}
      onOpenChange={(open) => {
        if (!open) setPendingHref(null);
      }}
      title="Imate nesačuvane izmene"
      description="Neke izmene nisu sačuvane (greška pri čuvanju ili polja sa greškom). Ako sada napustite stranicu, biće izgubljene."
      cancelLabel="Ostani"
      confirmLabel="Napusti bez čuvanja"
      destructive
      onConfirm={() => {
        const href = pendingHref;
        engine.discard();
        setPendingHref(null);
        if (href !== null) router.push(href);
      }}
    />
  );
}
