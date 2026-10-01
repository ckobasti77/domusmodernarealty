"use client";

import { useMutation, usePaginatedQuery } from "convex/react";
import { Loader2, Merge } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { SearchInput } from "@/components/admin/common/ListToolbar";
import { useMutationAction } from "@/components/admin/common/useMutationAction";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { cn } from "@/lib/utils";
import { ContactTags } from "./ContactBits";
import { OWNER_TAG } from "./shared";

/**
 * Merges a duplicate INTO the open contact (`contacts.merge`): the duplicate's
 * leads move here, missing email/phone are filled in, consents and notes are
 * combined, and the duplicate is deleted. A listing owner can only survive.
 */
export function MergeDialog({ into }: { into: { _id: Id<"contacts">; name: string } }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<Id<"contacts"> | null>(null);
  const merge = useMutationAction(useMutation(api.contacts.merge));

  const search = q.trim();
  const { results, status } = usePaginatedQuery(
    api.contacts.list,
    open && search.length >= 2 ? { q: search } : "skip",
    { initialNumItems: 10 },
  );
  const candidates = results.filter((row) => row._id !== into._id && row.anonymizedAt === undefined);
  const chosen = candidates.find((row) => row._id === selected);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (merge.pending) return;
        setOpen(next);
        if (!next) {
          setQ("");
          setSelected(null);
        }
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" data-testid="contact-merge">
          <Merge aria-hidden="true" />
          Spoji duplikat…
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Spajanje duplikata</DialogTitle>
          <DialogDescription>
            Pronađite drugi zapis iste osobe. Njegovi upiti prelaze na „{into.name}”, a duplikat se briše.
          </DialogDescription>
        </DialogHeader>

        <SearchInput
          value={q}
          onChange={(value) => {
            setQ(value);
            setSelected(null);
          }}
          label="Pretraga duplikata"
          placeholder="Ime, e-pošta ili telefon…"
          className="sm:w-full"
        />

        <div role="radiogroup" aria-label="Pronađeni kontakti" className="max-h-64 min-h-24 overflow-y-auto rounded-md border">
          {search.length < 2 ? (
            <p className="px-3 py-6 text-center text-sm text-muted-foreground">Unesite bar dva znaka.</p>
          ) : status === "LoadingFirstPage" ? (
            <p className="flex items-center justify-center gap-2 px-3 py-6 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              Pretraga…
            </p>
          ) : candidates.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-muted-foreground" aria-live="polite">
              Nema drugih kontakata za „{search}”.
            </p>
          ) : (
            candidates.map((row) => {
              const owner = row.tags.includes(OWNER_TAG);
              const checked = selected === row._id;
              return (
                <button
                  key={row._id}
                  type="button"
                  role="radio"
                  aria-checked={checked}
                  disabled={owner}
                  onClick={() => setSelected(row._id)}
                  className={cn(
                    "flex w-full flex-col gap-0.5 border-b px-3 py-2 text-left text-sm transition-colors duration-150 outline-none last:border-b-0 hover:bg-muted/50 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:ring-inset disabled:cursor-not-allowed disabled:opacity-60",
                    checked && "bg-primary/10 hover:bg-primary/10",
                  )}
                >
                  <span className="flex items-center gap-1.5 font-medium">
                    {row.name}
                    <ContactTags contact={row} />
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {[row.email, row.phone].filter((item) => item !== undefined).join(" · ") || "Bez podataka za kontakt"}
                    {` · upita: ${row.leadCount}${row.leadCountCapped ? "+" : ""}`}
                  </span>
                  {owner ? (
                    <span className="text-xs text-muted-foreground">
                      Vlasnik nekretnine: otvorite njega i spojite ovaj kontakt u njega.
                    </span>
                  ) : null}
                </button>
              );
            })
          )}
        </div>

        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline" disabled={merge.pending}>
              Otkaži
            </Button>
          </DialogClose>
          <Button
            disabled={chosen === undefined || merge.pending}
            data-testid="contact-merge-confirm"
            onClick={async () => {
              if (chosen === undefined) return;
              const result = await merge.run({ intoId: into._id, fromId: chosen._id });
              if (result === undefined) return;
              toast.success(`Kontakti su spojeni. Prebačeno upita: ${result.movedLeads}.`);
              setOpen(false);
              setQ("");
              setSelected(null);
            }}
          >
            {merge.pending ? <Loader2 className="animate-spin" aria-hidden="true" /> : null}
            {chosen !== undefined ? `Spoji „${chosen.name}” ovde` : "Spoji"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
