"use client";

import { X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useRef, type ReactNode } from "react";

/**
 * Full-screen shell for the immersive viewers. A native modal `<dialog>`: the
 * page behind is inert, Esc closes it and focus returns to the launcher.
 * `data-lenis-prevent` keeps smooth scrolling from eating wheel and touch
 * input meant for the viewer. The viewer is a child that mounts with the
 * dialog and unmounts (and disposes its WebGL context) when it closes.
 *
 * A dialog can also be swapped out while open (the 3D walk's "open the 360°
 * tour instead"). Removing an open dialog skips the native close and its focus
 * restore, so the unmount hands focus back to whatever opened it; the next
 * dialog then records that launcher as its own opener.
 */
export function TourDialog({
  label,
  onClose,
  children,
}: {
  label: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const t = useTranslations("tours");
  const ref = useRef<HTMLDialogElement>(null);
  const opener = useRef<HTMLElement | null>(null);
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    const dialog = ref.current;
    if (dialog === null) return;
    if (!dialog.open) {
      opener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      dialog.showModal();
    }
    const root = document.documentElement;
    const previousOverflow = root.style.overflow;
    root.style.overflow = "hidden";
    const handleClose = () => onCloseRef.current();
    dialog.addEventListener("close", handleClose);
    // No `dialog.close()` here: its `close` event is queued, and under Strict
    // Mode's effect replay it would reach the re-added listener and shut the
    // dialog again. Unmounting removes the element from the top layer anyway.
    return () => {
      dialog.removeEventListener("close", handleClose);
      root.style.overflow = previousOverflow;
      // Still open but already out of the document: swapped out, not closed
      // (Strict Mode's replay leaves it connected, so it does not count).
      if (dialog.open && !dialog.isConnected) opener.current?.focus();
    };
  }, []);

  return (
    <dialog
      ref={ref}
      aria-label={label}
      data-lenis-prevent=""
      data-tour-dialog=""
      className="fixed inset-0 m-0 h-dvh max-h-none w-screen max-w-none overflow-clip bg-ink p-0 text-ivory backdrop:bg-ink"
    >
      <div className="relative size-full">
        {children}
        <button
          type="button"
          onClick={() => ref.current?.close()}
          aria-label={t("close")}
          className="absolute top-3 right-3 z-30 flex size-11 items-center justify-center border border-ivory/40 bg-ink/70 text-ivory backdrop-blur-[2px] transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-bronze pointer-fine:hover:border-bronze pointer-fine:hover:text-bronze md:top-5 md:right-5"
        >
          <X aria-hidden="true" strokeWidth={1.5} className="size-5" />
        </button>
      </div>
    </dialog>
  );
}
