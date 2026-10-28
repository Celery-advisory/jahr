"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Archive, ArchiveRestore, Pencil, Plus } from "lucide-react";
import { Field, OptionSelect } from "@/components/devices/device-ui";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Spinner } from "@/components/ui/spinner";
import {
  createDeviceCategory,
  setDeviceCategoryArchived,
  updateDeviceCategory,
} from "@/lib/devices/actions";
import {
  DEVICE_TEMPLATES,
  DEVICE_TEMPLATE_IDS,
  type DeviceCategory,
  type DeviceTemplate,
} from "@/lib/devices/types";
import { useAsyncAction } from "@/lib/hooks/use-async-action";
import { cn } from "@/lib/utils";

const TEMPLATE_ITEMS = DEVICE_TEMPLATE_IDS.map((id) => {
  const specs = DEVICE_TEMPLATES[id].specs.map((spec) => spec.label);
  return {
    value: id,
    label: specs.length
      ? `${DEVICE_TEMPLATES[id].label}: ${specs.join(", ")}`
      : `${DEVICE_TEMPLATES[id].label}: no extra details`,
  };
});

interface Draft {
  id: string | null;
  name: string;
  tagPrefix: string;
  template: DeviceTemplate;
}

const EMPTY_DRAFT: Draft = { id: null, name: "", tagPrefix: "", template: "other" };

export function CategoryManagerSheet({
  open,
  onOpenChange,
  categories,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categories: DeviceCategory[];
}) {
  const router = useRouter();
  const { pending, run } = useAsyncAction();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [error, setError] = useState<string | null>(null);

  function save() {
    if (!draft) return;
    setError(null);
    void run(async () => {
      const input = {
        name: draft.name,
        tagPrefix: draft.tagPrefix,
        template: draft.template,
      };
      const result = draft.id
        ? await updateDeviceCategory(draft.id, input)
        : await createDeviceCategory(input);
      if (result.error) {
        setError(result.error);
        return;
      }
      setDraft(null);
      router.refresh();
    });
  }

  function toggleArchived(category: DeviceCategory) {
    setError(null);
    void run(async () => {
      const result = await setDeviceCategoryArchived(category.id, !category.archived);
      if (result.error) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) {
          setDraft(null);
          setError(null);
        }
      }}
    >
      <SheetContent side="right" className="w-full sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>Device categories</SheetTitle>
          <SheetDescription>
            The ID code starts each JA ID (JA-LT-0001). Changing a code only
            affects devices added afterwards.
          </SheetDescription>
        </SheetHeader>

        <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-4 pb-4">
          {draft ? (
            <div className="space-y-4 rounded-lg border border-border p-4">
              <p className="text-sm font-medium">
                {draft.id ? "Edit category" : "New category"}
              </p>
              <div className="grid gap-4 sm:grid-cols-[1fr_7rem]">
                <Field label="Name" htmlFor="category-name">
                  <Input
                    id="category-name"
                    value={draft.name}
                    onChange={(event) => setDraft({ ...draft, name: event.target.value })}
                    placeholder="Projector"
                  />
                </Field>
                <Field label="ID code" htmlFor="category-prefix">
                  <Input
                    id="category-prefix"
                    value={draft.tagPrefix}
                    onChange={(event) =>
                      setDraft({
                        ...draft,
                        tagPrefix: event.target.value.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 4),
                      })
                    }
                    placeholder="PJ"
                    className="font-mono uppercase"
                  />
                </Field>
              </div>
              <Field
                label="Extra details to track"
                htmlFor="category-template"
                hint="Decides which fields appear when adding a device in this category."
              >
                <OptionSelect
                  id="category-template"
                  value={draft.template}
                  onValueChange={(value) =>
                    setDraft({ ...draft, template: value as DeviceTemplate })
                  }
                  items={TEMPLATE_ITEMS}
                />
              </Field>
              <div className="flex justify-end gap-2">
                <Button variant="ghost" onClick={() => setDraft(null)} disabled={pending}>
                  Cancel
                </Button>
                <Button
                  onClick={save}
                  disabled={pending || !draft.name.trim() || draft.tagPrefix.length < 2}
                  className="gap-2"
                >
                  {pending ? <Spinner /> : null}
                  Save category
                </Button>
              </div>
            </div>
          ) : (
            <Button
              variant="outline"
              className="gap-1.5 self-start"
              onClick={() => setDraft(EMPTY_DRAFT)}
            >
              <Plus className="size-4" />
              New category
            </Button>
          )}

          {error ? <p className="text-sm text-destructive">{error}</p> : null}

          <ul className="divide-y divide-border rounded-lg border border-border">
            {categories.map((category) => (
              <li
                key={category.id}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5",
                  category.archived && "opacity-60",
                )}
              >
                <span className="w-10 shrink-0 font-mono text-xs font-medium text-muted-foreground">
                  {category.tag_prefix}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{category.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {category.device_count} device{category.device_count === 1 ? "" : "s"}
                    {" · "}
                    {DEVICE_TEMPLATES[category.template].label}
                  </p>
                </div>
                {category.archived ? (
                  <Badge variant="outline" className="rounded-md font-normal">
                    Archived
                  </Badge>
                ) : null}
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Edit ${category.name}`}
                  disabled={pending}
                  onClick={() =>
                    setDraft({
                      id: category.id,
                      name: category.name,
                      tagPrefix: category.tag_prefix,
                      template: category.template,
                    })
                  }
                >
                  <Pencil />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={category.archived ? `Restore ${category.name}` : `Archive ${category.name}`}
                  title={category.archived ? "Restore" : "Archive: hide when adding devices"}
                  disabled={pending}
                  onClick={() => toggleArchived(category)}
                >
                  {category.archived ? <ArchiveRestore /> : <Archive />}
                </Button>
              </li>
            ))}
          </ul>
        </div>
      </SheetContent>
    </Sheet>
  );
}
