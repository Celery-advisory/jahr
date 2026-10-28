"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { UserMinus } from "lucide-react";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import {
  AssetTag,
  CONDITION_ITEMS,
  NO_CONDITION,
  OptionSelect,
} from "@/components/devices/device-ui";
import type { OffboardingDeviceOutcome } from "@/lib/devices/events";
import { isDeviceCondition } from "@/lib/devices/types";
import { offboardEmployee } from "@/lib/employees/actions";
import { useAsyncAction } from "@/lib/hooks/use-async-action";
import type { EmployeeAsset } from "@/lib/types/employee";

const OUTCOME_ITEMS: { value: OffboardingDeviceOutcome; label: string }[] = [
  { value: "returned", label: "Returned" },
  { value: "outstanding", label: "Not back yet" },
  { value: "lost", label: "Lost / write off" },
];

interface DeviceChoice {
  outcome: OffboardingDeviceOutcome | "";
  condition: string;
}

export function OffboardEmployeeDialog({
  employeeId,
  employeeName,
  devices = [],
}: {
  employeeId: string;
  employeeName: string;
  devices?: EmployeeAsset[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const { pending, run } = useAsyncAction();
  const [error, setError] = useState<string | null>(null);
  const [terminationDate, setTerminationDate] = useState<Date | undefined>(
    new Date(),
  );
  const [leavingReason, setLeavingReason] = useState("");
  const [choices, setChoices] = useState<Record<string, DeviceChoice>>({});

  const choiceFor = (deviceId: string): DeviceChoice =>
    choices[deviceId] ?? { outcome: "", condition: NO_CONDITION };
  const setChoice = (deviceId: string, next: Partial<DeviceChoice>) =>
    setChoices((current) => ({
      ...current,
      [deviceId]: { ...choiceFor(deviceId), ...next },
    }));
  const devicesDecided = devices.every(
    (device) => choiceFor(device.device_id).outcome !== "",
  );

  function handleOffboard() {
    setError(null);
    void run(async () => {
      const result = await offboardEmployee({
        employeeId,
        terminationDate: terminationDate
          ? format(terminationDate, "yyyy-MM-dd")
          : "",
        leavingReason,
        devices: devices.map((device) => {
          const choice = choiceFor(device.device_id);
          return {
            deviceId: device.device_id,
            outcome: choice.outcome as OffboardingDeviceOutcome,
            condition: isDeviceCondition(choice.condition) ? choice.condition : null,
          };
        }),
      });

      if (result.error) {
        setError(result.error);
        return;
      }

      setOpen(false);
      router.push("/admin/alumni");
    });
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger
        render={
          <Button type="button" variant="outline" className="gap-1.5" />
        }
      >
        <UserMinus className="size-3.5" />
        Offboard
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Offboard {employeeName}?</AlertDialogTitle>
          <AlertDialogDescription>
            This marks them as terminated and moves them to Alumni. They will
            no longer appear in the active employees directory.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="grid gap-4 py-2">
          <div className="space-y-2">
            <Label>Last day</Label>
            <DatePicker
              value={terminationDate}
              onChange={setTerminationDate}
              placeholder="Termination date"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="leaving-reason">Reason for leaving</Label>
            <Input
              id="leaving-reason"
              value={leavingReason}
              onChange={(event) => setLeavingReason(event.target.value)}
              placeholder="Resignation, end of contract, …"
            />
          </div>
          {devices.length > 0 ? (
            <div className="space-y-2">
              <Label>Company devices</Label>
              <p className="text-xs text-muted-foreground">
                Record what happened to each one. Devices not back yet stay
                listed as &ldquo;With former staff&rdquo; on the Devices page.
              </p>
              <ul className="max-h-64 divide-y divide-border overflow-y-auto rounded-lg border border-border">
                {devices.map((device) => {
                  const choice = choiceFor(device.device_id);
                  return (
                    <li key={device.device_id} className="space-y-2 px-3 py-2.5">
                      <div className="flex min-w-0 items-center gap-2">
                        {device.asset_tag ? <AssetTag tag={device.asset_tag} /> : null}
                        <span className="truncate text-sm">{device.label}</span>
                      </div>
                      <div className="grid gap-2 sm:grid-cols-2">
                        <OptionSelect
                          size="sm"
                          value={choice.outcome}
                          onValueChange={(value) =>
                            setChoice(device.device_id, {
                              outcome: value as OffboardingDeviceOutcome,
                            })
                          }
                          placeholder="What happened?"
                          ariaLabel={`Outcome for ${device.label}`}
                          items={OUTCOME_ITEMS}
                        />
                        {choice.outcome === "returned" ? (
                          <OptionSelect
                            size="sm"
                            value={choice.condition}
                            onValueChange={(value) =>
                              setChoice(device.device_id, { condition: value })
                            }
                            ariaLabel={`Condition of ${device.label}`}
                            items={CONDITION_ITEMS}
                          />
                        ) : null}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : null}
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
          <Button
            type="button"
            variant="destructive"
            disabled={pending || !leavingReason.trim() || !devicesDecided}
            onClick={handleOffboard}
            className="gap-2"
          >
            {pending ? <Spinner /> : null}
            Move to Alumni
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
