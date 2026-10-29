import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { differenceInCalendarDays, format, getMonth, parseISO } from "date-fns";
import { DashboardView } from "@/components/dashboard/dashboard-view";
import {
  DASHBOARD_COLORS,
  leaveTypeLabel,
  type DashboardKpi,
  type DashboardLeaveItem,
  type DashboardTeamMember,
} from "@/components/dashboard/shared";
import { getAnnouncementsForViewer } from "@/lib/announcements/get-for-viewer";
import { announcementTypeLabel } from "@/lib/announcements/categories";
import { getCurrentProfile } from "@/lib/auth/get-profile";
import { SIGN_OUT_PATH } from "@/lib/auth/routes";
import {
  formatAverageAge,
  getWorkforceInsights,
} from "@/lib/employees/get-workforce-insights";
import { summarizeLeaveBalance } from "@/lib/leave/balance";
import {
  getLeaveSchedule,
  type ScheduleLeaveEntry,
} from "@/lib/leave/get-schedule";
import type { LeaveStatus, LeaveTypeId } from "@/lib/leave/types";
import {
  canApproveLeave,
  displayName,
  isOrgAdmin,
} from "@/lib/types/database";
import { createClient } from "@/utils/supabase/server";

interface DashboardPersonal {
  leaveUsed: number;
  leavePending: number;
  documentCount: number;
  deviceCount: number;
  latestPayslipLabel: string | null;
}

async function getDashboardPersonal(
  supabase: ReturnType<typeof createClient>,
  employeeId: string,
  year: number,
): Promise<DashboardPersonal> {
  const [leaveResult, documentsResult, payslipResult, devicesResult] =
    await Promise.all([
      supabase
        .from("leave_requests")
        .select("type, status, start_date, working_days")
        .eq("employee_id", employeeId)
        .in("status", ["pending", "approved"])
        .gte("start_date", `${year}-01-01`)
        .lte("start_date", `${year}-12-31`),
      supabase
        .from("documents")
        .select("id", { count: "exact", head: true })
        .eq("employee_id", employeeId),
      supabase
        .from("payslips")
        .select("period_label")
        .eq("employee_id", employeeId)
        .order("period_start", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("device_assignments")
        .select("id", { count: "exact", head: true })
        .eq("employee_id", employeeId)
        .is("returned_at", null),
    ]);

  const summary = summarizeLeaveBalance(
    (leaveResult.data ?? []).map((row) => ({
      type: row.type as LeaveTypeId,
      status: row.status as LeaveStatus,
      startDate: row.start_date,
      workingDays: Number(row.working_days),
    })),
  );

  return {
    leaveUsed: summary.used,
    leavePending: summary.pending,
    documentCount: documentsResult.count ?? 0,
    deviceCount: devicesResult.count ?? 0,
    latestPayslipLabel: payslipResult.data?.period_label ?? null,
  };
}

const TEAM_PROFILE_SELECT = `
  id, first_name, last_name, preferred_name, job_title, avatar_url, gender, annual_leave_entitlement, date_of_birth, manager_id,
  year_leave:leave_requests!leave_requests_employee_id_fkey ( type, status, start_date, working_days )
`;

const ADMIN_TEAM_PREVIEW_LIMIT = 12;

/** Team profiles with this year's pending/approved leave embedded, in one round trip. */
function getTeamProfiles(
  supabase: ReturnType<typeof createClient>,
  options: { viewerId: string; isOrgAdmin: boolean; year: number },
) {
  const base = supabase
    .from("profiles")
    .select(TEAM_PROFILE_SELECT)
    .in("year_leave.status", ["pending", "approved"])
    .gte("year_leave.start_date", `${options.year}-01-01`)
    .lte("year_leave.start_date", `${options.year}-12-31`)
    .order("first_name", { ascending: true });

  return options.isOrgAdmin
    ? base.eq("status", "active").limit(ADMIN_TEAM_PREVIEW_LIMIT)
    : base.eq("manager_id", options.viewerId).neq("status", "terminated");
}

function greetingForHour(hour: number): string {
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

function daysAgoLabel(endDate: string, todayKey: string): string {
  const days = differenceInCalendarDays(parseISO(todayKey), parseISO(endDate));
  if (days <= 0) return "Ended today";
  if (days === 1) return "Ended 1 day ago";
  return `Ended ${days} days ago`;
}

function shortLeaveRange(startDate: string, endDate: string): string {
  const start = parseISO(startDate);
  const end = parseISO(endDate);
  if (startDate === endDate) return format(start, "d MMM");
  if (format(start, "yyyy-MM") === format(end, "yyyy-MM")) {
    return `${format(start, "d")}–${format(end, "d MMM")}`;
  }
  return `${format(start, "d MMM")}–${format(end, "d MMM")}`;
}

function ownLeaveKpi(
  schedule: ScheduleLeaveEntry[],
  viewerId: string,
  todayKey: string,
): DashboardKpi {
  const own = schedule
    .filter((entry) => entry.person.id === viewerId)
    .sort((a, b) => a.startDate.localeCompare(b.startDate));
  const next = own.find((entry) => entry.endDate >= todayKey);
  const last = [...own]
    .reverse()
    .find((entry) => entry.endDate < todayKey);
  const featured = next ?? last;

  if (!featured) {
    return {
      label: "Your leave",
      value: "None booked",
      hint: "Request time off",
      href: "/leave",
      icon: "leave",
      accent: DASHBOARD_COLORS.leave,
    };
  }

  const dayLabel = `${featured.workingDays} day${featured.workingDays === 1 ? "" : "s"}`;
  const typeLabel = leaveTypeLabel(featured.type);

  return {
    label: next
      ? featured.status === "pending"
        ? "Leave pending"
        : "Next leave"
      : "Last leave",
    value: shortLeaveRange(featured.startDate, featured.endDate),
    hint: next
      ? featured.status === "pending"
        ? `${typeLabel}, waiting for approval`
        : `${typeLabel}, ${dayLabel}`
      : `${typeLabel}, ${daysAgoLabel(featured.endDate, todayKey)}`,
    href: "/leave",
    icon: "leave",
    accent: DASHBOARD_COLORS.leave,
  };
}

export default async function DashboardPage() {
  const profile = await getCurrentProfile();
  if (!profile) {
    redirect(SIGN_OUT_PATH);
  }

  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);
  const hour = new Date().getHours();
  const todayKey = format(new Date(), "yyyy-MM-dd");
  const year = new Date().getFullYear();
  const month = getMonth(new Date());
  const admin = isOrgAdmin(profile);
  const canApprove = canApproveLeave(profile);
  const firstName = displayName(profile).split(" ")[0] || "there";

  const [
    personal,
    schedule,
    announcements,
    holidaysResult,
    pendingApprovalsResult,
    teamProfilesResult,
    insights,
  ] = await Promise.all([
    getDashboardPersonal(supabase, profile.id, year),
    getLeaveSchedule({
      viewerId: profile.id,
      isOrgAdmin: admin,
      isManager: profile.isManager,
    }),
    getAnnouncementsForViewer(1),
    supabase
      .from("holidays")
      .select("name, holiday_date")
      .gte("holiday_date", todayKey)
      .order("holiday_date", { ascending: true })
      .limit(3),
    canApprove
      ? admin
        ? supabase
            .from("leave_requests")
            .select("id", { count: "exact", head: true })
            .eq("status", "pending")
            .or(`manager_id.eq.${profile.id},manager_id.is.null`)
        : supabase
            .from("leave_requests")
            .select("id", { count: "exact", head: true })
            .eq("status", "pending")
            .eq("manager_id", profile.id)
      : Promise.resolve({ count: 0 }),
    profile.isManager || admin
      ? getTeamProfiles(supabase, {
          viewerId: profile.id,
          isOrgAdmin: admin,
          year,
        })
      : Promise.resolve({ data: [] }),
    admin ? getWorkforceInsights() : Promise.resolve(null),
  ]);

  const leaveUsed = personal.leaveUsed;
  const leavePending = personal.leavePending;

  const upcomingLeave: DashboardLeaveItem[] = schedule
    .filter((entry) => entry.endDate >= todayKey)
    .slice(0, 6)
    .map((entry) => ({
      id: entry.id,
      name: entry.person.name,
      avatarUrl: entry.person.avatarUrl,
      gender: entry.person.gender,
      typeLabel: leaveTypeLabel(entry.type),
      status: entry.status === "approved" ? "approved" : "pending",
      startDate: entry.startDate,
      endDate: entry.endDate,
      workingDays: entry.workingDays,
      isSelf: entry.person.id === profile.id,
    }));

  const holidays = holidaysResult.data;
  const teamProfiles = teamProfilesResult.data ?? [];
  let team: DashboardTeamMember[] = [];

  if (teamProfiles.length > 0 && (profile.isManager || admin)) {
    team = teamProfiles.slice(0, 6).map((person) => {
      const summary = summarizeLeaveBalance(
        (person.year_leave ?? []).map((request) => ({
          type: request.type as LeaveTypeId,
          status: request.status as LeaveStatus,
          startDate: request.start_date,
          workingDays: Number(request.working_days),
        })),
      );
      return {
        id: person.id,
        name: displayName(person),
        jobTitle: person.job_title,
        avatarUrl: person.avatar_url,
        gender: person.gender,
        used: summary.used,
        pending: summary.pending,
      };
    });
  }

  const birthdaySource =
    teamProfiles.length > 0
      ? teamProfiles
      : [
          {
            id: profile.id,
            first_name: profile.first_name,
            last_name: profile.last_name,
            preferred_name: profile.preferred_name,
            avatar_url: profile.avatar_url,
            gender: profile.gender,
            date_of_birth: profile.date_of_birth,
          },
        ];

  const birthdays = birthdaySource
    .filter((person) => {
      if (!person.date_of_birth) return false;
      return getMonth(parseISO(person.date_of_birth)) === month;
    })
    .slice(0, 5)
    .map((person) => ({
      id: person.id,
      name: displayName(person),
      avatarUrl: person.avatar_url,
      gender: person.gender,
      dateLabel: format(parseISO(person.date_of_birth as string), "d MMMM"),
    }));

  const orgEmployees = insights?.activeEmployees ?? 0;
  const orgAverageAge = insights?.averageAgeYears ?? null;
  const orgAverageAgeSample = insights?.averageAgeSampleSize ?? 0;

  const pendingApprovals = pendingApprovalsResult.count ?? 0;
  const latestPayslip = personal.latestPayslipLabel
    ? { period_label: personal.latestPayslipLabel }
    : null;
  const deviceCount = personal.deviceCount;

  const leaveKpi = ownLeaveKpi(schedule, profile.id, todayKey);

  const kpis: DashboardKpi[] = admin
    ? [
        {
          label: "Active employees",
          value: String(orgEmployees),
          hint: "Across JA Group",
          href: "/admin/employees",
          icon: "people",
          accent: DASHBOARD_COLORS.people,
        },
        {
          label: "Waiting on you",
          value: String(pendingApprovals),
          hint: pendingApprovals > 0 ? "Needs your decision" : "Nothing waiting on you",
          href: "/approvals",
          icon: "approvals",
          accent: DASHBOARD_COLORS.people,
          progress:
            pendingApprovals === 0
              ? 100
              : Math.max(8, 100 - pendingApprovals * 12),
        },
        leaveKpi,
        {
          label: "Avg age",
          value: formatAverageAge(orgAverageAge),
          hint:
            orgAverageAgeSample > 0
              ? `${orgAverageAgeSample} with DOB on file`
              : "Add dates of birth on profiles",
          href: "/admin/insights",
          icon: "people",
          accent: DASHBOARD_COLORS.devices,
        },
      ]
    : [
        leaveKpi,
        {
          label: canApprove ? "Waiting on you" : "Pending requests",
          value: String(canApprove ? pendingApprovals : leavePending),
          hint: canApprove ? "Team leave to review" : "Your open requests",
          href: canApprove ? "/approvals" : "/leave",
          icon: "approvals",
          accent: DASHBOARD_COLORS.people,
        },
        {
          label: "Documents",
          value: String(personal.documentCount),
          hint: "On your file",
          href: "/documents",
          icon: "docs",
          accent: DASHBOARD_COLORS.docs,
        },
        {
          label: latestPayslip ? "Latest payslip" : "Devices",
          value: latestPayslip
            ? latestPayslip.period_label
            : String(deviceCount),
          hint: latestPayslip
            ? "Ready to download"
            : deviceCount > 0
              ? "Assigned to you"
              : "None assigned",
          href: latestPayslip ? "/documents" : "/settings",
          icon: latestPayslip ? "payroll" : "devices",
          accent: latestPayslip
            ? DASHBOARD_COLORS.payroll
            : DASHBOARD_COLORS.devices,
        },
      ];

  return (
    <DashboardView
      greeting={greetingForHour(hour)}
      firstName={firstName}
      subtitle={[
        profile.business_unit?.name ?? "JA Group",
        profile.department?.name ?? profile.job_title ?? "Team",
      ].join(" · ")}
      kpis={kpis}
      leaveUsed={leaveUsed}
      leavePending={leavePending}
      upcomingLeave={upcomingLeave}
      announcements={announcements.map((item) => ({
        id: item.id,
        title: item.title,
        typeLabel: announcementTypeLabel(item.announcement_type),
        body: item.body,
        bodyJson: item.body_json,
        publishedAtLabel: format(parseISO(item.published_at), "d MMM"),
        attachments: item.attachments ?? [],
      }))}
      team={profile.isManager || admin ? team : []}
      birthdays={birthdays}
      holidays={(holidays ?? []).map((item) => ({
        name: item.name,
        dateLabel: format(parseISO(item.holiday_date), "EEE d MMM"),
      }))}
      canApprove={canApprove}
      isAdmin={admin}
    />
  );
}
