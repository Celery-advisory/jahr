"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { previewAnnouncementEmail } from "@/lib/announcements/actions";
import type { AnnouncementType } from "@/lib/announcements/categories";
import { sanitizeTipTapJson } from "@/lib/communications/tiptap-links";
import type { JSONContent } from "@/lib/communications/types";

export interface CommsEmailPreviewDraft {
  title: string;
  announcementType: AnnouncementType;
  bodyJson: JSONContent;
  attachmentNames: string[];
}

/** Debounce keeps typing from firing a render request per keystroke. */
const PREVIEW_DEBOUNCE_MS = 500;

export function CommsEmailPreview({
  draft,
  disabled,
}: {
  draft: CommsEmailPreviewDraft;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [html, setHtml] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const draftSignature = useMemo(() => JSON.stringify(draft), [draft]);
  const draftRef = useRef(draft);
  const requestId = useRef(0);

  // Declared before the preview effect so the debounced request reads the latest draft.
  useEffect(() => {
    draftRef.current = draft;
  }, [draft]);

  useEffect(() => {
    if (!open) return;

    const timer = setTimeout(() => {
      const currentRequest = ++requestId.current;
      setLoading(true);
      setError(null);

      void previewAnnouncementEmail({
        ...draftRef.current,
        bodyJson: sanitizeTipTapJson(draftRef.current.bodyJson),
      }).then((result) => {
        if (currentRequest !== requestId.current) return;
        setLoading(false);
        if (result.error) {
          setError(result.error);
          setHtml(null);
          return;
        }
        setError(null);
        setHtml(result.html ?? null);
      });
    }, PREVIEW_DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [open, draftSignature]);

  const showSkeleton = loading || (!html && !error);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        render={
          <Button type="button" variant="outline" disabled={disabled}>
            <Mail />
            Preview email
          </Button>
        }
      />
      <SheetContent className="w-full gap-0 sm:max-w-170">
        <SheetHeader className="border-b p-4 pr-14">
          <SheetTitle>Email preview</SheetTitle>
          <SheetDescription>
            How this announcement appears in inboxes.
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto p-4">
          {error ? (
            <p className="text-sm text-destructive">{error}</p>
          ) : showSkeleton ? (
            <div className="space-y-3">
              <Skeleton className="h-6 w-2/3" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
            </div>
          ) : html ? (
            <div
              className="prose prose-sm max-w-none text-foreground"
              dangerouslySetInnerHTML={{ __html: html }}
            />
          ) : (
            <p className="text-sm text-muted-foreground">
              Preview could not be generated.
            </p>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
