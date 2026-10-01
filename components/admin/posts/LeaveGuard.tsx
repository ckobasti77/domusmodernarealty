"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ConfirmDialog } from "@/components/admin/common/ConfirmDialog";

/**
 * While the post has unsaved changes: closing or reloading the tab asks the
 * browser to confirm, and an in-app link click (same origin, plain left
 * click) asks first, offering to stay or leave without saving.
 */
export function LeaveGuard({ dirty }: { dirty: boolean }) {
  const router = useRouter();
  const [pendingHref, setPendingHref] = useState<string | null>(null);

  useEffect(() => {
    if (!dirty) return;

    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      // Older browsers only prompt when returnValue is set.
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
      // Links inside the article body are text, not navigation.
      if (anchor.closest(".ProseMirror") !== null) return;
      const url = new URL(anchor.href, window.location.href);
      if (url.origin !== window.location.origin) return;
      if (url.pathname === window.location.pathname && url.search === window.location.search) return;
      // Capture phase on document: runs before React's root listener, so the
      // Link never sees this click.
      event.preventDefault();
      event.stopPropagation();
      setPendingHref(`${url.pathname}${url.search}${url.hash}`);
    };

    window.addEventListener("beforeunload", onBeforeUnload);
    document.addEventListener("click", onClick, true);
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      document.removeEventListener("click", onClick, true);
    };
  }, [dirty]);

  return (
    <ConfirmDialog
      open={pendingHref !== null}
      onOpenChange={(open) => {
        if (!open) setPendingHref(null);
      }}
      title="Imate nesačuvane izmene"
      description="Ako sada napustite stranicu, izmene u ovom tekstu biće izgubljene."
      cancelLabel="Ostani"
      confirmLabel="Napusti bez čuvanja"
      destructive
      onConfirm={() => {
        const href = pendingHref;
        setPendingHref(null);
        if (href !== null) router.push(href);
      }}
    />
  );
}
