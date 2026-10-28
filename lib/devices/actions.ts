"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { getCurrentProfile } from "@/lib/auth/get-profile";
import { logDeviceEvent } from "@/lib/devices/events";
import {
  DEVICE_FILE_MIME_TYPES,
  DEVICES_BUCKET,
  MAX_DEVICE_FILE_BYTES,
  uploadDeviceFileObject,
} from "@/lib/devices/storage";
import {
  DEVICE_CONDITION_LABELS,
  DEVICE_STATUS_LABELS,
  DEVICE_TEMPLATES,
  isDeviceCondition,
  isDeviceFileLabel,
  isDeviceTemplate,
  type DeviceCondition,
  type DeviceSpecs,
  type DeviceStatus,
  type DeviceTemplate,
} from "@/lib/devices/types";
import { isOrgAdmin, type ProfileWithOrg } from "@/lib/types/database";
import { createClient } from "@/utils/supabase/server";

export interface DeviceActionResult {
  error?: string;
  success?: boolean;
  deviceId?: string;
}

type Supabase = ReturnType<typeof createClient>;

async function requireAdmin(): Promise<
  { admin: ProfileWithOrg; supabase: Supabase } | { error: string }
> {
  const profile = await getCurrentProfile();
  if (!profile || !isOrgAdmin(profile)) {
    return { error: "Only org admins can manage devices." };
  }
  const cookieStore = await cookies();
  return { admin: profile, supabase: createClient(cookieStore) };
}

function revalidateDevicePaths(deviceId?: string) {
  revalidatePath("/admin/devices");
  if (deviceId) revalidatePath(`/admin/devices/${deviceId}`);
  revalidatePath("/settings");
  revalidatePath("/profile");
}

function clean(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function isIsoDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function personName(
  person: { first_name: string; preferred_name: string | null } | null | undefined,
): string | null {
  return person?.preferred_name?.trim() || person?.first_name || null;
}

// ---------------------------------------------------------------------------
// Create / edit
// ---------------------------------------------------------------------------

export interface DeviceInput {
  categoryId: string;
  name: string;
  serialNumber?: string;
  manufacturer?: string;
  model?: string;
  color?: string;
  condition?: DeviceCondition | "";
  location?: string;
  purchasedAt?: string;
  purchaseCost?: string;
  purchaseCurrency?: string;
  supplier?: string;
  orderNumber?: string;
  legalEntityId?: string;
  warrantyExpiresAt?: string;
  specs?: DeviceSpecs;
  notes?: string;
}

/** Validates form input and maps it to columns. Everything but category and name is optional. */
async function toDeviceColumns(
  supabase: Supabase,
  input: DeviceInput,
): Promise<{ columns: Record<string, unknown> } | { error: string }> {
  const name = input.name.trim();
  if (!name) return { error: "Add a device name." };
  if (!input.categoryId) return { error: "Choose a category." };

  const { data: category, error: categoryError } = await supabase
    .from("device_categories")
    .select("id, template")
    .eq("id", input.categoryId)
    .maybeSingle();
  if (categoryError || !category) {
    return { error: categoryError?.message ?? "That category no longer exists." };
  }

  // Only keep spec fields that belong to this category's template.
  const template: DeviceTemplate = isDeviceTemplate(category.template)
    ? category.template
    : "other";
  const specs: DeviceSpecs = {};
  for (const field of DEVICE_TEMPLATES[template].specs) {
    const value = clean(input.specs?.[field.key]);
    if (value) specs[field.key] = value;
  }

  let purchaseCost: number | null = null;
  const rawCost = clean(input.purchaseCost)?.replace(/,/g, "");
  if (rawCost) {
    purchaseCost = Number(rawCost);
    if (!Number.isFinite(purchaseCost) || purchaseCost < 0) {
      return { error: "Purchase cost must be a positive number." };
    }
  }

  for (const [label, value] of [
    ["Purchase date", input.purchasedAt],
    ["Warranty end", input.warrantyExpiresAt],
  ] as const) {
    if (value && !isIsoDate(value)) return { error: `${label} is not a valid date.` };
  }

  if (input.condition && !isDeviceCondition(input.condition)) {
    return { error: "Choose a valid condition." };
  }

  return {
    columns: {
      category_id: category.id,
      name,
      serial_number: clean(input.serialNumber),
      manufacturer: clean(input.manufacturer),
      model: clean(input.model),
      color: clean(input.color),
      condition: input.condition || null,
      location: clean(input.location),
      purchased_at: input.purchasedAt || null,
      purchase_cost: purchaseCost,
      purchase_currency: purchaseCost !== null ? clean(input.purchaseCurrency) : null,
      supplier: clean(input.supplier),
      order_number: clean(input.orderNumber),
      legal_entity_id: input.legalEntityId || null,
      warranty_expires_at: input.warrantyExpiresAt || null,
      specs,
      notes: clean(input.notes),
    },
  };
}

function serialError(error: { code?: string; message: string }): string {
  return error.code === "23505"
    ? "A device with that serial number already exists."
    : error.message;
}

export async function createDevice(input: DeviceInput): Promise<DeviceActionResult> {
  const auth = await requireAdmin();
  if ("error" in auth) return auth;
  const { admin, supabase } = auth;

  const mapped = await toDeviceColumns(supabase, input);
  if ("error" in mapped) return mapped;

  // asset_tag is assigned by a database trigger.
  const { data, error } = await supabase
    .from("devices")
    .insert({ ...mapped.columns, status: "available" satisfies DeviceStatus })
    .select("id, asset_tag")
    .single();

  if (error || !data) return { error: error ? serialError(error) : "Could not save." };

  await logDeviceEvent(supabase, {
    deviceId: data.id,
    kind: "created",
    summary: `Added to inventory as ${data.asset_tag}`,
    actorId: admin.id,
  });

  revalidateDevicePaths(data.id);
  return { success: true, deviceId: data.id };
}

export async function updateDevice(
  deviceId: string,
  input: DeviceInput,
): Promise<DeviceActionResult> {
  const auth = await requireAdmin();
  if ("error" in auth) return auth;
  const { admin, supabase } = auth;

  const mapped = await toDeviceColumns(supabase, input);
  if ("error" in mapped) return mapped;

  const { error } = await supabase
    .from("devices")
    .update(mapped.columns)
    .eq("id", deviceId);

  if (error) return { error: serialError(error) };

  await logDeviceEvent(supabase, {
    deviceId,
    kind: "updated",
    summary: "Details updated",
    actorId: admin.id,
  });

  revalidateDevicePaths(deviceId);
  return { success: true, deviceId };
}

// ---------------------------------------------------------------------------
// Assign / return / status
// ---------------------------------------------------------------------------

export async function assignDevice(input: {
  deviceId: string;
  employeeId: string;
  condition?: DeviceCondition | "";
  notes?: string;
}): Promise<DeviceActionResult> {
  const auth = await requireAdmin();
  if ("error" in auth) return auth;
  const { admin, supabase } = auth;

  if (!input.deviceId || !input.employeeId) {
    return { error: "Select a device and an employee." };
  }

  const { data: device, error: deviceError } = await supabase
    .from("devices")
    .select("id, status")
    .eq("id", input.deviceId)
    .maybeSingle();
  if (deviceError || !device) {
    return { error: deviceError?.message ?? "Device not found." };
  }
  if (device.status === "retired") return { error: "Retired devices cannot be assigned." };
  if (device.status === "assigned") {
    return { error: "This device is already assigned. Return it first." };
  }

  const { data: employee } = await supabase
    .from("profiles")
    .select("first_name, preferred_name")
    .eq("id", input.employeeId)
    .maybeSingle();

  const condition = isDeviceCondition(input.condition) ? input.condition : null;

  // A trigger moves the device to "assigned" once this row exists.
  const { error } = await supabase.from("device_assignments").insert({
    device_id: input.deviceId,
    employee_id: input.employeeId,
    assigned_by: admin.id,
    condition_out: condition,
    notes: clean(input.notes),
  });

  if (error) {
    return {
      error:
        error.code === "23505"
          ? "This device is already assigned. Return it first."
          : error.message,
    };
  }

  if (condition) {
    await supabase.from("devices").update({ condition }).eq("id", input.deviceId);
  }

  await logDeviceEvent(supabase, {
    deviceId: input.deviceId,
    kind: "assigned",
    summary: `Assigned to ${personName(employee) ?? "employee"}`,
    details: [
      condition ? `Condition: ${DEVICE_CONDITION_LABELS[condition]}` : null,
      clean(input.notes),
    ]
      .filter(Boolean)
      .join("\n"),
    actorId: admin.id,
  });

  revalidateDevicePaths(input.deviceId);
  return { success: true };
}

export async function returnDevice(input: {
  deviceId: string;
  condition?: DeviceCondition | "";
  notes?: string;
}): Promise<DeviceActionResult> {
  const auth = await requireAdmin();
  if ("error" in auth) return auth;
  const { admin, supabase } = auth;

  const { data: open, error: openError } = await supabase
    .from("device_assignments")
    .select("id, notes, employee_id")
    .eq("device_id", input.deviceId)
    .is("returned_at", null)
    .maybeSingle();

  if (openError) return { error: openError.message };
  if (!open) return { error: "This device has no active assignment." };

  const condition = isDeviceCondition(input.condition) ? input.condition : null;
  const returnNote = clean(input.notes);

  // A trigger moves the device back to "available".
  const { error } = await supabase
    .from("device_assignments")
    .update({
      returned_at: new Date().toISOString(),
      condition_in: condition,
      notes: returnNote
        ? [open.notes, `Return: ${returnNote}`].filter(Boolean).join("\n")
        : open.notes,
    })
    .eq("id", open.id);

  if (error) return { error: error.message };

  if (condition) {
    await supabase.from("devices").update({ condition }).eq("id", input.deviceId);
  }

  const { data: employee } = await supabase
    .from("profiles")
    .select("first_name, preferred_name")
    .eq("id", open.employee_id)
    .maybeSingle();
  const holder = personName(employee);

  await logDeviceEvent(supabase, {
    deviceId: input.deviceId,
    kind: "returned",
    summary: holder ? `Returned by ${holder}` : "Returned",
    details: [
      condition ? `Condition: ${DEVICE_CONDITION_LABELS[condition]}` : null,
      returnNote,
    ]
      .filter(Boolean)
      .join("\n"),
    actorId: admin.id,
  });

  revalidateDevicePaths(input.deviceId);
  return { success: true };
}

export async function updateDeviceStatus(input: {
  deviceId: string;
  status: Exclude<DeviceStatus, "assigned">;
  note?: string;
}): Promise<DeviceActionResult> {
  const auth = await requireAdmin();
  if ("error" in auth) return auth;
  const { admin, supabase } = auth;

  if (!["available", "repair", "retired"].includes(input.status)) {
    return { error: "Invalid status." };
  }

  // The database rejects this while the device is still assigned.
  const { error } = await supabase
    .from("devices")
    .update({ status: input.status })
    .eq("id", input.deviceId);

  if (error) {
    return {
      error: error.message.includes("Return device")
        ? "Return the device before changing its status."
        : error.message,
    };
  }

  await logDeviceEvent(supabase, {
    deviceId: input.deviceId,
    kind: "status",
    summary: `Marked ${DEVICE_STATUS_LABELS[input.status].toLowerCase()}`,
    details: input.note,
    actorId: admin.id,
  });

  revalidateDevicePaths(input.deviceId);
  return { success: true };
}

export async function addDeviceNote(input: {
  deviceId: string;
  note: string;
}): Promise<DeviceActionResult> {
  const auth = await requireAdmin();
  if ("error" in auth) return auth;

  const note = input.note.trim();
  if (!note) return { error: "Write a note first." };

  await logDeviceEvent(auth.supabase, {
    deviceId: input.deviceId,
    kind: "note",
    summary: `Note from ${personName(auth.admin)}`,
    details: note,
    actorId: auth.admin.id,
  });

  revalidateDevicePaths(input.deviceId);
  return { success: true };
}

// ---------------------------------------------------------------------------
// Files
// ---------------------------------------------------------------------------

export async function uploadDeviceFile(formData: FormData): Promise<DeviceActionResult> {
  const auth = await requireAdmin();
  if ("error" in auth) return auth;
  const { admin, supabase } = auth;

  const deviceId = String(formData.get("deviceId") ?? "");
  const label = formData.get("label");
  const file = formData.get("file");

  if (!deviceId) return { error: "Device is required." };
  if (!(file instanceof File) || file.size === 0) return { error: "Choose a file." };
  if (!DEVICE_FILE_MIME_TYPES.has(file.type)) {
    return { error: "Upload a JPG, PNG, WebP or PDF." };
  }
  if (file.size > MAX_DEVICE_FILE_BYTES) return { error: "Files must be 10 MB or smaller." };

  let storageKey: string;
  try {
    ({ storageKey } = await uploadDeviceFileObject(supabase, { deviceId, file }));
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Upload failed." };
  }

  const { error } = await supabase.from("device_files").insert({
    device_id: deviceId,
    label: isDeviceFileLabel(label) ? label : "other",
    file_name: file.name,
    file_type: file.type,
    file_size: file.size,
    storage_key: storageKey,
    uploaded_by: admin.id,
  });

  if (error) {
    await supabase.storage.from(DEVICES_BUCKET).remove([storageKey]);
    return { error: error.message };
  }

  await logDeviceEvent(supabase, {
    deviceId,
    kind: "file",
    summary: `Attached ${file.name}`,
    actorId: admin.id,
  });

  revalidateDevicePaths(deviceId);
  return { success: true };
}

export async function deleteDeviceFile(fileId: string): Promise<DeviceActionResult> {
  const auth = await requireAdmin();
  if ("error" in auth) return auth;
  const { supabase } = auth;

  const { data: file, error } = await supabase
    .from("device_files")
    .select("id, device_id, storage_key")
    .eq("id", fileId)
    .maybeSingle();
  if (error || !file) return { error: error?.message ?? "File not found." };

  const { error: deleteError } = await supabase
    .from("device_files")
    .delete()
    .eq("id", fileId);
  if (deleteError) return { error: deleteError.message };

  await supabase.storage.from(DEVICES_BUCKET).remove([file.storage_key]);

  revalidateDevicePaths(file.device_id);
  return { success: true };
}

// ---------------------------------------------------------------------------
// Categories
// ---------------------------------------------------------------------------

export interface DeviceCategoryInput {
  name: string;
  tagPrefix: string;
  template: string;
}

function categoryColumns(
  input: DeviceCategoryInput,
): { columns: Record<string, unknown> } | { error: string } {
  const name = input.name.trim();
  const tagPrefix = input.tagPrefix.trim().toUpperCase();
  if (!name) return { error: "Name the category." };
  if (!/^[A-Z]{2,4}$/.test(tagPrefix)) {
    return { error: "The ID code must be 2 to 4 letters, e.g. TB." };
  }
  if (!isDeviceTemplate(input.template)) return { error: "Choose which details to track." };
  return { columns: { name, tag_prefix: tagPrefix, template: input.template } };
}

function categoryError(error: { code?: string; message: string }): string {
  if (error.code !== "23505") return error.message;
  return error.message.includes("tag_prefix")
    ? "Another category already uses that ID code."
    : "A category with that name already exists.";
}

export async function createDeviceCategory(
  input: DeviceCategoryInput,
): Promise<DeviceActionResult> {
  const auth = await requireAdmin();
  if ("error" in auth) return auth;

  const mapped = categoryColumns(input);
  if ("error" in mapped) return mapped;

  const { data: last } = await auth.supabase
    .from("device_categories")
    .select("sort_order")
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { error } = await auth.supabase.from("device_categories").insert({
    ...mapped.columns,
    sort_order: (last?.sort_order ?? 0) + 10,
  });
  if (error) return { error: categoryError(error) };

  revalidateDevicePaths();
  return { success: true };
}

/** Renaming or re-coding a category never changes existing JA IDs. */
export async function updateDeviceCategory(
  categoryId: string,
  input: DeviceCategoryInput,
): Promise<DeviceActionResult> {
  const auth = await requireAdmin();
  if ("error" in auth) return auth;

  const mapped = categoryColumns(input);
  if ("error" in mapped) return mapped;

  const { error } = await auth.supabase
    .from("device_categories")
    .update(mapped.columns)
    .eq("id", categoryId);
  if (error) return { error: categoryError(error) };

  revalidateDevicePaths();
  return { success: true };
}

/** Archived categories stay on existing devices but are hidden when adding new ones. */
export async function setDeviceCategoryArchived(
  categoryId: string,
  archived: boolean,
): Promise<DeviceActionResult> {
  const auth = await requireAdmin();
  if ("error" in auth) return auth;

  const { error } = await auth.supabase
    .from("device_categories")
    .update({ archived_at: archived ? new Date().toISOString() : null })
    .eq("id", categoryId);
  if (error) return { error: error.message };

  revalidateDevicePaths();
  return { success: true };
}
