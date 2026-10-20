import { redirect } from "next/navigation";
import { OrganogramBoard } from "@/components/organogram/organogram-board";
import { getCurrentProfile } from "@/lib/auth/get-profile";
import {
  buildOrganogram,
  getOrganogramEmployees,
} from "@/lib/employees/get-directory";
import {
  canManagePayroll,
  canViewEmployeeDetails,
  canViewPeopleDirectory,
} from "@/lib/types/database";

export default async function OrganogramPage() {
  const profile = await getCurrentProfile();

  if (!profile) {
    redirect("/dashboard");
  }

  const canOpenRecords =
    canViewPeopleDirectory(profile) || canManagePayroll(profile);
  const employees = await getOrganogramEmployees();
  const roots = buildOrganogram(employees, {
    profileHref: (employee) =>
      canOpenRecords && canViewEmployeeDetails(profile, employee)
        ? `/admin/employees/${employee.id}`
        : null,
  });

  return (
    <div className="flex h-[calc(100svh-3rem-2.5rem)] w-full flex-col gap-4 overflow-hidden">
      <div
        className="relative shrink-0 overflow-hidden rounded-xl border border-border px-5 py-4 sm:px-6"
        style={{
          background:
            "linear-gradient(135deg, color-mix(in srgb, #0070F3 8%, white) 0%, #ffffff 55%, color-mix(in srgb, #F6B93B 6%, white) 100%)",
        }}
      >
        <div className="space-y-1">
          <p className="text-xs font-medium tracking-wide text-[#0B4FBF] uppercase">
            People
          </p>
          <h1 className="text-xl font-medium tracking-tight sm:text-2xl">
            Organogram
          </h1>
          <p className="max-w-xl text-sm text-muted-foreground">
            Reporting structure across JA Group.
          </p>
        </div>
      </div>

      <OrganogramBoard
        roots={roots}
        emptyTitle="No reporting lines"
        emptyDescription="None are visible for your account."
      />
    </div>
  );
}
