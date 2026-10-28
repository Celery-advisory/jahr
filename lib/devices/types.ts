export type DeviceStatus = "available" | "assigned" | "repair" | "retired";

export const DEVICE_STATUS_LABELS: Record<DeviceStatus, string> = {
  available: "Available",
  assigned: "Assigned",
  repair: "In repair",
  retired: "Retired",
};

export const DEVICE_STATUSES = Object.keys(DEVICE_STATUS_LABELS) as DeviceStatus[];

export type DeviceCondition = "new" | "good" | "fair" | "poor" | "damaged";

export const DEVICE_CONDITION_LABELS: Record<DeviceCondition, string> = {
  new: "New",
  good: "Good",
  fair: "Fair",
  poor: "Poor",
  damaged: "Damaged",
};

export const DEVICE_CONDITIONS = Object.keys(
  DEVICE_CONDITION_LABELS,
) as DeviceCondition[];

export function isDeviceCondition(value: unknown): value is DeviceCondition {
  return typeof value === "string" && value in DEVICE_CONDITION_LABELS;
}

/**
 * A category's template decides which extra spec fields the device form
 * shows. Values are stored in `devices.specs` keyed by `SpecField.key`.
 */
export type DeviceTemplate =
  | "computer"
  | "phone"
  | "tablet"
  | "monitor"
  | "accessory"
  | "access_card"
  | "sim"
  | "vehicle"
  | "other";

export interface SpecField {
  key: string;
  label: string;
  placeholder?: string;
  mono?: boolean;
}

export const DEVICE_TEMPLATES: Record<
  DeviceTemplate,
  { label: string; specs: SpecField[] }
> = {
  computer: {
    label: "Computer",
    specs: [
      { key: "processor", label: "Processor", placeholder: "Apple M3 Pro" },
      { key: "memory", label: "Memory", placeholder: "18 GB" },
      { key: "storage", label: "Storage", placeholder: "512 GB" },
      { key: "os", label: "Operating system", placeholder: "macOS 15" },
    ],
  },
  phone: {
    label: "Phone",
    specs: [
      { key: "imei", label: "IMEI", placeholder: "35 209900 176148 1", mono: true },
      { key: "phone_number", label: "Phone number", placeholder: "+233 20 000 0000" },
      { key: "storage", label: "Storage", placeholder: "256 GB" },
    ],
  },
  tablet: {
    label: "Tablet",
    specs: [
      { key: "imei", label: "IMEI", placeholder: "Cellular models only", mono: true },
      { key: "storage", label: "Storage", placeholder: "256 GB" },
    ],
  },
  monitor: {
    label: "Monitor",
    specs: [
      { key: "screen_size", label: "Screen size", placeholder: "27 inch" },
      { key: "resolution", label: "Resolution", placeholder: "2560 × 1440" },
    ],
  },
  accessory: { label: "Accessory", specs: [] },
  access_card: {
    label: "Access card",
    specs: [
      { key: "card_number", label: "Card number", mono: true },
      { key: "access_level", label: "Access level", placeholder: "All floors" },
    ],
  },
  sim: {
    label: "SIM card",
    specs: [
      { key: "phone_number", label: "Phone number", placeholder: "+233 20 000 0000" },
      { key: "network", label: "Network", placeholder: "MTN" },
      { key: "iccid", label: "ICCID", mono: true },
    ],
  },
  vehicle: {
    label: "Vehicle",
    specs: [
      { key: "registration", label: "Registration", placeholder: "GR 1234-26", mono: true },
      { key: "vin", label: "VIN", mono: true },
      { key: "year", label: "Year", placeholder: "2024" },
    ],
  },
  other: { label: "Other", specs: [] },
};

export const DEVICE_TEMPLATE_IDS = Object.keys(DEVICE_TEMPLATES) as DeviceTemplate[];

export function isDeviceTemplate(value: unknown): value is DeviceTemplate {
  return typeof value === "string" && value in DEVICE_TEMPLATES;
}

export type DeviceSpecs = Record<string, string>;

export interface DeviceCategory {
  id: string;
  name: string;
  tag_prefix: string;
  template: DeviceTemplate;
  sort_order: number;
  archived: boolean;
  device_count: number;
}

export interface DeviceAssignee {
  id: string;
  first_name: string;
  last_name: string;
  preferred_name: string | null;
  email: string;
  job_title: string | null;
  gender: string | null;
  avatar_url: string | null;
  /** "terminated" means they have left but still hold the device. */
  status: string;
}

export interface DeviceAssignment {
  id: string;
  device_id: string;
  employee_id: string;
  assigned_at: string;
  returned_at: string | null;
  notes: string | null;
  condition_out: DeviceCondition | null;
  condition_in: DeviceCondition | null;
  employee: DeviceAssignee | null;
  assigned_by_name: string | null;
}

export interface DeviceRecord {
  id: string;
  name: string;
  /** Permanent JA ID assigned by the database, e.g. JA-LT-0001. */
  asset_tag: string;
  category: Pick<DeviceCategory, "id" | "name" | "tag_prefix" | "template">;
  serial_number: string | null;
  manufacturer: string | null;
  model: string | null;
  color: string | null;
  status: DeviceStatus;
  condition: DeviceCondition | null;
  location: string | null;
  purchased_at: string | null;
  purchase_cost: number | null;
  purchase_currency: string | null;
  supplier: string | null;
  order_number: string | null;
  legal_entity: { id: string; name: string } | null;
  warranty_expires_at: string | null;
  specs: DeviceSpecs;
  notes: string | null;
  created_at: string;
  current_assignment: DeviceAssignment | null;
}

export type DeviceEventKind =
  | "created"
  | "updated"
  | "assigned"
  | "returned"
  | "status"
  | "note"
  | "file"
  | "offboarding";

export interface DeviceEvent {
  id: string;
  kind: DeviceEventKind;
  summary: string;
  details: string | null;
  actor_name: string | null;
  created_at: string;
}

export type DeviceFileLabel = "invoice" | "photo" | "warranty" | "other";

export const DEVICE_FILE_LABELS: Record<DeviceFileLabel, string> = {
  invoice: "Invoice",
  photo: "Photo",
  warranty: "Warranty",
  other: "Other",
};

export function isDeviceFileLabel(value: unknown): value is DeviceFileLabel {
  return typeof value === "string" && value in DEVICE_FILE_LABELS;
}

export interface DeviceFile {
  id: string;
  label: DeviceFileLabel;
  file_name: string;
  file_type: string;
  file_size: number;
  uploaded_by_name: string | null;
  created_at: string;
}

export interface DeviceDetail extends DeviceRecord {
  history: DeviceAssignment[];
  events: DeviceEvent[];
  files: DeviceFile[];
}

/** Choices and suggestions the add/edit form needs. */
export interface DeviceFormOptions {
  categories: DeviceCategory[];
  legalEntities: { id: string; name: string }[];
  locations: string[];
  manufacturers: string[];
  models: string[];
  suppliers: string[];
}

/** Days before warranty end at which a device counts as "expiring soon". */
export const WARRANTY_WARNING_DAYS = 90;

export function warrantyState(
  expiresAt: string | null,
  today = new Date(),
): "none" | "active" | "expiring" | "expired" {
  if (!expiresAt) return "none";
  const end = new Date(`${expiresAt}T23:59:59`);
  const days = (end.getTime() - today.getTime()) / 86_400_000;
  if (days < 0) return "expired";
  if (days <= WARRANTY_WARNING_DAYS) return "expiring";
  return "active";
}

export function formatDeviceDate(iso: string | null): string {
  if (!iso) return "-";
  // Date-only values (YYYY-MM-DD) parse as UTC midnight; append noon to keep the calendar day.
  const value = /^\d{4}-\d{2}-\d{2}$/.test(iso) ? `${iso}T12:00:00` : iso;
  return new Date(value).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}
