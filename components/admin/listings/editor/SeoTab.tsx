"use client";

import { useMutation } from "convex/react";
import { ImageOff, RefreshCw } from "lucide-react";
import Image from "next/image";
import { useState } from "react";
import { useController, useFormContext, useWatch } from "react-hook-form";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/admin/common/ConfirmDialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { api } from "@/convex/_generated/api";
import type { L10nKey } from "@/convex/lib/validators";
import { pathnames } from "@/i18n/routing";
import { adminErrorMessage } from "@/lib/admin/errors";
import { L10N_LABEL } from "@/lib/admin/labels";
import {
  META_DESCRIPTION_MAX,
  META_DESCRIPTION_SOFT,
  META_TITLE_MAX,
  META_TITLE_SOFT,
  deepEqual,
  type ListingForm,
} from "@/lib/admin/listing-form";
import { useEditor, type EditorData } from "./editor-context";
import { Group, TabPanel, TextAreaField, TextField } from "./fields";
import { LOCALE_LANG, LocaleTabs } from "./LocaleTabs";

const LOCALE_PREFIX: Record<L10nKey, string> = { sr: "/sr", en: "/en", ru: "/ru", de: "/de" };
const ROUTE_LOCALE = { sr: "sr-Latn", en: "en", ru: "ru", de: "de" } as const satisfies Record<L10nKey, string>;

/** Public path of a listing in a locale, built from the router's own pathnames. */
function listingPath(locale: L10nKey, slug: string): string {
  return `${LOCALE_PREFIX[locale]}${pathnames["/properties/[slug]"][ROUTE_LOCALE[locale]].replace("[slug]", slug)}`;
}

/** Hosts `next.config.ts` lets the image optimizer fetch; anything else is shown as-is. */
function optimizable(url: string): boolean {
  try {
    const host = new URL(url).hostname;
    return host.endsWith(".convex.cloud") || host === "images.unsplash.com" || host === "dl.polyhaven.org";
  } catch {
    return false;
  }
}

export function SeoTab({ data }: { data: EditorData }) {
  return (
    <TabPanel
      id="panel-seo"
      title="SEO"
      description="Adresa oglasa, naslov i opis za pretraživače i slika koja se prikazuje pri deljenju."
    >
      <SlugGroup />
      <MetaGroup />
      <OgImageGroup data={data} />
    </TabPanel>
  );
}

function SlugGroup() {
  const { engine, listingId } = useEditor();
  const { setValue } = useFormContext<ListingForm>();
  const regenerate = useMutation(api.listingsAdmin.regenerateSlug);

  const onRegenerate = async () => {
    // The slug is built from the SAVED Serbian title: save first.
    const flushed = await engine.flush();
    if (!flushed.ok) {
      toast.error("Izmene nisu sačuvane, pa adresa nije generisana. Pokušajte ponovo.");
      return false;
    }
    try {
      const { slug } = await regenerate({ id: listingId });
      setValue("slug", slug, { shouldValidate: true });
      toast.success(`Nova adresa: ${listingPath("sr", slug)}`);
    } catch (error) {
      toast.error(adminErrorMessage(error, "Adresa nije generisana."));
      return false;
    }
  };

  return (
    <Group
      title="URL adresa"
      layout="stack"
      description="Promena adrese automatski pravi trajno preusmerenje (301) sa stare adrese, pa postojeći linkovi i dalje rade."
      actions={
        <ConfirmDialog
          trigger={
            <Button type="button" variant="outline" size="sm">
              <RefreshCw aria-hidden="true" />
              Generiši iz naslova
            </Button>
          }
          title="Generisati adresu iz naslova?"
          description="Nova adresa se pravi iz srpskog naslova i šifre nekretnine. Stara adresa ostaje kao preusmerenje (301)."
          confirmLabel="Generiši"
          onConfirm={onRegenerate}
        />
      }
    >
      <TextField
        name="slug"
        id="f-slug"
        label="Adresa (slug)"
        prefix="/sr/nekretnine/"
        autoComplete="off"
        spellCheck={false}
        inputClassName="font-mono text-sm"
        hint="Mala slova a–z, cifre i crtice. Čuva se kad završite unos."
        onBlur={() => engine.schedule(250)}
      />
    </Group>
  );
}

function MetaGroup() {
  const [locale, setLocale] = useState<L10nKey>("sr");
  return (
    <Group
      title="Pretraživači"
      layout="stack"
      description="Opciono. Ako ostane prazno, koriste se naslov oglasa i početak opisa."
    >
      <LocaleTabs label="Jezik meta podataka" value={locale} onValueChange={setLocale}>
        {(key) => (
          <div className="flex flex-col gap-4">
            <TextField
              name={`seo.metaTitle.${key}`}
              id={`f-metaTitle-${key}`}
              label={`Meta naslov — ${L10N_LABEL[key].toLowerCase()}`}
              lang={LOCALE_LANG[key]}
              autoComplete="off"
              counter={{ soft: META_TITLE_SOFT, max: META_TITLE_MAX }}
              hint={`Do ${META_TITLE_SOFT} znakova Google prikazuje ceo naslov; najviše ${META_TITLE_MAX}.`}
            />
            <TextAreaField
              name={`seo.metaDescription.${key}`}
              id={`f-metaDescription-${key}`}
              label={`Meta opis — ${L10N_LABEL[key].toLowerCase()}`}
              lang={LOCALE_LANG[key]}
              rows={3}
              counter={{ soft: META_DESCRIPTION_SOFT, max: META_DESCRIPTION_MAX }}
              hint={`Preporuka do ${META_DESCRIPTION_SOFT} znakova; najviše ${META_DESCRIPTION_MAX}.`}
            />
          </div>
        )}
      </LocaleTabs>
      <SnippetPreview locale={locale} />
    </Group>
  );
}

function clip(text: string, max: number): string {
  const clean = text.replace(/\s+/g, " ").trim();
  return clean.length > max ? `${clean.slice(0, max - 1).trimEnd()}…` : clean;
}

function siteHost(): string {
  const configured = process.env.NEXT_PUBLIC_SITE_URL;
  if (configured !== undefined && configured !== "") {
    try {
      return new URL(configured).host;
    } catch {
      return configured;
    }
  }
  return typeof window === "undefined" ? "" : window.location.host;
}

/** A Google-style result for the selected locale, with the same fallbacks the site uses. */
function SnippetPreview({ locale }: { locale: L10nKey }) {
  const [metaTitle, metaDescription, title, titleSr, description, descriptionSr, slug] = useWatch<
    ListingForm,
    [
      `seo.metaTitle.${L10nKey}`,
      `seo.metaDescription.${L10nKey}`,
      `title.${L10nKey}`,
      "title.sr",
      `description.${L10nKey}`,
      "description.sr",
      "slug",
    ]
  >({
    name: [
      `seo.metaTitle.${locale}`,
      `seo.metaDescription.${locale}`,
      `title.${locale}`,
      "title.sr",
      `description.${locale}`,
      "description.sr",
      "slug",
    ],
  });
  const shownTitle = [metaTitle, title, titleSr].find((text) => text.trim() !== "") ?? "";
  const shownDescription = [metaDescription, description, descriptionSr].find((text) => text.trim() !== "") ?? "";
  const crumbs = listingPath(locale, slug).split("/").filter((part) => part !== "");

  return (
    <figure className="rounded-lg border bg-background p-4">
      <figcaption className="mb-3 text-xs font-medium text-muted-foreground">
        Pregled u pretrazi — {L10N_LABEL[locale].toLowerCase()}
      </figcaption>
      {/* Google's result font, so line lengths read as they will in search. */}
      <div className="max-w-[600px]" style={{ fontFamily: "Arial, sans-serif" }} lang={LOCALE_LANG[locale]}>
        <p className="truncate text-xs text-foreground/80">
          {siteHost()} › {crumbs.join(" › ")}
        </p>
        <p className="mt-1 truncate text-lg leading-snug text-[#1a0dab] dark:text-[#99c3ff]">
          {shownTitle !== "" ? clip(shownTitle, META_TITLE_SOFT + 5) : "Bez naslova"}
        </p>
        <p className="mt-1 line-clamp-2 text-sm leading-normal text-foreground/75">
          {shownDescription !== "" ? clip(shownDescription, META_DESCRIPTION_SOFT + 5) : "Bez opisa."}
        </p>
      </div>
    </figure>
  );
}

function OgImageGroup({ data }: { data: EditorData }) {
  const { field } = useController<ListingForm, "seo.ogImage">({ name: "seo.ogImage" });
  const media = [...data.listing.media].sort((a, b) => a.order - b.order);
  const current = field.value;
  const selected =
    current === null ? "auto" : (media.find((item) => deepEqual(item.image, current))?.id ?? "missing");

  return (
    <Group
      title="Slika za deljenje (OG)"
      layout="stack"
      description="Prikazuje se kada se oglas podeli na društvenim mrežama i u porukama."
    >
      <RadioGroup
        value={selected}
        onValueChange={(id) => field.onChange(id === "auto" ? null : (media.find((item) => item.id === id)?.image ?? null))}
        aria-label="Slika za deljenje"
        className="grid grid-cols-2 gap-3 @md:grid-cols-3 @2xl:grid-cols-4"
      >
        <Label
          htmlFor="f-og-auto"
          className="relative flex aspect-[4/3] cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border border-dashed bg-muted/40 p-3 text-center text-xs font-normal transition-colors duration-150 hover:bg-muted has-data-[state=checked]:border-solid has-data-[state=checked]:border-primary has-data-[state=checked]:ring-2 has-data-[state=checked]:ring-primary/30"
        >
          <RadioGroupItem id="f-og-auto" value="auto" className="absolute top-2 left-2 bg-background" />
          <span className="font-medium">Automatski</span>
          <span className="text-muted-foreground">naslovna fotografija</span>
        </Label>
        {media.map((item, index) => {
          const url = data.mediaUrls[item.id];
          const id = `f-og-${item.id}`;
          const alt = item.alt.sr.trim() !== "" ? item.alt.sr : `Fotografija ${index + 1}`;
          return (
            <Label
              key={item.id}
              htmlFor={id}
              className="relative block aspect-[4/3] cursor-pointer overflow-hidden rounded-lg border bg-muted transition-shadow duration-150 has-data-[state=checked]:border-primary has-data-[state=checked]:ring-2 has-data-[state=checked]:ring-primary/40"
            >
              {url !== undefined ? (
                <Image
                  src={url}
                  alt={alt}
                  fill
                  sizes="(min-width: 1280px) 180px, 45vw"
                  unoptimized={!optimizable(url)}
                  className="object-cover"
                />
              ) : (
                <span className="flex size-full items-center justify-center text-muted-foreground">
                  <ImageOff aria-hidden="true" className="size-5" />
                  <span className="sr-only">{alt}</span>
                </span>
              )}
              <RadioGroupItem id={id} value={item.id} aria-label={alt} className="absolute top-2 left-2 bg-background" />
              {item.isCover === true ? (
                <span className="absolute right-2 bottom-2 rounded bg-background/90 px-1.5 py-0.5 text-[0.6875rem] font-medium">
                  Naslovna
                </span>
              ) : null}
            </Label>
          );
        })}
      </RadioGroup>
      {selected === "missing" ? (
        <p className="text-xs text-amber-800 dark:text-amber-300">
          Izabrana slika više nije u galeriji. Izaberite drugu ili „Automatski”.
        </p>
      ) : null}
      {media.length === 0 ? (
        <p className="text-xs text-muted-foreground">Dodajte fotografije u kartici „Mediji” da biste izabrali drugu sliku.</p>
      ) : null}
    </Group>
  );
}
