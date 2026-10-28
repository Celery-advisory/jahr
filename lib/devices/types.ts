import type { AssetKind } from "@/lib/types/employee";

export type DeviceStatus = "available" | "assigned" | "repair" | "retired";

export const DEVICE_KIND_OPTIONS: Array<{ id: AssetKind; label: string }> = [
  { id: "laptop", label: "Laptop" },
  { id: "monitor", label: "Monitor" },
  { id: "phone", label: "Phone" },
  { id: "access_card", label: "Access card" },
  { id: "other", label: "Other" },
];

export const DEVICE_STATUS_LABELS: Record<DeviceStatus, string> = {
  available: "Available",
  assigned: "Assigned",
  repair: "In repair",
  retired: "Retired",
};

export interface DeviceAssignee {
  id: string;
  first_name: string;
  last_name: string;
  preferred_name: string | null;
  email: string;
  job_title: string | null;
  gender: string | null;
  avatar_url: string | null;
}

export interface DeviceAssignment {
  id: string;
  device_id: string;
  employee_id: string;
  assigned_at: string;
  returned_at: string | null;
  notes: string | null;
  employee: DeviceAssignee | null;
  assigned_by_name: string | null;
}

export interface DeviceRecord {
  id: string;
  kind: AssetKind;
  name: string;
  /** Permanent JA ID assigned by the database, e.g. JA-LT-0001. */
  asset_tag: string;
  serial_number: string | null;
  manufacturer: string | null;
  model: string | null;
  color: string | null;
  status: DeviceStatus;
  purchased_at: string | null;
  notes: string | null;
  created_at: string;
  current_assignment: DeviceAssignment | null;
  history: DeviceAssignment[];
}
