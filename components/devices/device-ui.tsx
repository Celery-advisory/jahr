"use client";

import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DEVICE_CONDITION_LABELS,
  DEVICE_STATUS_LABELS,
  formatDeviceDate,
  warrantyState,
  type DeviceCondition,
  type DeviceRecord,
  type DeviceStatus,
} from "@/lib/devices/types";
import { displayName } from "@/lib/types/database";
import { cn } from "@/lib/utils";

export function statusTone(status: DeviceStatus): string {
  switch (status) {
    case "available":
      return "border-transparent bg-[color-mix(in_srgb,var(--success)_12%,white)] text-[color:var(--success)]";
    case "assigned":
      return "border-transparent bg-[color-mix(in_srgb,var(--accent-blue)_10%,white)] text-accent-blue";
    case "repair":
      return "border-transparent bg-[color-mix(in_srgb,var(--warning)_16%,white)] text-[#B45309]";
    case "retired":
      return "border-border bg-secondary text-muted-foreground";
    default:
      return "";
  }
}

export function StatusBadge({ status }: { status: DeviceStatus }) {
  return (
    <Badge variant="outline" className={cn("rounded-md font-normal", statusTone(status))}>
      {DEVICE_STATUS_LABELS[status]}
    </Badge>
  );
}

export function AssetTag({ tag, className }: { tag: string; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 rounded-md bg-secondary px-1.5 py-0.5 font-mono text-xs font-medium text-foreground",
        className,
      )}
    >
      {tag}
    </span>
  );
}

const CONDITION_TONE: Record<DeviceCondition, string> = {
  new: "text-[color:var(--success)]",
  good: "text-[color:var(--success)]",
  fair: "text-[#B45309]",
  poor: "text-destructive",
  damaged: "text-destructive",
};

export function ConditionText({ condition }: { condition: DeviceCondition | null }) {
  if (!condition) return <span className="text-muted-foreground">-</span>;
  return (
    <span className={CONDITION_TONE[condition]}>
      {DEVICE_CONDITION_LABELS[condition]}
    </span>
  );
}

export function WarrantyText({ expiresAt }: { expiresAt: string | null }) {
  const state = warrantyState(expiresAt);
  if (state === "none") return <span className="text-muted-foreground">-</span>;
  return (
    <span
      className={cn(
        state === "expired" && "text-muted-foreground line-through decoration-muted-foreground/40",
        state === "expiring" && "font-medium text-[#B45309]",
      )}
      title={state === "expired" ? "Warranty expired" : undefined}
    >
      {formatDeviceDate(expiresAt)}
    </span>
  );
}

/** True when the person holding the device has already left. */
export function heldByFormerStaff(device: DeviceRecord): boolean {
  return device.current_assignment?.employee?.status === "terminated";
}

export function holderName(device: DeviceRecord): string | null {
  const employee = device.current_assignment?.employee;
  return employee ? displayName(employee) : null;
}

export function deviceSubtitle(device: DeviceRecord): string {
  return [
    device.category.name,
    [device.manufacturer, device.model].filter(Boolean).join(" "),
  ]
    .filter(Boolean)
    .join(" · ");
}

export function OptionSelect({
  id,
  value,
  onValueChange,
  items,
  placeholder,
  className,
  size,
  ariaLabel,
}: {
  id?: string;
  value: string;
  onValueChange: (value: string) => void;
  items: { value: string; label: string }[];
  placeholder?: string;
  className?: string;
  size?: "sm" | "default";
  ariaLabel?: string;
}) {
  return (
    <Select
      value={value}
      onValueChange={(next) => {
        if (next !== null) onValueChange(String(next));
      }}
      items={items}
    >
      <SelectTrigger id={id} size={size} className={cn("w-full", className)} aria-label={ariaLabel}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent alignItemWithTrigger={false} align="start">
        {items.map((item) => (
          <SelectItem key={item.value} value={item.value}>
            {item.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function Field({
  label,
  htmlFor,
  optional,
  hint,
  children,
  className,
}: {
  label: string;
  htmlFor?: string;
  optional?: boolean;
  hint?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("space-y-2", className)}>
      <Label htmlFor={htmlFor}>
        {label}
        {optional ? (
          <span className="font-normal text-muted-foreground">Optional</span>
        ) : null}
      </Label>
      {children}
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

/** Select values cannot be empty, so "none" stands for "not recorded". */
export const NO_CONDITION = "none";

export const CONDITION_ITEMS = [
  { value: NO_CONDITION, label: "Not recorded" },
  ...(Object.entries(DEVICE_CONDITION_LABELS) as [DeviceCondition, string][]).map(
    ([value, label]) => ({ value, label }),
  ),
];
