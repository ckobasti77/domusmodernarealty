"use client";

import { cormorant, manrope } from "@/app/fonts";
import "@/app/globals.css";

/**
 * Last-resort boundary for errors thrown in a root layout. It replaces the root
 * layout, so it renders its own `<html>`/`<body>` and cannot export `metadata`.
 * The Next docs confirm a single `app/global-error.tsx` covers internationalized
 * apps with multiple root layouts, which is why it lives here and not per root.
 */
export default function GlobalError({ retry }: { error: Error; retry: () => void }) {
  return (
    <html lang="sr-Latn" className={`${cormorant.variable} ${manrope.variable}`}>
      <body className="flex min-h-svh flex-col items-center justify-center bg-ink px-6 text-center text-ivory">
        <title>Nešto nije u redu — Mihajlo Estate</title>
        <p className="font-sans text-eyebrow uppercase text-bronze">500</p>
        <h1 className="mt-6 font-display text-display-m font-light">Nešto nije u redu</h1>
        <p className="mt-5 max-w-[46ch] font-sans text-body text-mist">
          Došlo je do greške. Pokušajte ponovo.
          <br />
          <span lang="en">Something went wrong. Please try again.</span>
        </p>
        <button
          type="button"
          onClick={() => retry()}
          className="mt-10 border-b border-bronze pb-1 font-sans text-small uppercase tracking-[0.18em] text-ivory"
        >
          Pokušajte ponovo
        </button>
      </body>
    </html>
  );
}
