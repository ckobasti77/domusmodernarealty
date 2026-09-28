"use client";

import { Button } from "@/components/ui/button";

export default function AdminError({ retry }: { error: Error; retry: () => void }) {
  return (
    <main className="grid min-h-svh place-items-center px-6 text-center">
      <div>
        <p className="font-mono text-label uppercase text-muted-foreground">Greška</p>
        <h1 className="mt-4 font-display text-3xl font-normal">Nešto nije u redu</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Došlo je do greške pri učitavanju. Pokušajte ponovo.
        </p>
        <Button variant="outline" className="mt-8" onClick={() => retry()}>
          Pokušajte ponovo
        </Button>
      </div>
    </main>
  );
}
