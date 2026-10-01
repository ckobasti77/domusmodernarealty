import type { Metadata } from "next";
import Link from "next/link";
import { fontVariables } from "@/app/fonts";
import { Container } from "@/components/site/Container";
import { ErrorScreen } from "@/components/site/errors/ErrorScreen";
import { Logo } from "@/components/site/Logo";
import "@/app/globals.css";

export const metadata: Metadata = {
  title: "Stranica nije nađena / Page not found — Mihajlo Estate",
  description: "Adresa ne postoji ili je sadržaj uklonjen. This address does not exist or its content has been removed.",
};

/**
 * 404 for URLs that match no route at all (`/sr/nema-ove-strane`,
 * `/nepostoji.html`, `/api/…`). Next skips every layout here, so this file is a
 * complete HTML document with its own styles and fonts; it exists because the
 * app has two root layouts and its public root is a top-level dynamic segment
 * (`app/[locale]`), exactly the two cases the Next docs name for
 * `global-not-found`. Next adds `noindex` to the response itself.
 *
 * No locale can be read, so the copy is Serbian with English beneath, the
 * search goes to the Serbian properties page and the links offer every
 * language's home page. Same ink screen as the localized 404, minus the
 * header (no client islands, no GSAP, no Lenis on a dead end).
 */
export default function GlobalNotFound() {
  return (
    <html lang="sr-Latn" className={fontVariables}>
      <body className="bg-ink text-ivory">
        <header className="absolute inset-x-0 top-0 z-10">
          <Container className="flex h-[85px] items-center">
            <Link href="/sr" className="inline-flex min-h-11 items-center focus-visible:outline-bronze">
              <Logo tone="dark" title="Mihajlo Estate" className="w-[190px] md:w-[230px]" />
            </Link>
          </Container>
        </header>
        <main id="main">
          <ErrorScreen
            code="404"
            eyebrow="Stranica nije nađena"
            title="Ova adresa ne vodi nikuda."
            subtitle={{ text: "This address leads nowhere.", lang: "en" }}
            body={
              <>
                <p>Adresa ne postoji ili je sadržaj uklonjen. Pretražite ponudu ili izaberite jezik i počnite od početne stranice.</p>
                <p lang="en" className="mt-3">
                  The address does not exist or its content has been removed. Search our properties or choose a language
                  to start from the home page.
                </p>
              </>
            }
            search={{
              action: "/sr/nekretnine",
              label: "Pretražite nekretnine · Search properties",
              placeholder: "Kraj, ulica ili šifra nekretnine",
              submit: "Pretraži",
              testId: "notfound-search",
            }}
            linksHeading="Izaberite jezik · Choose a language"
            links={[
              { href: "/sr", label: "Srpski — početna", lang: "sr-Latn" },
              { href: "/en", label: "English — home", lang: "en" },
              { href: "/ru", label: "Русский — главная", lang: "ru" },
              { href: "/de", label: "Deutsch — Startseite", lang: "de" },
            ]}
          />
        </main>
      </body>
    </html>
  );
}
