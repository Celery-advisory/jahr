export type LeaveTypeId =
  | "annual"
  | "sick"
  | "maternity"
  | "paternity"
  | "casual"
  | "unpaid";

export interface LeaveTypeOption {
  id: LeaveTypeId;
  label: string;
  description: string;
  deductsBalance: boolean;
}

export const LEAVE_TYPES: LeaveTypeOption[] = [
  {
    id: "annual",
    label: "Annual leave",
    description: "Paid annual leave",
    deductsBalance: true,
  },
  {
    id: "sick",
    label: "Sick leave",
    description: "Illness or medical appointment",
    deductsBalance: false,
  },
  {
    id: "maternity",
    label: "Maternity leave",
    description: "Ghana Labour Act maternity leave",
    deductsBalance: false,
  },
  {
    id: "paternity",
    label: "Paternity leave",
    description: "Short leave for new fathers",
    deductsBalance: false,
  },
  {
    id: "unpaid",
    label: "Unpaid leave",
    description: "Leave without pay",
    deductsBalance: false,
  },
];

/** Older requests may still use types that are no longer offered. */
const RETIRED_LEAVE_LABELS: Partial<Record<LeaveTypeId, string>> = {
  casual: "Casual leave",
};

export function leaveTypeLabel(type: string): string {
  return (
    LEAVE_TYPES.find((option) => option.id === type)?.label ??
    RETIRED_LEAVE_LABELS[type as LeaveTypeId] ??
    type
  );
}

export type LeaveStatus = "pending" | "approved" | "rejected";

/** `request` books upcoming leave. `past` logs leave already taken for review. */
export type LeaveEntryKind = "request" | "past";

export interface LeaveBalanceSummary {
  used: number;
  pending: number;
}

export interface LeaveRequestDraft {
  id: string;
  type: LeaveTypeId;
  startDate: string;
  endDate: string;
  workingDays: number;
  notes: string;
  status: LeaveStatus;
  submittedAt: string;
  loggedPast: boolean;
}

/** A leave request row as stored/queried from `public.leave_requests`. */
export interface LeaveRequestRecord {
  id: string;
  employeeId: string;
  type: LeaveTypeId;
  startDate: string;
  endDate: string;
  workingDays: number;
  status: LeaveStatus;
  notes: string;
  managerNotes: string | null;
  submittedAt: string;
}

/** A pending request enriched with the requesting employee's details, for the approvals queue. */
export interface PendingApprovalRecord extends LeaveRequestRecord {
  employeeName: string;
  employeeJobTitle: string | null;
}

/** Approvals queue row with hours, balance context, and decision metadata. */
export interface ApprovalQueueRecord extends PendingApprovalRecord {
  reference: string;
  workingHours: number;
  managerResponseAt: string | null;
  annualUsed: number | null;
  annualPending: number | null;
  loggedPast: boolean;
  /** Manager who should decide. Null when nobody is assigned. */
  approverName: string | null;
  /** True when this viewer is the person who should approve or decline. */
  awaitingViewer: boolean;
}

export interface TeamLeaveBalance {
  employeeId: string;
  name: string;
  jobTitle: string | null;
  avatarUrl: string | null;
  gender: string | null;
  used: number;
  pending: number;
}

export interface LeaveDecisionLog {
  id: string;
  reference: string;
  employeeName: string;
  type: LeaveTypeId;
  status: Exclude<LeaveStatus, "pending">;
  startDate: string;
  endDate: string;
  workingDays: number;
  workingHours: number;
  decidedAt: string;
  managerNotes: string | null;
}
