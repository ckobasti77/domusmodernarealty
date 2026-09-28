"use client";

import { Heart, Menu, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useRef, useState } from "react";
import { DURATION, gsap, ScrollTrigger, STAGGER, useGSAP } from "@/components/motion/gsap";
import { ScrollProgress } from "@/components/motion/ScrollProgress";
import { Link, usePathname } from "@/i18n/navigation";
import { useFavoriteCount } from "@/lib/stores/favorites";
import { cn } from "@/lib/utils";
import { LocaleSwitcher } from "./LocaleSwitcher";
import { Logo } from "./Logo";

/**
 * Site header. Transparent over the hero, solid ink once the visitor has scrolled
 * past it, plus the full-screen mobile menu (DESIGN §4 and the step-04 brief).
 *
 * The solid/transparent flip is a class change driven by one ScrollTrigger, not
 * a scroll listener: it shares Lenis's ticker, so it cannot fall out of sync with
 * the smooth scroll.
 */

/** Internal (canonical) pathnames; next-intl maps each to its localized segment. */
const NAV = [
  { href: "/properties", key: "properties" },
  { href: "/locations", key: "locations" },
  { href: "/valuation", key: "valuation" },
  { href: "/sell", key: "sell" },
  { href: "/journal", key: "journal" },
  { href: "/about", key: "about" },
  { href: "/contact", key: "contact" },
] as const;

export function Header() {
  const t = useTranslations("nav");
  const tCommon = useTranslations("common");
  const pathname = usePathname();
  const [solid, setSolid] = useState(false);
  // The open flag is stored with the pathname it was opened on, so a browser
  // back/forward that changes the route closes the overlay during render — no
  // effect, and no frame where the menu covers the new page.
  const [menu, setMenu] = useState({ open: false, path: pathname });
  const header = useRef<HTMLElement>(null);
  const favorites = useFavoriteCount();

  if (menu.path !== pathname) setMenu({ open: false, path: pathname });
  const menuOpen = menu.open && menu.path === pathname;

  useGSAP(
    () => {
      const trigger = ScrollTrigger.create({
        start: 80,
        end: "max",
        onToggle: (self) => setSolid(self.isActive),
      });
      return () => trigger.kill();
    },
    { scope: header },
  );

  const close = useCallback(() => setMenu((prev) => ({ ...prev, open: false })), []);

  return (
    <header
      ref={header}
      data-solid={solid ? "true" : "false"}
      className={cn(
        "fixed inset-x-0 top-0 transition-[background-color,border-color] duration-300 ease-out",
        // The overlay menu is a CHILD of this element, so it is trapped in the
        // header's stacking context — at z-header (30) the cookie banner
        // (z-overlay, 40) painted over it and swallowed every click. Lifting the
        // whole header to z-menu while the overlay is open is the fix; the bar
        // itself never overlaps the banner, so nothing else changes.
        menuOpen ? "z-(--z-menu)" : "z-(--z-header)",
        solid ? "border-b border-hairline-dark bg-ink/95" : "border-b border-transparent bg-transparent",
      )}
    >
      <div className="mx-auto flex max-w-bleed items-center justify-between gap-6 px-gutter py-5 md:px-gutter-md lg:px-gutter-lg">
        <Link href="/" aria-label={tCommon("brand")} className="block w-[190px] shrink-0 lg:w-[240px]">
          <Logo tone="dark" title="" />
        </Link>

        <nav aria-label={t("home")} className="hidden lg:block">
          <ul className="flex items-center gap-8">
            {NAV.map((item) => {
              const active = pathname === item.href;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    prefetch={false}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "relative inline-flex min-h-11 items-center font-sans text-small uppercase tracking-[0.12em]",
                      "transition-colors duration-200 ease-out",
                      "after:absolute after:inset-x-0 after:bottom-3 after:h-px after:origin-left after:bg-bronze",
                      "after:transition-transform after:duration-300 after:ease-out",
                      active ? "text-bronze after:scale-x-100" : "text-ivory after:scale-x-0",
                      "pointer-fine:hover:after:scale-x-100 focus-visible:after:scale-x-100",
                    )}
                  >
                    {t(item.key)}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="flex items-center gap-2 lg:gap-5">
          <Link
            href="/favorites"
            prefetch={false}
            className="relative inline-flex size-11 items-center justify-center text-ivory transition-colors duration-200 pointer-fine:hover:text-bronze"
          >
            <Heart aria-hidden="true" strokeWidth={1.25} className="size-5" />
            <span className="sr-only">
              {t("favorites")}
              {favorites > 0 ? ` (${favorites})` : ""}
            </span>
            {favorites > 0 ? (
              <span
                aria-hidden="true"
                data-numeric
                className="absolute right-0.5 top-1 min-w-4 bg-bronze px-1 text-center font-mono text-[0.625rem] leading-4 text-ink"
              >
                {favorites}
              </span>
            ) : null}
          </Link>

          <LocaleSwitcher className="hidden md:block" />

          <button
            type="button"
            onClick={() => setMenu({ open: true, path: pathname })}
            aria-expanded={menuOpen}
            aria-controls="site-menu"
            className="inline-flex size-11 items-center justify-center text-ivory transition-colors duration-200 pointer-fine:hover:text-bronze lg:hidden"
          >
            <Menu aria-hidden="true" strokeWidth={1.25} className="size-6" />
            <span className="sr-only">{tCommon("openMenu")}</span>
          </button>
        </div>
      </div>

      {/* Reading-progress hairline, visible only once the header is solid so it
          never draws a line across the hero. */}
      <ScrollProgress className={cn("transition-opacity duration-300", solid ? "opacity-100" : "opacity-0")} />

      <MobileMenu open={menuOpen} onClose={close} />
    </header>
  );
}

function MobileMenu({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useTranslations("nav");
  const tCommon = useTranslations("common");
  const panel = useRef<HTMLDivElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);

  // Escape closes, focus starts on the close button, and focus is trapped while
  // the overlay is up. Body scroll is locked so the page behind cannot move.
  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.documentElement.style.overflow;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    document.documentElement.style.overflow = "hidden";
    closeButton.current?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== "Tab") return;

      const root = panel.current;
      if (root === null) return;
      const focusable = root.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (first === undefined || last === undefined) return;

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.documentElement.style.overflow = previousOverflow;
      previouslyFocused?.focus();
    };
  }, [open, onClose]);

  useGSAP(
    () => {
      const root = panel.current;
      if (root === null || !open) return;

      const items = root.querySelectorAll("[data-menu-item]");
      const mm = gsap.matchMedia();

      mm.add("(prefers-reduced-motion: reduce)", () => {
        gsap.set(root, { opacity: 1 });
        gsap.set(items, { clearProps: "all" });
      });

      mm.add("(prefers-reduced-motion: no-preference)", () => {
        const tl = gsap.timeline();
        // `opacity`, never `autoAlpha`: autoAlpha also writes `visibility`, and a
        // hidden element refuses focus — which silently broke the focus move
        // onto the close button, because useGSAP's layout effect runs before the
        // effect that calls focus().
        tl.fromTo(root, { opacity: 0 }, { opacity: 1, duration: 0.24, ease: "power3.out" })
          .fromTo(
            items,
            { yPercent: 60, opacity: 0 },
            {
              yPercent: 0,
              opacity: 1,
              duration: DURATION.revealFast,
              stagger: STAGGER.tight,
              ease: "expo.out",
              clearProps: "transform,opacity",
            },
            0.08,
          );
      });

      return () => mm.revert();
    },
    { dependencies: [open] },
  );

  if (!open) return null;

  return (
    <div
      ref={panel}
      id="site-menu"
      role="dialog"
      aria-modal="true"
      aria-label={tCommon("openMenu")}
      // The overlay scrolls itself on short screens; Lenis must not hijack it.
      data-lenis-prevent
      className="fixed inset-0 z-(--z-menu) flex flex-col overflow-y-auto bg-ink opacity-0 lg:hidden"
    >
      <div className="flex items-center justify-between px-gutter py-5 md:px-gutter-md">
        <Logo tone="dark" title="" className="w-[190px]" />
        <button
          ref={closeButton}
          type="button"
          onClick={onClose}
          className="inline-flex size-11 items-center justify-center text-ivory"
        >
          <X aria-hidden="true" strokeWidth={1.25} className="size-6" />
          <span className="sr-only">{tCommon("closeMenu")}</span>
        </button>
      </div>

      <nav aria-label={t("home")} className="flex-1 px-gutter pb-10 md:px-gutter-md">
        <ul className="flex flex-col">
          {NAV.map((item) => (
            <li key={item.href} data-menu-item className="hairline-b-dark">
              <Link
                href={item.href}
                prefetch={false}
                onClick={onClose}
                className="flex min-h-14 items-center py-3 font-display text-display-m font-light text-ivory"
              >
                {t(item.key)}
              </Link>
            </li>
          ))}
          <li data-menu-item className="hairline-b-dark">
            <Link
              href="/favorites"
              prefetch={false}
              onClick={onClose}
              className="flex min-h-14 items-center py-3 font-display text-display-m font-light text-ivory"
            >
              {t("favorites")}
            </Link>
          </li>
        </ul>

        <div data-menu-item className="mt-10">
          <LocaleSwitcher />
        </div>
      </nav>
    </div>
  );
}
