"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Boxes,
  PackageCheck,
  Plus,
  Search,
  Settings2,
  ShieldAlert,
  UserCheck,
  UserX,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import {
  SortHeader,
  SortSelect,
  compareValues,
  nextSort,
  type Sort,
  type SortDirection,
} from "@/components/admin/list-sort";
import { CategoryManagerSheet } from "@/components/devices/category-manager-sheet";
import { DeviceActions } from "@/components/devices/device-actions";
import { DeviceFormSheet } from "@/components/devices/device-form-sheet";
import {
  AssetTag,
  OptionSelect,
  StatusBadge,
  WarrantyText,
  deviceSubtitle,
  heldByFormerStaff,
} from "@/components/devices/device-ui";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { UserAvatar } from "@/components/ui/user-avatar";
import {
  DEVICE_STATUS_LABELS,
  DEVICE_STATUSES,
  WARRANTY_WARNING_DAYS,
  warrantyState,
  type DeviceAssignee,
  type DeviceFormOptions,
  type DeviceRecord,
  type DeviceStatus,
} from "@/lib/devices/types";
import { displayName } from "@/lib/types/database";
import { cn } from "@/lib/utils";

/** "active" = everything except retired, the default view. */
type StatusFilter =
  "active" | "all" | DeviceStatus | "former_staff" | "warranty";

const STATUS_FILTER_ITEMS: { value: StatusFilter; label: string }[] = [
  { value: "active", label: "All in service" },
  ...DEVICE_STATUSES.map((status) => ({
    value: status as StatusFilter,
    label: DEVICE_STATUS_LABELS[status],
  })),
  { value: "former_staff", label: "With former staff" },
  {
    value: "warranty",
    label: `Warranty ending ≤ ${WARRANTY_WARNING_DAYS} days`,
  },
  { value: "all", label: "Everything, incl. retired" },
];

type SortKey =
  "device" | "holder" | "status" | "location" | "warranty" | "added";

const SORT_ITEMS: { value: `${SortKey}:${SortDirection}`; label: string }[] = [
  { value: "added:desc", label: "Newest first" },
  { value: "added:asc", label: "Oldest first" },
  { value: "device:asc", label: "JA ID ascending" },
  { value: "device:desc", label: "JA ID descending" },
  { value: "holder:asc", label: "Holder A–Z" },
  { value: "holder:desc", label: "Holder Z–A" },
  { value: "status:asc", label: "Status: available first" },
  { value: "status:desc", label: "Status: retired first" },
  { value: "location:asc", label: "Location A–Z" },
  { value: "location:desc", label: "Location Z–A" },
  { value: "warranty:asc", label: "Warranty ending soonest" },
  { value: "warranty:desc", label: "Warranty ending latest" },
];

function holderSortName(device: DeviceRecord): string | null {
  const employee = device.current_assignment?.employee;
  return employee ? displayName(employee) : null;
}

function sortValue(device: DeviceRecord, key: SortKey): string | number | null {
  switch (key) {
    case "device":
      return device.asset_tag;
    case "holder":
      return holderSortName(device);
    case "status":
      return DEVICE_STATUSES.indexOf(device.status);
    case "location":
      return device.location;
    case "warranty":
      return device.warranty_expires_at;
    case "added":
      return device.created_at;
  }
}

/** Sorts by the chosen column, blanks last, then newest first. */
function compareDevices(
  a: DeviceRecord,
  b: DeviceRecord,
  sort: Sort<SortKey>,
): number {
  return (
    compareValues(
      sortValue(a, sort.key),
      sortValue(b, sort.key),
      sort.direction,
    ) || compareValues(a.created_at, b.created_at, "desc")
  );
}

function matchesStatus(device: DeviceRecord, filter: StatusFilter): boolean {
  switch (filter) {
    case "all":
      return true;
    case "active":
      return device.status !== "retired";
    case "former_staff":
      return heldByFormerStaff(device);
    case "warranty":
      return (
        device.status !== "retired" &&
        warrantyState(device.warranty_expires_at) === "expiring"
      );
    default:
      return device.status === filter;
  }
}

function matchesQuery(device: DeviceRecord, query: string): boolean {
  if (!query) return true;
  const holder = device.current_assignment?.employee;
  return [
    device.asset_tag,
    device.name,
    device.serial_number,
    device.manufacturer,
    device.model,
    device.location,
    device.category.name,
    holder ? displayName(holder) : null,
    ...Object.values(device.specs),
  ].some((value) => value?.toLowerCase().includes(query));
}

function wash(color: string, percent: number): string {
  return `color-mix(in srgb, ${color} ${percent}%, white)`;
}

function SummaryTile({
  label,
  value,
  hint,
  icon: Icon,
  accent,
  active,
  onClick,
}: {
  label: string;
  value: number;
  hint: string;
  icon: LucideIcon;
  accent: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "flex h-full flex-col gap-2 rounded-xl border p-3.5 text-left transition-[border-color,box-shadow] duration-150 outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
        active
          ? "border-transparent ring-2"
          : "border-border hover:border-transparent",
      )}
      style={{
        background: `linear-gradient(165deg, ${wash(accent, 14)} 0%, #ffffff 58%)`,
        ...(active ? { ["--tw-ring-color" as string]: accent } : {}),
      }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="space-y-0.5">
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="text-xl font-medium tracking-tight tabular-nums">
            {value}
          </p>
        </div>
        <span
          className="flex size-8 shrink-0 items-center justify-center rounded-md"
          style={{ background: wash(accent, 12), color: accent }}
        >
          <Icon className="size-4" />
        </span>
      </div>
      <p className="text-[11px] leading-snug text-muted-foreground">{hint}</p>
    </button>
  );
}

function Holder({ device }: { device: DeviceRecord }) {
  const employee = device.current_assignment?.employee;
  if (!employee) {
    return <span className="text-muted-foreground">-</span>;
  }
  return (
    <div className="flex min-w-0 items-center gap-2">
      <UserAvatar
        name={displayName(employee)}
        src={employee.avatar_url}
        gender={employee.gender}
        size="sm"
      />
      <div className="min-w-0">
        <p className="truncate">{displayName(employee)}</p>
        {employee.status === "terminated" ? (
          <p className="text-xs text-destructive">Left the company</p>
        ) : employee.job_title ? (
          <p className="truncate text-xs text-muted-foreground">
            {employee.job_title}
          </p>
        ) : null}
      </div>
    </div>
  );
}

export function DevicesOverview({
  devices,
  employees,
  options,
}: {
  devices: DeviceRecord[];
  employees: DeviceAssignee[];
  options: DeviceFormOptions;
}) {
  const [query, setQuery] = useState("");
  const [categoryId, setCategoryId] = useState("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("active");
  const [addOpen, setAddOpen] = useState(false);
  const [categoriesOpen, setCategoriesOpen] = useState(false);
  const [sort, setSort] = useState<Sort<SortKey>>({
    key: "added",
    direction: "desc",
  });
  const toggleSort = (key: SortKey) =>
    setSort((current) => nextSort(current, key));

  const inService = devices.filter((device) => device.status !== "retired");
  const count = (filter: StatusFilter) =>
    devices.filter((device) => matchesStatus(device, filter)).length;

  const toggle = (filter: StatusFilter) =>
    setStatusFilter((current) => (current === filter ? "active" : filter));

  const normalizedQuery = query.trim().toLowerCase();
  const visible = devices
    .filter(
      (device) =>
        matchesStatus(device, statusFilter) &&
        (categoryId === "all" || device.category.id === categoryId) &&
        matchesQuery(device, normalizedQuery),
    )
    .sort((a, b) => compareDevices(a, b, sort));
  const filtered =
    normalizedQuery !== "" || categoryId !== "all" || statusFilter !== "active";

  const usedCategories = options.categories.filter((category) =>
    devices.some((device) => device.category.id === category.id),
  );

  const tiles: {
    filter: StatusFilter;
    label: string;
    hint: string;
    icon: LucideIcon;
    accent: string;
  }[] = [
    {
      filter: "active",
      label: "In service",
      hint: "Everything not retired",
      icon: Boxes,
      accent: "#475467",
    },
    {
      filter: "assigned",
      label: "Assigned",
      hint: "With an employee",
      icon: UserCheck,
      accent: "#0070F3",
    },
    {
      filter: "available",
      label: "Available",
      hint: "In stock, ready to issue",
      icon: PackageCheck,
      accent: "#16A34A",
    },
    {
      filter: "repair",
      label: "In repair",
      hint: "Out for fixing",
      icon: Wrench,
      accent: "#D97706",
    },
    {
      filter: "warranty",
      label: "Warranty ending",
      hint: `Within ${WARRANTY_WARNING_DAYS} days`,
      icon: ShieldAlert,
      accent: "#B45309",
    },
    {
      filter: "former_staff",
      label: "With former staff",
      hint: "Left without returning",
      icon: UserX,
      accent: "#DC2626",
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        {tiles.map((tile) => (
          <SummaryTile
            key={tile.filter}
            label={tile.label}
            value={
              tile.filter === "active" ? inService.length : count(tile.filter)
            }
            hint={tile.hint}
            icon={tile.icon}
            accent={tile.accent}
            active={statusFilter === tile.filter && tile.filter !== "active"}
            onClick={() => toggle(tile.filter)}
          />
        ))}
      </div>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_11rem_13rem] lg:max-w-3xl lg:flex-1">
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search ID, name, serial, holder"
              aria-label="Search devices"
              className="pl-8"
            />
          </div>
          <OptionSelect
            value={categoryId}
            onValueChange={setCategoryId}
            ariaLabel="Filter by category"
            items={[
              { value: "all", label: "All categories" },
              ...usedCategories.map((category) => ({
                value: category.id,
                label: category.name,
              })),
            ]}
          />
          <OptionSelect
            value={statusFilter}
            onValueChange={(value) => setStatusFilter(value as StatusFilter)}
            ariaLabel="Filter by status"
            items={STATUS_FILTER_ITEMS}
          />
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            className="gap-1.5"
            onClick={() => setCategoriesOpen(true)}
          >
            <Settings2 className="size-4" />
            Categories
          </Button>
          <Button className="gap-1.5" onClick={() => setAddOpen(true)}>
            <Plus className="size-4" />
            Add device
          </Button>
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 text-sm text-muted-foreground">
        <p>
          {filtered
            ? `${visible.length} of ${devices.length} devices`
            : `${inService.length} device${inService.length === 1 ? "" : "s"} in service`}
        </p>
        {filtered ? (
          <button
            type="button"
            className="text-sm text-accent-blue hover:underline"
            onClick={() => {
              setQuery("");
              setCategoryId("all");
              setStatusFilter("active");
            }}
          >
            Clear filters
          </button>
        ) : null}
      </div>

      {devices.length === 0 ? (
        <EmptyState
          surface
          kind="devices"
          title="No devices yet"
          description="Add a laptop, phone, or other company asset to start tracking it."
          className="py-12"
        />
      ) : visible.length === 0 ? (
        <div className="rounded-xl border border-border bg-card px-4 py-10 text-center text-sm text-muted-foreground">
          No devices match these filters.
        </div>
      ) : (
        <>
          <div className="hidden overflow-hidden rounded-xl border border-[#E7ECF2] bg-card lg:block">
            <table className="w-full text-sm">
              <thead className="border-b border-[#E7ECF2] bg-[#F6F8FB] text-left text-xs text-[#667085]">
                <tr>
                  {(
                    [
                      ["device", "Device"],
                      ["holder", "Holder"],
                      ["status", "Status"],
                      ["location", "Location"],
                      ["warranty", "Warranty"],
                    ] as const
                  ).map(([key, label]) => (
                    <th
                      key={key}
                      className="px-4 py-2.5 font-medium"
                      aria-sort={
                        sort.key === key
                          ? sort.direction === "asc"
                            ? "ascending"
                            : "descending"
                          : "none"
                      }
                    >
                      <SortHeader
                        label={label}
                        sortKey={key}
                        sort={sort}
                        onSort={toggleSort}
                      />
                    </th>
                  ))}
                  <th className="w-12 px-2 py-2.5">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {visible.map((device) => (
                  <tr
                    key={device.id}
                    className="border-b border-[#E7ECF2] transition-colors duration-150 last:border-0 hover:bg-[#F8FAFC]"
                  >
                    <td className="max-w-80 px-4 py-3">
                      <div className="flex items-start gap-2.5">
                        <AssetTag tag={device.asset_tag} className="mt-px" />
                        <div className="min-w-0">
                          <Link
                            href={`/admin/devices/${device.id}`}
                            className="block truncate font-medium hover:underline"
                          >
                            {device.name}
                          </Link>
                          <p className="truncate text-xs text-muted-foreground">
                            {deviceSubtitle(device)}
                            {device.serial_number ? (
                              <span className="font-mono">
                                {" "}
                                · {device.serial_number}
                              </span>
                            ) : null}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="max-w-56 px-4 py-3">
                      <Holder device={device} />
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={device.status} />
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {device.location ?? "-"}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <WarrantyText expiresAt={device.warranty_expires_at} />
                    </td>
                    <td className="px-2 py-3 text-right">
                      <DeviceActions
                        device={device}
                        employees={employees}
                        options={options}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="lg:hidden">
            <SortSelect sort={sort} onSortChange={setSort} items={SORT_ITEMS} />
          </div>

          <ul className="flex flex-col gap-2 lg:hidden">
            {visible.map((device) => (
              <li
                key={device.id}
                className="rounded-xl border border-border bg-card p-3.5"
              >
                <div className="flex items-start gap-2">
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <AssetTag tag={device.asset_tag} />
                      <StatusBadge status={device.status} />
                      {heldByFormerStaff(device) ? (
                        <Badge
                          variant="outline"
                          className="rounded-md border-transparent bg-destructive/10 font-normal text-destructive"
                        >
                          Not returned
                        </Badge>
                      ) : null}
                    </div>
                    <Link
                      href={`/admin/devices/${device.id}`}
                      className="block truncate text-sm font-medium hover:underline"
                    >
                      {device.name}
                    </Link>
                    <p className="truncate text-xs text-muted-foreground">
                      {deviceSubtitle(device)}
                    </p>
                    <div className="pt-1 text-sm">
                      <Holder device={device} />
                    </div>
                  </div>
                  <DeviceActions
                    device={device}
                    employees={employees}
                    options={options}
                  />
                </div>
              </li>
            ))}
          </ul>
        </>
      )}

      <DeviceFormSheet
        open={addOpen}
        onOpenChange={setAddOpen}
        device={null}
        options={options}
      />
      <CategoryManagerSheet
        open={categoriesOpen}
        onOpenChange={setCategoriesOpen}
        categories={options.categories}
      />
    </div>
  );
}
