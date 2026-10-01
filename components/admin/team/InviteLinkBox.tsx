"use client";

import { Check, Copy } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * The invite link, shown once: the server keeps only the token's hash, so
 * this is the only moment the link exists. Copies with the Clipboard API;
 * where that is unavailable (plain http, denied permission) the text is
 * selected for Ctrl+C instead.
 */
export function InviteLinkBox({ url, email }: { url: string; email: string }) {
  const id = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const copyRef = useRef<HTMLButtonElement>(null);
  const [copied, setCopied] = useState(false);

  // The form that produced the link is gone; put focus on the next step.
  useEffect(() => {
    copyRef.current?.focus();
  }, []);

  const selectAll = () => {
    inputRef.current?.focus();
    inputRef.current?.select();
  };

  const copy = async () => {
    try {
      if (navigator.clipboard === undefined) throw new Error("clipboard unavailable");
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success("Link je kopiran.");
    } catch {
      selectAll();
      toast.message("Link je označen. Kopirajte ga sa Ctrl+C (⌘C na Macu).");
    }
  };

  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>Link pozivnice za {email}</Label>
      <div className="flex gap-2">
        <Input
          ref={inputRef}
          id={id}
          readOnly
          value={url}
          spellCheck={false}
          data-testid="invite-link"
          aria-describedby={`${id}-hint`}
          className="font-mono text-xs md:text-xs"
          onFocus={(event) => event.currentTarget.select()}
        />
        <Button
          ref={copyRef}
          type="button"
          onClick={() => void copy()}
          data-testid="invite-copy"
          className="shrink-0"
        >
          {copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
          {copied ? "Kopirano" : "Kopiraj"}
        </Button>
      </div>
      <p id={`${id}-hint`} className="text-xs leading-relaxed text-muted-foreground">
        Link se prikazuje samo sada. Pošaljite ga lično (e-pošta, Viber, WhatsApp). Važi 7 dana i
        radi samo jednom; ako se izgubi, u kartici Pozivnice napravite novi link.
      </p>
      <p className="sr-only" aria-live="polite">
        {copied ? "Link je kopiran u privremenu memoriju." : ""}
      </p>
    </div>
  );
}
