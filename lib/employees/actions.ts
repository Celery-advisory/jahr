"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { getCurrentProfile } from "@/lib/auth/get-profile";
import {
  canAssignTag,
  hasTag,
  isOrgAdmin,
  parseTagSlugs,
  PERMISSION_TAG_LABELS,
  PERMISSION_TAG_SLUGS,
  syncRoleFromTags,
  type PermissionTagSlug,
} from "@/lib/auth/permissions";
import {
  isImmigrationStatus,
  type ImmigrationStatus,
} from "@/lib/employees/immigration";
import { isOfficeLocation } from "@/lib/employees/office-locations";
import type {
  EmployeeCategory,
  EmploymentType,
  WorkType,
} from "@/lib/types/employee";
import {
  allocatePayrollNumber,
  isPayrollNumber,
  needsPayrollNumber,
} from "@/lib/payroll/payroll-number";
import { createAdminClient } from "@/utils/supabase/admin";
import { createClient } from "@/utils/supabase/server";
import {
  settleDevicesForOffboarding,
  type OffboardingDeviceDecision,
} from "@/lib/devices/events";

export interface EmployeeActionResult {
  error?: string;
  success?: boolean;
  employeeId?: string;
}

export interface CreateEmployeeInput {
  firstName: string;
  lastName: string;
  preferredName: string;
  email: string;
  personalEmail: string;
  phone: string;
  dateOfBirth: string;
  gender: string;
  nationality: string;
  nationalId: string;
  ssnitNumber: string;
  tinNumber: string;
  immigrationStatus: string;
  workPermitNumber: string;
  workPermitExpiry: string;
  addressLine: string;
  city: string;
  country: string;
  jobTitle: string;
  employeeNumber: string;
  tags: PermissionTagSlug[];
  status: "active" | "inactive" | "onboarding";
  employeeCategory: EmployeeCategory;
  workType: WorkType;
  employmentType: EmploymentType;
  officeLocation: string;
  startDate: string;
  probationEndDate: string;
  annualLeaveEntitlement: number;
  businessUnitId: string;
  departmentId: string;
  managerId: string;
  emergencyName: string;
  emergencyRelationship: string;
  emergencyPhone: string;
}

export type UpdateEmployeeInput = Omit<CreateEmployeeInput, "email" | "status"> & {
  employeeId: string;
  status: "active" | "inactive" | "onboarding" | "terminated";
  terminationDate: string;
  leavingReason: string;
};

export interface OffboardEmployeeInput {
  employeeId: string;
  terminationDate: string;
  leavingReason: string;
  /** What happened to each company device they still hold. */
  devices?: OffboardingDeviceDecision[];
}

const HIRE_STATUSES = ["active", "inactive", "onboarding"] as const;

const EDITABLE_STATUSES = [
  "active",
  "inactive",
  "onboarding",
  "terminated",
] as const;

function clean(value: string): string {
  return value.trim();
}

function emptyToNull(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function parseOfficeLocation(value: string): string | null {
  const trimmed = clean(value);
  if (!trimmed) return null;
  if (!isOfficeLocation(trimmed)) {
    return "__invalid__";
  }
  return trimmed;
}

function parseImmigrationStatus(value: string): ImmigrationStatus | null {
  const trimmed = clean(value);
  if (!trimmed) return null;
  if (!isImmigrationStatus(trimmed)) {
    return null;
  }
  return trimmed;
}

function validateTagAssignment(
  viewer: { tags: readonly PermissionTagSlug[] },
  tags: PermissionTagSlug[],
  previous: readonly PermissionTagSlug[] = [],
): string | null {
  for (const slug of tags) {
    if (!(PERMISSION_TAG_SLUGS as readonly string[]).includes(slug)) {
      return `Unknown permission tag: ${slug}`;
    }
    if (!previous.includes(slug) && !canAssignTag(viewer, slug)) {
      return `You cannot assign the ${PERMISSION_TAG_LABELS[slug]} tag.`;
    }
  }
  for (const slug of previous) {
    if (!tags.includes(slug) && !canAssignTag(viewer, slug)) {
      return `You cannot remove the ${PERMISSION_TAG_LABELS[slug]} tag.`;
    }
  }
  return null;
}

async function resolveEmployeeNumber(
  admin: ReturnType<typeof createAdminClient>,
  manualValue: string,
): Promise<{ value?: string; error?: string }> {
  const trimmed = manualValue.trim();
  if (trimmed) {
    const normalized = trimmed.toUpperCase();
    if (!isPayrollNumber(normalized)) {
      return {
        error:
          "Employee number must match JA26-0100 (JA, 2-digit year, 4-character code).",
      };
    }
    return { value: normalized };
  }

  try {
    return { value: await allocatePayrollNumber(admin) };
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? error.message
          : "Could not assign an employee number.",
    };
  }
}

/**
 * Sync tags via service role after the server action has already verified
 * the viewer is an org admin. Delete-then-insert under the user session
 * breaks self-edits: removing your own admin tags makes RLS reject the
 * following insert.
 */
async function replaceProfileTags(options: {
  profileId: string;
  tags: PermissionTagSlug[];
  assignedBy: string;
}): Promise<string | null> {
  const { profileId, tags, assignedBy } = options;
  const admin = createAdminClient();

  const { data: catalogue, error: catalogueError } = await admin
    .from("permission_tags")
    .select("id, slug");

  if (catalogueError) {
    return catalogueError.message;
  }

  const idBySlug = new Map(
    (catalogue ?? []).map((row) => [row.slug as string, row.id as string]),
  );

  const { data: existingRows, error: existingError } = await admin
    .from("profile_permission_tags")
    .select("tag_id")
    .eq("profile_id", profileId);

  if (existingError) {
    return existingError.message;
  }

  const desiredTagIds = new Set(
    tags.flatMap((slug) => {
      const tagId = idBySlug.get(slug);
      return tagId ? [tagId] : [];
    }),
  );

  if (tags.length > 0 && desiredTagIds.size === 0) {
    return "Could not resolve permission tags.";
  }

  const existingTagIds = new Set(
    (existingRows ?? []).map((row) => row.tag_id as string),
  );

  const toInsert = [...desiredTagIds]
    .filter((tagId) => !existingTagIds.has(tagId))
    .map((tagId) => ({
      profile_id: profileId,
      tag_id: tagId,
      assigned_by: assignedBy,
    }));

  const toDelete = [...existingTagIds].filter(
    (tagId) => !desiredTagIds.has(tagId),
  );

  // Insert first so self-edits never briefly lose org-admin tags.
  if (toInsert.length > 0) {
    const { error: insertError } = await admin
      .from("profile_permission_tags")
      .insert(toInsert);
    if (insertError) {
      return insertError.message;
    }
  }

  if (toDelete.length > 0) {
    const { error: deleteError } = await admin
      .from("profile_permission_tags")
      .delete()
      .eq("profile_id", profileId)
      .in("tag_id", toDelete);
    if (deleteError) {
      return deleteError.message;
    }
  }

  return null;
}

function revalidateEmployeePaths(employeeId: string) {
  revalidatePath("/admin/employees");
  revalidatePath("/admin/alumni");
  revalidatePath("/organogram");
  revalidatePath("/admin/payroll");
  revalidatePath(`/admin/employees/${employeeId}`);
  revalidatePath(`/admin/employees/${employeeId}/edit`);
}

export async function createEmployee(
  input: CreateEmployeeInput,
): Promise<EmployeeActionResult> {
  const viewer = await getCurrentProfile();
  if (!viewer || !isOrgAdmin(viewer)) {
    return { error: "Only org admins can add employees." };
  }

  const firstName = clean(input.firstName);
  const lastName = clean(input.lastName);
  const email = clean(input.email).toLowerCase();
  const nationalId = emptyToNull(input.nationalId);
  const jobTitle = clean(input.jobTitle);
  const startDate = clean(input.startDate);
  const phone = clean(input.phone);
  const officeLocation = parseOfficeLocation(input.officeLocation);
  const immigrationStatus = parseImmigrationStatus(input.immigrationStatus);
  const tags = parseTagSlugs(input.tags);

  if (!firstName || !lastName) {
    return { error: "Add first and last name." };
  }
  if (!email || !email.includes("@")) {
    return { error: "A valid work email is required." };
  }
  if (!jobTitle) {
    return { error: "Job title is required." };
  }
  if (!phone) {
    return { error: "Phone number is required." };
  }
  if (officeLocation === "__invalid__") {
    return { error: "Select a valid office location." };
  }
  if (clean(input.immigrationStatus) && !immigrationStatus) {
    return { error: "Select a valid immigration status." };
  }

  const tagError = validateTagAssignment(viewer, tags);
  if (tagError) {
    return { error: tagError };
  }
  if (!(HIRE_STATUSES as readonly string[]).includes(input.status)) {
    return { error: "Select a valid employment status." };
  }

  const admin = createAdminClient();

  const employeeNumberResult = await resolveEmployeeNumber(
    admin,
    input.employeeNumber,
  );
  if (employeeNumberResult.error || !employeeNumberResult.value) {
    return { error: employeeNumberResult.error ?? "Invalid employee number." };
  }
  const employeeNumber = employeeNumberResult.value;

  const { data: authData, error: authError } = await admin.auth.admin.createUser({
    email,
    email_confirm: true,
    user_metadata: {
      full_name: `${firstName} ${lastName}`.trim(),
    },
  });

  if (authError || !authData.user) {
    return {
      error: authError?.message ?? "Could not create the auth account.",
    };
  }

  const userId = authData.user.id;
  const legacyRole = syncRoleFromTags(tags);

  const { error: profileError } = await admin.from("profiles").upsert(
    {
      id: userId,
      email,
      first_name: firstName,
      last_name: lastName,
      preferred_name: emptyToNull(input.preferredName),
      personal_email: emptyToNull(input.personalEmail),
      phone,
      date_of_birth: emptyToNull(input.dateOfBirth),
      gender: emptyToNull(input.gender),
      nationality: emptyToNull(input.nationality) ?? "Ghanaian",
      national_id: nationalId,
      ssnit_number: emptyToNull(input.ssnitNumber),
      tin_number: emptyToNull(input.tinNumber),
      immigration_status: immigrationStatus,
      work_permit_number: emptyToNull(input.workPermitNumber),
      work_permit_expiry: emptyToNull(input.workPermitExpiry),
      address_line: emptyToNull(input.addressLine),
      city: emptyToNull(input.city),
      country: emptyToNull(input.country) ?? "Ghana",
      job_title: jobTitle,
      employee_number: employeeNumber,
      role: legacyRole,
      status: input.status,
      employee_category: input.employeeCategory,
      work_type: input.workType,
      employment_type: input.employmentType,
      office_location: officeLocation,
      start_date: emptyToNull(startDate),
      probation_end_date: emptyToNull(input.probationEndDate),
      annual_leave_entitlement: input.annualLeaveEntitlement || 25,
      business_unit_id: emptyToNull(input.businessUnitId),
      department_id: emptyToNull(input.departmentId),
      manager_id: emptyToNull(input.managerId),
    },
    { onConflict: "id" },
  );

  if (profileError) {
    await admin.auth.admin.deleteUser(userId);
    return { error: profileError.message };
  }

  const tagsWriteError = await replaceProfileTags({
    profileId: userId,
    tags,
    assignedBy: viewer.id,
  });
  if (tagsWriteError) {
    await admin.auth.admin.deleteUser(userId);
    return { error: tagsWriteError };
  }

  const emergencyName = clean(input.emergencyName);
  const emergencyPhone = clean(input.emergencyPhone);
  if (emergencyName && emergencyPhone) {
    await admin.from("emergency_contacts").insert({
      employee_id: userId,
      full_name: emergencyName,
      relationship: emptyToNull(input.emergencyRelationship) ?? "Emergency",
      phone: emergencyPhone,
      is_primary: true,
    });
  }

  revalidateEmployeePaths(userId);
  return { success: true, employeeId: userId };
}

export async function updateEmployee(
  input: UpdateEmployeeInput,
): Promise<EmployeeActionResult> {
  const viewer = await getCurrentProfile();
  if (!viewer || !isOrgAdmin(viewer)) {
    return { error: "Only org admins can amend employees." };
  }

  const employeeId = clean(input.employeeId);
  if (!employeeId) {
    return { error: "Employee is required." };
  }

  const firstName = clean(input.firstName);
  const lastName = clean(input.lastName);
  const jobTitle = clean(input.jobTitle);
  const startDate = clean(input.startDate);
  const phone = clean(input.phone);
  const officeLocation = parseOfficeLocation(input.officeLocation);
  const immigrationStatus = parseImmigrationStatus(input.immigrationStatus);
  const tags = parseTagSlugs(input.tags);

  if (!firstName || !lastName) {
    return { error: "Add first and last name." };
  }
  if (!jobTitle) {
    return { error: "Job title is required." };
  }
  if (!phone) {
    return { error: "Phone number is required." };
  }
  if (officeLocation === "__invalid__") {
    return { error: "Select a valid office location." };
  }
  if (clean(input.immigrationStatus) && !immigrationStatus) {
    return { error: "Select a valid immigration status." };
  }
  if (!(EDITABLE_STATUSES as readonly string[]).includes(input.status)) {
    return { error: "Invalid employment status." };
  }

  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);
  const admin = createAdminClient();

  const { data: existing, error: existingError } = await supabase
    .from("profiles")
    .select("id, employee_number")
    .eq("id", employeeId)
    .maybeSingle();

  if (existingError || !existing) {
    return { error: existingError?.message ?? "Employee not found." };
  }

  const { data: existingTagRows } = await supabase
    .from("profile_permission_tags")
    .select("tag:permission_tags(slug)")
    .eq("profile_id", employeeId);

  const previousTags: PermissionTagSlug[] = [];
  for (const row of existingTagRows ?? []) {
    const tag = Array.isArray(row.tag) ? row.tag[0] : row.tag;
    const slug =
      tag && typeof tag === "object" && "slug" in tag
        ? String((tag as { slug: string }).slug)
        : null;
    if (slug && (PERMISSION_TAG_SLUGS as readonly string[]).includes(slug)) {
      previousTags.push(slug as PermissionTagSlug);
    }
  }

  const tagError = validateTagAssignment(viewer, tags, previousTags);
  if (tagError) {
    return { error: tagError };
  }

  if (
    previousTags.includes("ceo") &&
    !tags.includes("ceo") &&
    !hasTag(viewer, "ceo") &&
    !hasTag(viewer, "super_admin")
  ) {
    return { error: "Only the CEO or a super admin can remove the CEO tag." };
  }

  const terminationDate =
    input.status === "terminated"
      ? emptyToNull(input.terminationDate) ??
        new Date().toISOString().slice(0, 10)
      : null;
  const leavingReason =
    input.status === "terminated"
      ? emptyToNull(input.leavingReason)
      : null;

  let employeeNumber = existing.employee_number;
  const manualEmployeeNumber = clean(input.employeeNumber);
  if (manualEmployeeNumber) {
    const normalized = manualEmployeeNumber.toUpperCase();
    if (!isPayrollNumber(normalized)) {
      return {
        error:
          "Employee number must match JA26-0100 (JA, 2-digit year, 4-character code).",
      };
    }
    employeeNumber = normalized;
  } else if (!employeeNumber || needsPayrollNumber(employeeNumber)) {
    const assigned = await resolveEmployeeNumber(admin, "");
    if (assigned.error || !assigned.value) {
      return { error: assigned.error ?? "Could not assign an employee number." };
    }
    employeeNumber = assigned.value;
  }

  const { error: updateError } = await supabase
    .from("profiles")
    .update({
      first_name: firstName,
      last_name: lastName,
      preferred_name: emptyToNull(input.preferredName),
      personal_email: emptyToNull(input.personalEmail),
      phone,
      date_of_birth: emptyToNull(input.dateOfBirth),
      gender: emptyToNull(input.gender),
      nationality: emptyToNull(input.nationality),
      national_id: emptyToNull(input.nationalId),
      ssnit_number: emptyToNull(input.ssnitNumber),
      tin_number: emptyToNull(input.tinNumber),
      immigration_status: immigrationStatus,
      work_permit_number: emptyToNull(input.workPermitNumber),
      work_permit_expiry: emptyToNull(input.workPermitExpiry),
      address_line: emptyToNull(input.addressLine),
      city: emptyToNull(input.city),
      country: emptyToNull(input.country) ?? "Ghana",
      job_title: jobTitle,
      employee_number: employeeNumber,
      role: syncRoleFromTags(tags),
      status: input.status,
      employee_category: input.employeeCategory,
      work_type: input.workType,
      employment_type: input.employmentType,
      office_location: officeLocation,
      start_date: emptyToNull(startDate),
      probation_end_date: emptyToNull(input.probationEndDate),
      annual_leave_entitlement: input.annualLeaveEntitlement || 25,
      business_unit_id: emptyToNull(input.businessUnitId),
      department_id: emptyToNull(input.departmentId),
      manager_id: emptyToNull(input.managerId),
      termination_date: terminationDate,
      leaving_reason: leavingReason,
    })
    .eq("id", employeeId);

  if (updateError) {
    return { error: updateError.message };
  }

  const tagsWriteError = await replaceProfileTags({
    profileId: employeeId,
    tags,
    assignedBy: viewer.id,
  });
  if (tagsWriteError) {
    return { error: tagsWriteError };
  }

  const emergencyName = clean(input.emergencyName);
  const emergencyPhone = clean(input.emergencyPhone);
  if (emergencyName && emergencyPhone) {
    const { data: primary } = await supabase
      .from("emergency_contacts")
      .select("id")
      .eq("employee_id", employeeId)
      .eq("is_primary", true)
      .maybeSingle();

    if (primary) {
      await supabase
        .from("emergency_contacts")
        .update({
          full_name: emergencyName,
          relationship: emptyToNull(input.emergencyRelationship) ?? "Emergency",
          phone: emergencyPhone,
        })
        .eq("id", primary.id);
    } else {
      await supabase.from("emergency_contacts").insert({
        employee_id: employeeId,
        full_name: emergencyName,
        relationship: emptyToNull(input.emergencyRelationship) ?? "Emergency",
        phone: emergencyPhone,
        is_primary: true,
      });
    }
  }

  revalidateEmployeePaths(employeeId);
  return { success: true, employeeId };
}

export async function offboardEmployee(
  input: OffboardEmployeeInput,
): Promise<EmployeeActionResult> {
  const viewer = await getCurrentProfile();
  if (!viewer || !isOrgAdmin(viewer)) {
    return { error: "Only org admins can offboard employees." };
  }

  const employeeId = clean(input.employeeId);
  if (!employeeId) {
    return { error: "Employee is required." };
  }
  if (employeeId === viewer.id) {
    return { error: "You cannot offboard your own account." };
  }

  const terminationDate =
    emptyToNull(input.terminationDate) ??
    new Date().toISOString().slice(0, 10);
  const leavingReason = emptyToNull(input.leavingReason);
  if (!leavingReason) {
    return { error: "A reason for leaving is required." };
  }

  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  const { data: existing, error: existingError } = await supabase
    .from("profiles")
    .select("id, status, first_name, preferred_name")
    .eq("id", employeeId)
    .maybeSingle();

  if (existingError || !existing) {
    return { error: existingError?.message ?? "Employee not found." };
  }
  if (existing.status === "terminated") {
    return { error: "This person is already in Alumni." };
  }

  // Settle devices first so a failure leaves the employee untouched.
  const devices = await settleDevicesForOffboarding(supabase, {
    employeeId,
    employeeName: existing.preferred_name?.trim() || existing.first_name,
    actorId: viewer.id,
    decisions: input.devices ?? [],
  });
  if (devices.error) {
    return { error: devices.error };
  }

  const { error: updateError } = await supabase
    .from("profiles")
    .update({
      status: "terminated",
      termination_date: terminationDate,
      leaving_reason: leavingReason,
    })
    .eq("id", employeeId);

  if (updateError) {
    return { error: updateError.message };
  }

  revalidateEmployeePaths(employeeId);
  revalidatePath("/admin/devices");
  return { success: true, employeeId };
}

export async function getOrgOptionsForHire(): Promise<{
  businessUnits: Array<{ id: string; name: string }>;
  departments: Array<{
    id: string;
    name: string;
    business_unit_id: string;
  }>;
  managers: Array<{
    id: string;
    first_name: string;
    last_name: string;
    preferred_name: string | null;
    job_title: string | null;
  }>;
}> {
  const viewer = await getCurrentProfile();
  if (!viewer || !isOrgAdmin(viewer)) {
    return { businessUnits: [], departments: [], managers: [] };
  }

  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  const [units, departments, managers] = await Promise.all([
    supabase
      .from("business_units")
      .select("id, name")
      .eq("is_active", true)
      .order("name"),
    supabase
      .from("departments")
      .select("id, name, business_unit_id")
      .eq("is_active", true)
      .order("name"),
    supabase
      .from("profiles")
      .select("id, first_name, last_name, preferred_name, job_title")
      .eq("status", "active")
      .order("first_name"),
  ]);

  const businessUnits = [...(units.data ?? [])].sort((a, b) => {
    if (a.name === "JA Group") return -1;
    if (b.name === "JA Group") return 1;
    return a.name.localeCompare(b.name);
  });

  return {
    businessUnits,
    departments: departments.data ?? [],
    managers: managers.data ?? [],
  };
}
