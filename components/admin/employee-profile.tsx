"use client";

import { useEffect, useMemo, useState, type ComponentType, type ReactNode } from "react";
import Link from "next/link";
import { format } from "date-fns";
import {
  ArrowLeft,
  Briefcase,
  Building2,
  ExternalLink,
  FileText,
  History,
  Laptop,
  MapPin,
  Pencil,
  Shield,
  UserRound,
  Wallet,
} from "lucide-react";
import { OffboardEmployeeDialog } from "@/components/admin/offboard-employee-dialog";
import { PayPackageForm } from "@/components/admin/pay-package-form";
import { DocumentsManager } from "@/components/documents/documents-manager";
import { PayslipsPanel } from "@/components/payroll/payslips-panel";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { UserAvatar } from "@/components/ui/user-avatar";
import { IMMIGRATION_STATUS_LABELS } from "@/lib/employees/immigration";
import { PERMISSION_TAG_LABELS } from "@/lib/auth/permissions";
import type { PayPackage } from "@/lib/payroll/types";
import {
  ASSET_KIND_LABELS,
  type EmployeeRecord,
} from "@/lib/types/employee";
import type { EmploymentStatus } from "@/lib/types/database";
import { displayName } from "@/lib/types/database";
import { leaveTypeLabel } from "@/lib/leave/types";
import { cn } from "@/lib/utils";

type ProfileTab = "profile" | "compensation" | "documents" | "more";

function statusLabel(
  status: EmploymentStatus,
  leavingReason?: string | null,
): string {
  if (status === "terminated") {
    const reason = leavingReason?.toLowerCase() ?? "";
    if (reason.includes("dismiss") || reason.includes("fir")) return "Fired";
    if (reason.includes("resign")) return "Resigned";
    if (reason.includes("contract")) return "Contract ended";
    return "Left";
  }
  if (status === "inactive") return "Inactive";
  if (status === "onboarding") return "Onboarding";
  return "Active";
}

function statusBadgeClass(status: EmploymentStatus): string {
  if (status === "active") {
    return "border-transparent bg-success/10 text-success";
  }
  if (status === "onboarding") {
    return "border-transparent bg-amber-500/10 text-amber-700";
  }
  if (status === "inactive") {
    return "border-transparent bg-secondary text-muted-foreground";
  }
  return "border-transparent bg-destructive/10 text-destructive";
}

function formatLabel(value: string): string {
  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatDate(value: string | null | undefined): string {
  if (!value) return "-";
  return format(new Date(value), "d MMM yyyy");
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 space-y-1">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="truncate text-sm font-medium text-foreground">
        {value || "-"}
      </p>
    </div>
  );
}

function Section({
  title,
  icon: Icon,
  children,
  description,
}: {
  title: string;
  icon: ComponentType<{ className?: string }>;
  children: ReactNode;
  description?: string;
}) {
  return (
    <section className="rounded-xl border border-border bg-card">
      <div className="flex items-start gap-2.5 border-b border-border px-6 py-4">
        <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-[color-mix(in_srgb,#0070F3_8%,white)] text-[#0070F3]">
          <Icon className="size-4" />
        </div>
        <div className="min-w-0 space-y-0.5">
          <h2 className="text-sm font-medium">{title}</h2>
          {description ? (
            <p className="text-xs text-muted-foreground">{description}</p>
          ) : null}
        </div>
      </div>
      <div className="p-6">{children}</div>
    </section>
  );
}

const TABS: Array<{ id: ProfileTab; label: string }> = [
  { id: "profile", label: "Personal details" },
  { id: "compensation", label: "Compensation" },
  { id: "documents", label: "Documents" },
  { id: "more", label: "More" },
];

export function EmployeeProfile({
  record,
  viewerId,
  payPackage,
  legalEntities,
  isAdmin,
}: {
  record: EmployeeRecord;
  viewerId: string;
  payPackage: PayPackage | null;
  legalEntities: string[];
  isAdmin: boolean;
}) {
  const [tab, setTab] = useState<ProfileTab>("profile");
  const { profile } = record;
  const name = displayName(profile);
  const isAlumni = profile.status === "terminated";
  const backHref = isAlumni ? "/admin/alumni" : "/admin/employees";
  const backLabel = isAlumni ? "Alumni" : "Employees";

  const latestContract = useMemo(
    () =>
      record.documents.find((doc) => doc.kind === "employment_contract") ??
      null,
    [record.documents],
  );

  const immigrationLabel = profile.immigration_status
    ? (IMMIGRATION_STATUS_LABELS[
        profile.immigration_status as keyof typeof IMMIGRATION_STATUS_LABELS
      ] ?? formatLabel(profile.immigration_status))
    : "-";

  // Deep links (#pay, #contract) pick the opening tab. The hash only exists
  // in the browser, so this runs after hydration rather than in initial state.
  useEffect(() => {
    const hash = window.location.hash;
    const initialTab: ProfileTab | null =
      hash === "#contract"
        ? "documents"
        : hash === "#pay" && isAdmin
          ? "compensation"
          : null;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (initialTab) setTab(initialTab);
  }, [isAdmin]);

  return (
    <div className="flex w-full flex-col gap-5">
      <div className="space-y-4">
        <Link
          href={backHref}
          className={cn(
            buttonVariants({ variant: "ghost", size: "sm" }),
            "w-fit px-0 hover:bg-transparent",
          )}
        >
          <ArrowLeft className="size-4" />
          {backLabel}
        </Link>

        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-medium tracking-tight">
                {name}
                {profile.job_title ? (
                  <span className="text-muted-foreground">
                    , {profile.job_title}
                  </span>
                ) : null}
              </h1>
              <Badge
                variant="outline"
                className={cn(
                  "rounded-md font-normal",
                  statusBadgeClass(profile.status),
                )}
              >
                {statusLabel(profile.status, profile.leaving_reason)}
              </Badge>
              {profile.employee_category !== "employee" ? (
                <Badge variant="outline" className="rounded-md font-normal">
                  {formatLabel(profile.employee_category)}
                </Badge>
              ) : null}
            </div>
            <p className="text-sm text-muted-foreground">
              {[
                profile.employee_number,
                profile.department?.name,
                profile.office_location,
              ]
                .filter(Boolean)
                .join(" · ")}
            </p>
          </div>

          {isAdmin ? (
            <div className="flex flex-wrap items-center gap-2">
              <Link
                href={`/admin/employees/${profile.id}/edit`}
                className={cn(
                  buttonVariants({ variant: "outline" }),
                  "gap-1.5",
                )}
              >
                <Pencil className="size-3.5" />
                Edit
              </Link>
              {!isAlumni ? (
                <OffboardEmployeeDialog
                  employeeId={profile.id}
                  employeeName={name}
                  devices={record.assets}
                />
              ) : null}
            </div>
          ) : null}
        </div>

        <div className="flex gap-1 border-b border-border">
          {TABS.map((item) => {
            if (item.id === "compensation" && !isAdmin) return null;
            const active = tab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setTab(item.id)}
                className={cn(
                  "relative -mb-px px-3 py-2.5 text-sm transition-colors",
                  active
                    ? "font-medium text-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {item.label}
                {active ? (
                  <span className="absolute inset-x-3 bottom-0 h-0.5 rounded-full bg-[#0070F3]" />
                ) : null}
              </button>
            );
          })}
        </div>
      </div>

      {tab === "profile" ? (
        <div className="flex flex-col gap-4">
          <Section title="Personal details" icon={UserRound}>
            <div className="flex flex-col gap-6 lg:flex-row lg:gap-8">
              <UserAvatar
                name={name}
                src={profile.avatar_url}
                gender={profile.gender}
                className="size-28 shrink-0 rounded-xl after:rounded-xl [&_[data-slot=avatar-fallback]]:rounded-xl [&_[data-slot=avatar-image]]:rounded-xl"
              />
              <div className="grid min-w-0 flex-1 gap-x-6 gap-y-5 sm:grid-cols-2 lg:grid-cols-3">
                <Field label="First name" value={profile.first_name} />
                <Field
                  label="Preferred name"
                  value={profile.preferred_name ?? "-"}
                />
                <Field label="Last name" value={profile.last_name} />
                <Field label="Work email" value={profile.email} />
                <Field
                  label="Personal email"
                  value={profile.personal_email ?? "-"}
                />
                <Field label="Phone number" value={profile.phone ?? "-"} />
                <Field label="Position" value={profile.job_title ?? "-"} />
                <Field
                  label="Date of birth"
                  value={formatDate(profile.date_of_birth)}
                />
                <Field label="Gender" value={profile.gender ?? "-"} />
                <Field label="Nationality" value={profile.nationality ?? "-"} />
                <Field label="National ID" value={profile.national_id ?? "-"} />
                <Field label="SSNIT" value={profile.ssnit_number ?? "-"} />
                <Field label="Immigration status" value={immigrationLabel} />
                <Field
                  label="Work permit number"
                  value={profile.work_permit_number ?? "-"}
                />
                <Field
                  label="Work permit expiry"
                  value={formatDate(profile.work_permit_expiry)}
                />
              </div>
            </div>
          </Section>

          <Section
            title="Employment contract"
            icon={FileText}
            description="Latest contract. Upload more in Documents."
          >
            {latestContract ? (
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0 space-y-1">
                  <p className="truncate text-sm font-medium">
                    {latestContract.title}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {latestContract.file_name} · uploaded{" "}
                    {formatDate(latestContract.created_at)}
                  </p>
                </div>
                <a
                  href={`/api/documents/${latestContract.id}`}
                  target="_blank"
                  rel="noreferrer"
                  className={cn(
                    buttonVariants({ variant: "outline", size: "sm" }),
                    "gap-1.5",
                  )}
                >
                  <ExternalLink className="size-3.5" />
                  Open
                </a>
              </div>
            ) : (
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm text-muted-foreground">
                  No employment contract uploaded yet.
                </p>
                {isAdmin ? (
                  <button
                    type="button"
                    onClick={() => setTab("documents")}
                    className={cn(buttonVariants({ size: "sm" }), "gap-1.5")}
                  >
                    Upload contract
                  </button>
                ) : null}
              </div>
            )}
          </Section>

          <Section title="Address information" icon={MapPin}>
            <div className="grid gap-x-6 gap-y-5 sm:grid-cols-2 lg:grid-cols-3">
              <Field label="Address" value={profile.address_line ?? "-"} />
              <Field label="City" value={profile.city ?? "-"} />
              <Field label="Country" value={profile.country || "-"} />
              <Field
                label="Office / location"
                value={profile.office_location ?? "-"}
              />
            </div>
          </Section>

          <Section title="Employment details" icon={Briefcase}>
            <div className="grid gap-x-6 gap-y-5 sm:grid-cols-2 lg:grid-cols-3">
              <Field
                label="Employee ID"
                value={profile.employee_number ?? "-"}
              />
              <Field label="Status" value={formatLabel(profile.status)} />
              <Field
                label="Category"
                value={formatLabel(profile.employee_category)}
              />
              <Field
                label="Employment type"
                value={formatLabel(profile.employment_type)}
              />
              <Field label="Work type" value={formatLabel(profile.work_type)} />
              <Field
                label="Department"
                value={profile.department?.name ?? "-"}
              />
              <Field
                label="Business unit"
                value={profile.business_unit?.name ?? "JA Group"}
              />
              <Field label="Team" value={profile.team?.name ?? "-"} />
              <Field
                label="Reports to"
                value={
                  profile.manager ? displayName(profile.manager) : "-"
                }
              />
              <Field label="Hire date" value={formatDate(profile.start_date)} />
              <Field
                label="Probation end"
                value={formatDate(profile.probation_end_date)}
              />
              <Field
                label="Termination date"
                value={formatDate(profile.termination_date)}
              />
              {profile.leaving_reason ? (
                <Field
                  label="Reason for leaving"
                  value={profile.leaving_reason}
                />
              ) : null}
            </div>
          </Section>

          <Section title="Emergency contact information" icon={Shield}>
            {record.emergencyContacts.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No emergency contact on file.
              </p>
            ) : (
              <div className="space-y-5">
                {record.emergencyContacts.map((contact, index) => (
                  <div key={contact.id} className="space-y-4">
                    {record.emergencyContacts.length > 1 ? (
                      <Badge
                        variant="outline"
                        className="rounded-md font-normal"
                      >
                        Contact ({index + 1})
                      </Badge>
                    ) : null}
                    <div className="grid gap-x-6 gap-y-5 sm:grid-cols-2 lg:grid-cols-3">
                      <Field label="Name" value={contact.full_name} />
                      <Field
                        label="Relationship"
                        value={contact.relationship}
                      />
                      <Field label="Phone" value={contact.phone} />
                      <Field label="Email" value={contact.email ?? "-"} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Section>

          {record.directReports.length > 0 ? (
            <Section title="Direct reports" icon={Building2}>
              <ul className="grid gap-2 sm:grid-cols-2">
                {record.directReports.map((report) => (
                  <li
                    key={report.id}
                    className="rounded-md border border-border px-3 py-2.5 text-sm"
                  >
                    <p className="font-medium">{displayName(report)}</p>
                    <p className="text-xs text-muted-foreground">
                      {report.job_title ?? "Team member"}
                    </p>
                  </li>
                ))}
              </ul>
            </Section>
          ) : null}
        </div>
      ) : null}

      {tab === "compensation" && isAdmin ? (
        <div id="pay" className="flex flex-col gap-4 scroll-mt-6">
          {payPackage ? (
            <Section
              title="Pay package"
              icon={Wallet}
              description="Salary, statutory IDs, bank details, and payslip line items."
            >
              <PayPackageForm pack={payPackage} legalEntities={legalEntities} />
            </Section>
          ) : null}
          <PayslipsPanel
            employeeId={record.profile.id}
            payslips={record.payslips}
            canGenerate
            employmentStartDate={profile.start_date}
            hasPayPackage={record.hasPayPackage}
          />
        </div>
      ) : null}

      {tab === "documents" ? (
        <DocumentsManager
          employeeId={profile.id}
          viewerId={viewerId}
          documents={record.documents}
          canManageHrDocs={isAdmin}
          defaultKind={isAdmin ? "employment_contract" : "cv"}
          title={isAdmin ? "Employee documents" : "Documents"}
          description={
            isAdmin
              ? "Upload employment contracts, appointment letters, NDAs, and other files."
              : "Upload your CV, ID, and certificates. HR files appear here too."
          }
        />
      ) : null}

      {tab === "more" ? (
        <div className="flex flex-col gap-4">
          <Section title="Leave balances" icon={History}>
            {record.leaveBalances.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No leave balances for {new Date().getFullYear()} yet.
                Entitlement on file: {profile.annual_leave_entitlement} days.
              </p>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {record.leaveBalances.map((balance) => {
                  const label = leaveTypeLabel(balance.leave_type);
                  return (
                    <div
                      key={`${balance.leave_type}-${balance.year}`}
                      className="rounded-md border border-border px-3 py-3"
                    >
                      <p className="text-sm font-medium">{label}</p>
                      <p className="mt-1 text-2xl font-medium tracking-tight">
                        {balance.used}
                        <span className="text-sm font-normal text-muted-foreground">
                          {" "}
                          days used
                        </span>
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {balance.pending} pending
                      </p>
                    </div>
                  );
                })}
              </div>
            )}
          </Section>

          <Section title="Devices" icon={Laptop}>
            {record.assets.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No company devices assigned.
              </p>
            ) : (
              <ul className="flex flex-col gap-2">
                {record.assets.map((asset) => (
                  <li
                    key={asset.id}
                    className="rounded-md border border-border px-3 py-2 text-sm"
                  >
                    <p className="font-medium">
                      {asset.asset_tag ? `${asset.asset_tag} · ` : ""}
                      {asset.category_name ?? ASSET_KIND_LABELS[asset.kind]} · {asset.label}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {asset.serial_number ?? "No serial"}
                      {asset.assigned_at
                        ? ` · assigned ${formatDate(asset.assigned_at)}`
                        : ""}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </Section>

          {isAdmin ? (
            <Section
              title="HR notes"
              icon={FileText}
              description="HR only."
            >
              {record.hrNotes.length === 0 ? (
                <p className="text-sm text-muted-foreground">No HR notes.</p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {record.hrNotes.map((note) => (
                    <li
                      key={note.id}
                      className="rounded-md border border-border px-3 py-2 text-sm"
                    >
                      <Badge
                        variant="outline"
                        className="mb-1 rounded-md font-normal"
                      >
                        {formatLabel(note.kind)}
                      </Badge>
                      <p>{note.body}</p>
                    </li>
                  ))}
                </ul>
              )}
            </Section>
          ) : null}

          <Section title="User account" icon={UserRound}>
            <div className="grid gap-x-6 gap-y-5 sm:grid-cols-2 lg:grid-cols-3">
              <div className="space-y-2 sm:col-span-2 lg:col-span-3">
                <p className="text-xs text-muted-foreground">Permission tags</p>
                {profile.tags.length === 0 ? (
                  <p className="text-sm font-medium text-foreground">
                    Employee
                  </p>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {profile.tags.map((slug) => (
                      <Badge
                        key={slug}
                        variant="outline"
                        className="rounded-md font-normal"
                      >
                        {PERMISSION_TAG_LABELS[slug] ?? slug}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
              <Field
                label="Account status"
                value={formatLabel(profile.status)}
              />
              <Field
                label="Last login"
                value={
                  profile.last_login_at
                    ? format(new Date(profile.last_login_at), "d MMM yyyy HH:mm")
                    : "-"
                }
              />
            </div>
          </Section>

          <Section title="Activity" icon={History}>
            {record.activity.length === 0 ? (
              <p className="text-sm text-muted-foreground">No activity yet.</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {record.activity.map((item) => (
                  <li
                    key={item.id}
                    className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2 text-sm"
                  >
                    <span className="font-medium">
                      {formatLabel(item.action)}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {format(new Date(item.created_at), "d MMM yyyy")}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Section>
        </div>
      ) : null}
    </div>
  );
}
