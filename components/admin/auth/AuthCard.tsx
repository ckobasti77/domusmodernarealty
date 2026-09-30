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
      <div aria-hidden="true" className="pointer-events-none absolute inset-10 hidden border border-foreground/10 sm:block" />
      <div className="relative w-full max-w-[28rem] border border-foreground/15 bg-card px-7 py-10 shadow-[0_1px_0_0_rgb(14_13_11/0.04),0_24px_48px_-32px_rgb(14_13_11/0.35)] sm:px-10">
        <p className="font-mono text-[0.6875rem] tracking-[0.2em] text-muted-foreground uppercase">{eyebrow}</p>
        <h1 className="mt-4 font-display text-[2rem] leading-[1.1] font-normal tracking-[-0.01em] text-foreground sm:text-[2.25rem]">
          Mihajlo Estate{" "}
          <span className="whitespace-nowrap">
            <span className="text-primary">·</span> Admin
          </span>
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
