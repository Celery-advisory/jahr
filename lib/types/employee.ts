import type { LeaveTypeId } from "@/lib/leave/types";
import type { AppRole, EmploymentStatus, ProfileWithOrg } from "@/lib/types/database";

export type EmployeeCategory = "employee" | "contractor" | "intern";
export type WorkType = "onsite" | "hybrid" | "remote";
export type EmploymentType = "full_time" | "part_time";
export type PayFrequency = "monthly" | "weekly" | "annually";
export type DocumentKind =
  | "employment_contract"
  | "offer_letter"
  | "appointment_letter"
  | "nda"
  | "id_card"
  | "passport"
  | "cv"
  | "certificate"
  | "tax_form"
  | "signed_policy"
  | "payslip"
  | "other";
export type AssetKind =
  | "laptop"
  | "monitor"
  | "phone"
  | "access_card"
  | "other";
export type HrNoteKind = "promotion" | "warning" | "recognition" | "general";
export type AuditAction =
  | "joined_company"
  | "profile_updated"
  | "requested_leave"
  | "approved_leave"
  | "rejected_leave"
  | "downloaded_payslip"
  | "generated_payslip"
  | "uploaded_document"
  | "changed_password";

export interface EmployeeProfile extends ProfileWithOrg {
  employee_number: string | null;
  personal_email: string | null;
  date_of_birth: string | null;
  gender: string | null;
  employee_category: EmployeeCategory;
  work_type: WorkType;
  employment_type: EmploymentType;
  office_location: string | null;
  probation_end_date: string | null;
  termination_date: string | null;
  leaving_reason: string | null;
  nationality: string | null;
  national_id: string | null;
  immigration_status: string | null;
  work_permit_number: string | null;
  work_permit_expiry: string | null;
  ssnit_number: string | null;
  tin_number: string | null;
  address_line: string | null;
  city: string | null;
  country: string;
  last_login_at: string | null;
  team: { id: string; name: string; slug: string } | null;
  role: AppRole;
  status: EmploymentStatus;
}

export interface EmergencyContact {
  id: string;
  full_name: string;
  relationship: string;
  phone: string;
  email: string | null;
  is_primary: boolean;
}

export interface PayDetails {
  salary: number | null;
  currency: string;
  pay_frequency: PayFrequency;
  legal_entity_paying: string | null;
  bank_name: string | null;
  bank_branch: string | null;
  account_name: string | null;
  account_number: string | null;
  payment_method: string;
}

export interface EmployeeDocument {
  id: string;
  kind: DocumentKind;
  title: string;
  file_url: string | null;
  file_name: string | null;
  mime_type: string | null;
  storage_path: string | null;
  uploaded_by: string | null;
  created_at: string;
}

export interface PayslipRecord {
  id: string;
  reference: string | null;
  period_label: string;
  period_start: string | null;
  period_end: string | null;
  gross_pay: number | null;
  total_deductions: number | null;
  net_pay: number | null;
  currency: string | null;
  file_url: string | null;
  uploaded_at: string;
  generated_at: string | null;
}

export interface EmployeeAsset {
  id: string;
  kind: AssetKind;
  label: string;
  asset_tag: string | null;
  serial_number: string | null;
  assigned_at: string | null;
  notes: string | null;
}

export interface HrNote {
  id: string;
  kind: HrNoteKind;
  body: string;
  created_at: string;
}

export interface LeaveBalanceRow {
  leave_type: LeaveTypeId;
  year: number;
  entitlement: number;
  used: number;
  pending: number;
}

export interface Announcement {
  id: string;
  title: string;
  category: import("@/lib/announcements/categories").AnnouncementCategory;
  announcement_type: import("@/lib/announcements/categories").AnnouncementType;
  body: string;
  body_json: import("@/lib/communications/types").JSONContent;
  published_at: string;
  audience_business_unit_ids: string[];
  audience_work_types: WorkType[];
  is_active: boolean;
  created_by: string | null;
  attachments?: import("@/lib/communications/types").AnnouncementAttachmentSummary[];
}

export interface Holiday {
  id: string;
  name: string;
  holiday_date: string;
}

export interface AuditLogRow {
  id: string;
  action: AuditAction;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface EmployeeRecord {
  profile: EmployeeProfile;
  emergencyContacts: EmergencyContact[];
  payDetails: PayDetails | null;
  hasPayPackage: boolean;
  documents: EmployeeDocument[];
  payslips: PayslipRecord[];
  assets: EmployeeAsset[];
  hrNotes: HrNote[];
  leaveBalances: LeaveBalanceRow[];
  activity: AuditLogRow[];
  directReports: Array<{
    id: string;
    first_name: string;
    last_name: string;
    preferred_name: string | null;
    job_title: string | null;
    email: string;
  }>;
}

export const DOCUMENT_KIND_LABELS: Record<DocumentKind, string> = {
  employment_contract: "Employment contract",
  offer_letter: "Offer letter",
  appointment_letter: "Appointment letter",
  nda: "NDA",
  id_card: "ID card",
  passport: "Passport",
  cv: "CV",
  certificate: "Certificate",
  tax_form: "Tax form",
  signed_policy: "Signed policy",
  payslip: "Payslip",
  other: "Other",
};

export const ASSET_KIND_LABELS: Record<AssetKind, string> = {
  laptop: "Laptop",
  monitor: "Monitor",
  phone: "Phone",
  access_card: "Access card",
  other: "Other",
};
