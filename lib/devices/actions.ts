"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { getCurrentProfile } from "@/lib/auth/get-profile";
import type { DeviceStatus } from "@/lib/devices/types";
import type { AssetKind } from "@/lib/types/employee";
import { isOrgAdmin } from "@/lib/types/database";
import { createClient } from "@/utils/supabase/server";

export interface DeviceActionResult {
  error?: string;
  success?: boolean;
}

export interface CreateDeviceInput {
  kind: AssetKind;
  name: string;
  serialNumber?: string;
  manufacturer?: string;
  model?: string;
  color?: string;
  purchasedAt?: string;
  notes?: string;
}

export async function createDevice(
  input: CreateDeviceInput,
): Promise<DeviceActionResult> {
  const profile = await getCurrentProfile();
  if (!profile || !isOrgAdmin(profile)) {
    return { error: "Only org admins can add devices." };
  }

  const name = input.name.trim();
  // Everything except type and name is optional so older devices with
  // incomplete records can still be logged.
  const serialNumber = input.serialNumber?.trim() || null;
  if (!name) {
    return { error: "Add a device name." };
  }

  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  // asset_tag is assigned by a database trigger.
  const { error } = await supabase.from("devices").insert({
    kind: input.kind,
    name,
    serial_number: serialNumber,
    manufacturer: input.manufacturer?.trim() || null,
    model: input.model?.trim() || null,
    color: input.color?.trim() || null,
    purchased_at: input.purchasedAt || null,
    notes: input.notes?.trim() || null,
    status: "available" satisfies DeviceStatus,
  });

  if (error) {
    if (error.code === "23505") {
      return { error: "A device with that serial number already exists." };
    }
    return { error: error.message };
  }

  revalidatePath("/admin/devices");
  return { success: true };
}

export async function assignDevice(input: {
  deviceId: string;
  employeeId: string;
  notes?: string;
}): Promise<DeviceActionResult> {
  const profile = await getCurrentProfile();
  if (!profile || !isOrgAdmin(profile)) {
    return { error: "Only org admins can assign devices." };
  }

  if (!input.deviceId || !input.employeeId) {
    return { error: "Select a device and an employee." };
  }

  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  const { data: device, error: deviceError } = await supabase
    .from("devices")
    .select("id, status")
    .eq("id", input.deviceId)
    .maybeSingle();

  if (deviceError || !device) {
    return { error: deviceError?.message ?? "Device not found." };
  }

  if (device.status === "retired") {
    return { error: "Retired devices cannot be assigned." };
  }

  const { data: openAssignment } = await supabase
    .from("device_assignments")
    .select("id")
    .eq("device_id", input.deviceId)
    .is("returned_at", null)
    .maybeSingle();

  if (openAssignment) {
    return { error: "This device is already assigned. Return it first." };
  }

  const { error: assignError } = await supabase.from("device_assignments").insert({
    device_id: input.deviceId,
    employee_id: input.employeeId,
    assigned_by: profile.id,
    notes: input.notes?.trim() || null,
  });

  if (assignError) {
    return { error: assignError.message };
  }

  const { error: statusError } = await supabase
    .from("devices")
    .update({ status: "assigned" satisfies DeviceStatus })
    .eq("id", input.deviceId);

  if (statusError) {
    return { error: statusError.message };
  }

  revalidatePath("/admin/devices");
  revalidatePath("/settings");
  return { success: true };
}

export async function returnDevice(input: {
  deviceId: string;
  notes?: string;
}): Promise<DeviceActionResult> {
  const profile = await getCurrentProfile();
  if (!profile || !isOrgAdmin(profile)) {
    return { error: "Only org admins can return devices." };
  }

  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  const { data: openAssignment, error: openError } = await supabase
    .from("device_assignments")
    .select("id, notes")
    .eq("device_id", input.deviceId)
    .is("returned_at", null)
    .maybeSingle();

  if (openError) {
    return { error: openError.message };
  }
  if (!openAssignment) {
    return { error: "This device has no active assignment." };
  }

  const returnNote = input.notes?.trim();
  const nextNotes = returnNote
    ? [openAssignment.notes, `Return: ${returnNote}`].filter(Boolean).join("\n")
    : openAssignment.notes;

  const { error: returnError } = await supabase
    .from("device_assignments")
    .update({
      returned_at: new Date().toISOString(),
      notes: nextNotes,
    })
    .eq("id", openAssignment.id);

  if (returnError) {
    return { error: returnError.message };
  }

  const { error: statusError } = await supabase
    .from("devices")
    .update({ status: "available" satisfies DeviceStatus })
    .eq("id", input.deviceId);

  if (statusError) {
    return { error: statusError.message };
  }

  revalidatePath("/admin/devices");
  revalidatePath("/settings");
  return { success: true };
}

export async function updateDeviceStatus(input: {
  deviceId: string;
  status: Exclude<DeviceStatus, "assigned">;
}): Promise<DeviceActionResult> {
  const profile = await getCurrentProfile();
  if (!profile || !isOrgAdmin(profile)) {
    return { error: "Only org admins can update device status." };
  }

  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  if (input.status !== "repair" && input.status !== "retired" && input.status !== "available") {
    return { error: "Invalid status." };
  }

  const { data: openAssignment } = await supabase
    .from("device_assignments")
    .select("id")
    .eq("device_id", input.deviceId)
    .is("returned_at", null)
    .maybeSingle();

  if (openAssignment && input.status !== "available") {
    return { error: "Return the device before changing its status." };
  }

  const { error } = await supabase
    .from("devices")
    .update({ status: input.status })
    .eq("id", input.deviceId);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/admin/devices");
  return { success: true };
}
