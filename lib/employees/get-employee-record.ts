import { cookies } from "next/headers";
import { getCurrentProfile, loadProfileTags } from "@/lib/auth/get-profile";
import { summarizeLeaveByType } from "@/lib/leave/balance";
import type { LeaveStatus, LeaveTypeId } from "@/lib/leave/types";
import type {
  AssetKind,
  AuditAction,
  DocumentKind,
  EmployeeCategory,
  EmployeeProfile,
  EmployeeRecord,
  EmploymentType,
  HrNoteKind,
  PayFrequency,
  WorkType,
} from "@/lib/types/employee";
import { canViewEmployeeDetails, isOrgAdmin } from "@/lib/types/database";
import { createClient } from "@/utils/supabase/server";

export async function getEmployeeRecord(
  employeeId?: string,
): Promise<EmployeeRecord | null> {
  const viewer = await getCurrentProfile();
  if (!viewer) {
    return null;
  }

  const targetId = employeeId ?? viewer.id;
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", targetId)
    .maybeSingle();

  if (error || !profile) {
    if (error) {
      console.error("[getEmployeeRecord]", error.message);
    }
    return null;
  }

  if (
    !canViewEmployeeDetails(viewer, {
      id: profile.id,
      manager_id: profile.manager_id,
    })
  ) {
    return null;
  }

  const [
    businessUnit,
    department,
    team,
    manager,
    emergencyContacts,
    payDetails,
    packageLineCount,
    documents,
    payslips,
    assets,
    leaveBalances,
    activity,
    directReports,
    hrNotes,
    tags,
  ] = await Promise.all([
    profile.business_unit_id
      ? supabase
          .from("business_units")
          .select("id, name, slug")
          .eq("id", profile.business_unit_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    profile.department_id
      ? supabase
          .from("departments")
          .select("id, name, slug")
          .eq("id", profile.department_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    profile.team_id
      ? supabase
          .from("teams")
          .select("id, name, slug")
          .eq("id", profile.team_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    profile.manager_id
      ? supabase
          .from("profiles")
          .select("id, first_name, last_name, email, job_title")
          .eq("id", profile.manager_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    supabase
      .from("emergency_contacts")
      .select("id, full_name, relationship, phone, email, is_primary")
      .eq("employee_id", targetId)
      .order("is_primary", { ascending: false }),
    supabase.from("pay_details").select("*").eq("employee_id", targetId).maybeSingle(),
    supabase
      .from("pay_package_lines")
      .select("id", { count: "exact", head: true })
      .eq("employee_id", targetId)
      .eq("active", true),
    supabase
      .from("documents")
      .select(
        "id, kind, title, file_url, file_name, mime_type, storage_path, uploaded_by, created_at",
      )
      .eq("employee_id", targetId)
      .order("created_at", { ascending: false }),
    supabase
      .from("payslips")
      .select(
        "id, reference, period_label, period_start, period_end, gross_pay, total_deductions, net_pay, currency, file_url, uploaded_at, generated_at",
      )
      .eq("employee_id", targetId)
      .order("period_start", { ascending: false }),
    supabase
      .from("device_assignments")
      .select(
        `
        id, assigned_at, notes,
        device:devices ( id, kind, name, asset_tag, serial_number )
      `,
      )
      .eq("employee_id", targetId)
      .is("returned_at", null)
      .order("assigned_at", { ascending: false }),
    supabase
      .from("leave_requests")
      .select("type, status, start_date, working_days")
      .eq("employee_id", targetId)
      .in("status", ["pending", "approved"])
      .gte("start_date", `${new Date().getFullYear()}-01-01`)
      .lte("start_date", `${new Date().getFullYear()}-12-31`),
    supabase
      .from("audit_logs")
      .select("id, action, metadata, created_at")
      .eq("subject_id", targetId)
      .order("created_at", { ascending: false })
      .limit(12),
    supabase
      .from("profiles")
      .select("id, first_name, last_name, preferred_name, job_title, email")
      .eq("manager_id", targetId)
      .eq("status", "active")
      .order("first_name", { ascending: true }),
    isOrgAdmin(viewer)
      ? supabase
          .from("hr_notes")
          .select("id, kind, body, created_at")
          .eq("employee_id", targetId)
          .order("created_at", { ascending: false })
      : Promise.resolve({ data: [] }),
    loadProfileTags(supabase, targetId),
  ]);

  const employeeProfile: EmployeeProfile = {
    ...(profile as Omit<EmployeeProfile, "business_unit" | "department" | "manager" | "team" | "isManager">),
    employee_category: profile.employee_category as EmployeeCategory,
    work_type: profile.work_type as WorkType,
    employment_type: profile.employment_type as EmploymentType,
    immigration_status:
      (profile as { immigration_status?: string | null }).immigration_status ??
      null,
    work_permit_number:
      (profile as { work_permit_number?: string | null }).work_permit_number ??
      null,
    work_permit_expiry:
      (profile as { work_permit_expiry?: string | null }).work_permit_expiry ??
      null,
    business_unit: businessUnit.data,
    department: department.data,
    team: team.data,
    manager: manager.data,
    isManager: (directReports.data ?? []).length > 0,
    tags,
  };

  return {
    profile: employeeProfile,
    emergencyContacts: emergencyContacts.data ?? [],
    payDetails: payDetails.data
      ? {
          salary:
            payDetails.data.salary === null
              ? null
              : Number(payDetails.data.salary),
          currency: payDetails.data.currency,
          pay_frequency: payDetails.data.pay_frequency as PayFrequency,
          legal_entity_paying: payDetails.data.legal_entity_paying ?? null,
          bank_name: payDetails.data.bank_name,
          bank_branch: payDetails.data.bank_branch ?? null,
          account_name: payDetails.data.account_name,
          account_number: payDetails.data.account_number,
          payment_method: payDetails.data.payment_method,
        }
      : null,
    hasPayPackage: (packageLineCount.count ?? 0) > 0,
    documents: (documents.data ?? []).map((doc) => ({
      ...doc,
      kind: doc.kind as DocumentKind,
    })),
    payslips: (payslips.data ?? []).map((slip) => ({
      id: slip.id,
      reference: slip.reference ?? null,
      period_label: slip.period_label,
      period_start: slip.period_start,
      period_end: slip.period_end,
      gross_pay:
        slip.gross_pay === null || slip.gross_pay === undefined
          ? null
          : Number(slip.gross_pay),
      total_deductions:
        slip.total_deductions === null || slip.total_deductions === undefined
          ? null
          : Number(slip.total_deductions),
      net_pay:
        slip.net_pay === null || slip.net_pay === undefined
          ? null
          : Number(slip.net_pay),
      currency: slip.currency ?? null,
      file_url: slip.file_url,
      uploaded_at: slip.uploaded_at,
      generated_at: slip.generated_at ?? null,
    })),
    assets: (assets.data ?? []).flatMap((row) => {
      const device = Array.isArray(row.device) ? row.device[0] : row.device;
      if (!device) return [];
      return [
        {
          id: row.id as string,
          kind: device.kind as AssetKind,
          label: device.name as string,
          asset_tag: (device.asset_tag as string | null) ?? null,
          serial_number: (device.serial_number as string | null) ?? null,
          assigned_at: (row.assigned_at as string | null) ?? null,
          notes: (row.notes as string | null) ?? null,
        },
      ];
    }),
    hrNotes: (hrNotes.data ?? []).map((note) => ({
      ...note,
      kind: note.kind as HrNoteKind,
    })),
    leaveBalances: summarizeLeaveByType(
      (leaveBalances.data ?? []).map((row) => ({
        type: row.type as LeaveTypeId,
        status: row.status as LeaveStatus,
        startDate: row.start_date,
        workingDays: Number(row.working_days),
      })),
      Number(profile.annual_leave_entitlement ?? 0),
    ),
    activity: (activity.data ?? []).map((row) => ({
      id: row.id,
      action: row.action as AuditAction,
      metadata: (row.metadata ?? {}) as Record<string, unknown>,
      created_at: row.created_at,
    })),
    directReports: directReports.data ?? [],
  };
}
