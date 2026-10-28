"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ChevronDown,
  ChevronUp,
  ChevronsUpDown,
  Eye,
  Mars,
  MoreHorizontal,
  Search,
  Venus,
  Wallet,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EmptyIllustration, EmptyState } from "@/components/ui/empty-state";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { UserAvatar } from "@/components/ui/user-avatar";
import type { DirectoryEmployee } from "@/lib/employees/get-directory";
import { normalizeGender } from "@/lib/employees/normalize-gender";
import type { EmploymentStatus } from "@/lib/types/database";
import { displayName } from "@/lib/types/database";
import { cn } from "@/lib/utils";

type StatusFilter = "all" | "active";
type SortKey = "name" | "position" | "department" | "status";
type SortDirection = "asc" | "desc";
type Sort = { key: SortKey; direction: SortDirection };

const SORT_ITEMS: { value: string; label: string }[] = [
  { value: "name:asc", label: "Name A–Z" },
  { value: "name:desc", label: "Name Z–A" },
  { value: "position:asc", label: "Position A–Z" },
  { value: "position:desc", label: "Position Z–A" },
  { value: "department:asc", label: "Department A–Z" },
  { value: "department:desc", label: "Department Z–A" },
  { value: "status:asc", label: "Status: active first" },
  { value: "status:desc", label: "Status: left first" },
];

const STATUS_ORDER: Record<EmploymentStatus, number> = {
  active: 0,
  onboarding: 1,
  inactive: 2,
  terminated: 3,
};

const GRID_COLUMNS =
  "md:grid-cols-[minmax(0,2fr)_minmax(0,1.2fr)_minmax(0,1fr)_8.5rem_7rem]";

function departmentOf(employee: DirectoryEmployee): string {
  return (
    employee.department_name ?? employee.business_unit_name ?? "JA Group"
  );
}

function searchText(employee: DirectoryEmployee): string {
  return [
    displayName(employee),
    employee.first_name,
    employee.last_name,
    employee.email,
    employee.job_title,
    departmentOf(employee),
    employee.employee_number,
    employee.manager_name,
    employee.office_location,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

const collator = new Intl.Collator(undefined, { sensitivity: "base" });

/** Sorts by the chosen column, keeps blanks last, then falls back to name. */
function compareEmployees(
  a: DirectoryEmployee,
  b: DirectoryEmployee,
  sort: Sort,
): number {
  const byName = collator.compare(displayName(a), displayName(b));
  const sign = sort.direction === "asc" ? 1 : -1;

  if (sort.key === "name") return byName * sign;
  if (sort.key === "status") {
    const diff = STATUS_ORDER[a.status] - STATUS_ORDER[b.status];
    return diff !== 0 ? diff * sign : byName;
  }

  const left = sort.key === "position" ? a.job_title : departmentOf(a);
  const right = sort.key === "position" ? b.job_title : departmentOf(b);
  if (!left && !right) return byName;
  if (!left) return 1;
  if (!right) return -1;
  const diff = collator.compare(left, right);
  return diff !== 0 ? diff * sign : byName;
}

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

function matchesFilter(
  employee: DirectoryEmployee,
  filter: StatusFilter,
): boolean {
  if (filter === "all") return true;
  return employee.status === "active";
}

export function EmployeesList({
  employees,
  canManagePay = false,
  variant = "employees",
}: {
  employees: DirectoryEmployee[];
  /** Org admins can open pay packages; managers cannot. */
  canManagePay?: boolean;
  /** Alumni hides the Active filter chip. */
  variant?: "employees" | "alumni";
}) {
  const router = useRouter();
  const [filter, setFilter] = useState<StatusFilter>("all");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<Sort>({ key: "name", direction: "asc" });
  const isAlumni = variant === "alumni";

  const stats = useMemo(() => {
    const active = employees.filter((row) => row.status === "active").length;
    const male = employees.filter(
      (row) => normalizeGender(row.gender) === "male",
    ).length;
    const female = employees.filter(
      (row) => normalizeGender(row.gender) === "female",
    ).length;
    const gendered = male + female;
    const malePct = gendered === 0 ? 0 : Math.round((male / gendered) * 100);
    const femalePct = gendered === 0 ? 0 : 100 - malePct;

    return {
      all: employees.length,
      active,
      male,
      female,
      malePct,
      femalePct,
    };
  }, [employees]);

  const indexed = useMemo(
    () => employees.map((row) => ({ row, text: searchText(row) })),
    [employees],
  );

  const visible = useMemo(() => {
    const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
    return indexed
      .filter(({ row, text }) => {
        if (!isAlumni && !matchesFilter(row, filter)) return false;
        return terms.every((term) => text.includes(term));
      })
      .map(({ row }) => row)
      .sort((a, b) => compareEmployees(a, b, sort));
  }, [indexed, filter, isAlumni, query, sort]);

  function toggleSort(key: SortKey) {
    setSort((current) =>
      current.key === key
        ? { key, direction: current.direction === "asc" ? "desc" : "asc" }
        : { key, direction: "asc" },
    );
  }

  const sortValue = `${sort.key}:${sort.direction}`;

  if (employees.length === 0) {
    if (isAlumni) {
      return (
        <div className="rounded-xl border border-border bg-card px-6 py-12">
          <div className="mx-auto flex max-w-md flex-col items-center text-center">
            <EmptyIllustration kind="alumni" className="mb-4 h-[104px] w-[148px]" />
            <p className="text-sm font-medium tracking-tight">
              No alumni yet
            </p>
            <p className="mt-1.5 text-sm text-muted-foreground">
              Offboard from an employee profile.
            </p>
            <ol className="mt-6 w-full space-y-2.5 rounded-xl border border-border bg-background px-4 py-4 text-left text-sm">
              <li className="flex gap-3">
                <span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-secondary text-xs font-medium text-foreground">
                  1
                </span>
                <span className="pt-0.5 text-muted-foreground">
                  Open the person from{" "}
                  <span className="font-medium text-foreground">Employees</span>
                </span>
              </li>
              <li className="flex gap-3">
                <span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-secondary text-xs font-medium text-foreground">
                  2
                </span>
                <span className="pt-0.5 text-muted-foreground">
                  Click{" "}
                  <span className="font-medium text-foreground">Offboard</span>{" "}
                  on their profile
                </span>
              </li>
              <li className="flex gap-3">
                <span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-secondary text-xs font-medium text-foreground">
                  3
                </span>
                <span className="pt-0.5 text-muted-foreground">
                  Set their last day and reason for leaving, then confirm
                </span>
              </li>
            </ol>
            <Link
              href="/admin/employees"
              className={cn(buttonVariants(), "mt-6")}
            >
              Go to Employees
            </Link>
          </div>
        </div>
      );
    }

    return (
      <EmptyState
        surface
        kind="people"
        title={canManagePay ? "No employees yet" : "No one reports to you"}
        description={
          canManagePay
            ? "Add someone to start the directory."
            : "Direct reports show up here."
        }
        action={
          canManagePay ? (
            <Link
              href="/admin/employees/new"
              className={cn(buttonVariants())}
            >
              Add employee
            </Link>
          ) : null
        }
      />
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-3 rounded-xl border border-border bg-card px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setFilter("all")}
            className={cn(
              "inline-flex h-8 items-center gap-1.5 rounded-md border px-3 text-sm transition-colors",
              filter === "all"
                ? "border-[#0070F3] bg-[color-mix(in_srgb,#0070F3_8%,white)] text-foreground"
                : "border-border bg-background text-muted-foreground hover:bg-muted/40 hover:text-foreground",
            )}
          >
            {isAlumni ? "Alumni" : "All"}
            <span className="tabular-nums font-medium text-foreground">
              {stats.all}
            </span>
          </button>
          {!isAlumni ? (
            <button
              type="button"
              onClick={() => setFilter("active")}
              className={cn(
                "inline-flex h-8 items-center gap-1.5 rounded-md border px-3 text-sm transition-colors",
                filter === "active"
                  ? "border-[#0070F3] bg-[color-mix(in_srgb,#0070F3_8%,white)] text-foreground"
                  : "border-border bg-background text-muted-foreground hover:bg-muted/40 hover:text-foreground",
              )}
            >
              Active
              <span className="tabular-nums font-medium text-foreground">
                {stats.active}/{stats.all}
              </span>
            </button>
          ) : null}
        </div>

        <div className="flex min-w-0 flex-1 items-center gap-3 sm:max-w-sm sm:justify-end">
          <div className="flex shrink-0 items-center gap-2.5 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1" title="Male">
              <Mars className="size-3.5 text-[#55A8FD]" aria-hidden />
              <span className="tabular-nums text-foreground">{stats.male}</span>
              <span className="sr-only">male</span>
            </span>
            <span className="inline-flex items-center gap-1" title="Female">
              <Venus className="size-3.5 text-[#FF7A59]" aria-hidden />
              <span className="tabular-nums text-foreground">
                {stats.female}
              </span>
              <span className="sr-only">female</span>
            </span>
          </div>
          <div className="flex h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-muted">
            <div
              className="bg-[#55A8FD]"
              style={{ width: `${stats.malePct}%` }}
            />
            <div
              className="bg-[#FF7A59]"
              style={{ width: `${stats.femalePct}%` }}
            />
          </div>
          <p className="shrink-0 text-xs tabular-nums text-muted-foreground">
            {stats.malePct}% / {stats.femalePct}%
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative sm:max-w-sm sm:flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search name, email, position, department"
            aria-label="Search people"
            className="pl-8"
          />
        </div>
        <div className="md:hidden">
          <Select
            value={sortValue}
            onValueChange={(next) => {
              if (next === null) return;
              const [key, direction] = String(next).split(":");
              setSort({
                key: key as SortKey,
                direction: direction as SortDirection,
              });
            }}
            items={SORT_ITEMS}
          >
            <SelectTrigger className="w-full sm:w-44" aria-label="Sort by">
              <SelectValue />
            </SelectTrigger>
            <SelectContent alignItemWithTrigger={false} align="start">
              {SORT_ITEMS.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <div
          className={cn(
            "hidden gap-4 border-b border-[#E7ECF2] bg-[#F6F8FB] px-4 py-2.5 text-left text-xs font-medium text-[#667085] md:grid",
            GRID_COLUMNS,
          )}
        >
          <SortHeader label="Full name" sortKey="name" sort={sort} onSort={toggleSort} />
          <SortHeader label="Position" sortKey="position" sort={sort} onSort={toggleSort} />
          <SortHeader label="Department" sortKey="department" sort={sort} onSort={toggleSort} />
          <SortHeader label="Status" sortKey="status" sort={sort} onSort={toggleSort} />
          <span>Actions</span>
        </div>

        {visible.length === 0 ? (
          <EmptyState
            size="compact"
            kind="search"
            title={
              query.trim()
                ? `No one matches "${query.trim()}"`
                : "No people in this group"
            }
          />
        ) : (
          <ul className="divide-y divide-border">
            {visible.map((employee) => {
              const name = displayName(employee);
              const href = `/admin/employees/${employee.id}`;

              return (
                <li
                  key={employee.id}
                  className={cn(
                    "grid gap-3 px-4 py-3.5 text-left md:items-center md:gap-4",
                    GRID_COLUMNS,
                  )}
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <UserAvatar
                      name={name}
                      src={employee.avatar_url}
                      gender={employee.gender}
                      size="sm"
                    />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{name}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {employee.email}
                      </p>
                    </div>
                  </div>

                  <p className="truncate text-sm">
                    <span className="md:hidden text-xs text-muted-foreground">
                      Position ·{" "}
                    </span>
                    {employee.job_title ?? "-"}
                  </p>

                  <p className="truncate text-sm text-muted-foreground">
                    <span className="md:hidden text-xs">Dept · </span>
                    {departmentOf(employee)}
                  </p>

                  <div>
                    <Badge
                      variant="outline"
                      className={cn(
                        "w-fit rounded-md font-normal",
                        statusBadgeClass(employee.status),
                      )}
                    >
                      {statusLabel(employee.status, employee.leaving_reason)}
                    </Badge>
                  </div>

                  <div className="flex items-center justify-start gap-1">
                    <Link
                      href={href}
                      aria-label={`View ${name}`}
                      className={cn(
                        buttonVariants({ variant: "ghost", size: "icon-sm" }),
                      )}
                    >
                      <Eye />
                    </Link>
                    {canManagePay ? (
                      <Link
                        href={`${href}#pay`}
                        aria-label={`Pay package for ${name}`}
                        className={cn(
                          buttonVariants({ variant: "ghost", size: "icon-sm" }),
                        )}
                      >
                        <Wallet />
                      </Link>
                    ) : null}
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        className={cn(
                          buttonVariants({
                            variant: "ghost",
                            size: "icon-sm",
                          }),
                        )}
                        aria-label={`More actions for ${name}`}
                      >
                        <MoreHorizontal />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="start" className="min-w-40">
                        <DropdownMenuItem onClick={() => router.push(href)}>
                          Open profile
                        </DropdownMenuItem>
                        {canManagePay ? (
                          <DropdownMenuItem
                            onClick={() => router.push(`${href}#pay`)}
                          >
                            Edit salary
                          </DropdownMenuItem>
                        ) : null}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        <div className="border-t border-border px-4 py-3 text-xs text-muted-foreground">
          Showing {visible.length} of {employees.length}{" "}
          {employees.length === 1 ? "result" : "results"}
        </div>
      </div>
    </div>
  );
}

function SortHeader({
  label,
  sortKey,
  sort,
  onSort,
}: {
  label: string;
  sortKey: SortKey;
  sort: Sort;
  onSort: (key: SortKey) => void;
}) {
  const active = sort.key === sortKey;
  return (
    <span>
      <button
        type="button"
        aria-label={`Sort by ${label.toLowerCase()}`}
        onClick={() => onSort(sortKey)}
        className={cn(
          "inline-flex items-center gap-1 text-xs font-medium hover:text-foreground",
          active && "text-foreground",
        )}
      >
        {label}
        {active ? (
          sort.direction === "asc" ? (
            <ChevronUp className="size-3.5" />
          ) : (
            <ChevronDown className="size-3.5" />
          )
        ) : (
          <ChevronsUpDown className="size-3.5 opacity-40" />
        )}
      </button>
    </span>
  );
}
