import type { ReactNode } from "react";
import { format } from "date-fns";
import { DocumentsManager } from "@/components/documents/documents-manager";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PayslipsPanel } from "@/components/payroll/payslips-panel";
import {
  ASSET_KIND_LABELS,
  type EmployeeRecord,
} from "@/lib/types/employee";
import { PERMISSION_TAG_LABELS } from "@/lib/auth/permissions";
import { displayName } from "@/lib/types/database";
import { leaveTypeLabel } from "@/lib/leave/types";

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-medium">{value || "-"}</p>
    </div>
  );
}

function Section({
  title,
  children,
  description,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-medium">{title}</CardTitle>
        {description ? (
          <p className="text-sm text-muted-foreground">{description}</p>
        ) : null}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
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

export function ProfileSections({
  record,
  viewerId,
  showHrNotes,
  hidePayroll = false,
  canManageHrDocs = false,
}: {
  record: EmployeeRecord;
  viewerId: string;
  showHrNotes: boolean;
  /** Hide the read-only payroll card when an editable form is shown above. */
  hidePayroll?: boolean;
  canManageHrDocs?: boolean;
}) {
  const { profile } = record;
  const annual = record.leaveBalances.find((row) => row.leave_type === "annual");

  return (
    <div className="flex flex-col gap-4">
      <Section title="Basic information">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Employee ID" value={profile.employee_number ?? "-"} />
          <Field label="First name" value={profile.first_name} />
          <Field label="Last name" value={profile.last_name} />
          <Field label="Preferred name" value={profile.preferred_name ?? "-"} />
          <Field label="Work email" value={profile.email} />
          <Field label="Personal email" value={profile.personal_email ?? "-"} />
          <Field label="Phone" value={profile.phone ?? "-"} />
          <Field label="Date of birth" value={formatDate(profile.date_of_birth)} />
          <Field label="Gender" value={profile.gender ?? "-"} />
        </div>
      </Section>

      <Section title="Employment">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Status" value={formatLabel(profile.status)} />
          <Field
            label="Category"
            value={formatLabel(profile.employee_category)}
          />
          <Field label="Job title" value={profile.job_title ?? "-"} />
          <Field label="Department" value={profile.department?.name ?? "-"} />
          <Field
            label="Manager"
            value={profile.manager ? displayName(profile.manager) : "-"}
          />
          <Field label="Office / location" value={profile.office_location ?? "-"} />
          <Field label="Work type" value={formatLabel(profile.work_type)} />
          <Field
            label="Employment type"
            value={formatLabel(profile.employment_type)}
          />
          <Field label="Start date" value={formatDate(profile.start_date)} />
          <Field
            label="Probation end"
            value={formatDate(profile.probation_end_date)}
          />
          <Field
            label="Termination date"
            value={formatDate(profile.termination_date)}
          />
          <Field label="Reason for leaving" value={profile.leaving_reason ?? "-"} />
        </div>
      </Section>

      <Section title="Organisation">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field
            label="Business unit"
            value={profile.business_unit?.name ?? "JA Group"}
          />
          <Field label="Team" value={profile.team?.name ?? "-"} />
          <Field label="Employee number" value={profile.employee_number ?? "-"} />
          <Field
            label="Reports to"
            value={profile.manager ? displayName(profile.manager) : "-"}
          />
        </div>
        {record.directReports.length > 0 ? (
          <div className="mt-4 space-y-2">
            <p className="text-xs text-muted-foreground">Direct reports</p>
            <ul className="flex flex-col gap-2">
              {record.directReports.map((report) => (
                <li
                  key={report.id}
                  className="rounded-md border border-border px-3 py-2 text-sm"
                >
                  <span className="font-medium">{displayName(report)}</span>
                  <span className="text-muted-foreground">
                    {" "}
                    · {report.job_title ?? "Team member"}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </Section>

      <Section title="Leave">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {record.leaveBalances.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No leave balances for {new Date().getFullYear()} yet.
              {annual
                ? ""
                : ` Entitlement on file: ${profile.annual_leave_entitlement} days.`}
            </p>
          ) : (
            record.leaveBalances.map((balance) => {
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
            })
          )}
        </div>
      </Section>

      {hidePayroll ? null : (
        <Section
          title="Payroll"
          description="For payslip generation only."
        >
          {record.payDetails ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <Field
                label="Salary"
                value={
                  record.payDetails.salary === null
                    ? "-"
                    : `${record.payDetails.currency} ${record.payDetails.salary.toLocaleString()}`
                }
              />
              <Field
                label="Pay frequency"
                value={formatLabel(record.payDetails.pay_frequency)}
              />
              <Field
                label="Payment method"
                value={formatLabel(record.payDetails.payment_method)}
              />
              <Field label="Bank" value={record.payDetails.bank_name ?? "-"} />
              <Field
                label="Branch"
                value={record.payDetails.bank_branch ?? "-"}
              />
              <Field
                label="Account name"
                value={record.payDetails.account_name ?? "-"}
              />
              <Field
                label="Account number"
                value={record.payDetails.account_number ?? "-"}
              />
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              No pay details on file.
            </p>
          )}
        </Section>
      )}

      <PayslipsPanel
        employeeId={record.profile.id}
        payslips={record.payslips}
        canGenerate
        employmentStartDate={profile.start_date}
        hasPayPackage={record.hasPayPackage}
      />

      <DocumentsManager
        employeeId={profile.id}
        viewerId={viewerId}
        documents={record.documents}
        canManageHrDocs={canManageHrDocs}
        title={canManageHrDocs ? "Employee documents" : "Documents"}
        description={
          canManageHrDocs
            ? "Upload appointment letters, NDAs, contracts, and other files."
            : "Upload your CV, ID, and certificates. HR files appear here too."
        }
      />

      <Section title="Emergency contact">
        {record.emergencyContacts.length === 0 ? (
          <p className="text-sm text-muted-foreground">No emergency contact.</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {record.emergencyContacts.map((contact) => (
              <div
                key={contact.id}
                className="rounded-md border border-border px-3 py-3"
              >
                <p className="text-sm font-medium">{contact.full_name}</p>
                <p className="text-xs text-muted-foreground">
                  {contact.relationship}
                </p>
                <p className="mt-2 text-sm">{contact.phone}</p>
                <p className="text-sm text-muted-foreground">
                  {contact.email ?? "-"}
                </p>
              </div>
            ))}
          </div>
        )}
      </Section>

      <Section title="Personal information">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Nationality" value={profile.nationality ?? "-"} />
          <Field label="National ID" value={profile.national_id ?? "-"} />
          <Field label="Address" value={profile.address_line ?? "-"} />
          <Field label="City" value={profile.city ?? "-"} />
          <Field label="Country" value={profile.country ?? "-"} />
        </div>
      </Section>

      <Section title="Devices">
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

      {showHrNotes ? (
        <Section
          title="HR notes"
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
                  <Badge variant="outline" className="mb-1 rounded-md font-normal">
                    {formatLabel(note.kind)}
                  </Badge>
                  <p>{note.body}</p>
                </li>
              ))}
            </ul>
          )}
        </Section>
      ) : null}

      <Section title="User account">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="space-y-2 sm:col-span-2 lg:col-span-3">
            <p className="text-xs text-muted-foreground">Permission tags</p>
            {profile.tags.length === 0 ? (
              <p className="text-sm font-medium">Employee</p>
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
          <Field label="Account status" value={formatLabel(profile.status)} />
          <Field
            label="Last login"
            value={
              profile.last_login_at
                ? format(new Date(profile.last_login_at), "d MMM yyyy HH:mm")
                : "-"
            }
          />
          <Field label="Email verified" value="Yes" />
          <Field label="MFA enabled" value="Not configured" />
        </div>
      </Section>

      <Section title="Activity">
        {record.activity.length === 0 ? (
          <p className="text-sm text-muted-foreground">No activity yet.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {record.activity.map((item) => (
              <li
                key={item.id}
                className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2 text-sm"
              >
                <span className="font-medium">{formatLabel(item.action)}</span>
                <span className="text-xs text-muted-foreground">
                  {format(new Date(item.created_at), "d MMM yyyy")}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  );
}
