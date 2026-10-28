"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Building2,
  Check,
  House,
  Laptop,
  Megaphone,
  Users,
} from "lucide-react";
import { CommsEmailPreview } from "@/components/admin/comms-email-preview";
import { MessageComposer } from "@/components/communications/message-composer";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import {
  previewAnnouncementAudience,
  publishAnnouncement,
} from "@/lib/announcements/actions";
import type {
  AnnouncementCategory,
  AnnouncementType,
} from "@/lib/announcements/categories";
import {
  DEFAULT_ANNOUNCEMENT_CATEGORY,
  DEFAULT_ANNOUNCEMENT_TYPE,
  getAnnouncementCategory,
} from "@/lib/announcements/categories";
import { sanitizeTipTapJson } from "@/lib/communications/tiptap-links";
import { isTipTapDocEmpty } from "@/lib/communications/plain-text";
import {
  EMPTY_DOC,
  type JSONContent,
  type MentionCandidate,
  type PendingAttachment,
} from "@/lib/communications/types";
import type { WorkType } from "@/lib/types/employee";
import { cn } from "@/lib/utils";
import { useAsyncAction } from "@/lib/hooks/use-async-action";

const WORK_TYPE_OPTIONS: Array<{
  value: WorkType;
  label: string;
  hint: string;
  icon: typeof Building2;
  accent: string;
}> = [
  {
    value: "onsite",
    label: "Onsite",
    hint: "In the office",
    icon: Building2,
    accent: "#55A8FD",
  },
  {
    value: "hybrid",
    label: "Hybrid",
    hint: "Split week",
    icon: Laptop,
    accent: "#2EC4B6",
  },
  {
    value: "remote",
    label: "Remote",
    hint: "From home",
    icon: House,
    accent: "#8B7CF8",
  },
];

const UNIT_ACCENTS: Record<string, string> = {
  "JA Digital": "#55A8FD",
  "JA Wealth": "#F6B93B",
  "JA Realty": "#FF7A59",
  "JA Elements": "#2EC4B6",
};

function tint(color: string, percent: number): string {
  return `color-mix(in srgb, ${color} ${percent}%, white)`;
}

function unitAccent(name: string): string {
  return UNIT_ACCENTS[name] ?? "#0070F3";
}

function joinNames(names: string[]): string {
  if (names.length === 0) return "";
  if (names.length === 1) return names[0];
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names.slice(0, -1).join(", ")}, and ${names[names.length - 1]}`;
}

function workStylePhrase(types: WorkType[]): string {
  const labels = types.map((type) => {
    if (type === "onsite") return "onsite";
    if (type === "hybrid") return "hybrid";
    return "remote";
  });
  return `${joinNames(labels)} workers`;
}

function describeAudience(input: {
  selectedUnitNames: string[];
  selectedWorkTypes: WorkType[];
  allUnitsSelected: boolean;
  allWorkTypesSelected: boolean;
}): string {
  const {
    selectedUnitNames,
    selectedWorkTypes,
    allUnitsSelected,
    allWorkTypesSelected,
  } = input;

  if (allUnitsSelected && allWorkTypesSelected) {
    return "This goes to everyone at JA Group.";
  }

  if (allUnitsSelected) {
    return `This goes to ${workStylePhrase(selectedWorkTypes)} across JA Group.`;
  }

  if (allWorkTypesSelected) {
    return `This goes to everyone at ${joinNames(selectedUnitNames)}.`;
  }

  return `This goes to ${workStylePhrase(selectedWorkTypes)} at ${joinNames(selectedUnitNames)}.`;
}

interface CommsComposerInitialDraft {
  title: string;
  category: AnnouncementCategory;
  announcementType: AnnouncementType;
  bodyJson: JSONContent;
  businessUnitIds: string[];
  workTypes: WorkType[];
}

interface CommsComposerFormProps {
  businessUnits: Array<{ id: string; name: string }>;
  mentionCandidates: MentionCandidate[];
  initialDraft?: CommsComposerInitialDraft | null;
}

export function CommsComposerForm({
  businessUnits,
  mentionCandidates,
  initialDraft = null,
}: CommsComposerFormProps) {
  const router = useRouter();
  const [title, setTitle] = useState(initialDraft?.title ?? "");
  const [announcementType, setAnnouncementType] = useState<AnnouncementType>(
    initialDraft?.announcementType ?? DEFAULT_ANNOUNCEMENT_TYPE,
  );
  const [category, setCategory] = useState<AnnouncementCategory>(
    initialDraft?.category ??
      getAnnouncementCategory(
        initialDraft?.announcementType ?? DEFAULT_ANNOUNCEMENT_TYPE,
      ) ??
      DEFAULT_ANNOUNCEMENT_CATEGORY,
  );
  const [bodyJson, setBodyJson] = useState<JSONContent>(
    initialDraft ? sanitizeTipTapJson(initialDraft.bodyJson) : EMPTY_DOC,
  );
  const [pendingAttachments, setPendingAttachments] = useState<
    PendingAttachment[]
  >([]);
  const [businessUnitIds, setBusinessUnitIds] = useState<string[]>(
    initialDraft?.businessUnitIds ?? [],
  );
  const [workTypes, setWorkTypes] = useState<WorkType[]>(
    initialDraft?.workTypes ?? [],
  );
  const [audienceCount, setAudienceCount] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(
    initialDraft
      ? "From a past announcement. Publish to email again."
      : null,
  );
  const [confirmOpen, setConfirmOpen] = useState(false);
  const { pending, run } = useAsyncAction();
  // The count is stale until the request for the current selection lands.
  const audienceKey = JSON.stringify([businessUnitIds, workTypes]);
  const [countedKey, setCountedKey] = useState<string | null>(null);
  const counting = countedKey !== audienceKey;

  const wholeCompany =
    businessUnitIds.length === 0 && workTypes.length === 0;

  useEffect(() => {
    let cancelled = false;
    void previewAnnouncementAudience({
      businessUnitIds,
      workTypes,
    }).then((result) => {
      if (cancelled) return;
      if (!result.error) {
        setAudienceCount(result.count);
      }
      setCountedKey(audienceKey);
    });
    return () => {
      cancelled = true;
    };
  }, [audienceKey, businessUnitIds, workTypes]);

  const selectedUnitNames = useMemo(() => {
    if (businessUnitIds.length === 0) {
      return businessUnits.map((unit) => unit.name);
    }
    return businessUnits
      .filter((unit) => businessUnitIds.includes(unit.id))
      .map((unit) => unit.name);
  }, [businessUnitIds, businessUnits]);

  const effectiveWorkTypes = useMemo(
    () =>
      workTypes.length === 0
        ? WORK_TYPE_OPTIONS.map((option) => option.value)
        : workTypes,
    [workTypes],
  );

  const audienceSentence = useMemo(
    () =>
      describeAudience({
        selectedUnitNames,
        selectedWorkTypes: effectiveWorkTypes,
        allUnitsSelected: businessUnitIds.length === 0,
        allWorkTypesSelected: workTypes.length === 0,
      }),
    [
      selectedUnitNames,
      effectiveWorkTypes,
      businessUnitIds.length,
      workTypes.length,
    ],
  );

  function selectWholeCompany() {
    setBusinessUnitIds([]);
    setWorkTypes([]);
  }

  function toggleBusinessUnit(id: string) {
    setBusinessUnitIds((current) => {
      if (current.length === 0) {
        return [id];
      }
      if (current.includes(id)) {
        return current.filter((item) => item !== id);
      }
      const next = [...current, id];
      if (next.length === businessUnits.length) {
        return [];
      }
      return next;
    });
  }

  function toggleWorkType(value: WorkType) {
    setWorkTypes((current) => {
      if (current.length === 0) {
        return [value];
      }
      if (current.includes(value)) {
        return current.filter((item) => item !== value);
      }
      const next = [...current, value];
      if (next.length === WORK_TYPE_OPTIONS.length) {
        return [];
      }
      return next;
    });
  }

  function openConfirmIfValid() {
    if (pending || !canPublish) return;
    setError(null);
    setConfirmOpen(true);
  }

  function handleConfirmPublish() {
    if (pending) return;
    setError(null);
    setSuccess(null);
    void run(async () => {
      const result = await publishAnnouncement({
        title,
        announcementType,
        bodyJson: sanitizeTipTapJson(bodyJson),
        businessUnitIds,
        workTypes,
        files: pendingAttachments.map((item) => item.file),
      });

      if (result.error) {
        setError(result.error);
        return;
      }

      setConfirmOpen(false);
      router.push("/admin/comms");
    });
  }

  const canPublish = Boolean(title.trim() && !isTipTapDocEmpty(bodyJson));

  const audienceSlot = (
    <Card>
      <CardHeader className="border-b">
        <CardTitle>Audience</CardTitle>
        <CardDescription>
          Whole company, or filter by unit and work style.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
      <button
        type="button"
        onClick={selectWholeCompany}
        disabled={pending}
        className={cn(
          "flex w-full items-center gap-3 rounded-md border px-4 py-3 text-left transition-[background-color,border-color,transform] duration-150 ease-out active:scale-[0.99]",
          wholeCompany
            ? "border-[color-mix(in_srgb,#0070F3_35%,var(--border))]"
            : "border-border bg-background hover:bg-secondary/40",
        )}
        style={
          wholeCompany ? { background: tint("#0070F3", 8) } : undefined
        }
      >
        <div
          className="flex size-9 shrink-0 items-center justify-center rounded-md"
          style={{
            background: tint("#0070F3", wholeCompany ? 16 : 10),
            color: "#0070F3",
          }}
        >
          <Users className="size-4" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">Whole company</p>
          <p className="text-xs text-muted-foreground">
            Every active person across JA Group
          </p>
        </div>
        {wholeCompany ? (
          <Check className="size-4 shrink-0 text-[#0070F3]" />
        ) : null}
      </button>

      <div className="grid gap-2 sm:grid-cols-2">
        {businessUnits.map((unit) => {
          const accent = unitAccent(unit.name);
          const selected = businessUnitIds.includes(unit.id);

          return (
            <button
              key={unit.id}
              type="button"
              onClick={() => toggleBusinessUnit(unit.id)}
              disabled={pending}
              className={cn(
                "flex items-center gap-3 rounded-md border px-3.5 py-3 text-left transition-[background-color,border-color,transform] duration-150 ease-out active:scale-[0.98]",
                selected
                  ? undefined
                  : "border-border bg-background hover:bg-secondary/40",
              )}
              style={
                selected
                  ? {
                      background: tint(accent, 12),
                      borderColor: tint(accent, 42),
                    }
                  : undefined
              }
            >
              <span
                className="size-2.5 shrink-0 rounded-full"
                style={{
                  background: selected ? accent : "#C7CBD3",
                }}
                aria-hidden
              />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium tracking-tight">
                  {unit.name}
                </p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  {selected
                    ? "Selected"
                    : wholeCompany
                      ? "Included in whole company"
                      : "Not selected"}
                </p>
              </div>
              {selected ? (
                <Check
                  className="size-4 shrink-0"
                  style={{ color: accent }}
                />
              ) : null}
            </button>
          );
        })}
      </div>

      <div className="space-y-2">
        <p className="text-xs font-medium text-muted-foreground">Work style</p>
        <div className="grid grid-cols-3 gap-2">
          {WORK_TYPE_OPTIONS.map((option) => {
            const Icon = option.icon;
            const selected = workTypes.includes(option.value);

            return (
              <button
                key={option.value}
                type="button"
                onClick={() => toggleWorkType(option.value)}
                disabled={pending}
                className={cn(
                  "flex flex-col items-center gap-1.5 rounded-md border px-2 py-3 text-center transition-[background-color,border-color,transform] duration-150 ease-out active:scale-[0.97]",
                  selected
                    ? undefined
                    : "border-border bg-background text-muted-foreground hover:bg-secondary/40",
                )}
                style={
                  selected
                    ? {
                        background: tint(option.accent, 12),
                        borderColor: tint(option.accent, 42),
                        color: option.accent,
                      }
                    : undefined
                }
              >
                <Icon className="size-4" />
                <span
                  className={cn(
                    "text-xs font-medium",
                    selected ? "text-foreground" : undefined,
                  )}
                >
                  {option.label}
                </span>
                <span className="text-[10px] text-muted-foreground">
                  {option.hint}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div
        className="rounded-md border border-border px-4 py-3.5"
        style={{ background: tint("#55A8FD", 7) }}
      >
        <p className="text-sm font-medium leading-snug text-foreground">
          {audienceSentence}
        </p>
        <p className="mt-1.5 flex items-center gap-1.5 text-xs text-muted-foreground tabular-nums">
          {counting || audienceCount === null ? (
            <Spinner className="size-3" />
          ) : (
            `${audienceCount} active employee${
              audienceCount === 1 ? "" : "s"
            } with email`
          )}
        </p>
      </div>
      </CardContent>
    </Card>
  );

  return (
    <div id="comms-composer">
      <MessageComposer
        title={title}
        onTitleChange={setTitle}
        category={category}
        onCategoryChange={setCategory}
        announcementType={announcementType}
        onAnnouncementTypeChange={setAnnouncementType}
        bodyJson={bodyJson}
        onBodyChange={setBodyJson}
        pendingAttachments={pendingAttachments}
        onPendingAttachmentsChange={setPendingAttachments}
        mentionCandidates={mentionCandidates}
        disabled={pending}
        onSubmitShortcut={openConfirmIfValid}
        error={error}
        success={success}
        audienceSlot={audienceSlot}
        footerSlot={
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Link
              href="/admin/comms"
              className={cn(buttonVariants({ variant: "secondary" }))}
            >
              Cancel
            </Link>
            <CommsEmailPreview
              draft={{
                title,
                announcementType,
                bodyJson,
                attachmentNames: pendingAttachments.map(
                  (item) => item.fileName,
                ),
              }}
              disabled={pending}
            />
            <Button
              type="button"
              onClick={openConfirmIfValid}
              disabled={pending || !canPublish}
            >
              {pending ? <Spinner /> : <Megaphone />}
              Publish
            </Button>
          </div>
        }
      />

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Publish this announcement?</AlertDialogTitle>
            <AlertDialogDescription>
              {audienceSentence}
              {audienceCount !== null
                ? ` ${audienceCount} recipient${
                    audienceCount === 1 ? "" : "s"
                  }.`
                : null}
            </AlertDialogDescription>
          </AlertDialogHeader>

          {error ? (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          ) : null}

          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
            <Button type="button" disabled={pending} onClick={handleConfirmPublish}>
              {pending ? <Spinner /> : <Megaphone />}
              Publish
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
