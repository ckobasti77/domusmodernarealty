"use client";

import { useMutation } from "convex/react";
import { Loader2, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { RequireRole } from "@/components/admin/common/RequireRole";
import { Button } from "@/components/ui/button";
import { api } from "@/convex/_generated/api";
import { adminErrorMessage } from "@/lib/admin/errors";
import { CONTENT_ROLES, postEditorHref, POSTS_PATH } from "./shared";

/** `/admin/magazin/novi` — creates an empty draft and opens it in the editor. */
export function NewPostScreen() {
  return (
    <RequireRole roles={CONTENT_ROLES}>
      <CreateDraft />
    </RequireRole>
  );
}

function CreateDraft() {
  const create = useMutation(api.postsAdmin.create);
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  // One draft per visit, also under Strict Mode's double effect run.
  const started = useRef(false);

  const start = useCallback(() => {
    void create({})
      .then((id) => router.replace(postEditorHref(id)))
      .catch((reason: unknown) => setError(adminErrorMessage(reason, "Nacrt nije napravljen. Pokušajte ponovo.")));
  }, [create, router]);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    start();
  }, [start]);

  if (error !== null) {
    return (
      <div role="alert" className="mx-auto mt-10 max-w-md rounded-lg border bg-card p-8 text-center">
        <TriangleAlert aria-hidden="true" className="mx-auto size-8 text-muted-foreground" />
        <h1 className="mt-4 text-lg font-semibold">Novi tekst nije napravljen</h1>
        <p className="mt-2 text-sm text-muted-foreground">{error}</p>
        <div className="mt-6 flex justify-center gap-2">
          <Button variant="outline" asChild>
            <Link href={POSTS_PATH}>Nazad na Magazin</Link>
          </Button>
          <Button
            onClick={() => {
              setError(null);
              start();
            }}
          >
            Pokušajte ponovo
          </Button>
        </div>
      </div>
    );
  }

  return (
    <p role="status" className="mt-10 flex items-center justify-center gap-2 text-sm text-muted-foreground">
      <Loader2 aria-hidden="true" className="size-4 animate-spin" />
      Pravimo nacrt…
    </p>
  );
}
