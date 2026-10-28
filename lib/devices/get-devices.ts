import { cookies } from "next/headers";
import type {
  DeviceAssignee,
  DeviceAssignment,
  DeviceRecord,
  DeviceStatus,
} from "@/lib/devices/types";
import type { AssetKind } from "@/lib/types/employee";
import { createClient } from "@/utils/supabase/server";

function displayPerson(person: {
  preferred_name?: string | null;
  first_name: string;
  last_name: string;
}): string {
  if (person.preferred_name?.trim()) return person.preferred_name.trim();
  return [person.first_name, person.last_name].filter(Boolean).join(" ");
}

export async function getDevices(): Promise<DeviceRecord[]> {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  const { data: devices, error } = await supabase
    .from("devices")
    .select(
      "id, kind, name, asset_tag, serial_number, manufacturer, model, color, status, purchased_at, notes, created_at",
    )
    .order("created_at", { ascending: false });

  if (error || !devices) {
    if (error) console.error("[getDevices]", error.message);
    return [];
  }

  if (devices.length === 0) return [];

  const deviceIds = devices.map((device) => device.id);

  const { data: assignments, error: assignmentError } = await supabase
    .from("device_assignments")
    .select(
      "id, device_id, employee_id, assigned_by, assigned_at, returned_at, notes",
    )
    .in("device_id", deviceIds)
    .order("assigned_at", { ascending: false });

  if (assignmentError) {
    console.error("[getDevices] assignments", assignmentError.message);
  }

  const peopleIds = [
    ...new Set(
      (assignments ?? []).flatMap((row) =>
        [row.employee_id, row.assigned_by].filter(Boolean),
      ),
    ),
  ] as string[];

  const { data: people } = peopleIds.length
    ? await supabase
        .from("profiles")
        .select(
          "id, first_name, last_name, preferred_name, email, job_title, gender, avatar_url",
        )
        .in("id", peopleIds)
    : { data: [] as DeviceAssignee[] };

  const peopleMap = new Map(
    (people ?? []).map((person) => [person.id, person as DeviceAssignee]),
  );

  const historyByDevice = new Map<string, DeviceAssignment[]>();

  for (const row of assignments ?? []) {
    const employee = peopleMap.get(row.employee_id) ?? null;
    const assignedBy = row.assigned_by
      ? peopleMap.get(row.assigned_by)
      : null;

    const entry: DeviceAssignment = {
      id: row.id,
      device_id: row.device_id,
      employee_id: row.employee_id,
      assigned_at: row.assigned_at,
      returned_at: row.returned_at,
      notes: row.notes,
      employee,
      assigned_by_name: assignedBy ? displayPerson(assignedBy) : null,
    };

    const list = historyByDevice.get(row.device_id) ?? [];
    list.push(entry);
    historyByDevice.set(row.device_id, list);
  }

  return devices.map((device) => {
    const history = historyByDevice.get(device.id) ?? [];
    const current =
      history.find((item) => item.returned_at === null) ?? null;

    return {
      id: device.id,
      kind: device.kind as AssetKind,
      name: device.name,
      asset_tag: device.asset_tag,
      serial_number: device.serial_number,
      manufacturer: device.manufacturer,
      model: device.model,
      color: device.color,
      status: device.status as DeviceStatus,
      purchased_at: device.purchased_at,
      notes: device.notes,
      created_at: device.created_at,
      current_assignment: current,
      history,
    };
  });
}

export async function getAssignableEmployees(): Promise<DeviceAssignee[]> {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  const { data, error } = await supabase
    .from("profiles")
    .select(
      "id, first_name, last_name, preferred_name, email, job_title, gender, avatar_url",
    )
    .eq("status", "active")
    .order("first_name", { ascending: true });

  if (error || !data) {
    if (error) console.error("[getAssignableEmployees]", error.message);
    return [];
  }

  return data as DeviceAssignee[];
}
