import Link from "next/link";

export default function AdminNotFound() {
  return (
    <main className="grid min-h-svh place-items-center px-6 text-center">
      <div>
        <p className="font-mono text-label uppercase text-muted-foreground">404</p>
        <h1 className="mt-4 font-display text-3xl font-normal">Stranica nije nađena</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Ova administratorska stranica ne postoji.
        </p>
        <Link
          href="/admin"
          className="mt-8 inline-block text-sm text-primary underline underline-offset-4"
        >
          Nazad na administraciju
        </Link>
      </div>
    </main>
  );
}
