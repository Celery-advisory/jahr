"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Archive,
  Eye,
  MoreHorizontal,
  Pencil,
  RotateCcw,
  UserPlus,
  Wrench,
  CheckCircle2,
} from "lucide-react";
import { DeviceFormSheet } from "@/components/devices/device-form-sheet";
import {
  AssetTag,
  CONDITION_ITEMS,
  Field,
  NO_CONDITION,
  OptionSelect,
  holderName,
} from "@/components/devices/device-ui";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import {
  assignDevice,
  returnDevice,
  updateDeviceStatus,
} from "@/lib/devices/actions";
import {
  isDeviceCondition,
  type DeviceAssignee,
  type DeviceFormOptions,
  type DeviceRecord,
  type DeviceStatus,
} from "@/lib/devices/types";
import { displayName } from "@/lib/types/database";
import { useAsyncAction } from "@/lib/hooks/use-async-action";
import { useResetOnChange } from "@/lib/hooks/use-reset-on-change";

type Dialog =
  | "edit"
  | "assign"
  | "return"
  | Exclude<DeviceStatus, "assigned">
  | null;

const STATUS_COPY: Record<
  Exclude<DeviceStatus, "assigned">,
  { title: string; description: string; confirm: string }
> = {
  repair: {
    title: "Send for repair?",
    description: "It can't be assigned until it's marked available again.",
    confirm: "Mark in repair",
  },
  available: {
    title: "Mark as available?",
    description: "It goes back into stock and can be assigned.",
    confirm: "Mark available",
  },
  retired: {
    title: "Retire this device?",
    description:
      "Use this when it's sold, recycled, lost or beyond repair. It stays in the records but can't be assigned.",
    confirm: "Retire device",
  },
};

/**
 * The "⋯" menu for a device, plus every sheet and dialog it opens.
 * `showView` hides "View details" when already on the detail page.
 */
export function DeviceActions({
  device,
  employees,
  options,
  showView = true,
  align = "end",
}: {
  device: DeviceRecord;
  employees: DeviceAssignee[];
  options: DeviceFormOptions;
  showView?: boolean;
  align?: "start" | "end";
}) {
  const router = useRouter();
  const { pending, run } = useAsyncAction();
  const [dialog, setDialog] = useState<Dialog>(null);
  const [error, setError] = useState<string | null>(null);
  const [employeeId, setEmployeeId] = useState("");
  const [condition, setCondition] = useState(NO_CONDITION);
  const [notes, setNotes] = useState("");

  useResetOnChange([dialog], () => {
    setError(null);
    setEmployeeId("");
    setCondition(device.condition ?? NO_CONDITION);
    setNotes("");
  });

  const close = () => setDialog(null);
  const conditionValue = isDeviceCondition(condition) ? condition : ("" as const);

  function submit(action: () => Promise<{ error?: string }>) {
    setError(null);
    void run(async () => {
      const result = await action();
      if (result.error) {
        setError(result.error);
        return;
      }
      close();
      router.refresh();
    });
  }

  const statusDialog =
    dialog === "repair" || dialog === "available" || dialog === "retired"
      ? dialog
      : null;
  const holder = holderName(device);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={`Actions for ${device.asset_tag}`}
            />
          }
        >
          <MoreHorizontal />
        </DropdownMenuTrigger>
        <DropdownMenuContent align={align} className="min-w-44">
          {showView ? (
            <DropdownMenuItem render={<Link href={`/admin/devices/${device.id}`} />}>
              <Eye />
              View details
            </DropdownMenuItem>
          ) : null}
          <DropdownMenuItem onClick={() => setDialog("edit")}>
            <Pencil />
            Edit details
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          {device.status === "available" ? (
            <DropdownMenuItem onClick={() => setDialog("assign")}>
              <UserPlus />
              Assign
            </DropdownMenuItem>
          ) : null}
          {device.status === "assigned" ? (
            <DropdownMenuItem onClick={() => setDialog("return")}>
              <RotateCcw />
              Return
            </DropdownMenuItem>
          ) : null}
          {device.status === "available" ? (
            <DropdownMenuItem onClick={() => setDialog("repair")}>
              <Wrench />
              Send for repair
            </DropdownMenuItem>
          ) : null}
          {device.status === "repair" || device.status === "retired" ? (
            <DropdownMenuItem onClick={() => setDialog("available")}>
              <CheckCircle2 />
              Mark available
            </DropdownMenuItem>
          ) : null}
          {device.status === "available" || device.status === "repair" ? (
            <DropdownMenuItem variant="destructive" onClick={() => setDialog("retired")}>
              <Archive />
              Retire
            </DropdownMenuItem>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>

      <DeviceFormSheet
        open={dialog === "edit"}
        onOpenChange={(open) => setDialog(open ? "edit" : null)}
        device={device}
        options={options}
      />

      <Sheet open={dialog === "assign"} onOpenChange={(open) => setDialog(open ? "assign" : null)}>
        <SheetContent side="right" className="w-full sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Assign device</SheetTitle>
            <SheetDescription className="flex items-center gap-2">
              <AssetTag tag={device.asset_tag} />
              {device.name}
            </SheetDescription>
          </SheetHeader>
          <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-4">
            <Field label="Employee" htmlFor="assign-employee">
              <OptionSelect
                id="assign-employee"
                value={employeeId}
                onValueChange={setEmployeeId}
                placeholder="Select employee"
                items={employees.map((employee) => ({
                  value: employee.id,
                  label: `${displayName(employee)}${employee.job_title ? ` · ${employee.job_title}` : ""}`,
                }))}
              />
            </Field>
            <Field
              label="Condition at handover"
              htmlFor="assign-condition"
              optional
            >
              <OptionSelect
                id="assign-condition"
                value={condition}
                onValueChange={setCondition}
                items={CONDITION_ITEMS}
              />
            </Field>
            <Field label="Handover notes" htmlFor="assign-notes" optional>
              <Textarea
                id="assign-notes"
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                placeholder="Charger included, screen protector fitted"
                rows={3}
              />
            </Field>
          </div>
          <SheetFooter>
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
            <Button
              disabled={pending || !employeeId}
              className="gap-2"
              onClick={() =>
                submit(() =>
                  assignDevice({
                    deviceId: device.id,
                    employeeId,
                    condition: conditionValue,
                    notes,
                  }),
                )
              }
            >
              {pending ? <Spinner /> : <ArrowRight />}
              Assign device
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <AlertDialog open={dialog === "return"} onOpenChange={(open) => setDialog(open ? "return" : null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Return {device.asset_tag}?</AlertDialogTitle>
            <AlertDialogDescription>
              {holder
                ? `Record ${device.name} as handed back by ${holder}.`
                : `Record ${device.name} as handed back.`}{" "}
              It goes back into stock.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="grid gap-4 py-2">
            <Field label="Condition on return" htmlFor="return-condition" optional>
              <OptionSelect
                id="return-condition"
                value={condition}
                onValueChange={setCondition}
                items={CONDITION_ITEMS}
              />
            </Field>
            <Field label="Notes" htmlFor="return-notes" optional>
              <Textarea
                id="return-notes"
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                placeholder="Scratch on lid, charger missing"
                rows={2}
              />
            </Field>
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
            <Button
              disabled={pending}
              className="gap-2"
              onClick={() =>
                submit(() =>
                  returnDevice({ deviceId: device.id, condition: conditionValue, notes }),
                )
              }
            >
              {pending ? <Spinner /> : null}
              Record return
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={statusDialog !== null} onOpenChange={(open) => (!open ? close() : null)}>
        {statusDialog ? (
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{STATUS_COPY[statusDialog].title}</AlertDialogTitle>
              <AlertDialogDescription>
                {device.asset_tag} · {device.name}. {STATUS_COPY[statusDialog].description}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="grid gap-4 py-2">
              <Field label="Note" htmlFor="status-note" optional>
                <Textarea
                  id="status-note"
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  placeholder={
                    statusDialog === "retired"
                      ? "Sold to staff, recycled via …, data wiped on …"
                      : statusDialog === "repair"
                        ? "Battery replacement at iStore, ticket #1234"
                        : undefined
                  }
                  rows={2}
                />
              </Field>
              {error ? <p className="text-sm text-destructive">{error}</p> : null}
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
              <Button
                variant={statusDialog === "retired" ? "destructive" : "default"}
                disabled={pending}
                className="gap-2"
                onClick={() =>
                  submit(() =>
                    updateDeviceStatus({
                      deviceId: device.id,
                      status: statusDialog,
                      note: notes,
                    }),
                  )
                }
              >
                {pending ? <Spinner /> : null}
                {STATUS_COPY[statusDialog].confirm}
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        ) : null}
      </AlertDialog>
    </>
  );
}
