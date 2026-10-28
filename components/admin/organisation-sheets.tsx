"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Spinner } from "@/components/ui/spinner";
import { useAsyncAction } from "@/lib/hooks/use-async-action";
import {
  createBusinessUnit,
  createDepartment,
  deleteBusinessUnit,
  deleteDepartment,
  updateBusinessUnit,
  updateDepartment,
} from "@/lib/organisation/actions";

export function BusinessUnitSheet({
  open,
  unit,
  onOpenChange,
}: {
  open: boolean;
  unit: { id: string; name: string; description: string | null } | null;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const { pending, run } = useAsyncAction();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const editing = unit !== null;

  // Reset the fields whenever the sheet opens or the unit changes.
  const formKey = open
    ? JSON.stringify([unit?.id, unit?.name, unit?.description])
    : null;
  const [syncedKey, setSyncedKey] = useState<string | null>(null);
  if (formKey !== syncedKey) {
    setSyncedKey(formKey);
    if (open) {
      setName(unit?.name ?? "");
      setDescription(unit?.description ?? "");
    }
  }

  function handleSubmit() {
    const trimmed = name.trim();
    if (!trimmed) return;

    void run(async () => {
      const result = unit
        ? await updateBusinessUnit({
            id: unit.id,
            name: trimmed,
            description,
          })
        : await createBusinessUnit({ name: trimmed, description });

      if (result.error) {
        toast.error(result.error);
        return;
      }

      toast.success(editing ? "Business unit updated" : "Business unit added");
      onOpenChange(false);
      router.refresh();
    });
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full gap-0 sm:max-w-md">
        <SheetHeader className="border-b border-border">
          <SheetTitle>
            {editing ? "Edit business unit" : "Add business unit"}
          </SheetTitle>
        </SheetHeader>
        <form
          className="flex min-h-0 flex-1 flex-col"
          onSubmit={(event) => {
            event.preventDefault();
            handleSubmit();
          }}
        >
          <div className="flex flex-col gap-4 px-4 py-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="business-unit-name">Business unit name</Label>
              <Input
                id="business-unit-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Name"
                disabled={pending}
                autoFocus
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="business-unit-description">Description</Label>
              <Input
                id="business-unit-description"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="What this unit covers"
                disabled={pending}
              />
            </div>
          </div>
          <div className="mt-auto flex justify-end gap-2 border-t border-border p-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={pending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={pending || name.trim().length === 0}>
              {pending ? <Spinner /> : null}
              {editing ? "Save" : "Add business unit"}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}

export function DepartmentSheet({
  open,
  businessUnitId,
  department,
  onOpenChange,
}: {
  open: boolean;
  businessUnitId: string;
  department: { id: string; name: string } | null;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const { pending, run } = useAsyncAction();
  const [name, setName] = useState("");
  const editing = department !== null;

  // Reset the field whenever the sheet opens or the department changes.
  const formKey = open
    ? JSON.stringify([department?.id, department?.name])
    : null;
  const [syncedKey, setSyncedKey] = useState<string | null>(null);
  if (formKey !== syncedKey) {
    setSyncedKey(formKey);
    if (open) {
      setName(department?.name ?? "");
    }
  }

  function handleSubmit() {
    const trimmed = name.trim();
    if (!trimmed) return;

    void run(async () => {
      const result = department
        ? await updateDepartment({ id: department.id, name: trimmed })
        : await createDepartment({ businessUnitId, name: trimmed });

      if (result.error) {
        toast.error(result.error);
        return;
      }

      toast.success(editing ? "Department updated" : "Department added");
      onOpenChange(false);
      router.refresh();
    });
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full gap-0 sm:max-w-md">
        <SheetHeader className="border-b border-border">
          <SheetTitle>
            {editing ? "Edit department" : "Add department"}
          </SheetTitle>
        </SheetHeader>
        <form
          className="flex min-h-0 flex-1 flex-col"
          onSubmit={(event) => {
            event.preventDefault();
            handleSubmit();
          }}
        >
          <div className="flex flex-col gap-4 px-4 py-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="department-name">Department name</Label>
              <Input
                id="department-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Name"
                disabled={pending}
                autoFocus
              />
            </div>
          </div>
          <div className="mt-auto flex justify-end gap-2 border-t border-border p-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={pending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={pending || name.trim().length === 0}>
              {pending ? <Spinner /> : null}
              {editing ? "Save" : "Add department"}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}

export function OrganisationDeleteDialog({
  target,
  onOpenChange,
  onRemoved,
}: {
  target: { kind: "unit" | "department"; id: string; name: string } | null;
  onOpenChange: (open: boolean) => void;
  onRemoved?: () => void;
}) {
  const router = useRouter();
  const { pending, run } = useAsyncAction();

  function handleDelete() {
    if (!target) return;
    const current = target;

    void run(async () => {
      const result =
        current.kind === "unit"
          ? await deleteBusinessUnit(current.id)
          : await deleteDepartment(current.id);

      if (result.error) {
        toast.error(result.error);
        return;
      }

      toast.success(
        current.kind === "unit" ? "Business unit removed" : "Department removed",
      );
      onOpenChange(false);
      onRemoved?.();
      router.refresh();
    });
  }

  return (
    <AlertDialog
      open={target !== null}
      onOpenChange={(open) => {
        if (!open && !pending) onOpenChange(false);
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {target?.kind === "department"
              ? "Remove department?"
              : "Remove business unit?"}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {target ? `${target.name} will be removed.` : null}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            disabled={pending}
            onClick={(event) => {
              event.preventDefault();
              handleDelete();
            }}
          >
            {pending ? <Spinner /> : null}
            Remove
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
