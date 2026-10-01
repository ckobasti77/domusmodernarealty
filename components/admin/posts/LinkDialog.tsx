"use client";

import { Unlink } from "lucide-react";
import { useId, useState, type FormEvent } from "react";
import { describedBy } from "@/components/admin/common/form";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { isAllowedHref } from "@/lib/content/sanitize";

export type LinkValue = { href: string; newTab: boolean };

/** `www.rgz.gov.rs` → `https://www.rgz.gov.rs`; anything with a scheme or a leading `/`/`#` is left alone. */
function withScheme(input: string): string {
  const value = input.trim();
  if (value.length === 0 || /^[a-z][a-z0-9+.-]*:/i.test(value) || value.startsWith("/") || value.startsWith("#")) {
    return value;
  }
  return /^[^\s/]+\.[^\s/]{2,}/.test(value) ? `https://${value}` : value;
}

/** Add, change or remove the link on the selected text. */
export function LinkDialog({
  open,
  onOpenChange,
  initial,
  onApply,
  onRemove,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial: LinkValue;
  onApply: (value: LinkValue) => void;
  onRemove: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        {/* Remounted per opening, so the fields start from the current link. */}
        {open ? <LinkForm initial={initial} onApply={onApply} onRemove={onRemove} onClose={() => onOpenChange(false)} /> : null}
      </DialogContent>
    </Dialog>
  );
}

function LinkForm({
  initial,
  onApply,
  onRemove,
  onClose,
}: {
  initial: LinkValue;
  onApply: (value: LinkValue) => void;
  onRemove: () => void;
  onClose: () => void;
}) {
  const id = useId();
  const [href, setHref] = useState(initial.href);
  const [newTab, setNewTab] = useState(initial.newTab);
  const [error, setError] = useState<string | undefined>(undefined);
  const editing = initial.href.length > 0;

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    event.stopPropagation();
    const value = withScheme(href);
    if (!isAllowedHref(value)) {
      setError("Unesite adresu koja počinje sa https://, http://, mailto: ili / (stranica ovog sajta).");
      return;
    }
    onApply({ href: value, newTab });
    onClose();
  };

  return (
    <form onSubmit={submit} noValidate>
      <DialogHeader>
        <DialogTitle>{editing ? "Izmenite link" : "Dodajte link"}</DialogTitle>
        <DialogDescription>
          Spoljne adrese (https://…), e-pošta (mailto:…) ili stranica ovog sajta (/sr/…).
        </DialogDescription>
      </DialogHeader>
      <div className="my-4 flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`${id}-href`}>Adresa</Label>
          <Input
            id={`${id}-href`}
            value={href}
            autoFocus
            inputMode="url"
            autoComplete="off"
            spellCheck={false}
            placeholder="https://"
            aria-invalid={error !== undefined || undefined}
            aria-describedby={describedBy(`${id}-href`, false, error !== undefined)}
            onChange={(event) => {
              setHref(event.target.value);
              setError(undefined);
            }}
          />
          {error !== undefined ? (
            <p id={`${id}-href-error`} className="text-xs font-medium text-destructive">
              {error}
            </p>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          <Checkbox id={`${id}-tab`} checked={newTab} onCheckedChange={(checked) => setNewTab(checked === true)} />
          <Label htmlFor={`${id}-tab`} className="font-normal">
            Otvori u novoj kartici
          </Label>
        </div>
      </div>
      <DialogFooter className="gap-2 sm:justify-between">
        {editing ? (
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              onRemove();
              onClose();
            }}
          >
            <Unlink aria-hidden="true" />
            Uklonite link
          </Button>
        ) : (
          <span aria-hidden="true" />
        )}
        <div className="flex gap-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Otkaži
          </Button>
          <Button type="submit">{editing ? "Sačuvaj" : "Dodaj link"}</Button>
        </div>
      </DialogFooter>
    </form>
  );
}
