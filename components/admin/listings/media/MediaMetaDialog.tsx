"use client";

import { useMutation } from "convex/react";
import { Loader2 } from "lucide-react";
import { useId, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { L10N_KEYS, type L10n, type L10nKey, type MediaItem, type RoomTag } from "@/convex/lib/validators";
import { adminErrorMessage } from "@/lib/admin/errors";
import { L10N_LABEL, ROOM_TAG_LABEL } from "@/lib/admin/labels";
import { cn } from "@/lib/utils";
import { ALT_MAX, thumbUrl, type MediaTarget } from "./shared";

const ROOM_TAGS = Object.keys(ROOM_TAG_LABEL) as RoomTag[];

function isRoomTag(value: string): value is RoomTag {
  return Object.hasOwn(ROOM_TAG_LABEL, value);
}

const LANG: Record<L10nKey, string> = { sr: "sr-Latn", en: "en", ru: "ru", de: "de" };

type MetaDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  listingId: Id<"listings">;
  target: MediaTarget;
  /** Undefined while the dialog closes after its item was removed. */
  item: MediaItem | undefined;
  position: number;
  url: string | undefined;
};

/** Room tag + alt text per locale for one photo or floor plan (`media.updateMeta`). */
export function MediaMetaDialog({ open, onOpenChange, listingId, target, item, position, url }: MetaDialogProps) {
  const title = target === "gallery" ? `Fotografija ${position}` : `Tlocrt ${position}`;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* The stock close button is labelled in English; "Otkaži" and Esc close it instead. */}
      <DialogContent className="sm:max-w-lg" showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            {target === "gallery"
              ? "Oznaka prostorije i opis fotografije (alt tekst) na svakom jeziku sajta."
              : "Opis tlocrta (alt tekst) na svakom jeziku sajta."}
          </DialogDescription>
        </DialogHeader>
        {item !== undefined ? (
          <MetaForm
            key={item.id}
            listingId={listingId}
            target={target}
            item={item}
            position={position}
            url={url}
            onDone={() => onOpenChange(false)}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function MetaForm({
  listingId,
  target,
  item,
  position,
  url,
  onDone,
}: {
  listingId: Id<"listings">;
  target: MediaTarget;
  item: MediaItem;
  position: number;
  url: string | undefined;
  onDone: () => void;
}) {
  const updateMeta = useMutation(api.media.updateMeta);
  const baseId = useId();
  const [alt, setAlt] = useState<Record<L10nKey, string>>(() => ({
    sr: item.alt.sr,
    en: item.alt.en ?? "",
    ru: item.alt.ru ?? "",
    de: item.alt.de ?? "",
  }));
  const [room, setRoom] = useState<RoomTag | undefined>(item.room);
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    // The dialog is portaled, but React still bubbles `submit` to an enclosing editor form.
    event.stopPropagation();
    if (saving) return;

    const optional = (key: "en" | "ru" | "de") => {
      const value = alt[key].trim();
      return value.length > 0 ? { [key]: value } : {};
    };
    const nextAlt: L10n = { sr: alt.sr.trim(), ...optional("en"), ...optional("ru"), ...optional("de") };

    setSaving(true);
    try {
      await updateMeta({
        listingId,
        target,
        itemId: item.id,
        alt: nextAlt,
        ...(target === "gallery" && room !== undefined && room !== item.room ? { room } : {}),
      });
      toast.success("Opis je sačuvan.");
      onDone();
    } catch (error) {
      toast.error(adminErrorMessage(error, "Opis nije sačuvan. Pokušajte ponovo."));
    } finally {
      setSaving(false);
    }
  };

  const roomId = `${baseId}-room`;
  const fallbackAlt = target === "gallery" ? `Fotografija ${position}` : `Tlocrt ${position}`;

  return (
    <form onSubmit={handleSubmit} className="grid gap-4">
      <div className="flex items-start gap-3">
        <div className="aspect-[4/3] w-28 shrink-0 overflow-hidden rounded-md border bg-muted">
          {url !== undefined ? (
            // eslint-disable-next-line @next/next/no-img-element -- admin preview of a Convex storage URL; next/image adds nothing here
            <img
              src={thumbUrl(url)}
              alt={item.alt.sr.trim() || fallbackAlt}
              className={cn("size-full", target === "floorPlans" ? "bg-white object-contain" : "object-cover")}
            />
          ) : null}
        </div>
        {target === "gallery" ? (
          <div className="grid min-w-0 flex-1 gap-1.5">
            <Label htmlFor={roomId}>Prostorija</Label>
            <Select
              value={room ?? ""}
              onValueChange={(value) => {
                if (isRoomTag(value)) setRoom(value);
              }}
            >
              <SelectTrigger id={roomId} className="w-full">
                <SelectValue placeholder="Bez oznake" />
              </SelectTrigger>
              <SelectContent>
                {ROOM_TAGS.map((tag) => (
                  <SelectItem key={tag} value={tag}>
                    {ROOM_TAG_LABEL[tag]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : null}
      </div>

      <fieldset className="grid gap-3">
        <legend className="mb-2 text-sm font-medium">Alt tekst</legend>
        {L10N_KEYS.map((key) => {
          const id = `${baseId}-alt-${key}`;
          const countId = `${id}-count`;
          const hintId = `${id}-hint`;
          return (
            <div key={key} className="grid gap-1.5">
              <div className="flex items-baseline justify-between gap-2">
                <Label htmlFor={id}>{L10N_LABEL[key]}</Label>
                <span id={countId} className="text-xs tabular-nums text-muted-foreground">
                  {alt[key].length} / {ALT_MAX}
                </span>
              </div>
              <Input
                id={id}
                lang={LANG[key]}
                value={alt[key]}
                maxLength={ALT_MAX}
                autoComplete="off"
                placeholder={
                  key === "sr" ? "npr. Dnevna soba sa izlazom na terasu" : "Ako ostane prazno, koristi se srpski opis"
                }
                aria-describedby={key === "sr" ? `${hintId} ${countId}` : countId}
                onChange={(event) => {
                  const value = event.currentTarget.value;
                  setAlt((current) => ({ ...current, [key]: value }));
                }}
              />
              {key === "sr" ? (
                <p id={hintId} className="text-xs text-muted-foreground">
                  Opišite šta se vidi — važno za pristupačnost i SEO
                </p>
              ) : null}
            </div>
          );
        })}
      </fieldset>

      <DialogFooter>
        <DialogClose asChild>
          <Button type="button" variant="outline" disabled={saving}>
            Otkaži
          </Button>
        </DialogClose>
        <Button type="submit" disabled={saving}>
          {saving ? <Loader2 className="animate-spin" aria-hidden="true" /> : null}
          Sačuvaj
        </Button>
      </DialogFooter>
    </form>
  );
}
