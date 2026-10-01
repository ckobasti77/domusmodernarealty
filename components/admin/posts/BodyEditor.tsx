"use client";

import Image from "@tiptap/extension-image";
import Placeholder from "@tiptap/extension-placeholder";
import { EditorContent, useEditor, useEditorState, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import {
  Bold,
  Heading2,
  Heading3,
  ImagePlus,
  Italic,
  Link2,
  List,
  ListOrdered,
  Quote,
  Redo2,
  Undo2,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { LOCALE_LANG } from "@/components/admin/listings/editor/LocaleTabs";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { Id } from "@/convex/_generated/dataModel";
import type { L10nKey } from "@/convex/lib/validators";
import { isAllowedHref } from "@/lib/content/sanitize";
import { cn } from "@/lib/utils";
import { ImageDialog, type InsertedImage } from "./ImageDialog";
import { LinkDialog, type LinkValue } from "./LinkDialog";
import { POST_PROSE } from "./shared";

/**
 * The article body for one locale (Tiptap 3). Loaded with `next/dynamic`
 * (`ssr: false`) by the editor screen. It produces only what
 * `lib/content/sanitize.ts` keeps: h2/h3, paragraphs, bold, italic,
 * underline, strike, lists, quotes, rules, links and images.
 */

const PLACEHOLDER_STYLES = [
  "[&_p.is-editor-empty:first-child]:before:pointer-events-none",
  "[&_p.is-editor-empty:first-child]:before:float-left",
  "[&_p.is-editor-empty:first-child]:before:h-0",
  "[&_p.is-editor-empty:first-child]:before:text-muted-foreground",
  "[&_p.is-editor-empty:first-child]:before:content-[attr(data-placeholder)]",
].join(" ");

function buildExtensions() {
  return [
    StarterKit.configure({
      heading: { levels: [2, 3] },
      code: false,
      codeBlock: false,
      link: {
        openOnClick: false,
        autolink: true,
        linkOnPaste: true,
        defaultProtocol: "https",
        isAllowedUri: (url) => isAllowedHref(url),
        shouldAutoLink: (url) => isAllowedHref(url),
        HTMLAttributes: { target: null, rel: null, class: null },
      },
    }),
    Image.configure({ inline: false, allowBase64: false }),
    Placeholder.configure({ placeholder: "Počnite da pišete…" }),
  ];
}

/** The editor's HTML, or "" for an empty document (Tiptap reports `<p></p>`). */
function htmlOf(editor: Editor): string {
  return editor.isEmpty ? "" : editor.getHTML();
}

export function BodyEditor({
  postId,
  locale,
  value,
  onChange,
  labelId,
}: {
  postId: Id<"posts">;
  locale: L10nKey;
  value: string;
  onChange: (html: string) => void;
  /** The id of the visible label that names the text area. */
  labelId: string;
}) {
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  });
  // The HTML this editor last reported, so a value that comes back from the
  // form does not reset the document (and the caret) on every keystroke.
  const emitted = useRef(value);

  // Stable options: `useEditor` compares them on every render and would
  // otherwise re-apply them on each keystroke. The content is initial only;
  // later changes arrive through the effect below.
  const [initialContent] = useState(value);
  const extensions = useMemo(() => buildExtensions(), []);
  const editorProps = useMemo(
    () => ({
      attributes: {
        "data-testid": "post-body-editor",
        "data-locale": locale,
        role: "textbox",
        "aria-multiline": "true",
        "aria-labelledby": labelId,
        lang: LOCALE_LANG[locale],
        class: cn(
          POST_PROSE,
          PLACEHOLDER_STYLES,
          "min-h-80 px-4 py-3 outline-none [&_img.ProseMirror-selectednode]:ring-2 [&_img.ProseMirror-selectednode]:ring-ring",
        ),
      },
    }),
    [locale, labelId],
  );

  const editor = useEditor({
    immediatelyRender: false,
    extensions,
    content: initialContent,
    editorProps,
    onUpdate: ({ editor: current }) => {
      const html = htmlOf(current);
      emitted.current = html;
      onChangeRef.current(html);
    },
  });

  // Outside changes (reset, "Kopiraj iz srpskog", a fresh server version).
  useEffect(() => {
    if (editor === null || value === emitted.current) return;
    emitted.current = value;
    editor.commands.setContent(value, { emitUpdate: false });
  }, [editor, value]);

  return (
    <div className="overflow-hidden rounded-lg border bg-background focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50">
      {editor !== null ? <Toolbar editor={editor} postId={postId} /> : <div className="h-11 border-b bg-muted/40" />}
      <EditorContent editor={editor} />
    </div>
  );
}

type ToolKey = "h2" | "h3" | "bold" | "italic" | "bullet" | "ordered" | "quote";

const TOOLS: readonly { key: ToolKey; label: string; shortcut?: string; icon: LucideIcon }[] = [
  { key: "h2", label: "Podnaslov (H2)", shortcut: "Ctrl+Alt+2", icon: Heading2 },
  { key: "h3", label: "Manji podnaslov (H3)", shortcut: "Ctrl+Alt+3", icon: Heading3 },
  { key: "bold", label: "Podebljano", shortcut: "Ctrl+B", icon: Bold },
  { key: "italic", label: "Kurziv", shortcut: "Ctrl+I", icon: Italic },
  { key: "bullet", label: "Lista sa tačkama", shortcut: "Ctrl+Shift+8", icon: List },
  { key: "ordered", label: "Numerisana lista", shortcut: "Ctrl+Shift+7", icon: ListOrdered },
  { key: "quote", label: "Citat", shortcut: "Ctrl+Shift+B", icon: Quote },
];

function run(editor: Editor, key: ToolKey): void {
  const chain = editor.chain().focus();
  if (key === "h2") chain.toggleHeading({ level: 2 }).run();
  else if (key === "h3") chain.toggleHeading({ level: 3 }).run();
  else if (key === "bold") chain.toggleBold().run();
  else if (key === "italic") chain.toggleItalic().run();
  else if (key === "bullet") chain.toggleBulletList().run();
  else if (key === "ordered") chain.toggleOrderedList().run();
  else chain.toggleBlockquote().run();
}

/** Arrow keys move between toolbar buttons (WAI-ARIA toolbar pattern). */
function onToolbarKeyDown(event: KeyboardEvent<HTMLDivElement>): void {
  if (event.key !== "ArrowRight" && event.key !== "ArrowLeft" && event.key !== "Home" && event.key !== "End") return;
  const buttons = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>("button:not(:disabled)"));
  const index = buttons.findIndex((button) => button === document.activeElement);
  if (index === -1) return;
  event.preventDefault();
  const next =
    event.key === "Home"
      ? 0
      : event.key === "End"
        ? buttons.length - 1
        : (index + (event.key === "ArrowRight" ? 1 : -1) + buttons.length) % buttons.length;
  buttons[next]?.focus();
}

function ToolButton({
  label,
  shortcut,
  icon: Icon,
  pressed,
  disabled,
  onClick,
}: {
  label: string;
  shortcut?: string;
  icon: LucideIcon;
  pressed?: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={label}
          aria-pressed={pressed}
          disabled={disabled}
          onClick={onClick}
          className="aria-pressed:bg-muted aria-pressed:text-foreground"
        >
          <Icon aria-hidden="true" />
        </Button>
      </TooltipTrigger>
      <TooltipContent>
        {label}
        {shortcut !== undefined ? <span className="ml-1.5 font-mono opacity-70">{shortcut}</span> : null}
      </TooltipContent>
    </Tooltip>
  );
}

function Toolbar({ editor, postId }: { editor: Editor; postId: Id<"posts"> }) {
  const state = useEditorState({
    editor,
    selector: ({ editor: current }) => ({
      h2: current.isActive("heading", { level: 2 }),
      h3: current.isActive("heading", { level: 3 }),
      bold: current.isActive("bold"),
      italic: current.isActive("italic"),
      bullet: current.isActive("bulletList"),
      ordered: current.isActive("orderedList"),
      quote: current.isActive("blockquote"),
      link: current.isActive("link"),
      image: current.isActive("image"),
      canUndo: current.can().undo(),
      canRedo: current.can().redo(),
    }),
  });
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkInitial, setLinkInitial] = useState<LinkValue>({ href: "", newTab: false });
  const [imageOpen, setImageOpen] = useState(false);
  const [imageAlt, setImageAlt] = useState<string | null>(null);

  const openLink = () => {
    const attrs = editor.getAttributes("link");
    setLinkInitial({
      href: typeof attrs.href === "string" ? attrs.href : "",
      newTab: attrs.target === "_blank",
    });
    setLinkOpen(true);
  };

  const applyLink = ({ href, newTab }: LinkValue) => {
    const attrs = { href, target: newTab ? "_blank" : null, rel: newTab ? "noopener noreferrer" : null };
    const chain = editor.chain().focus().extendMarkRange("link");
    if (editor.state.selection.empty && !editor.isActive("link")) {
      chain.insertContent({ type: "text", text: href, marks: [{ type: "link", attrs }] }).run();
    } else {
      chain.setLink(attrs).run();
    }
  };

  const openImage = () => {
    const alt = editor.getAttributes("image").alt;
    setImageAlt(editor.isActive("image") ? (typeof alt === "string" ? alt : "") : null);
    setImageOpen(true);
  };

  const applyImage = (image: InsertedImage) => {
    if (image.kind === "alt") {
      editor.chain().focus().updateAttributes("image", { alt: image.alt }).run();
      return;
    }
    editor
      .chain()
      .focus()
      .setImage({
        src: image.src,
        alt: image.alt,
        ...(image.width !== undefined ? { width: image.width } : {}),
        ...(image.height !== undefined ? { height: image.height } : {}),
      })
      .run();
  };

  return (
    <>
      <div
        role="toolbar"
        aria-label="Oblikovanje teksta"
        onKeyDown={onToolbarKeyDown}
        className="flex flex-wrap items-center gap-0.5 border-b bg-muted/40 px-1.5 py-1"
      >
        {TOOLS.map((tool) => (
          <ToolButton
            key={tool.key}
            label={tool.label}
            shortcut={tool.shortcut}
            icon={tool.icon}
            pressed={state[tool.key]}
            onClick={() => run(editor, tool.key)}
          />
        ))}
        <Separator orientation="vertical" className="mx-1 h-5" />
        <ToolButton
          label={state.link ? "Izmenite link" : "Link"}
          shortcut="Ctrl+K"
          icon={Link2}
          pressed={state.link}
          onClick={openLink}
        />
        <ToolButton
          label={state.image ? "Opis slike" : "Umetnite sliku"}
          icon={ImagePlus}
          pressed={state.image}
          onClick={openImage}
        />
        <Separator orientation="vertical" className="mx-1 h-5" />
        <ToolButton
          label="Poništi"
          shortcut="Ctrl+Z"
          icon={Undo2}
          disabled={!state.canUndo}
          onClick={() => editor.chain().focus().undo().run()}
        />
        <ToolButton
          label="Ponovi"
          shortcut="Ctrl+Shift+Z"
          icon={Redo2}
          disabled={!state.canRedo}
          onClick={() => editor.chain().focus().redo().run()}
        />
      </div>
      <LinkDialog
        open={linkOpen}
        onOpenChange={setLinkOpen}
        initial={linkInitial}
        onApply={applyLink}
        onRemove={() => editor.chain().focus().extendMarkRange("link").unsetLink().run()}
      />
      <ImageDialog
        open={imageOpen}
        onOpenChange={setImageOpen}
        postId={postId}
        editAlt={imageAlt}
        onApply={applyImage}
      />
      <LinkShortcut editor={editor} onOpen={openLink} />
    </>
  );
}

/**
 * Ctrl/⌘+K inside the text opens the link dialog instead of the panel's
 * command palette (which listens on `window`, so propagation stops here).
 */
function LinkShortcut({ editor, onOpen }: { editor: Editor; onOpen: () => void }) {
  const onOpenRef = useRef(onOpen);
  useEffect(() => {
    onOpenRef.current = onOpen;
  });
  useEffect(() => {
    const dom = editor.view.dom;
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && !event.altKey && event.key.toLowerCase() === "k") {
        event.preventDefault();
        event.stopPropagation();
        onOpenRef.current();
      }
    };
    dom.addEventListener("keydown", onKeyDown);
    return () => dom.removeEventListener("keydown", onKeyDown);
  }, [editor]);
  return null;
}
