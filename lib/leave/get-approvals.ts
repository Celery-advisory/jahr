import { cookies } from "next/headers";
import { AUTH_BYPASS } from "@/lib/auth/config";
import { summarizeLeaveBalance } from "@/lib/leave/balance";
import type {
  ApprovalQueueRecord,
  LeaveDecisionLog,
  LeaveStatus,
  LeaveTypeId,
  TeamLeaveBalance,
} from "@/lib/leave/types";
import {
  isLoggedPastLeave,
  leaveReference,
  workingHoursFromDays,
} from "@/lib/leave/working-days";
import {
  displayName,
  isOrgAdmin,
} from "@/lib/types/database";
import { createClient } from "@/utils/supabase/server";

interface LeaveRow {
  id: string;
  employee_id: string;
  type: string;
  start_date: string;
  end_date: string;
  working_days: number;
  status: string;
  notes: string;
  manager_notes: string | null;
  manager_response_at: string | null;
  submitted_at: string;
  manager_id: string | null;
  manager: {
    id: string;
    first_name: string;
    last_name: string;
    preferred_name: string | null;
  } | null;
  employee: {
    id: string;
    first_name: string;
    last_name: string;
    preferred_name: string | null;
    job_title: string | null;
    avatar_url: string | null;
    gender: string | null;
    annual_leave_entitlement: number | null;
  } | null;
}

const PREVIEW_OPEN: ApprovalQueueRecord[] = [
  {
    id: "preview-approval-1",
    employeeId: "preview-employee-1",
    employeeName: "Ama Boateng",
    employeeJobTitle: "Product Designer",
    type: "annual",
    startDate: "2026-05-04",
    endDate: "2026-05-08",
    workingDays: 5,
    workingHours: 40,
    reference: "#LVPREV01",
    status: "pending",
    notes: "Wedding in Kumasi",
    managerNotes: null,
    managerResponseAt: null,
    submittedAt: "2026-04-20T09:00:00.000Z",
    annualUsed: 2,
    annualPending: 5,
    loggedPast: false,
    approverName: null,
    awaitingViewer: true,
  },
];

const PREVIEW_TEAM: TeamLeaveBalance[] = [
  {
    employeeId: "preview-employee-1",
    name: "Ama Boateng",
    jobTitle: "Product Designer",
    avatarUrl: null,
    gender: "female",
    used: 2,
    pending: 5,
  },
  {
    employeeId: "preview-employee-2",
    name: "Kofi Mensah",
    jobTitle: "Software Engineer",
    avatarUrl: null,
    gender: "male",
    used: 4,
    pending: 0,
  },
];

const PREVIEW_LOGS: LeaveDecisionLog[] = [
  {
    id: "preview-log-1",
    reference: "#LVPREV02",
    employeeName: "Esi Owusu",
    type: "annual",
    status: "approved",
    startDate: "2026-04-10",
    endDate: "2026-04-10",
    workingDays: 1,
    workingHours: 8,
    decidedAt: "2026-04-08T14:20:00.000Z",
    managerNotes: "Covered by the team.",
  },
];

function mapApproval(
  row: LeaveRow,
  balanceByEmployee: Map<
    string,
    { used: number; pending: number }
  >,
  viewerId: string,
  admin: boolean,
): ApprovalQueueRecord {
  const workingDays = Number(row.working_days);
  const balance = balanceByEmployee.get(row.employee_id);

  return {
    id: row.id,
    employeeId: row.employee?.id ?? row.employee_id,
    employeeName: row.employee
      ? displayName(row.employee)
      : "Former employee",
    employeeJobTitle: row.employee?.job_title ?? null,
    type: row.type as LeaveTypeId,
    startDate: row.start_date,
    endDate: row.end_date,
    workingDays,
    workingHours: workingHoursFromDays(workingDays),
    reference: leaveReference(row.id),
    status: row.status as LeaveStatus,
    notes: row.notes,
    managerNotes: row.manager_notes,
    managerResponseAt: row.manager_response_at,
    submittedAt: row.submitted_at,
    annualUsed: balance?.used ?? null,
    annualPending: balance?.pending ?? null,
    loggedPast: isLoggedPastLeave(row.end_date, row.submitted_at),
    approverName: row.manager ? displayName(row.manager) : null,
    awaitingViewer:
      row.status === "pending" &&
      (row.manager_id === viewerId || (admin && row.manager_id === null)),
  };
}

export async function getApprovalsWorkspace(viewer: {
  id: string;
  tags: import("@/lib/auth/permissions").PermissionTagSlug[];
  isManager: boolean;
}): Promise<{
  open: ApprovalQueueRecord[];
  closed: ApprovalQueueRecord[];
  teamBalances: TeamLeaveBalance[];
  logs: LeaveDecisionLog[];
}> {
  if (AUTH_BYPASS) {
    return {
      open: PREVIEW_OPEN,
      closed: [],
      teamBalances: PREVIEW_TEAM,
      logs: PREVIEW_LOGS,
    };
  }

  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);
  const admin = isOrgAdmin(viewer);
  const year = new Date().getFullYear();

  let requestsQuery = supabase
    .from("leave_requests")
    .select(
      `
      id, employee_id, manager_id, type, start_date, end_date, working_days, status, notes,
      manager_notes, manager_response_at, submitted_at,
      manager:profiles!leave_requests_manager_id_fkey (
        id, first_name, last_name, preferred_name
      ),
      employee:profiles!leave_requests_employee_id_fkey (
        id, first_name, last_name, preferred_name, job_title, avatar_url, gender,
        annual_leave_entitlement
      )
    `,
    )
    .order("submitted_at", { ascending: false })
    .limit(80);

  if (!admin) {
    requestsQuery = requestsQuery.eq("manager_id", viewer.id);
  }

  const teamQuery = admin
    ? supabase
        .from("profiles")
        .select(
          "id, first_name, last_name, preferred_name, job_title, avatar_url, gender, annual_leave_entitlement, manager_id",
        )
        .neq("status", "terminated")
        .order("first_name", { ascending: true })
        .limit(40)
    : supabase
        .from("profiles")
        .select(
          "id, first_name, last_name, preferred_name, job_title, avatar_url, gender, annual_leave_entitlement, manager_id",
        )
        .eq("manager_id", viewer.id)
        .neq("status", "terminated")
        .order("first_name", { ascending: true });

  const [{ data: requestRows }, { data: teamRows }] = await Promise.all([
    requestsQuery,
    teamQuery,
  ]);

  const rows = (requestRows ?? []) as unknown as LeaveRow[];
  const team = teamRows ?? [];
  const balanceIds = [
    ...new Set([
      ...team.map((person) => person.id),
      ...rows.map((row) => row.employee_id),
    ]),
  ];

  const balanceByEmployee = new Map<
    string,
    { used: number; pending: number }
  >();

  if (balanceIds.length > 0) {
    const { data: yearRequests } = await supabase
      .from("leave_requests")
      .select("employee_id, type, status, start_date, working_days")
      .in("employee_id", balanceIds)
      .in("status", ["pending", "approved"])
      .gte("start_date", `${year}-01-01`)
      .lte("start_date", `${year}-12-31`);

    const byEmployee = new Map<
      string,
      Array<{
        type: LeaveTypeId;
        status: LeaveStatus;
        startDate: string;
        workingDays: number;
      }>
    >();

    for (const request of yearRequests ?? []) {
      const list = byEmployee.get(request.employee_id) ?? [];
      list.push({
        type: request.type as LeaveTypeId,
        status: request.status as LeaveStatus,
        startDate: request.start_date,
        workingDays: Number(request.working_days),
      });
      byEmployee.set(request.employee_id, list);
    }

    for (const employeeId of balanceIds) {
      const summary = summarizeLeaveBalance(
        byEmployee.get(employeeId) ?? [],
        new Date(),
      );
      balanceByEmployee.set(employeeId, {
        used: summary.used,
        pending: summary.pending,
      });
    }
  }

  const mapped = rows.map((row) =>
    mapApproval(row, balanceByEmployee, viewer.id, admin),
  );
  const open = mapped
    .filter((row) => row.status === "pending")
    .sort((a, b) => a.startDate.localeCompare(b.startDate));
  const closed = mapped.filter((row) => row.status !== "pending");

  const teamBalances: TeamLeaveBalance[] = team.map((person) => {
    const balance = balanceByEmployee.get(person.id);
    return {
      employeeId: person.id,
      name: displayName(person),
      jobTitle: person.job_title,
      avatarUrl: person.avatar_url,
      gender: person.gender,
      used: balance?.used ?? 0,
      pending: balance?.pending ?? 0,
    };
  });

  const logs: LeaveDecisionLog[] = closed
    .filter((row) => row.managerResponseAt)
    .slice(0, 12)
    .map((row) => ({
      id: row.id,
      reference: row.reference,
      employeeName: row.employeeName,
      type: row.type,
      status: row.status as Exclude<LeaveStatus, "pending">,
      startDate: row.startDate,
      endDate: row.endDate,
      workingDays: row.workingDays,
      workingHours: row.workingHours,
      decidedAt: row.managerResponseAt as string,
      managerNotes: row.managerNotes,
    }));

  return { open, closed, teamBalances, logs };
}
