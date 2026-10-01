"use client";

import { X } from "lucide-react";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { foldDiacritics } from "@/convex/lib/slug";
import { TAG_MAX, TAGS_MAX } from "./form";

/**
 * Tags as removable chips. Enter or a comma adds what is typed (a pasted
 * "a, b, c" adds three); Backspace in the empty box removes the last one.
 * Duplicates (ignoring case and diacritics) are skipped.
 */
export function TagsInput({
  id,
  value,
  onChange,
  describedById,
}: {
  id: string;
  value: string[];
  onChange: (next: string[]) => void;
  describedById?: string;
}) {
  const [text, setText] = useState("");
  const full = value.length >= TAGS_MAX;

  const add = (raw: string) => {
    const next = [...value];
    for (const part of raw.split(",")) {
      const tag = part.trim().replace(/\s+/g, " ").slice(0, TAG_MAX);
      if (tag.length === 0 || next.length >= TAGS_MAX) continue;
      if (next.some((known) => foldDiacritics(known) === foldDiacritics(tag))) continue;
      next.push(tag);
    }
    if (next.length !== value.length) onChange(next);
    setText("");
  };

  return (
    <div className="flex flex-col gap-2">
      {value.length > 0 ? (
        <ul aria-label="Oznake" className="flex flex-wrap gap-1.5">
          {value.map((tag) => (
            <li key={tag} className="inline-flex items-center gap-1 rounded-md border bg-muted/50 py-0.5 pr-0.5 pl-2 text-xs">
              {tag}
              <button
                type="button"
                aria-label={`Uklonite oznaku ${tag}`}
                onClick={() => onChange(value.filter((item) => item !== tag))}
                className="inline-flex size-6 items-center justify-center rounded text-muted-foreground transition-colors duration-150 hover:bg-muted hover:text-foreground max-md:size-9"
              >
                <X className="size-3.5" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      <Input
        id={id}
        value={text}
        disabled={full}
        maxLength={TAG_MAX * 4}
        autoComplete="off"
        placeholder={full ? `Najviše ${TAGS_MAX} oznaka` : "npr. Kupovina, Porezi"}
        aria-describedby={describedById}
        onChange={(event) => {
          const next = event.target.value;
          if (next.includes(",")) add(next);
          else setText(next);
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            add(text);
          } else if (event.key === "Backspace" && text.length === 0 && value.length > 0) {
            onChange(value.slice(0, -1));
          }
        }}
        onBlur={() => {
          if (text.trim().length > 0) add(text);
        }}
      />
    </div>
  );
}
