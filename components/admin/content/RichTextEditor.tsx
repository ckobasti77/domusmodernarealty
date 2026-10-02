"use client";

import { EditorContent, useEditor, useEditorState, type Editor } from "@tiptap/react";
import { Bold, Heading3, Italic, Link2, List, ListOrdered, Quote, Redo2, Undo2, type LucideIcon } from "lucide-react";
import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { PAGE_SAFE_HREF, pageSectionExtensions } from "./section-extensions";

/**
 * A compact rich-text editor (Tiptap 3) for page sections: subheadings (H3),
 * paragraphs, bold, italic, lists, quotes and links — exactly the HTML
 * `convex/pagesAdmin.ts` accepts, pasted content included
 * (`pageSectionExtensions`). Loaded with `next/dynamic` (`ssr: false`) by
 * `RichTextInput`, one instance per visible locale.
 */

const PROSE = [
  "text-sm leading-6 text-foreground break-words",
  "[&>:first-child]:mt-0 [&>:last-child]:mb-0 [&_p]:my-2",
  "[&_h3]:mt-5 [&_h3]:mb-2 [&_h3]:text-base [&_h3]:font-semibold",
  "[&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-6 [&_li]:my-1 [&_li>p]:my-0",
  "[&_blockquote]:my-3 [&_blockquote]:border-l-2 [&_blockquote]:border-bronze [&_blockquote]:pl-4 [&_blockquote]:text-muted-foreground",
  "[&_a]:font-medium [&_a]:underline [&_a]:underline-offset-2",
].join(" ");

function htmlOf(editor: Editor): string {
  return editor.isEmpty ? "" : editor.getHTML();
}

/** `www.example.rs` → `https://www.example.rs`; paths, anchors and schemes stay. */
function withScheme(input: string): string {
  const value = input.trim();
  if (value.length === 0 || /^[a-z][a-z0-9+.-]*:/i.test(value) || value.startsWith("/") || value.startsWith("#")) return value;
  return /^[^\s/]+\.[^\s/]{2,}/.test(value) ? `https://${value}` : value;
}

export function RichTextEditor({
  value,
  onChange,
  labelId,
  lang,
  invalid,
  describedBy,
  testId,
}: {
  value: string;
  onChange: (html: string) => void;
  /** The id of the visible label naming the text area. */
  labelId: string;
  lang: string;
  invalid?: boolean;
  describedBy?: string;
  testId?: string;
}) {
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  });
  // The HTML this editor last reported: a value coming back from the form
  // must not reset the document (and the caret) on every keystroke.
  const emitted = useRef(value);
  // Stable: `useEditor` would otherwise re-apply a fresh list on every render.
  const [extensions] = useState(pageSectionExtensions);

  const editor = useEditor({
    immediatelyRender: false,
    extensions,
    content: value,
    editorProps: {
      attributes: {
        role: "textbox",
        "aria-multiline": "true",
        "aria-labelledby": labelId,
        ...(describedBy !== undefined ? { "aria-describedby": describedBy } : {}),
        ...(invalid === true ? { "aria-invalid": "true" } : {}),
        ...(testId !== undefined ? { "data-testid": testId } : {}),
        lang,
        class: cn(PROSE, "min-h-40 px-3 py-2.5 outline-none"),
      },
    },
    onUpdate: ({ editor: current }) => {
      const html = htmlOf(current);
      emitted.current = html;
      onChangeRef.current(html);
    },
  });

  // Outside changes: "Poništi izmene", "Kopiraj iz srpskog", a fresh server version.
  useEffect(() => {
    if (editor === null || value === emitted.current) return;
    emitted.current = value;
    editor.commands.setContent(value, { emitUpdate: false });
  }, [editor, value]);

  return (
    <div
      className={cn(
        "overflow-hidden rounded-md border bg-background transition-[border-color,box-shadow] duration-150 focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50",
        invalid === true && "border-destructive",
      )}
    >
      {editor !== null ? <Toolbar editor={editor} /> : <div className="h-10 border-b bg-muted/40" />}
      <EditorContent editor={editor} />
    </div>
  );
}

type ToolKey = "h3" | "bold" | "italic" | "bullet" | "ordered" | "quote";

const TOOLS: readonly { key: ToolKey; label: string; icon: LucideIcon }[] = [
  { key: "h3", label: "Podnaslov", icon: Heading3 },
  { key: "bold", label: "Podebljano (Ctrl+B)", icon: Bold },
  { key: "italic", label: "Kurziv (Ctrl+I)", icon: Italic },
  { key: "bullet", label: "Lista sa tačkama", icon: List },
  { key: "ordered", label: "Numerisana lista", icon: ListOrdered },
  { key: "quote", label: "Citat", icon: Quote },
];

function run(editor: Editor, key: ToolKey): void {
  const chain = editor.chain().focus();
  if (key === "h3") chain.toggleHeading({ level: 3 }).run();
  else if (key === "bold") chain.toggleBold().run();
  else if (key === "italic") chain.toggleItalic().run();
  else if (key === "bullet") chain.toggleBulletList().run();
  else if (key === "ordered") chain.toggleOrderedList().run();
  else chain.toggleBlockquote().run();
}

function Toolbar({ editor }: { editor: Editor }) {
  const state = useEditorState({
    editor,
    selector: ({ editor: current }) => ({
      h3: current.isActive("heading", { level: 3 }),
      bold: current.isActive("bold"),
      italic: current.isActive("italic"),
      bullet: current.isActive("bulletList"),
      ordered: current.isActive("orderedList"),
      quote: current.isActive("blockquote"),
      link: current.isActive("link"),
      href: (current.getAttributes("link").href as string | undefined) ?? "",
      canUndo: current.can().undo(),
      canRedo: current.can().redo(),
    }),
  });

  return (
    <div role="toolbar" aria-label="Oblikovanje teksta" className="flex flex-wrap items-center gap-0.5 border-b bg-muted/40 px-1 py-1">
      {TOOLS.map((tool) => (
        <Button
          key={tool.key}
          type="button"
          variant="ghost"
          size="icon"
          aria-label={tool.label}
          title={tool.label}
          aria-pressed={state[tool.key]}
          onClick={() => run(editor, tool.key)}
          className="aria-pressed:bg-background aria-pressed:text-foreground"
        >
          <tool.icon aria-hidden="true" />
        </Button>
      ))}
      <LinkButton editor={editor} active={state.link} href={state.href} />
      <span aria-hidden="true" className="mx-1 h-5 w-px bg-border" />
      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-label="Opozovi (Ctrl+Z)"
        title="Opozovi (Ctrl+Z)"
        disabled={!state.canUndo}
        onClick={() => editor.chain().focus().undo().run()}
      >
        <Undo2 aria-hidden="true" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-label="Ponovi (Ctrl+Y)"
        title="Ponovi (Ctrl+Y)"
        disabled={!state.canRedo}
        onClick={() => editor.chain().focus().redo().run()}
      >
        <Redo2 aria-hidden="true" />
      </Button>
    </div>
  );
}

function LinkButton({ editor, active, href }: { editor: Editor; active: boolean; href: string }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const id = useId();

  const apply = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    // A form inside a form is invalid HTML; this one is portalled, but the
    // submit must still not reach the page form.
    event.stopPropagation();
    const target = withScheme(draft);
    if (!PAGE_SAFE_HREF.test(target)) {
      setError("Unesite adresu koja počinje sa https://, mailto:, tel: ili / za stranicu sajta.");
      return;
    }
    editor.chain().focus().extendMarkRange("link").setLink({ href: target }).run();
    setOpen(false);
  };

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) {
          setDraft(href);
          setError(null);
        }
      }}
    >
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Link"
          title="Link"
          aria-pressed={active}
          className="aria-pressed:bg-background aria-pressed:text-foreground"
        >
          <Link2 aria-hidden="true" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80">
        <form onSubmit={apply} className="flex flex-col gap-2">
          <Label htmlFor={`${id}-href`}>Adresa linka</Label>
          <Input
            id={`${id}-href`}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="https://… ili /sr/kontakt"
            aria-invalid={error !== null || undefined}
            aria-describedby={error !== null ? `${id}-error` : undefined}
            autoFocus
          />
          {error !== null ? (
            <p id={`${id}-error`} className="text-xs font-medium text-destructive">
              {error}
            </p>
          ) : null}
          <div className="mt-1 flex justify-end gap-2">
            {active ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  editor.chain().focus().extendMarkRange("link").unsetLink().run();
                  setOpen(false);
                }}
              >
                Ukloni link
              </Button>
            ) : null}
            <Button type="submit" size="sm">
              Primeni
            </Button>
          </div>
        </form>
      </PopoverContent>
    </Popover>
  );
}
