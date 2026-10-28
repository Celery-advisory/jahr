"use client";

import { useRef, useState } from "react";
import type { Editor } from "@tiptap/react";
import {
  Bold,
  Heading2,
  Italic,
  Link2,
  List,
  ListOrdered,
  Quote,
  Redo2,
  RemoveFormatting,
  Strikethrough,
  Underline,
  Undo2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { normalizeEditorHref } from "@/lib/communications/href";
import {
  applyEditorLink,
  removeEditorLink,
} from "@/lib/communications/link-editor";
import { cn } from "@/lib/utils";

interface RichTextToolbarProps {
  editor: Editor | null;
  disabled?: boolean;
}

function ToolbarButton({
  label,
  active,
  disabled,
  onClick,
  children,
}: {
  label: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            disabled={disabled}
            aria-label={label}
            aria-pressed={active}
            onClick={onClick}
            className={cn(
              "text-muted-foreground",
              active && "bg-secondary text-foreground",
            )}
          />
        }
      >
        {children}
      </TooltipTrigger>
      <TooltipContent side="top">{label}</TooltipContent>
    </Tooltip>
  );
}

function LinkToolbarControl({
  editor,
  disabled,
}: {
  editor: Editor;
  disabled: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  function handleOpenChange(next: boolean) {
    if (next) {
      const current = editor.getAttributes("link").href;
      setUrl(typeof current === "string" && current.length > 0 ? current : "");
      setError(null);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
    setOpen(next);
  }

  function handleApply(event: React.FormEvent) {
    event.preventDefault();
    const trimmed = url.trim();

    if (!trimmed) {
      removeEditorLink(editor);
      setOpen(false);
      return;
    }

    const href = normalizeEditorHref(trimmed);
    if (!href) {
      setError("Enter a valid URL, email, or domain.");
      return;
    }

    if (!applyEditorLink(editor, href, trimmed)) {
      setError("Could not apply that link.");
      return;
    }

    setOpen(false);
  }

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <Tooltip>
        <TooltipTrigger
          render={
            <PopoverTrigger
              render={
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  disabled={disabled}
                  aria-label="Link"
                  aria-pressed={editor.isActive("link")}
                  className={cn(
                    "text-muted-foreground",
                    editor.isActive("link") && "bg-secondary text-foreground",
                  )}
                >
                  <Link2 />
                </Button>
              }
            />
          }
        />
        <TooltipContent side="top">Link</TooltipContent>
      </Tooltip>
      <PopoverContent align="start" className="w-80 gap-3 p-4">
        <PopoverHeader>
          <PopoverTitle>Link URL</PopoverTitle>
        </PopoverHeader>
        <form className="flex flex-col gap-3" onSubmit={handleApply}>
          <div className="space-y-2">
            <Label htmlFor="comms-link-url">Address</Label>
            <Input
              ref={inputRef}
              id="comms-link-url"
              value={url}
              onChange={(event) => {
                setUrl(event.target.value);
                if (error) setError(null);
              }}
              placeholder="https://example.com"
              autoComplete="off"
              spellCheck={false}
            />
          </div>
          {error ? (
            <p className="text-xs text-destructive" role="alert">
              {error}
            </p>
          ) : null}
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" size="sm">
              Apply
            </Button>
          </div>
        </form>
      </PopoverContent>
    </Popover>
  );
}

export function RichTextToolbar({ editor, disabled }: RichTextToolbarProps) {
  if (!editor) return null;

  const busy = disabled || !editor.isEditable;

  return (
    <TooltipProvider delay={200}>
      <div
        className="flex flex-wrap items-center gap-0.5 border-b border-border px-2 py-1.5"
        role="toolbar"
        aria-label="Formatting"
      >
        <ToolbarButton
          label="Bold"
          active={editor.isActive("bold")}
          disabled={busy}
          onClick={() => editor.chain().focus().toggleBold().run()}
        >
          <Bold />
        </ToolbarButton>
        <ToolbarButton
          label="Italic"
          active={editor.isActive("italic")}
          disabled={busy}
          onClick={() => editor.chain().focus().toggleItalic().run()}
        >
          <Italic />
        </ToolbarButton>
        <ToolbarButton
          label="Underline"
          active={editor.isActive("underline")}
          disabled={busy}
          onClick={() => editor.chain().focus().toggleUnderline().run()}
        >
          <Underline />
        </ToolbarButton>
        <ToolbarButton
          label="Strikethrough"
          active={editor.isActive("strike")}
          disabled={busy}
          onClick={() => editor.chain().focus().toggleStrike().run()}
        >
          <Strikethrough />
        </ToolbarButton>

        <span className="mx-1 h-4 w-px bg-border" aria-hidden />

        <ToolbarButton
          label="Heading"
          active={editor.isActive("heading", { level: 2 })}
          disabled={busy}
          onClick={() =>
            editor.chain().focus().toggleHeading({ level: 2 }).run()
          }
        >
          <Heading2 />
        </ToolbarButton>
        <ToolbarButton
          label="Bullet list"
          active={editor.isActive("bulletList")}
          disabled={busy}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
        >
          <List />
        </ToolbarButton>
        <ToolbarButton
          label="Numbered list"
          active={editor.isActive("orderedList")}
          disabled={busy}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
        >
          <ListOrdered />
        </ToolbarButton>
        <ToolbarButton
          label="Quote"
          active={editor.isActive("blockquote")}
          disabled={busy}
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
        >
          <Quote />
        </ToolbarButton>
        <LinkToolbarControl editor={editor} disabled={busy} />

        <span className="mx-1 h-4 w-px bg-border" aria-hidden />

        <ToolbarButton
          label="Undo"
          disabled={busy || !editor.can().undo()}
          onClick={() => editor.chain().focus().undo().run()}
        >
          <Undo2 />
        </ToolbarButton>
        <ToolbarButton
          label="Redo"
          disabled={busy || !editor.can().redo()}
          onClick={() => editor.chain().focus().redo().run()}
        >
          <Redo2 />
        </ToolbarButton>
        <ToolbarButton
          label="Clear formatting"
          disabled={busy}
          onClick={() =>
            editor.chain().focus().unsetAllMarks().clearNodes().run()
          }
        >
          <RemoveFormatting />
        </ToolbarButton>
      </div>
    </TooltipProvider>
  );
}
