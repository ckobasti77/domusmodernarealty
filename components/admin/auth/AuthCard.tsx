import type { ReactNode } from "react";

/**
 * The Editorial frame shared by sign-in and invite acceptance (DESIGN §7: the
 * admin login title is the one place the panel uses Cormorant).
 */
export function AuthCard({
  eyebrow,
  lede,
  children,
  footer,
}: {
  eyebrow: string;
  lede: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <main className="relative grid min-h-svh place-items-center overflow-hidden bg-background px-5 py-16">
      {/* Two hairline rules frame the card like a printed title page. */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-6 border border-foreground/10 md:inset-10" />
      <div className="relative w-full max-w-[26rem] border border-foreground/15 bg-card px-7 py-10 shadow-[0_1px_0_0_rgb(14_13_11/0.04),0_24px_48px_-32px_rgb(14_13_11/0.35)] sm:px-10">
        <p className="font-mono text-[0.6875rem] tracking-[0.2em] text-muted-foreground uppercase">{eyebrow}</p>
        <h1 className="mt-4 font-display text-[2.5rem] leading-[1.05] font-normal tracking-[-0.01em] text-foreground">
          Mihajlo Estate
          <span className="text-primary"> · </span>
          Admin
        </h1>
        <div className="mt-3 text-sm leading-relaxed text-muted-foreground">{lede}</div>
        <div className="mt-8">{children}</div>
        {footer !== undefined ? (
          <div className="mt-8 border-t border-foreground/10 pt-5 text-xs leading-relaxed text-muted-foreground">
            {footer}
          </div>
        ) : null}
      </div>
    </main>
  );
}
