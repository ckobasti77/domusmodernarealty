"use client";

import { CircleCheck, ExternalLink } from "lucide-react";
import { useWatch } from "react-hook-form";
import { externalTourEmbedUrl } from "@/convex/lib/tours";
import type { ListingForm } from "@/lib/admin/listing-form";
import { TextField } from "../fields";

/**
 * Matterport / Kuula: the share URL or the tour ID. The schema checks both
 * against `externalTourEmbedUrl` as they are typed (the server runs the same
 * function); once they resolve, "Pregled" opens the exact player the public
 * page will embed.
 */
export function ExternalTourFields({ provider }: { provider: "matterport" | "kuula" }) {
  const [url, externalId] = useWatch<ListingForm, ["tour360.url", "tour360.externalId"]>({
    name: ["tour360.url", "tour360.externalId"],
  });
  const embed = url.trim() !== "" || externalId.trim() !== "" ? externalTourEmbedUrl(provider, url, externalId) : null;
  const name = provider === "matterport" ? "Matterport" : "Kuula";

  return (
    <>
      <TextField
        name="tour360.url"
        id="f-tour360-url"
        label="Adresa ture"
        type="url"
        inputMode="url"
        autoComplete="off"
        spellCheck={false}
        placeholder={provider === "matterport" ? "https://my.matterport.com/show/?m=…" : "https://kuula.co/share/…"}
        hint={
          provider === "matterport"
            ? "Adresa za deljenje sa my.matterport.com."
            : "Adresa za deljenje sa kuula.co (tura ili kolekcija)."
        }
      />
      <TextField
        name="tour360.externalId"
        id="f-tour360-externalId"
        label={provider === "matterport" ? "ID modela" : "ID ture"}
        autoComplete="off"
        spellCheck={false}
        hint="Dovoljan je i samo ID kada adresa nije uneta."
      />
      <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-sm @lg:col-span-2 @3xl:col-span-1 @3xl:self-center">
        {embed !== null ? (
          <>
            <span className="inline-flex items-center gap-1.5 text-success-text">
              <CircleCheck aria-hidden="true" className="size-4" />
              {name} tura je prepoznata.
            </span>
            <a
              href={embed}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-11 items-center gap-1 font-medium text-primary underline-offset-4 hover:underline focus-visible:rounded-sm focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none md:min-h-0"
              data-testid="tour360-preview"
            >
              Pregled
              <ExternalLink aria-hidden="true" className="size-3.5" />
              <span className="sr-only"> (otvara se u novoj kartici)</span>
            </a>
          </>
        ) : (
          <span className="text-xs text-muted-foreground">Pregled je dostupan kada se adresa ili ID prepoznaju.</span>
        )}
      </div>
    </>
  );
}
