import { cache } from "react";
import { cookies } from "next/headers";
import {
  isDeviceCondition,
  isDeviceFileLabel,
  isDeviceTemplate,
  type DeviceAssignee,
  type DeviceAssignment,
  type DeviceCategory,
  type DeviceDetail,
  type DeviceEvent,
  type DeviceEventKind,
  type DeviceFile,
  type DeviceFormOptions,
  type DeviceRecord,
  type DeviceSpecs,
  type DeviceStatus,
} from "@/lib/devices/types";
import { OFFICE_LOCATIONS } from "@/lib/employees/office-locations";
import { createClient } from "@/utils/supabase/server";
import { firstRelation } from "@/utils/supabase/relations";

type Supabase = ReturnType<typeof createClient>;

const DEVICE_SELECT = `
  id, name, asset_tag, serial_number, manufacturer, model, color, status,
  condition, location, purchased_at, purchase_cost, purchase_currency,
  supplier, order_number, warranty_expires_at, specs, notes, created_at,
  category:device_categories ( id, name, tag_prefix, template ),
  legal_entity:legal_entities ( id, name )
`;

const ASSIGNMENT_SELECT =
  "id, device_id, employee_id, assigned_by, assigned_at, returned_at, notes, condition_out, condition_in";

const PERSON_SELECT =
  "id, first_name, last_name, preferred_name, email, job_title, gender, avatar_url, status";

interface DeviceRow {
  id: string;
  name: string;
  asset_tag: string;
  serial_number: string | null;
  manufacturer: string | null;
  model: string | null;
  color: string | null;
  status: string;
  condition: string | null;
  location: string | null;
  purchased_at: string | null;
  purchase_cost: number | string | null;
  purchase_currency: string | null;
  supplier: string | null;
  order_number: string | null;
  warranty_expires_at: string | null;
  specs: unknown;
  notes: string | null;
  created_at: string;
  category: unknown;
  legal_entity: unknown;
}

interface AssignmentRow {
  id: string;
  device_id: string;
  employee_id: string;
  assigned_by: string | null;
  assigned_at: string;
  returned_at: string | null;
  notes: string | null;
  condition_out: string | null;
  condition_in: string | null;
}

function displayPerson(person: {
  preferred_name?: string | null;
  first_name: string;
  last_name: string;
}): string {
  if (person.preferred_name?.trim()) return person.preferred_name.trim();
  return [person.first_name, person.last_name].filter(Boolean).join(" ");
}

function toSpecs(value: unknown): DeviceSpecs {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const specs: DeviceSpecs = {};
  for (const [key, raw] of Object.entries(value)) {
    if (typeof raw === "string" && raw.trim()) specs[key] = raw;
  }
  return specs;
}

function toDevice(
  row: DeviceRow,
  current: DeviceAssignment | null,
): DeviceRecord {
  const category = firstRelation(
    row.category as DeviceRecord["category"] | DeviceRecord["category"][] | null,
  );
  const legalEntity = firstRelation(
    row.legal_entity as
      | { id: string; name: string }
      | { id: string; name: string }[]
      | null,
  );

  return {
    id: row.id,
    name: row.name,
    asset_tag: row.asset_tag,
    category: category
      ? {
          ...category,
          template: isDeviceTemplate(category.template)
            ? category.template
            : "other",
        }
      : { id: "", name: "Uncategorised", tag_prefix: "OT", template: "other" },
    serial_number: row.serial_number,
    manufacturer: row.manufacturer,
    model: row.model,
    color: row.color,
    status: row.status as DeviceStatus,
    condition: isDeviceCondition(row.condition) ? row.condition : null,
    location: row.location,
    purchased_at: row.purchased_at,
    purchase_cost:
      row.purchase_cost === null ? null : Number(row.purchase_cost),
    purchase_currency: row.purchase_currency,
    supplier: row.supplier,
    order_number: row.order_number,
    legal_entity: legalEntity,
    warranty_expires_at: row.warranty_expires_at,
    specs: toSpecs(row.specs),
    notes: row.notes,
    created_at: row.created_at,
    current_assignment: current,
  };
}

async function loadPeople(
  supabase: Supabase,
  ids: (string | null | undefined)[],
): Promise<Map<string, DeviceAssignee>> {
  const unique = [...new Set(ids.filter(Boolean))] as string[];
  if (unique.length === 0) return new Map();

  const { data, error } = await supabase
    .from("profiles")
    .select(PERSON_SELECT)
    .in("id", unique);

  if (error) console.error("[devices] people", error.message);
  return new Map(
    (data ?? []).map((person) => [person.id, person as DeviceAssignee]),
  );
}

function toAssignment(
  row: AssignmentRow,
  people: Map<string, DeviceAssignee>,
): DeviceAssignment {
  const assignedBy = row.assigned_by ? people.get(row.assigned_by) : null;
  return {
    id: row.id,
    device_id: row.device_id,
    employee_id: row.employee_id,
    assigned_at: row.assigned_at,
    returned_at: row.returned_at,
    notes: row.notes,
    condition_out: isDeviceCondition(row.condition_out) ? row.condition_out : null,
    condition_in: isDeviceCondition(row.condition_in) ? row.condition_in : null,
    employee: people.get(row.employee_id) ?? null,
    assigned_by_name: assignedBy ? displayPerson(assignedBy) : null,
  };
}

export async function getDevices(): Promise<DeviceRecord[]> {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  const { data: devices, error } = await supabase
    .from("devices")
    .select(DEVICE_SELECT)
    .order("created_at", { ascending: false });

  if (error || !devices) {
    if (error) console.error("[getDevices]", error.message);
    return [];
  }
  if (devices.length === 0) return [];

  const { data: open, error: openError } = await supabase
    .from("device_assignments")
    .select(ASSIGNMENT_SELECT)
    .in(
      "device_id",
      devices.map((device) => device.id),
    )
    .is("returned_at", null);

  if (openError) console.error("[getDevices] assignments", openError.message);

  const rows = (open ?? []) as AssignmentRow[];
  const people = await loadPeople(
    supabase,
    rows.flatMap((row) => [row.employee_id, row.assigned_by]),
  );
  const currentByDevice = new Map(
    rows.map((row) => [row.device_id, toAssignment(row, people)]),
  );

  return (devices as DeviceRow[]).map((row) =>
    toDevice(row, currentByDevice.get(row.id) ?? null),
  );
}

export async function getDevice(id: string): Promise<DeviceDetail | null> {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  const { data: row, error } = await supabase
    .from("devices")
    .select(DEVICE_SELECT)
    .eq("id", id)
    .maybeSingle();

  if (error || !row) {
    if (error) console.error("[getDevice]", error.message);
    return null;
  }

  const [assignments, events, files] = await Promise.all([
    supabase
      .from("device_assignments")
      .select(ASSIGNMENT_SELECT)
      .eq("device_id", id)
      .order("assigned_at", { ascending: false }),
    supabase
      .from("device_events")
      .select("id, kind, summary, details, actor_id, created_at")
      .eq("device_id", id)
      .order("created_at", { ascending: false }),
    supabase
      .from("device_files")
      .select("id, label, file_name, file_type, file_size, uploaded_by, created_at")
      .eq("device_id", id)
      .order("created_at", { ascending: false }),
  ]);

  for (const result of [assignments, events, files]) {
    if (result.error) console.error("[getDevice]", result.error.message);
  }

  const assignmentRows = (assignments.data ?? []) as AssignmentRow[];
  const people = await loadPeople(supabase, [
    ...assignmentRows.flatMap((item) => [item.employee_id, item.assigned_by]),
    ...(events.data ?? []).map((item) => item.actor_id as string | null),
    ...(files.data ?? []).map((item) => item.uploaded_by as string | null),
  ]);

  const history = assignmentRows.map((item) => toAssignment(item, people));
  const nameOf = (personId: string | null) => {
    const person = personId ? people.get(personId) : null;
    return person ? displayPerson(person) : null;
  };

  return {
    ...toDevice(
      row as DeviceRow,
      history.find((item) => item.returned_at === null) ?? null,
    ),
    history,
    events: (events.data ?? []).map(
      (item): DeviceEvent => ({
        id: item.id,
        kind: item.kind as DeviceEventKind,
        summary: item.summary,
        details: item.details,
        actor_name: nameOf(item.actor_id),
        created_at: item.created_at,
      }),
    ),
    files: (files.data ?? []).map(
      (item): DeviceFile => ({
        id: item.id,
        label: isDeviceFileLabel(item.label) ? item.label : "other",
        file_name: item.file_name,
        file_type: item.file_type,
        file_size: item.file_size,
        uploaded_by_name: nameOf(item.uploaded_by),
        created_at: item.created_at,
      }),
    ),
  };
}

export const getDeviceCategories = cache(
  async (): Promise<DeviceCategory[]> => {
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    const [{ data, error }, { data: usage }] = await Promise.all([
      supabase
        .from("device_categories")
        .select("id, name, tag_prefix, template, sort_order, archived_at")
        .order("sort_order", { ascending: true })
        .order("name", { ascending: true }),
      supabase.from("devices").select("category_id"),
    ]);

    if (error || !data) {
      if (error) console.error("[getDeviceCategories]", error.message);
      return [];
    }

    const counts = new Map<string, number>();
    for (const item of usage ?? []) {
      counts.set(item.category_id, (counts.get(item.category_id) ?? 0) + 1);
    }

    return data.map((item) => ({
      id: item.id,
      name: item.name,
      tag_prefix: item.tag_prefix,
      template: isDeviceTemplate(item.template) ? item.template : "other",
      sort_order: item.sort_order,
      archived: item.archived_at !== null,
      device_count: counts.get(item.id) ?? 0,
    }));
  },
);

function distinctSorted(values: (string | null)[]): string[] {
  return [
    ...new Set(values.map((value) => value?.trim()).filter(Boolean)),
  ].sort((a, b) => a!.localeCompare(b!)) as string[];
}

export async function getDeviceFormOptions(
  devices: DeviceRecord[],
): Promise<DeviceFormOptions> {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  const [categories, { data: entities, error }] = await Promise.all([
    getDeviceCategories(),
    supabase
      .from("legal_entities")
      .select("id, name")
      .order("name", { ascending: true }),
  ]);

  if (error) console.error("[getDeviceFormOptions] entities", error.message);

  return {
    categories,
    legalEntities: entities ?? [],
    locations: distinctSorted([
      ...OFFICE_LOCATIONS,
      ...devices.map((device) => device.location),
    ]),
    manufacturers: distinctSorted(devices.map((device) => device.manufacturer)),
    models: distinctSorted(devices.map((device) => device.model)),
    suppliers: distinctSorted(devices.map((device) => device.supplier)),
  };
}

export async function getAssignableEmployees(): Promise<DeviceAssignee[]> {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  const { data, error } = await supabase
    .from("profiles")
    .select(PERSON_SELECT)
    .eq("status", "active")
    .order("first_name", { ascending: true });

  if (error || !data) {
    if (error) console.error("[getAssignableEmployees]", error.message);
    return [];
  }

  return data as DeviceAssignee[];
}
