"use client";

import { usePathname, useRouter } from "next/navigation";
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { ConfirmDialog } from "@/components/admin/common/ConfirmDialog";

/**
 * Keeps unsaved work from being lost when leaving a page of the panel. Every
 * editor registers with `useLeaveGuard`; one provider in the admin shell then
 * guards every way out:
 * - closing or reloading the tab: the browser's own confirmation;
 * - an in-app link (sidebar, breadcrumbs, any `<a>`; plain left click), ⌘K
 *   (`useGuardedNavigation().navigate`) and signing out (`leave`);
 * - the browser's Back button: while something is dirty a copy of the page's
 *   history entry sits on top of it, so Back first lands on the page itself,
 *   where a capture-phase `popstate` listener stops the App Router and asks.
 * Editors that can save on their own (the listing autosave: `flush`) are saved
 * first, and the user is asked only about what is still unsaved after that.
 */

type GuardEntry = {
  /** Read whenever someone tries to leave. */
  isDirty: () => boolean;
  /** The dialog's text for this editor. */
  description: string;
  /** Tries to save first; true when nothing is left unsaved. */
  flush?: () => Promise<boolean>;
  /** The user chose to leave without saving. */
  discard?: () => void;
};

type EntryRef = { readonly current: GuardEntry };

/** Where a guarded attempt to leave was going. */
type Exit = { kind: "href"; href: string } | { kind: "back" } | { kind: "run"; run: () => void };

type ControllerDeps = {
  push: (href: string) => void;
  replace: (href: string) => void;
  /** Opens the dialog with this text; `null` closes it. */
  ask: (description: string | null) => void;
};

const DEFAULT_DESCRIPTION = "Izmene koje niste sačuvali biće izgubljene ako sada napustite stranicu.";

/** The in-app path a click would follow, or `null` when it is not a plain same-origin link click. */
function linkTarget(event: MouseEvent): string | null {
  if (event.defaultPrevented || event.button !== 0) return null;
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return null;
  const anchor = event.target instanceof Element ? event.target.closest("a[href]") : null;
  if (!(anchor instanceof HTMLAnchorElement)) return null;
  if ((anchor.target !== "" && anchor.target !== "_self") || anchor.hasAttribute("download")) return null;
  // Links inside rich text being edited are text, not navigation.
  if (anchor.closest('.ProseMirror, [contenteditable="true"]') !== null) return null;
  const url = new URL(anchor.href, window.location.href);
  if (url.origin !== window.location.origin) return null;
  if (url.pathname === window.location.pathname && url.search === window.location.search) return null;
  return `${url.pathname}${url.search}${url.hash}`;
}

/** The guard's state machine; plain class, the provider only wires it to the router and the dialog. */
class LeaveController {
  private readonly entries = new Set<EntryRef>();
  private deps: ControllerDeps | null = null;
  /** A copy of the page's history entry is on top: Back lands on the page itself first. */
  private armed = false;
  /** The path of that copy, to tell a Forward back onto it from a second Back. */
  private copyPath = "";
  /** Runs on the next `popstate`, which the App Router then never sees. */
  private afterPop: (() => void) | null = null;
  /** The next `popstate` leaves for real: the App Router handles it. */
  private releasing = false;
  /** A Back is held on the page's own entry while we save or ask. */
  private holding = false;
  /** The way out the open dialog asks about. */
  private exit: Exit | null = null;
  /** The user chose to leave without saving: the browser is not to ask again. */
  private leaving = false;
  /** Bumped by every attempt and route change: a save that lands after it was overtaken does nothing. */
  private ticket = 0;

  connect(deps: ControllerDeps): void {
    this.deps = deps;
  }

  register(entry: EntryRef): () => void {
    this.entries.add(entry);
    return () => {
      this.entries.delete(entry);
    };
  }

  private dirty(): GuardEntry[] {
    return [...this.entries].map((entry) => entry.current).filter((entry) => entry.isDirty());
  }

  /** Something became dirty: put a copy of this page on the history stack, so Back can be asked about. */
  arm(): void {
    if (this.armed || this.dirty().length === 0) return;
    this.armed = true;
    this.copyPath = window.location.pathname;
    window.history.pushState(null, "", window.location.href);
  }

  /** The route changed: whatever was on the history stack is behind it now. */
  reset(): void {
    this.ticket += 1;
    this.armed = false;
    this.afterPop = null;
    this.releasing = false;
    this.holding = false;
    this.leaving = false;
    if (this.exit !== null) {
      this.exit = null;
      this.deps?.ask(null);
    }
  }

  navigate(href: string): void {
    this.attempt({ kind: "href", href });
  }

  leave(run: () => void): void {
    this.attempt({ kind: "run", run });
  }

  private attempt(exit: Exit): void {
    this.ticket += 1;
    const ticket = this.ticket;
    const dirty = this.dirty();
    const first = dirty[0];
    if (first === undefined) {
      this.proceed(exit);
      return;
    }
    const flushes = dirty.flatMap((entry) => (entry.flush !== undefined ? [entry.flush] : []));
    if (flushes.length < dirty.length) {
      this.ask(exit, first.description);
      return;
    }
    void Promise.all(flushes.map((flush) => flush())).then(
      (results) => {
        if (ticket !== this.ticket) return;
        if (results.every(Boolean) && this.dirty().length === 0) this.proceed(exit);
        else this.ask(exit, first.description);
      },
      () => {
        if (ticket === this.ticket) this.ask(exit, first.description);
      },
    );
  }

  private ask(exit: Exit, description: string): void {
    this.exit = exit;
    this.deps?.ask(description);
  }

  private proceed(exit: Exit): void {
    if (exit.kind === "run") {
      exit.run();
    } else if (exit.kind === "back") {
      // One more step back, past the page's own entry, for the App Router to handle.
      this.holding = false;
      this.releasing = true;
      window.history.back();
    } else if (this.armed) {
      // Replacing the copy instead of pushing past it leaves no dead Back step.
      this.armed = false;
      this.deps?.replace(exit.href);
    } else {
      this.deps?.push(exit.href);
    }
  }

  /** The dialog was dismissed: stay, and for Back, return to the copy of the page. */
  stay(): void {
    const exit = this.exit;
    this.exit = null;
    this.deps?.ask(null);
    if (exit?.kind !== "back") return;
    this.holding = false;
    this.afterPop = () => {
      this.armed = true;
    };
    window.history.forward();
  }

  /** "Napusti bez čuvanja". */
  go(): void {
    const exit = this.exit;
    this.exit = null;
    this.deps?.ask(null);
    if (exit === null) return;
    for (const entry of this.dirty()) entry.discard?.();
    // Back may leave the document (the page before was a full load): no second prompt.
    this.leaving = true;
    this.proceed(exit);
  }

  readonly onPopState = (event: PopStateEvent): void => {
    if (this.releasing) {
      this.releasing = false;
      return;
    }
    const after = this.afterPop;
    if (after !== null) {
      this.afterPop = null;
      event.stopImmediatePropagation();
      after();
      return;
    }
    if (!this.armed) {
      // While a Back was held the user answered with the browser: Forward onto
      // the copy means stay, another Back means leave (the App Router goes).
      if (this.holding) {
        this.holding = false;
        this.ticket += 1;
        if (this.exit !== null) {
          this.exit = null;
          this.deps?.ask(null);
        }
        this.armed = window.location.pathname === this.copyPath;
      }
      return;
    }
    // Back from the copy onto the page's own entry: hold the App Router until we know.
    event.stopImmediatePropagation();
    this.armed = false;
    this.holding = true;
    this.attempt({ kind: "back" });
  };

  readonly onClick = (event: MouseEvent): void => {
    if (!this.armed && this.dirty().length === 0) return;
    const href = linkTarget(event);
    if (href === null) return;
    // Capture phase on document: runs before React's root listener, so the
    // Link never sees this click.
    event.preventDefault();
    event.stopPropagation();
    this.attempt({ kind: "href", href });
  };

  readonly onBeforeUnload = (event: BeforeUnloadEvent): void => {
    if (this.leaving || this.dirty().length === 0) return;
    event.preventDefault();
    // Older browsers only prompt when returnValue is set.
    event.returnValue = "";
  };
}

const LeaveGuardContext = createContext<LeaveController | null>(null);

function useController(): LeaveController {
  const controller = useContext(LeaveGuardContext);
  if (controller === null) throw new Error("The leave guard needs <LeaveGuardProvider> (the admin shell).");
  return controller;
}

export function LeaveGuardProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [controller] = useState(() => new LeaveController());
  // The text outlives `open`, so it does not change while the dialog animates closed.
  const [dialog, setDialog] = useState({ open: false, description: DEFAULT_DESCRIPTION });

  useEffect(() => {
    controller.connect({
      push: (href) => router.push(href),
      replace: (href) => router.replace(href),
      ask: (description) =>
        setDialog((current) => (description === null ? { ...current, open: false } : { open: true, description })),
    });
  }, [controller, router]);

  useEffect(() => {
    // Capture: runs before the App Router's own `popstate` listener.
    window.addEventListener("popstate", controller.onPopState, { capture: true });
    window.addEventListener("beforeunload", controller.onBeforeUnload);
    document.addEventListener("click", controller.onClick, true);
    return () => {
      window.removeEventListener("popstate", controller.onPopState, { capture: true });
      window.removeEventListener("beforeunload", controller.onBeforeUnload);
      document.removeEventListener("click", controller.onClick, true);
    };
  }, [controller]);

  useEffect(() => {
    controller.reset();
  }, [controller, pathname]);

  return (
    <LeaveGuardContext.Provider value={controller}>
      {children}
      <ConfirmDialog
        open={dialog.open}
        onOpenChange={(open) => {
          if (!open) controller.stay();
        }}
        title="Imate nesačuvane izmene"
        description={dialog.description}
        cancelLabel="Ostani"
        confirmLabel="Napusti bez čuvanja"
        destructive
        onConfirm={() => controller.go()}
      />
    </LeaveGuardContext.Provider>
  );
}

export type LeaveGuardOptions = {
  /** Re-rendered with the editor: arms the Back-button guard when it turns true. */
  dirty: boolean;
  /** Read at the moment of leaving; defaults to `dirty`. */
  isDirty?: () => boolean;
  /** The dialog's text for this editor. */
  description?: string;
  /** Saves first (autosave); resolves true when nothing is left unsaved. */
  flush?: () => Promise<boolean>;
  /** The user chose to leave without saving. */
  discard?: () => void;
};

/** Registers an editor's unsaved state with the panel's leave guard while it is mounted. */
export function useLeaveGuard({ dirty, isDirty, description, flush, discard }: LeaveGuardOptions): void {
  const controller = useController();
  const entry = useRef<GuardEntry>({ isDirty: () => false, description: DEFAULT_DESCRIPTION });
  useEffect(() => {
    entry.current = {
      isDirty: isDirty ?? (() => dirty),
      description: description ?? DEFAULT_DESCRIPTION,
      ...(flush !== undefined ? { flush } : {}),
      ...(discard !== undefined ? { discard } : {}),
    };
  });
  useEffect(() => controller.register(entry), [controller]);
  useEffect(() => {
    if (dirty) controller.arm();
  }, [controller, dirty]);
}

/** In-app navigation from code (⌘K, sign-out) that asks first, like a link click. */
export function useGuardedNavigation(): { navigate: (href: string) => void; leave: (run: () => void) => void } {
  const controller = useController();
  return { navigate: (href) => controller.navigate(href), leave: (run) => controller.leave(run) };
}
