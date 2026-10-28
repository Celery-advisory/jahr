"use client";

import { useEffect, useRef } from "react";
import Mention from "@tiptap/extension-mention";
import Placeholder from "@tiptap/extension-placeholder";
import Underline from "@tiptap/extension-underline";
import Link from "@tiptap/extension-link";
import StarterKit from "@tiptap/starter-kit";
import {
  EditorContent,
  useEditor,
  type Editor,
} from "@tiptap/react";
import { createMentionSuggestion } from "@/components/communications/mention-extension";
import { RichTextToolbar } from "@/components/communications/rich-text-toolbar";
import { normalizeEditorHref } from "@/lib/communications/href";
import { sanitizeTipTapJson } from "@/lib/communications/tiptap-links";
import {
  EMPTY_DOC,
  type JSONContent,
  type MentionCandidate,
} from "@/lib/communications/types";
import { cn } from "@/lib/utils";

export interface RichTextEditorProps {
  value: JSONContent;
  onChange: (value: JSONContent) => void;
  onEditorReady?: (editor: Editor | null) => void;
  mentionCandidates?: MentionCandidate[];
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  onSubmitShortcut?: () => void;
  "aria-label"?: string;
}

export function RichTextEditor({
  value,
  onChange,
  onEditorReady,
  mentionCandidates = [],
  placeholder = "Write your announcement",
  disabled = false,
  className,
  onSubmitShortcut,
  "aria-label": ariaLabel = "Message body",
}: RichTextEditorProps) {
  const mentionCandidatesRef = useRef(mentionCandidates);
  const onSubmitShortcutRef = useRef(onSubmitShortcut);

  useEffect(() => {
    mentionCandidatesRef.current = mentionCandidates;
    onSubmitShortcutRef.current = onSubmitShortcut;
  }, [mentionCandidates, onSubmitShortcut]);

  const editor = useEditor({
    immediatelyRender: false,
    editable: !disabled,
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
        link: false,
        underline: false,
      }),
      Underline,
      Link.configure({
        openOnClick: false,
        autolink: true,
        defaultProtocol: "https",
        protocols: ["http", "https", "mailto"],
        HTMLAttributes: {
          rel: "noopener noreferrer",
          target: "_blank",
        },
        isAllowedUri: (url) => {
          if (!url?.trim()) return false;
          return normalizeEditorHref(url) !== null;
        },
      }),
      Placeholder.configure({ placeholder }),
      Mention.configure({
        HTMLAttributes: {
          class:
            "rounded-sm bg-[color-mix(in_srgb,#0070F3_12%,white)] px-1 py-0.5 font-medium text-[#0B4FBF]",
        },
        // The ref is only read inside TipTap's `items` callback, never during render.
        // eslint-disable-next-line react-hooks/refs
        suggestion: createMentionSuggestion(mentionCandidatesRef),
      }),
    ],
    content: value ?? EMPTY_DOC,
    editorProps: {
      attributes: {
        "aria-label": ariaLabel,
        class: cn(
          "prose-comms min-h-36 max-h-[min(28rem,50vh)] overflow-y-auto px-3 py-2.5 text-sm leading-relaxed outline-none",
          "focus-visible:outline-none",
        ),
      },
      handleKeyDown: (_view, event) => {
        if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
          event.preventDefault();
          onSubmitShortcutRef.current?.();
          return true;
        }
        return false;
      },
    },
    onUpdate: ({ editor: current }) => {
      onChange(sanitizeTipTapJson(current.getJSON()));
    },
  });

  useEffect(() => {
    onEditorReady?.(editor);
    return () => onEditorReady?.(null);
  }, [editor, onEditorReady]);

  useEffect(() => {
    if (!editor) return;
    editor.setEditable(!disabled);
  }, [editor, disabled]);

  useEffect(() => {
    if (!editor) return;
    const current = JSON.stringify(editor.getJSON());
    const next = JSON.stringify(value ?? EMPTY_DOC);
    if (current !== next) {
      editor.commands.setContent(value ?? EMPTY_DOC, { emitUpdate: false });
    }
  }, [editor, value]);
  return (
    <div
      className={cn(
        "overflow-hidden rounded-md border border-border bg-background focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50",
        disabled && "opacity-60",
        className,
      )}
    >
      <RichTextToolbar editor={editor} disabled={disabled} />
      <EditorContent editor={editor} />
    </div>
  );
}
