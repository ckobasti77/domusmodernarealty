import type { Metadata } from "next";
import Link from "next/link";
import { displaySerif, manrope } from "@/app/fonts";
import "@/app/globals.css";

export const metadata: Metadata = {
  title: "Stranica nije nađena — Mihajlo Estate",
  description: "Adresa ne postoji ili je sadržaj uklonjen.",
};

/**
 * 404 for URLs that match no route at all. Next skips rendering entirely here,
 * so this file must be a complete HTML document and bring its own styles and
 * fonts. It exists because the app has two root layouts and its public root is
 * a top-level dynamic segment (`app/[locale]`), which is exactly the situation
 * the Next docs name for `global-not-found`.
 *
 * Copy is bilingual: an unmatched URL has no locale to read.
 */
export default function GlobalNotFound() {
  return (
    <html lang="sr-Latn" className={`${displaySerif.variable} ${manrope.variable}`}>
      <body className="flex min-h-svh flex-col items-center justify-center bg-ink px-6 text-center text-ivory">
        <p className="font-sans text-eyebrow uppercase text-bronze">404</p>
        <h1 className="mt-6 font-display text-display-m font-normal">Stranica nije nađena</h1>
        <p className="mt-5 max-w-[46ch] font-sans text-body text-mist">
          Adresa ne postoji ili je sadržaj uklonjen.
          <br />
          <span lang="en">This page does not exist.</span>
        </p>
        <Link
          href="/sr"
          className="mt-10 border-b border-bronze pb-1 font-sans text-small uppercase tracking-[0.18em] text-ivory"
        >
          Mihajlo Estate
        </Link>
      </body>
    </html>
  );
}
