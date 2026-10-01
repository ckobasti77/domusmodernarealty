"use client";

import { useMutation } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { Trash2, TriangleAlert } from "lucide-react";
import { useEffect, useId, useMemo, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/admin/common/ConfirmDialog";
import { describedBy, FieldShell, FormSection, SaveBar } from "@/components/admin/common/form";
import { ImageField } from "@/components/admin/common/ImageField";
import { fromL10nValue, L10nInput, toL10nValue, type L10nValue } from "@/components/admin/common/L10nInput";
import { insideSerbia, parseCoordinate, type CoordAxis } from "@/components/admin/listings/location/coords";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { api } from "@/convex/_generated/api";
import { slugify } from "@/convex/lib/slug";
import { L10N_KEYS, type ImageRef, type LocationKind } from "@/convex/lib/validators";
import { LOCATION_KIND_LABEL } from "@/lib/admin/labels";
import { adminErrorMessage, errorData } from "@/lib/admin/errors";
import { CentroidPicker } from "./CentroidPicker";
import {
  childrenOf,
  formatAmount,
  PARENT_KINDS,
  parseAmount,
  siblingsOf,
  type LocationId,
  type TreeIndex,
} from "./model";

export type LocationDetail = NonNullable<FunctionReturnType<typeof api.locationsAdmin.get>>;

/** Server limits (`convex/locationsAdmin.ts`), checked here first for inline errors. */
const SALE_MAX = 50_000;
const RENT_MAX = 500;
const FACTS_MAX = 12;
const FACT_MAX = 200;
const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
/** Roughly the middle of Serbia: where a brand-new city starts. */
const SERBIA_CENTER = { lat: 44.0165, lng: 20.9114 };

const ZOOM: Record<LocationKind, number> = { city: 11, municipality: 13, neighborhood: 14 };

const perM2 = new Intl.NumberFormat("sr-Latn-RS", { maximumFractionDigits: 2 });

type Draft = {
  parentId: LocationId | undefined;
  slug: string;
  /** A new location's slug follows the name until the user edits it. */
  slugTouched: boolean;
  name: L10nValue;
  intro: L10nValue;
  /** One fact per line, per locale. */
  facts: L10nValue;
  cover: ImageRef | undefined;
  avgSale: string;
  avgRent: string;
  lat: string;
  lng: string;
  featured: boolean;
};

type Errors = Partial<Record<"name" | "slug" | "parent" | "facts" | "avgSale" | "avgRent" | CoordAxis, string>>;

function lines(text: string): string[] {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

function factsToText(facts: LocationDetail["facts"]): L10nValue {
  return toL10nValue({
    sr: facts?.sr.join("\n"),
    en: facts?.en?.join("\n"),
    ru: facts?.ru?.join("\n"),
    de: facts?.de?.join("\n"),
  });
}

function textToFacts(value: L10nValue): { sr: string[]; en?: string[]; ru?: string[]; de?: string[] } {
  const out: { sr: string[]; en?: string[]; ru?: string[]; de?: string[] } = { sr: lines(value.sr) };
  for (const key of ["en", "ru", "de"] as const) {
    const list = lines(value[key]);
    if (list.length > 0) out[key] = list;
  }
  return out;
}

function draftFromDetail(detail: LocationDetail): Draft {
  return {
    parentId: detail.parentId,
    slug: detail.slug,
    slugTouched: true,
    name: toL10nValue(detail.name),
    intro: toL10nValue(detail.intro),
    facts: factsToText(detail.facts),
    cover: detail.cover,
    avgSale: formatAmount(detail.avgPricePerM2Sale),
    avgRent: formatAmount(detail.avgPricePerM2Rent),
    lat: String(detail.lat),
    lng: String(detail.lng),
    featured: detail.featured,
  };
}

function newDraft(index: TreeIndex, kind: LocationKind, parentId: LocationId | undefined): Draft {
  const parent = parentId !== undefined ? index.byId.get(parentId) : undefined;
  const center = parent !== undefined ? { lat: parent.lat, lng: parent.lng } : SERBIA_CENTER;
  return {
    parentId: parent?._id,
    slug: "",
    slugTouched: false,
    name: toL10nValue(undefined),
    intro: toL10nValue(undefined),
    facts: toL10nValue(undefined),
    cover: undefined,
    avgSale: "",
    avgRent: "",
    lat: String(center.lat),
    lng: String(center.lng),
    featured: false,
  };
}

/** Everything but the auto-slug bookkeeping. */
function comparable(draft: Draft): string {
  const { slugTouched: _ignored, ...rest } = draft;
  return JSON.stringify(rest);
}

function effectiveSlug(draft: Draft): string {
  return draft.slugTouched ? draft.slug : draft.name.sr.trim().length > 0 ? slugify(draft.name.sr) : "";
}

function validate(draft: Draft, kind: LocationKind): Errors {
  const errors: Errors = {};
  if (draft.name.sr.trim().length < 2) errors.name = "Unesite naziv na srpskom (najmanje 2 znaka).";
  const slug = effectiveSlug(draft);
  if (draft.slugTouched && (!SLUG_RE.test(slug) || slug.length < 2)) {
    errors.slug = "Samo mala slova bez kvačica, brojevi i crtice; najmanje 2 znaka.";
  }
  if (PARENT_KINDS[kind].length > 0 && draft.parentId === undefined) {
    errors.parent = kind === "municipality" ? "Izaberite grad." : "Izaberite opštinu ili grad.";
  }
  for (const key of L10N_KEYS) {
    const list = lines(draft.facts[key]);
    if (list.length > FACTS_MAX) errors.facts = `Najviše ${FACTS_MAX} činjenica po jeziku.`;
    else if (list.some((line) => line.length > FACT_MAX)) {
      errors.facts = `Jedna činjenica može imati najviše ${FACT_MAX} znakova.`;
    }
  }
  const sale = parseAmount(draft.avgSale);
  if (!sale.ok) errors.avgSale = "Unesite broj, npr. 3400.";
  else if (sale.value !== undefined && sale.value > SALE_MAX) errors.avgSale = `Najviše ${SALE_MAX} €/m².`;
  const rent = parseAmount(draft.avgRent);
  if (!rent.ok) errors.avgRent = "Unesite broj, npr. 12,5.";
  else if (rent.value !== undefined && rent.value > RENT_MAX) errors.avgRent = `Najviše ${RENT_MAX} €/m² mesečno.`;
  const lat = parseCoordinate(draft.lat, "lat");
  const lng = parseCoordinate(draft.lng, "lng");
  if (!lat.ok) errors.lat = lat.error;
  if (!lng.ok) errors.lng = lng.error;
  if (lat.ok && lng.ok && !insideSerbia(lat.value, lng.value)) {
    errors.lat = "Središte lokacije mora biti u Srbiji.";
  }
  return errors;
}

function amountPreview(text: string, unit: string): string | undefined {
  const parsed = parseAmount(text);
  if (!parsed.ok || parsed.value === undefined) return undefined;
  return `Na sajtu: ${perM2.format(parsed.value)} ${unit}`;
}

/**
 * The location editor (PRD B8), inside the detail sheet. Plain state, one
 * `locationsAdmin.upsert` on save; the server re-validates everything and
 * logs a field-level diff.
 */
export function LocationForm({
  formId,
  kind,
  detail,
  initialParentId,
  index,
  canDelete,
  onDirtyChange,
  onCreated,
  onDeleted,
}: {
  formId: string;
  kind: LocationKind;
  /** null for a new location. */
  detail: LocationDetail | null;
  initialParentId: LocationId | undefined;
  index: TreeIndex;
  canDelete: boolean;
  onDirtyChange: (dirty: boolean) => void;
  /** Called after a new location is saved. */
  onCreated?: (id: LocationId) => void;
  onDeleted: () => void;
}) {
  const [baseline, setBaseline] = useState<Draft>(() =>
    detail !== null ? draftFromDetail(detail) : newDraft(index, kind, initialParentId),
  );
  const [draft, setDraft] = useState<Draft>(baseline);
  const [submitted, setSubmitted] = useState(false);
  const [touched, setTouched] = useState<Partial<Record<CoordAxis, boolean>>>({});
  const [slugServerError, setSlugServerError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const upsert = useMutation(api.locationsAdmin.upsert);
  const remove = useMutation(api.locationsAdmin.remove);
  const ids = {
    parent: useId(),
    slug: useId(),
    sale: useId(),
    rent: useId(),
    featured: useId(),
  };

  const dirty = comparable(draft) !== comparable(baseline);
  useEffect(() => onDirtyChange(dirty), [dirty, onDirtyChange]);

  // A reload or closed tab would lose the draft.
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const errors = validate(draft, kind);
  const shown: Errors = submitted
    ? errors
    : {
        ...(touched.lat === true && errors.lat !== undefined ? { lat: errors.lat } : {}),
        ...(touched.lng === true && errors.lng !== undefined ? { lng: errors.lng } : {}),
      };
  const slugError = shown.slug ?? slugServerError ?? undefined;

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft((prev) => ({ ...prev, [key]: value }));

  const parentOptions = useMemo(() => {
    const allowed = PARENT_KINDS[kind];
    if (allowed.length === 0) return [];
    return index.roots
      .filter((city) => city.kind === "city")
      .map((city) => ({
        city,
        municipalities: allowed.includes("municipality")
          ? childrenOf(index, city._id).filter((child) => child.kind === "municipality")
          : [],
      }));
  }, [index, kind]);

  const inUse = detail !== null && (detail.inUse || detail.saleCount + detail.rentCount > 0);
  const moveLocked = detail !== null && detail.inUse;
  const parentHint = moveLocked
    ? "Premeštanje nije moguće dok lokaciju koriste nekretnine."
    : detail?.hasChildren === true
      ? "Podređena naselja se sele zajedno sa lokacijom."
      : undefined;
  const slug = effectiveSlug(draft);
  const slugChanged = detail !== null && slug !== detail.slug;
  const saleHint = amountPreview(draft.avgSale, "€/m²");
  const rentHint = amountPreview(draft.avgRent, "€/m² mesečno");
  const position = (() => {
    if (detail === null) return null;
    const row = index.byId.get(detail._id);
    if (row === undefined) return null;
    const siblings = siblingsOf(index, row);
    return { place: siblings.findIndex((item) => item._id === row._id) + 1, of: siblings.length };
  })();

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitted(true);
    setSlugServerError(null);
    if (Object.keys(errors).length > 0) {
      toast.error("Proverite označena polja.");
      return;
    }
    const lat = parseCoordinate(draft.lat, "lat");
    const lng = parseCoordinate(draft.lng, "lng");
    const sale = parseAmount(draft.avgSale);
    const rent = parseAmount(draft.avgRent);
    if (!lat.ok || !lng.ok || !sale.ok || !rent.ok) return;

    const sendSlug = detail === null ? draft.slugTouched : slugChanged;
    setSaving(true);
    try {
      const result = await upsert({
        ...(detail !== null ? { id: detail._id } : {}),
        kind,
        ...(draft.parentId !== undefined && PARENT_KINDS[kind].length > 0 ? { parentId: draft.parentId } : {}),
        ...(sendSlug ? { slug } : {}),
        name: fromL10nValue(draft.name),
        intro: fromL10nValue(draft.intro),
        facts: textToFacts(draft.facts),
        ...(draft.cover !== undefined ? { cover: draft.cover } : {}),
        ...(sale.value !== undefined ? { avgPricePerM2Sale: sale.value } : {}),
        ...(rent.value !== undefined ? { avgPricePerM2Rent: rent.value } : {}),
        lat: lat.value,
        lng: lng.value,
        featured: draft.featured,
      });
      if (detail === null) {
        toast.success("Lokacija je dodata.");
        setBaseline(draft);
        onCreated?.(result.id);
        return;
      }
      const saved = { ...draft, slug: result.slug, slugTouched: true };
      setDraft(saved);
      setBaseline(saved);
      setSubmitted(false);
      toast.success("Izmene su sačuvane.");
    } catch (error) {
      const data = errorData(error);
      if (data?.code === "CONFLICT" && data.message !== undefined && data.message.startsWith("Adresa")) {
        setSlugServerError(data.message);
      }
      toast.error(adminErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  const factsError = shown.facts;
  const baseLat = parseCoordinate(baseline.lat, "lat");
  const baseLng = parseCoordinate(baseline.lng, "lng");
  const fallback = {
    lat: baseLat.ok ? baseLat.value : SERBIA_CENTER.lat,
    lng: baseLng.ok ? baseLng.value : SERBIA_CENTER.lng,
  };

  return (
    <form id={formId} noValidate onSubmit={submit} className="flex flex-col gap-4">
      <FormSection
        title="Osnovno"
        description={
          <>
            Vrsta: {LOCATION_KIND_LABEL[kind].toLowerCase()}. Vrsta se ne menja posle dodavanja.
          </>
        }
      >
        {PARENT_KINDS[kind].length > 0 ? (
          <FieldShell
            id={ids.parent}
            label={kind === "municipality" ? "Grad" : "Pripada (opština ili grad)"}
            error={shown.parent}
            hint={parentHint}
            wide
          >
            <Select
              value={draft.parentId ?? ""}
              disabled={moveLocked}
              onValueChange={(value) => {
                const row = index.byId.get(value as LocationId);
                if (row !== undefined) set("parentId", row._id);
              }}
            >
              <SelectTrigger
                id={ids.parent}
                className="w-full sm:max-w-sm"
                aria-invalid={shown.parent !== undefined || undefined}
                aria-describedby={describedBy(ids.parent, parentHint !== undefined, shown.parent !== undefined)}
              >
                <SelectValue placeholder="Izaberite…" />
              </SelectTrigger>
              <SelectContent>
                {parentOptions.map(({ city, municipalities }) =>
                  municipalities.length > 0 ? (
                    <SelectGroup key={city._id}>
                      <SelectLabel>{city.name.sr}</SelectLabel>
                      <SelectItem value={city._id}>{city.name.sr} (ceo grad)</SelectItem>
                      {municipalities.map((municipality) => (
                        <SelectItem key={municipality._id} value={municipality._id} className="pl-6">
                          {municipality.name.sr}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  ) : (
                    <SelectItem key={city._id} value={city._id}>
                      {city.name.sr}
                    </SelectItem>
                  ),
                )}
              </SelectContent>
            </Select>
          </FieldShell>
        ) : null}

        <L10nInput
          label="Naziv"
          value={draft.name}
          onChange={(name) => {
            setSlugServerError(null);
            set("name", name);
          }}
          required
          maxLength={80}
          error={shown.name}
          testId="location-name"
        />

        <FieldShell
          id={ids.slug}
          label="Adresa stranice (slug)"
          error={slugError}
          hint={`Javna adresa: /sr/lokacije/${slug.length > 0 ? slug : "…"}; isti slug važi na sva četiri jezika. ${
            detail === null && !draft.slugTouched ? "Nastaje iz srpskog naziva; možete ga izmeniti." : ""
          }`.trim()}
          wide
        >
          <Input
            id={ids.slug}
            value={slug}
            spellCheck={false}
            autoComplete="off"
            className="font-mono sm:max-w-sm"
            aria-invalid={slugError !== undefined || undefined}
            aria-describedby={describedBy(ids.slug, true, slugError !== undefined)}
            onChange={(event) => {
              setSlugServerError(null);
              setDraft((prev) => ({ ...prev, slug: event.currentTarget.value, slugTouched: true }));
            }}
            onBlur={() => {
              if (draft.slugTouched && draft.slug.trim().length > 0) set("slug", slugify(draft.slug));
            }}
          />
        </FieldShell>
        {slugChanged ? (
          <div
            role="note"
            className="col-span-full flex gap-2 rounded-lg border border-warning/40 bg-warning/10 p-3 text-xs leading-relaxed"
          >
            <TriangleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-warning-text dark:text-warning" />
            <p>
              Promena adrese menja javni link: <span className="font-mono">/lokacije/{detail?.slug}</span> postaje{" "}
              <span className="font-mono">/lokacije/{slug}</span>. Stari linkovi i pretrage sa ovom lokacijom (
              <span className="font-mono">?location={detail?.slug}</span>) prestaju da je prepoznaju.
              {inUse ? " Nekretnine ostaju vezane za lokaciju." : ""}
            </p>
          </div>
        ) : null}
      </FormSection>

      <FormSection title="Tekst" columns={1}>
        <L10nInput
          label="Uvod"
          value={draft.intro}
          onChange={(intro) => set("intro", intro)}
          multiline
          rows={5}
          maxLength={1500}
          hint="Nekoliko rečenica za stranicu lokacije: karakter kraja, gradnja, saobraćaj."
        />
        <L10nInput
          label="Činjenice"
          value={draft.facts}
          onChange={(facts) => set("facts", facts)}
          multiline
          rows={5}
          error={factsError}
          hint={`Jedna činjenica po redu, najviše ${FACTS_MAX} po jeziku.`}
        />
      </FormSection>

      <FormSection title="Naslovna fotografija" columns={1}>
        <ImageField
          label="Fotografija lokacije"
          value={draft.cover}
          previewUrl={detail?.coverUrl}
          onChange={(cover) => set("cover", cover)}
          hint="Široka fotografija, najmanje 1600 px. JPEG, PNG, WebP ili AVIF do 20 MB."
          className="max-w-md"
        />
      </FormSection>

      <FormSection
        title="Tržište"
        description="Prosečne tražene cene za karticu i stranicu lokacije. Ostavite prazno ako nemate pouzdan podatak."
      >
        <FieldShell
          id={ids.sale}
          label="Prosečna cena prodaje (€/m²)"
          error={shown.avgSale}
          hint={saleHint ?? "Na primer 3400."}
        >
          <Input
            id={ids.sale}
            inputMode="decimal"
            autoComplete="off"
            data-testid="location-avg-sale"
            value={draft.avgSale}
            aria-invalid={shown.avgSale !== undefined || undefined}
            aria-describedby={describedBy(ids.sale, true, shown.avgSale !== undefined)}
            onChange={(event) => set("avgSale", event.currentTarget.value)}
          />
        </FieldShell>
        <FieldShell
          id={ids.rent}
          label="Prosečna zakupnina (€/m² mesečno)"
          error={shown.avgRent}
          hint={rentHint ?? "Mesečna zakupnina po kvadratu, na primer 12,5."}
        >
          <Input
            id={ids.rent}
            inputMode="decimal"
            autoComplete="off"
            data-testid="location-avg-rent"
            value={draft.avgRent}
            aria-invalid={shown.avgRent !== undefined || undefined}
            aria-describedby={describedBy(ids.rent, true, shown.avgRent !== undefined)}
            onChange={(event) => set("avgRent", event.currentTarget.value)}
          />
        </FieldShell>
      </FormSection>

      <FormSection title="Položaj" columns={1}>
        <CentroidPicker
          latText={draft.lat}
          lngText={draft.lng}
          fallback={fallback}
          zoom={detail === null && kind === "city" ? 7 : ZOOM[kind]}
          errors={{ ...(shown.lat !== undefined ? { lat: shown.lat } : {}), ...(shown.lng !== undefined ? { lng: shown.lng } : {}) }}
          onTextChange={(axis, text) => set(axis, text)}
          onBlurAxis={(axis) => setTouched((prev) => ({ ...prev, [axis]: true }))}
          onPick={(next) => setDraft((prev) => ({ ...prev, lat: String(next.lat), lng: String(next.lng) }))}
        />
      </FormSection>

      <FormSection title="Prikaz na sajtu" columns={1}>
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <label htmlFor={ids.featured} className="text-sm font-medium">
              Istaknuta lokacija
            </label>
            <p id={`${ids.featured}-hint`} className="mt-0.5 text-xs text-muted-foreground">
              Prikazuje se na naslovnoj strani među izdvojenim lokacijama.
            </p>
          </div>
          <Switch
            id={ids.featured}
            checked={draft.featured}
            onCheckedChange={(featured) => set("featured", featured)}
            aria-describedby={`${ids.featured}-hint`}
          />
        </div>
        <p className="text-xs text-muted-foreground">
          {position !== null
            ? `Redosled: ${position.place}. od ${position.of} na ovom nivou. Menja se strelicama u stablu.`
            : "Nova lokacija dolazi na kraj svog nivoa; redosled menjate strelicama u stablu."}
        </p>
      </FormSection>

      {detail !== null && canDelete ? (
        <DeleteSection detail={detail} onDelete={() => remove({ id: detail._id })} onDeleted={onDeleted} />
      ) : null}

      {/* SaveBar's bleed is sized for page padding; the sheet body has 20 px, so
          this wrapper (sticky itself: a sticky child cannot leave its parent)
          evens it out at every breakpoint. */}
      <div className="sticky bottom-0 z-10 -mx-1 -mb-5 md:mx-1">
        <SaveBar
          dirty={dirty}
          saving={saving}
          onReset={
            detail !== null
              ? () => {
                  setDraft(baseline);
                  setSubmitted(false);
                  setTouched({});
                  setSlugServerError(null);
                }
              : undefined
          }
          submitLabel={detail === null ? "Dodaj lokaciju" : "Sačuvaj"}
        />
      </div>
    </form>
  );
}

function DeleteSection({
  detail,
  onDelete,
  onDeleted,
}: {
  detail: LocationDetail;
  onDelete: () => Promise<null>;
  onDeleted: () => void;
}) {
  const blocker = detail.hasChildren
    ? "Lokacija ima podređene lokacije. Prvo ih obrišite ili premestite."
    : detail.inUse || detail.saleCount + detail.rentCount > 0
      ? "Lokaciju koriste nekretnine (i nacrti se računaju). Prvo ih prebacite na drugu lokaciju."
      : null;

  return (
    <FormSection title="Brisanje" columns={1}>
      <p className="text-xs text-muted-foreground">
        {blocker ?? "Lokaciju ne koristi nijedna nekretnina i nema podređenih lokacija, pa se može obrisati."}
      </p>
      <div>
        <ConfirmDialog
          trigger={
            <Button type="button" variant="destructive" disabled={blocker !== null}>
              <Trash2 aria-hidden="true" />
              Obriši lokaciju
            </Button>
          }
          title={`Obrisati „${detail.name.sr}”?`}
          description="Lokacija, njena fotografija i brojači se trajno brišu. Ova radnja se ne može poništiti."
          confirmLabel="Obriši"
          destructive
          onConfirm={async () => {
            try {
              await onDelete();
            } catch (error) {
              toast.error(adminErrorMessage(error));
              return false;
            }
            toast.success("Lokacija je obrisana.");
            onDeleted();
            return true;
          }}
        />
      </div>
    </FormSection>
  );
}
