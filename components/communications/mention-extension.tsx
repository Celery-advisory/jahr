"use client";

import { ReactRenderer } from "@tiptap/react";
import type { SuggestionOptions, SuggestionProps } from "@tiptap/suggestion";
import tippy, { type Instance as TippyInstance } from "tippy.js";
import "tippy.js/dist/tippy.css";
import type { MentionCandidate } from "@/lib/communications/types";
import {
  MentionList,
  type MentionListHandle,
} from "@/components/communications/mention-list";

export function createMentionSuggestion(
  candidatesRef: { readonly current: MentionCandidate[] },
): Omit<SuggestionOptions<MentionCandidate>, "editor"> {
  return {
    char: "@",
    allowSpaces: false,
    items: ({ query }) => {
      const normalized = query.trim().toLowerCase();
      return candidatesRef.current
        .filter((candidate) => {
          if (!normalized) return true;
          return (
            candidate.label.toLowerCase().includes(normalized) ||
            (candidate.jobTitle?.toLowerCase().includes(normalized) ?? false)
          );
        })
        .slice(0, 8);
    },
    render: () => {
      let component: ReactRenderer<MentionListHandle> | null = null;
      let popup: TippyInstance[] | null = null;

      return {
        onStart: (props: SuggestionProps<MentionCandidate>) => {
          component = new ReactRenderer(MentionList, {
            props: {
              items: props.items,
              command: (item: MentionCandidate) => {
                props.command({ id: item.id, label: item.label });
              },
            },
            editor: props.editor,
          });

          if (!props.clientRect) return;

          popup = tippy("body", {
            getReferenceClientRect: props.clientRect as () => DOMRect,
            appendTo: () => document.body,
            content: component.element,
            showOnCreate: true,
            interactive: true,
            trigger: "manual",
            placement: "bottom-start",
          });
        },
        onUpdate: (props: SuggestionProps<MentionCandidate>) => {
          component?.updateProps({
            items: props.items,
            command: (item: MentionCandidate) => {
              props.command({ id: item.id, label: item.label });
            },
          });

          if (!popup?.[0] || !props.clientRect) return;
          popup[0].setProps({
            getReferenceClientRect: props.clientRect as () => DOMRect,
          });
        },
        onKeyDown: (props: { event: KeyboardEvent }) => {
          if (props.event.key === "Escape") {
            popup?.[0]?.hide();
            return true;
          }
          return component?.ref?.onKeyDown(props.event) ?? false;
        },
        onExit: () => {
          popup?.[0]?.destroy();
          component?.destroy();
          popup = null;
          component = null;
        },
      };
    },
  };
}
