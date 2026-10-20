import { cookies } from "next/headers";
import {
  getCurrentProfile,
  PERMISSION_TAGS_EMBED,
} from "@/lib/auth/get-profile";
import {
  PERMISSION_TAG_LABELS,
  permissionTagsFromRows,
  type PermissionTagRow,
  type PermissionTagSlug,
} from "@/lib/auth/permissions";
import {
  isOrgAdmin,
  type AppRole,
  type EmploymentStatus,
} from "@/lib/types/database";
import { createAdminClient } from "@/utils/supabase/admin";
import { createClient } from "@/utils/supabase/server";
import { firstRelation } from "@/utils/supabase/relations";

export interface DirectoryEmployee {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  preferred_name: string | null;
  job_title: string | null;
  role: AppRole;
  tags: PermissionTagSlug[];
  status: EmploymentStatus;
  employee_number: string | null;
  office_location: string | null;
  gender: string | null;
  avatar_url: string | null;
  leaving_reason: string | null;
  business_unit_id: string | null;
  department_id: string | null;
  manager_id: string | null;
  business_unit_name: string | null;
  department_name: string | null;
  manager_name: string | null;
}

export async function getDirectoryEmployees(options?: {
  /** When true, includes inactive, onboarding, and terminated people. */
  allStatuses?: boolean;
  /** Restrict to a single employment status (e.g. alumni = terminated). */
  status?: EmploymentStatus;
  /**
   * When true, includes active / inactive / onboarding but not terminated.
   * Ignored when `status` or `allStatuses` is set.
   */
  excludeTerminated?: boolean;
  /**
   * When true, non-admins include themselves plus direct reports (organogram).
   * Default is reports-only for managers.
   */
  includeSelf?: boolean;
}): Promise<DirectoryEmployee[]> {
  const viewer = await getCurrentProfile();
  if (!viewer) {
    return [];
  }

  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);
  const admin = isOrgAdmin(viewer);

  let query = supabase
    .from("profiles")
    .select(DIRECTORY_SELECT)
    .order("first_name", { ascending: true });

  if (options?.status) {
    query = query.eq("status", options.status);
  } else if (options?.excludeTerminated) {
    query = query.neq("status", "terminated");
  } else if (!options?.allStatuses) {
    query = query.eq("status", "active");
  }

  if (!admin) {
    query = options?.includeSelf
      ? query.or(`id.eq.${viewer.id},manager_id.eq.${viewer.id}`)
      : query.eq("manager_id", viewer.id);
  }

  const { data, error } = await query;

  if (error || !data) {
    if (error) {
      console.error("[getDirectoryEmployees]", error.message);
    }
    return [];
  }

  const rows: DirectoryRow[] = data;
  return rows.map(toDirectoryEmployee);
}

const ORGANOGRAM_SELECT = `
  id, email, first_name, last_name, preferred_name, job_title,
  role, status, gender, avatar_url, business_unit_id, department_id, manager_id,
  business_unit:business_units ( name ),
  department:departments ( name ),
  manager:manager_id ( first_name, last_name, preferred_name ),
  ${PERMISSION_TAGS_EMBED}
`;

type OrganogramSourceRow = Omit<
  DirectoryRow,
  "employee_number" | "office_location" | "leaving_reason"
>;

/**
 * Active people for the company organogram.
 * The service role is limited to chart columns so reporting-line RLS still
 * hides national IDs, tax numbers, and similar fields on `profiles`.
 */
async function loadActiveOrganogramEmployees(): Promise<DirectoryEmployee[]> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("profiles")
    .select(ORGANOGRAM_SELECT)
    .eq("status", "active")
    .order("first_name", { ascending: true });

  if (error || !data) {
    if (error) {
      console.error("[loadActiveOrganogramEmployees]", error.message);
    }
    return [];
  }

  const rows: OrganogramSourceRow[] = data;
  return rows.map((row) =>
    toDirectoryEmployee({
      ...row,
      employee_number: null,
      office_location: null,
      leaving_reason: null,
    }),
  );
}

export async function getOrganogramEmployees(): Promise<DirectoryEmployee[]> {
  const viewer = await getCurrentProfile();
  if (!viewer) {
    return [];
  }

  return loadActiveOrganogramEmployees();
}

function shareRoleLabel(node: OrganogramNode): string {
  const title = node.jobTitle?.trim();
  if (title) return title;
  if (node.tags.length === 0) return "Team member";
  return node.tags
    .map((slug) => PERMISSION_TAG_LABELS[slug] ?? slug)
    .join(", ");
}

/** Chart fields only. Emails, access tags, and profile links stay off the payload. */
function forPublicShare(nodes: OrganogramNode[]): OrganogramNode[] {
  return nodes.map((node) => ({
    ...node,
    jobTitle: shareRoleLabel(node),
    email: "",
    tags: [],
    gender: null,
    role: "employee",
    profileHref: null,
    assistants: forPublicShare(node.assistants),
    children: forPublicShare(node.children),
  }));
}

/**
 * Active reporting lines for the public organogram.
 * No session is required. The service role reads chart columns only.
 */
export async function getShareOrganogram(): Promise<OrganogramNode[]> {
  const employees = await loadActiveOrganogramEmployees();
  return forPublicShare(buildOrganogram(employees));
}

const DIRECTORY_SELECT = `
  id, email, first_name, last_name, preferred_name, job_title,
  role, status, employee_number, office_location, gender, avatar_url,
  leaving_reason, business_unit_id, department_id, manager_id,
  business_unit:business_units ( name ),
  department:departments ( name ),
  manager:manager_id ( first_name, last_name, preferred_name ),
  ${PERMISSION_TAGS_EMBED}
`;

interface NamedRelation {
  name: string;
}

interface DirectoryManagerRelation {
  first_name: string;
  last_name: string;
  preferred_name: string | null;
}

type DirectoryRow = Omit<
  DirectoryEmployee,
  "tags" | "business_unit_name" | "department_name" | "manager_name"
> & {
  business_unit: NamedRelation | NamedRelation[] | null;
  department: NamedRelation | NamedRelation[] | null;
  manager: DirectoryManagerRelation | DirectoryManagerRelation[] | null;
  profile_permission_tags: PermissionTagRow[] | null;
};

function managerDisplayName(
  manager: DirectoryManagerRelation | null,
): string | null {
  if (!manager) return null;
  return [manager.preferred_name?.trim() || manager.first_name, manager.last_name]
    .filter(Boolean)
    .join(" ");
}

function toDirectoryEmployee({
  business_unit,
  department,
  manager,
  profile_permission_tags,
  ...row
}: DirectoryRow): DirectoryEmployee {
  return {
    ...row,
    tags: permissionTagsFromRows(profile_permission_tags),
    gender: row.gender ?? null,
    avatar_url: row.avatar_url ?? null,
    leaving_reason: row.leaving_reason ?? null,
    business_unit_name: firstRelation(business_unit)?.name ?? null,
    department_name: firstRelation(department)?.name ?? null,
    manager_name: managerDisplayName(firstRelation(manager)),
  };
}

export interface OrganogramNode {
  id: string;
  name: string;
  jobTitle: string | null;
  email: string;
  role: AppRole;
  tags: PermissionTagSlug[];
  gender: string | null;
  avatarUrl: string | null;
  departmentName: string | null;
  businessUnitName: string | null;
  /** Staff roles drawn to the left of this person, not as reports below. */
  assistants: OrganogramNode[];
  children: OrganogramNode[];
  /** Set when the viewer may open this person's employee record. */
  profileHref: string | null;
}

const ORGANOGRAM_UNIT_ORDER = [
  "JA Group",
  "JA Wealth",
  "Harry Hill Consulting",
  "JA Digital",
  "JA Realty",
  "JA Elements",
] as const;

function organogramUnitLabel(name: string | null): string {
  return name ?? "JA Group";
}

function unitOrderIndex(name: string): number {
  const index = (ORGANOGRAM_UNIT_ORDER as readonly string[]).indexOf(name);
  return index === -1 ? ORGANOGRAM_UNIT_ORDER.length : index;
}

function isExecutiveAssistant(jobTitle: string | null): boolean {
  if (!jobTitle) return false;
  const title = jobTitle.trim().toLowerCase();
  return (
    title.includes("executive assistant") ||
    title.includes("personal assistant") ||
    title.includes("assistant to the")
  );
}

function compareOrganogramSiblings(
  a: OrganogramNode,
  b: OrganogramNode,
): number {
  const aUnit = organogramUnitLabel(a.businessUnitName);
  const bUnit = organogramUnitLabel(b.businessUnitName);
  const unitDiff = unitOrderIndex(aUnit) - unitOrderIndex(bUnit);
  if (unitDiff !== 0) return unitDiff;
  if (aUnit !== bUnit) return aUnit.localeCompare(bUnit);

  const dept = (a.departmentName ?? "").localeCompare(b.departmentName ?? "");
  if (dept !== 0) return dept;

  return a.name.localeCompare(b.name);
}

export function buildOrganogram(
  employees: DirectoryEmployee[],
  options?: {
    profileHref?: (employee: DirectoryEmployee) => string | null;
  },
): OrganogramNode[] {
  const nodes = new Map<string, OrganogramNode>();

  for (const employee of employees) {
    nodes.set(employee.id, {
      id: employee.id,
      name: [
        employee.preferred_name?.trim() || employee.first_name,
        employee.last_name,
      ]
        .filter(Boolean)
        .join(" "),
      jobTitle: employee.job_title,
      email: employee.email,
      role: employee.role,
      tags: employee.tags,
      gender: employee.gender,
      avatarUrl: employee.avatar_url,
      departmentName: employee.department_name,
      businessUnitName: employee.business_unit_name,
      assistants: [],
      children: [],
      profileHref: options?.profileHref?.(employee) ?? null,
    });
  }

  const roots: OrganogramNode[] = [];

  for (const employee of employees) {
    const node = nodes.get(employee.id);
    if (!node) continue;

    if (employee.manager_id && nodes.has(employee.manager_id)) {
      const parent = nodes.get(employee.manager_id);
      if (!parent) continue;
      if (isExecutiveAssistant(employee.job_title)) {
        parent.assistants.push(node);
      } else {
        parent.children.push(node);
      }
    } else {
      roots.push(node);
    }
  }

  const sortTree = (list: OrganogramNode[]) => {
    list.sort(compareOrganogramSiblings);
    list.forEach((node) => {
      sortTree(node.assistants);
      sortTree(node.children);
    });
  };
  sortTree(roots);

  return roots;
}
