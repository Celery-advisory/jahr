"use client";

import { useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronDown, Plus, X } from "lucide-react";
import { toast } from "sonner";
import {
  ConfirmDialog,
  RowMenu,
  SettingsSection,
  transactionCountLabel,
} from "@/components/petty-cash/confirm-dialog";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import {
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useAsyncAction } from "@/lib/hooks/use-async-action";
import { categoryTone } from "@/lib/petty-cash/category-color";
import {
  saveCategory,
  setCategoryActive,
  setCategoryGroupActive,
} from "@/lib/petty-cash/actions";
import type { PettyCashBundle, PettyCashCategory } from "@/lib/petty-cash/types";
import { cn } from "@/lib/utils";

type CategoryEditor =
  | { kind: "group"; category: PettyCashCategory | null }
  | { kind: "category"; category: PettyCashCategory | null; parentId: string };

const CATEGORY_DEACTIVATE =
  "Existing transactions using this category will remain unchanged. The category will no longer be available for new transactions.";

const GROUP_DEACTIVATE =
  "Existing transactions stay unchanged. Categories in this group will no longer be available for new transactions.";

const TRANSACTION_RANGES = [
  { id: "none", name: "None", min: 0, max: 0 },
  { id: "1-5", name: "1 to 5", min: 1, max: 5 },
  { id: "6-20", name: "6 to 20", min: 6, max: 20 },
  { id: "21+", name: "21 or more", min: 21, max: Number.POSITIVE_INFINITY },
] as const;

export function SettingsCategories({ bundle }: { bundle: PettyCashBundle }) {
  const router = useRouter();
  const { pending, run } = useAsyncAction();
  const [query, setQuery] = useState("");
  const [groupIds, setGroupIds] = useState<string[]>([]);
  const [statuses, setStatuses] = useState<Array<"active" | "inactive">>([]);
  const [transactionRanges, setTransactionRanges] = useState<string[]>([]);
  const [editor, setEditor] = useState<CategoryEditor | null>(null);
  const [confirm, setConfirm] = useState<{
    title: string;
    description: string;
    confirmLabel: string;
    run: () => void;
  } | null>(null);

  const groups = useMemo(() => groupCategories(bundle.categories), [bundle.categories]);
  const counts = useMemo(() => transactionCounts(bundle.transactions), [bundle.transactions]);
  const tableGroups = useMemo(
    () => visibleCategoryGroups(groups, counts, query, groupIds, statuses, transactionRanges),
    [groups, counts, query, groupIds, statuses, transactionRanges],
  );
  function clearFilters() {
    setQuery("");
    setGroupIds([]);
    setStatuses([]);
    setTransactionRanges([]);
  }

  function refresh(message: string) {
    toast.success(message);
    setConfirm(null);
    setEditor(null);
    router.refresh();
  }

  function toggleActive(category: PettyCashCategory, group: boolean) {
    const next = !category.isActive;
    if (next) {
      void run(async () => {
        const result = group
          ? await setCategoryGroupActive(activeForm(category.id, true))
          : await setCategoryActive(activeForm(category.id, true));
        if (result.error) {
          toast.error(result.error);
          return;
        }
        refresh(group ? "Group activated" : "Category activated");
      });
      return;
    }

    setConfirm({
      title: group ? "Deactivate group?" : "Deactivate category?",
      description: group ? GROUP_DEACTIVATE : CATEGORY_DEACTIVATE,
      confirmLabel: "Deactivate",
      run: () => {
        void run(async () => {
          const result = group
            ? await setCategoryGroupActive(activeForm(category.id, false))
            : await setCategoryActive(activeForm(category.id, false));
          if (result.error) {
            toast.error(result.error);
            return;
          }
          refresh(group ? "Group deactivated" : "Category deactivated");
        });
      },
    });
  }

  return (
    <SettingsSection
      title="Categories"
      description="Manage expense categories."
      action={
        groups.length === 0 ? undefined : (
          <>
            <Button
              type="button"
              variant="outline"
              onClick={() => setEditor({ kind: "group", category: null })}
            >
              Add group
            </Button>
            <Button
              type="button"
              onClick={() =>
                setEditor({
                  kind: "category",
                  category: null,
                  parentId: groups[0]?.group.id ?? "",
                })
              }
            >
              <Plus />
              Add category
            </Button>
          </>
        )
      }
    >
      {groups.length === 0 ? (
        <EmptyState
          kind="documents"
          surface
          title="Add a group"
          description="Groups hold the categories people pick on an expense."
          action={
            <Button
              type="button"
              onClick={() => setEditor({ kind: "group", category: null })}
            >
              <Plus />
              Add group
            </Button>
          }
        />
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <div className="flex items-center gap-3 border-b border-border p-4">
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search categories"
              aria-label="Search categories"
            />
            {groupIds.length > 0 || statuses.length > 0 || transactionRanges.length > 0 ? (
              <button
                type="button"
                className="shrink-0 text-sm text-[#667085] hover:text-foreground"
                onClick={() => {
                  setGroupIds([]);
                  setStatuses([]);
                  setTransactionRanges([]);
                }}
              >
                Clear
              </button>
            ) : null}
          </div>
          {tableGroups.length === 0 ? (
            <EmptyState
              kind="search"
              size="compact"
              title={query.trim() ? "Try another name" : "Try another filter"}
              action={
                <Button type="button" variant="outline" onClick={clearFilters}>
                  Clear filters
                </Button>
              }
            />
          ) : (
            <>
              <div className="flex flex-wrap gap-2 border-b border-border px-4 py-3 md:hidden">
                <FilterChip
                  label="Group"
                  selected={groupIds}
                  options={groups.map((entry) => ({
                    id: entry.group.id,
                    name: entry.group.name,
                    kind: "group" as const,
                  }))}
                  onChange={setGroupIds}
                />
                <FilterChip
                  label="Transactions"
                  selected={transactionRanges}
                  options={TRANSACTION_RANGES.map((range) => ({
                    id: range.id,
                    name: range.name,
                    kind: "count" as const,
                  }))}
                  onChange={setTransactionRanges}
                />
                <FilterChip
                  label="Status"
                  selected={statuses}
                  options={[
                    { id: "active", name: "Active", kind: "active" },
                    { id: "inactive", name: "Inactive", kind: "inactive" },
                  ]}
                  onChange={(next) => setStatuses(next as Array<"active" | "inactive">)}
                />
              </div>
              <ul className="md:hidden">
                {tableGroups.map((entry) => (
                  <li key={entry.group.id} className="border-b border-border last:border-0">
                    <div className="flex items-center justify-between gap-3 bg-[#F6F8FB] px-4 py-2">
                      <TonePill name={entry.group.name} />
                      <GroupMenu
                        group={entry.group}
                        onEdit={() => setEditor({ kind: "group", category: entry.group })}
                        onAdd={() =>
                          setEditor({
                            kind: "category",
                            category: null,
                            parentId: entry.group.id,
                          })
                        }
                        onToggle={() => toggleActive(entry.group, true)}
                      />
                    </div>
                    {entry.categories.map((item) => (
                        <div
                          key={item.category.id}
                          className="flex items-start gap-3 border-t border-[#E7ECF2] px-4 py-3"
                        >
                          <div className="min-w-0 flex-1">
                            <p
                              className={cn(
                                "truncate text-sm font-medium",
                                !item.category.isActive && "text-muted-foreground",
                              )}
                            >
                              {item.category.name}
                            </p>
                            <p className="mt-1 text-xs text-muted-foreground">
                              {transactionCountLabel(item.transactionCount)}
                              {" · "}
                              {item.category.isActive ? "Active" : "Inactive"}
                            </p>
                          </div>
                          <CategoryMenu
                            category={item.category}
                            group={entry.group}
                            onEdit={() =>
                              setEditor({
                                kind: "category",
                                category: item.category,
                                parentId: item.category.parentId ?? entry.group.id,
                              })
                            }
                            onToggle={() => toggleActive(item.category, false)}
                            onEditGroup={() =>
                              setEditor({ kind: "group", category: entry.group })
                            }
                            onAdd={() =>
                              setEditor({
                                kind: "category",
                                category: null,
                                parentId: entry.group.id,
                              })
                            }
                            onToggleGroup={() => toggleActive(entry.group, true)}
                          />
                        </div>
                    ))}
                  </li>
                ))}
              </ul>
              <div className="hidden overflow-x-auto md:block">
              <table className="w-full min-w-[40rem] text-sm">
                <thead className="border-b border-[#E7ECF2] bg-[#F6F8FB] text-left text-xs font-medium text-[#667085]">
                  <tr>
                    <th scope="col" className="px-4 py-2.5 font-medium">
                      Category
                    </th>
                    <th scope="col" className="px-4 py-2.5 font-medium">
                      <FilterChip
                        label="Group"
                        variant="header"
                        selected={groupIds}
                        options={groups.map((entry) => ({
                          id: entry.group.id,
                          name: entry.group.name,
                          kind: "group" as const,
                        }))}
                        onChange={setGroupIds}
                      />
                    </th>
                    <th scope="col" className="px-4 py-2.5 text-right font-medium">
                      <FilterChip
                        label="Transactions"
                        variant="header"
                        align="end"
                        selected={transactionRanges}
                        options={TRANSACTION_RANGES.map((range) => ({
                          id: range.id,
                          name: range.name,
                          kind: "count" as const,
                        }))}
                        onChange={setTransactionRanges}
                      />
                    </th>
                    <th scope="col" className="px-4 py-2.5 font-medium">
                      <FilterChip
                        label="Status"
                        variant="header"
                        selected={statuses}
                        options={[
                          { id: "active", name: "Active", kind: "active" },
                          { id: "inactive", name: "Inactive", kind: "inactive" },
                        ]}
                        onChange={(next) => setStatuses(next as Array<"active" | "inactive">)}
                      />
                    </th>
                    <th scope="col" className="w-12 px-4 py-2.5 font-medium">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {tableGroups.map((entry) =>
                    entry.categories.length === 0 ? (
                      <tr key={entry.group.id} className="border-b border-[#E7ECF2] last:border-0">
                        <td className="px-4 py-2.5 text-[#667085]" />
                        <td className="px-4 py-2.5">
                          <TonePill name={entry.group.name} />
                        </td>
                        <td className="px-4 py-2.5" />
                        <td className="px-4 py-2.5">
                          <ActivityStatus active={entry.group.isActive} />
                        </td>
                        <td className="px-4 py-2.5">
                          <GroupMenu
                            group={entry.group}
                            onEdit={() => setEditor({ kind: "group", category: entry.group })}
                            onAdd={() =>
                              setEditor({
                                kind: "category",
                                category: null,
                                parentId: entry.group.id,
                              })
                            }
                            onToggle={() => toggleActive(entry.group, true)}
                          />
                        </td>
                      </tr>
                    ) : (
                      entry.categories.map((item) => (
                        <tr key={item.category.id} className="border-b border-[#E7ECF2] last:border-0">
                          <td className="max-w-56 px-4 py-2.5">
                            <span
                              className={cn(
                                "block truncate font-medium",
                                !item.category.isActive && "text-muted-foreground",
                              )}
                            >
                              {item.category.name}
                            </span>
                          </td>
                          <td className="px-4 py-2.5">
                            <TonePill name={entry.group.name} />
                          </td>
                          <td className="px-4 py-2.5 text-right tabular-nums text-[#667085]">
                            {item.transactionCount}
                          </td>
                          <td className="px-4 py-2.5">
                            <ActivityStatus active={item.category.isActive} />
                          </td>
                          <td className="px-4 py-2.5">
                            <CategoryMenu
                              category={item.category}
                              group={entry.group}
                              onEdit={() =>
                                setEditor({
                                  kind: "category",
                                  category: item.category,
                                  parentId: item.category.parentId ?? entry.group.id,
                                })
                              }
                              onToggle={() => toggleActive(item.category, false)}
                              onEditGroup={() =>
                                setEditor({ kind: "group", category: entry.group })
                              }
                              onAdd={() =>
                                setEditor({
                                  kind: "category",
                                  category: null,
                                  parentId: entry.group.id,
                                })
                              }
                              onToggleGroup={() => toggleActive(entry.group, true)}
                            />
                          </td>
                        </tr>
                      ))
                    ),
                  )}
                </tbody>
              </table>
              </div>
            </>
          )}
        </div>
      )}

      <CategorySheet
        editor={editor}
        groups={groups.map((entry) => entry.group)}
        pending={pending}
        onOpenChange={(open) => {
          if (!open && !pending) setEditor(null);
        }}
        onSave={(formData, deactivating) => {
          const persist = () => {
            void run(async () => {
              const result = await saveCategory(formData);
              if (result.error) {
                toast.error(result.error);
                return;
              }
              const created = !formData.get("id");
              const group = !formData.get("parentId");
              refresh(
                created
                  ? group
                    ? "Group added"
                    : "Category added"
                  : group
                    ? "Group updated"
                    : "Category updated",
              );
            });
          };
          if (!deactivating) {
            persist();
            return;
          }
          const group = !formData.get("parentId");
          setConfirm({
            title: group ? "Deactivate group?" : "Deactivate category?",
            description: group ? GROUP_DEACTIVATE : CATEGORY_DEACTIVATE,
            confirmLabel: "Deactivate",
            run: persist,
          });
        }}
      />

      <ConfirmDialog
        open={confirm !== null}
        title={confirm?.title ?? ""}
        description={confirm?.description ?? ""}
        confirmLabel={confirm?.confirmLabel ?? "Deactivate"}
        destructive
        pending={pending}
        onOpenChange={(open) => {
          if (!open && !pending) setConfirm(null);
        }}
        onConfirm={() => confirm?.run()}
      />
    </SettingsSection>
  );
}

function CategorySheet({
  editor,
  groups,
  pending,
  onOpenChange,
  onSave,
}: {
  editor: CategoryEditor | null;
  groups: PettyCashCategory[];
  pending: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (formData: FormData, deactivating: boolean) => void;
}) {
  const editing = editor?.category ?? null;
  const isGroup = editor?.kind === "group";
  const [name, setName] = useState("");
  const [parentId, setParentId] = useState("");
  const [description, setDescription] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [seed, setSeed] = useState<CategoryEditor | null>(null);

  if (editor !== seed) {
    setSeed(editor);
    setName(editor?.category?.name ?? "");
    setDescription(editor?.category?.description ?? "");
    setIsActive(editor?.category?.isActive ?? true);
    setParentId(
      editor?.kind === "category"
        ? (editor.category?.parentId ?? editor.parentId)
        : "",
    );
  }

  const groupItems = groups.map((group) => ({
    value: group.id,
    label: group.isActive ? group.name : `${group.name} (inactive)`,
  }));

  function save() {
    if (!editor) return;
    if (!isGroup && !parentId) {
      toast.error("Choose a group.");
      return;
    }
    const formData = new FormData();
    if (editing) formData.set("id", editing.id);
    formData.set("name", name);
    formData.set("description", description);
    formData.set("isActive", String(isActive));
    if (!isGroup) formData.set("parentId", parentId);
    const deactivating = Boolean(editing?.isActive && !isActive);
    onSave(formData, deactivating);
  }

  const title = isGroup
    ? editing
      ? "Edit group"
      : "Add group"
    : editing
      ? "Edit category"
      : "Add category";

  return (
    <Sheet open={editor !== null} onOpenChange={onOpenChange}>
      <SheetContent className="h-dvh w-full! max-w-none! overflow-y-auto overscroll-contain pb-[env(safe-area-inset-bottom)] sm:h-full sm:max-w-md!">
        <SheetHeader className="pr-12">
          <SheetTitle>{title}</SheetTitle>
        </SheetHeader>
        <div className="flex flex-col gap-4 px-4 pb-6">
          <div className="flex flex-col gap-1.5">
            <Label>Name</Label>
            <Input value={name} onChange={(event) => setName(event.target.value)} />
          </div>
          {isGroup ? null : (
            <div className="flex flex-col gap-1.5">
              <Label>Group</Label>
              <Select
                value={parentId}
                onValueChange={(value) => {
                  if (value) setParentId(value);
                }}
                items={groupItems}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Choose a group" />
                </SelectTrigger>
                <SelectContent>
                  {groupItems.map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="flex flex-col gap-1.5">
            <Label>Description</Label>
            <Textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              className="rounded-md px-3"
            />
          </div>
          {editing ? (
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-medium">Status</p>
                <p className="text-sm text-muted-foreground">
                  {isActive ? "Active" : "Inactive"}
                </p>
              </div>
              <Switch checked={isActive} onCheckedChange={setIsActive} />
            </div>
          ) : null}
          <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end [&_button]:w-full sm:[&_button]:w-auto">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={pending}
            >
              Cancel
            </Button>
            <Button type="button" onClick={save} disabled={pending}>
              {pending ? <Spinner /> : null}
              {editing ? "Save changes" : isGroup ? "Add group" : "Add category"}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

type CategoryTableGroup = {
  group: PettyCashCategory;
  categories: Array<{ category: PettyCashCategory; transactionCount: number }>;
};

type FilterOption = {
  id: string;
  name: string;
  kind: "group" | "active" | "inactive" | "count";
};

function FilterChip({
  label,
  selected,
  options,
  onChange,
  variant = "chip",
  align = "start",
}: {
  label: string;
  selected: string[];
  options: FilterOption[];
  onChange: (next: string[]) => void;
  variant?: "chip" | "header";
  align?: "start" | "end";
}) {
  const count = selected.length;
  const only = count === 1 ? options.find((option) => option.id === selected[0]) : undefined;

  function toggle(id: string) {
    onChange(selected.includes(id) ? selected.filter((item) => item !== id) : [...selected, id]);
  }

  const header = variant === "header";

  return (
    <div
      className={cn(
        "inline-flex items-center",
        header ? "gap-1" : "h-8 rounded-md border border-[#E3E8EF] bg-white",
        align === "end" && "w-full justify-end",
      )}
    >
      <Popover>
        <PopoverTrigger
          className={cn(
            "inline-flex items-center gap-1.5",
            header
              ? "text-xs font-medium text-[#667085]"
              : "h-8 px-2.5 text-sm",
            header && count > 0 && "text-foreground",
          )}
        >
          <span className={header ? undefined : "text-[#667085]"}>{label}</span>
          {!header && only ? <FilterValue option={only} /> : null}
          {count > 1 || (header && count > 0) ? (
            <span className="inline-flex size-4 items-center justify-center rounded-full bg-[#8B7CF8] text-[10px] font-medium text-white">
              {count}
            </span>
          ) : null}
          {!header && count > 1 ? <span className="font-medium">selected</span> : null}
          <ChevronDown className={cn("text-[#98A2B3]", header ? "size-3" : "size-3.5")} />
        </PopoverTrigger>
        <PopoverContent align={align} className="w-60 gap-0.5 p-1.5">
          {options.map((option) => (
            <FilterCheck
              key={option.id}
              checked={selected.includes(option.id)}
              onChange={() => toggle(option.id)}
            >
              <FilterValue option={option} />
            </FilterCheck>
          ))}
          <div className="mt-1 border-t border-[#E7ECF2] pt-1">
            <FilterCheck
              checked={options.length > 0 && count === options.length}
              onChange={() =>
                onChange(count === options.length ? [] : options.map((option) => option.id))
              }
              trailing
            >
              Select all
            </FilterCheck>
          </div>
        </PopoverContent>
      </Popover>
      {count > 0 ? (
        <button
          type="button"
          className="mr-1.5 inline-flex size-5 items-center justify-center rounded-sm text-[#98A2B3] hover:text-foreground"
          aria-label={`Clear ${label}`}
          onClick={() => onChange([])}
        >
          <X className="size-3.5" />
        </button>
      ) : null}
    </div>
  );
}

function FilterValue({ option }: { option: FilterOption }) {
  if (option.kind === "group") return <TonePill name={option.name} />;
  if (option.kind === "count") {
    return <span className="text-sm font-medium">{option.name}</span>;
  }
  const active = option.kind === "active";
  return (
    <span className="inline-flex items-center gap-1.5 text-sm font-medium">
      <span
        className={cn("size-1.5 rounded-full", active ? "bg-[#16A34A]" : "bg-[#98A2B3]")}
        aria-hidden
      />
      {option.name}
    </span>
  );
}

function FilterCheck({
  checked,
  onChange,
  trailing = false,
  children,
}: {
  checked: boolean;
  onChange: () => void;
  trailing?: boolean;
  children: ReactNode;
}) {
  const box = (
    <span
      className={cn(
        "flex size-4 shrink-0 items-center justify-center rounded-[4px] border",
        checked ? "border-[#0070F3] bg-[#0070F3] text-white" : "border-[#D0D5DD] bg-white",
      )}
    >
      {checked ? <Check className="size-3" /> : null}
    </span>
  );

  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      onClick={onChange}
      className="flex w-full items-center gap-2 rounded-md px-1.5 py-1.5 text-left text-sm hover:bg-[#F5F7FB]"
    >
      {trailing ? <span className="min-w-0 flex-1">{children}</span> : box}
      {trailing ? box : <span className="min-w-0 flex-1">{children}</span>}
    </button>
  );
}

function TonePill({ name }: { name: string }) {
  const tone = categoryTone(name);
  return (
    <span
      className="inline-flex max-w-40 truncate rounded-md px-2 py-0.5 text-xs font-medium"
      style={{ backgroundColor: tone.bg, color: tone.text }}
    >
      {name}
    </span>
  );
}

function ActivityStatus({ active }: { active: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium",
        active
          ? "border-[#BBF7D0] bg-[#F0FDF4] text-[#166534]"
          : "border-[#E7ECF2] bg-white text-[#667085]",
      )}
    >
      <span
        className={cn("size-1.5 rounded-full", active ? "bg-[#16A34A]" : "bg-[#98A2B3]")}
        aria-hidden
      />
      {active ? "Active" : "Inactive"}
    </span>
  );
}

function GroupMenu({
  group,
  onEdit,
  onAdd,
  onToggle,
}: {
  group: PettyCashCategory;
  onEdit: () => void;
  onAdd: () => void;
  onToggle: () => void;
}) {
  return (
    <RowMenu label={`Actions for ${group.name}`}>
      <DropdownMenuItem onClick={onEdit}>Edit group</DropdownMenuItem>
      <DropdownMenuItem onClick={onAdd}>Add category</DropdownMenuItem>
      <DropdownMenuSeparator />
      <DropdownMenuItem
        variant={group.isActive ? "destructive" : "default"}
        onClick={onToggle}
      >
        {group.isActive ? "Deactivate group" : "Activate group"}
      </DropdownMenuItem>
    </RowMenu>
  );
}

function CategoryMenu({
  category,
  group,
  onEdit,
  onToggle,
  onEditGroup,
  onAdd,
  onToggleGroup,
}: {
  category: PettyCashCategory;
  group: PettyCashCategory;
  onEdit: () => void;
  onToggle: () => void;
  onEditGroup: () => void;
  onAdd: () => void;
  onToggleGroup: () => void;
}) {
  return (
    <RowMenu label={`Actions for ${category.name}`}>
      <DropdownMenuItem onClick={onEdit}>Edit</DropdownMenuItem>
      <DropdownMenuSeparator />
      <DropdownMenuItem
        variant={category.isActive ? "destructive" : "default"}
        onClick={onToggle}
      >
        {category.isActive ? "Deactivate" : "Activate"}
      </DropdownMenuItem>
      <DropdownMenuSeparator />
      <DropdownMenuItem onClick={onEditGroup}>Edit group</DropdownMenuItem>
      <DropdownMenuItem onClick={onAdd}>Add category</DropdownMenuItem>
      <DropdownMenuItem
        variant={group.isActive ? "destructive" : "default"}
        onClick={onToggleGroup}
      >
        {group.isActive ? "Deactivate group" : "Activate group"}
      </DropdownMenuItem>
    </RowMenu>
  );
}

function groupCategories(categories: PettyCashCategory[]) {
  const groups = categories
    .filter((category) => !category.parentId)
    .sort((a, b) => a.name.localeCompare(b.name));
  const children = new Map<string, PettyCashCategory[]>();
  for (const category of categories) {
    if (!category.parentId) continue;
    const list = children.get(category.parentId) ?? [];
    list.push(category);
    children.set(category.parentId, list);
  }
  for (const list of children.values()) {
    list.sort((a, b) => a.name.localeCompare(b.name));
  }
  return groups.map((group) => ({
    group,
    categories: children.get(group.id) ?? [],
  }));
}

function transactionCounts(
  transactions: PettyCashBundle["transactions"],
): Map<string, number> {
  const counts = new Map<string, number>();
  for (const row of transactions) {
    if (!row.categoryId || row.status === "voided") continue;
    counts.set(row.categoryId, (counts.get(row.categoryId) ?? 0) + 1);
  }
  return counts;
}

function activeForm(id: string, isActive: boolean): FormData {
  const formData = new FormData();
  formData.set("id", id);
  formData.set("isActive", String(isActive));
  return formData;
}

function visibleCategoryGroups(
  groups: Array<{ group: PettyCashCategory; categories: PettyCashCategory[] }>,
  counts: Map<string, number>,
  query: string,
  groupIds: string[],
  statuses: Array<"active" | "inactive">,
  transactionRanges: string[],
): CategoryTableGroup[] {
  const needle = query.trim().toLowerCase();
  const groupSet = new Set(groupIds);
  const statusSet = new Set(statuses);
  const visible: CategoryTableGroup[] = [];
  for (const entry of groups) {
    if (groupSet.size > 0 && !groupSet.has(entry.group.id)) continue;
    const groupMatches = needle.length > 0 && entry.group.name.toLowerCase().includes(needle);
    const named = !needle || groupMatches
      ? entry.categories
      : entry.categories.filter((category) => category.name.toLowerCase().includes(needle));
    if (needle && !groupMatches && named.length === 0) continue;
    const byStatus = statusSet.size === 0
      ? named
      : named.filter((category) => statusSet.has(category.isActive ? "active" : "inactive"));
    const rows = byStatus
      .map((category) => ({
        category,
        transactionCount: counts.get(category.id) ?? 0,
      }))
      .filter((item) => matchesTransactionRange(item.transactionCount, transactionRanges));
    if (rows.length === 0) {
      const emptyGroup = entry.categories.length === 0;
      if (!emptyGroup || transactionRanges.length > 0) continue;
      if (statusSet.size > 0 && !statusSet.has(entry.group.isActive ? "active" : "inactive")) {
        continue;
      }
      visible.push({ group: entry.group, categories: [] });
      continue;
    }
    visible.push({ group: entry.group, categories: rows });
  }
  return visible;
}

function matchesTransactionRange(count: number, selected: string[]): boolean {
  if (selected.length === 0) return true;
  return TRANSACTION_RANGES.some(
    (range) => selected.includes(range.id) && count >= range.min && count <= range.max,
  );
}
