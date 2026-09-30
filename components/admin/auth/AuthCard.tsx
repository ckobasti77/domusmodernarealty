import type { ReactNode } from "react";

/**
 * The Editorial frame shared by sign-in and invite acceptance (DESIGN §7: the
 * admin login title is the one place the panel uses Cormorant). One hairline
 * card on paper, sharp corners like the public site's print language.
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
    <main className="grid min-h-svh place-items-center bg-background px-5 py-16">
      <div className="w-full max-w-[28rem] border border-foreground/15 bg-card px-6 py-10 sm:px-10">
        <p className="font-mono text-[0.6875rem] tracking-[0.08em] text-muted-foreground uppercase">
          {eyebrow}
        </p>
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
