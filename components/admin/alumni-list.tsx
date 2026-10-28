"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eye, MoreHorizontal, Search } from "lucide-react";
import {
  SortHeader,
  SortSelect,
  nextSort,
  sortCollator,
  type Sort,
  type SortDirection,
} from "@/components/admin/list-sort";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { UserAvatar } from "@/components/ui/user-avatar";
import type { AlumniDirectoryEntry } from "@/lib/alumni/types";
import { leavingReasonLabel } from "@/lib/employees/leaving-reason";
import { normalizeGender } from "@/lib/employees/normalize-gender";
import { displayName } from "@/lib/types/database";
import { cn } from "@/lib/utils";

type TypeFilter = "all" | "profile" | "record";
type SortKey = "name" | "placement" | "left" | "type";

const ANY_YEAR = "any";

const SORT_ITEMS: { value: `${SortKey}:${SortDirection}`; label: string }[] = [
  { value: "name:asc", label: "Name A–Z" },
  { value: "name:desc", label: "Name Z–A" },
  { value: "left:desc", label: "Left most recently" },
  { value: "left:asc", label: "Left longest ago" },
  { value: "placement:asc", label: "Where they worked A–Z" },
  { value: "placement:desc", label: "Where they worked Z–A" },
  { value: "type:asc", label: "Offboarded first" },
  { value: "type:desc", label: "Records first" },
];

const GRID_COLUMNS =
  "md:grid-cols-[minmax(0,2fr)_minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,0.8fr)_8.5rem_7rem]";

function alumniName(entry: AlumniDirectoryEntry): string {
  return displayName({
    first_name: entry.first_name,
    last_name: entry.last_name,
    preferred_name: entry.preferred_name,
  });
}

function alumniEmail(entry: AlumniDirectoryEntry): string {
  if (entry.source === "profile") return entry.email;
  return entry.email ?? entry.personal_email ?? "—";
}

function alumniPlacement(entry: AlumniDirectoryEntry): string {
  if (entry.source === "profile") {
    return (
      entry.department_name ??
      entry.business_unit_name ??
      entry.job_title ??
      "—"
    );
  }
  return entry.business_unit_name ?? entry.placement ?? entry.job_title ?? "—";
}

function alumniTenure(entry: AlumniDirectoryEntry): string {
  if (entry.source === "record") {
    if (entry.start_year && entry.end_year) {
      return `${entry.start_year}–${entry.end_year}`;
    }
    if (entry.start_year) return `From ${entry.start_year}`;
    if (entry.end_year) return `Until ${entry.end_year}`;
    if (entry.start_date || entry.termination_date) {
      const start = entry.start_date ?? "?";
      const end = entry.termination_date ?? "?";
      return `${start} – ${end}`;
    }
    return "—";
  }

  if (entry.start_date && entry.termination_date) {
    return `${entry.start_date.slice(0, 4)}–${entry.termination_date.slice(0, 4)}`;
  }
  if (entry.start_date) return `From ${entry.start_date.slice(0, 4)}`;
  if (entry.termination_date) {
    return `Until ${entry.termination_date.slice(0, 4)}`;
  }
  return "—";
}

/** Sortable leaving date: a full date when known, otherwise the year. */
function leftKey(entry: AlumniDirectoryEntry): string | null {
  if (entry.termination_date) return entry.termination_date;
  if (entry.source === "record" && entry.end_year)
    return String(entry.end_year);
  return null;
}

function leftYear(entry: AlumniDirectoryEntry): string | null {
  return leftKey(entry)?.slice(0, 4) ?? null;
}

function searchText(entry: AlumniDirectoryEntry): string {
  const fields =
    entry.source === "profile"
      ? [entry.email, entry.phone, entry.department_name, entry.leaving_reason]
      : [
          entry.email,
          entry.personal_email,
          entry.phone,
          entry.placement,
          entry.notes,
        ];
  return [
    alumniName(entry),
    entry.first_name,
    entry.last_name,
    entry.job_title,
    entry.business_unit_name,
    alumniPlacement(entry),
    ...fields,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

/** Sorts by the chosen column, keeps blanks last, then falls back to name. */
function compareAlumni(
  a: AlumniDirectoryEntry,
  b: AlumniDirectoryEntry,
  sort: Sort<SortKey>,
): number {
  const byName = sortCollator.compare(alumniName(a), alumniName(b));
  const sign = sort.direction === "asc" ? 1 : -1;

  if (sort.key === "name") return byName * sign;
  if (sort.key === "type") {
    if (a.source === b.source) return byName;
    return (a.source === "profile" ? -1 : 1) * sign;
  }

  const blank = (value: string) => value === "—";
  const left = sort.key === "left" ? leftKey(a) : alumniPlacement(a);
  const right = sort.key === "left" ? leftKey(b) : alumniPlacement(b);
  const leftEmpty = !left || blank(left);
  const rightEmpty = !right || blank(right);
  if (leftEmpty && rightEmpty) return byName;
  if (leftEmpty) return 1;
  if (rightEmpty) return -1;
  const diff = sortCollator.compare(left, right);
  return diff !== 0 ? diff * sign : byName;
}

function sourceBadge(entry: AlumniDirectoryEntry) {
  if (entry.source === "profile") {
    return (
      <Badge
        variant="outline"
        className="rounded-md border-transparent bg-secondary font-normal"
      >
        {leavingReasonLabel(entry.leaving_reason)}
      </Badge>
    );
  }
  return (
    <Badge
      variant="outline"
      className="rounded-md border-transparent bg-[color-mix(in_srgb,#55A8FD_10%,white)] font-normal text-[#2563EB]"
    >
      Record
    </Badge>
  );
}

function entryHref(entry: AlumniDirectoryEntry): string {
  return entry.source === "profile"
    ? `/admin/employees/${entry.id}`
    : `/admin/alumni/records/${entry.id}`;
}

export function AlumniList({ alumni }: { alumni: AlumniDirectoryEntry[] }) {
  const router = useRouter();
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [year, setYear] = useState(ANY_YEAR);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<Sort<SortKey>>({
    key: "name",
    direction: "asc",
  });

  const counts = useMemo(() => {
    const offboarded = alumni.filter(
      (entry) => entry.source === "profile",
    ).length;
    return {
      all: alumni.length,
      profile: offboarded,
      record: alumni.length - offboarded,
    };
  }, [alumni]);

  const yearItems = useMemo(() => {
    const years = [
      ...new Set(alumni.map(leftYear).filter((value) => value !== null)),
    ].sort((a, b) => b.localeCompare(a));
    return [
      { value: ANY_YEAR, label: "Left in any year" },
      ...years.map((value) => ({ value, label: `Left in ${value}` })),
    ];
  }, [alumni]);

  const indexed = useMemo(
    () => alumni.map((entry) => ({ entry, text: searchText(entry) })),
    [alumni],
  );

  const visible = useMemo(() => {
    const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
    return indexed
      .filter(({ entry, text }) => {
        if (typeFilter !== "all" && entry.source !== typeFilter) return false;
        if (year !== ANY_YEAR && leftYear(entry) !== year) return false;
        return terms.every((term) => text.includes(term));
      })
      .map(({ entry }) => entry)
      .sort((a, b) => compareAlumni(a, b, sort));
  }, [indexed, typeFilter, year, query, sort]);

  const filtered =
    typeFilter !== "all" || year !== ANY_YEAR || query.trim() !== "";

  function toggleSort(key: SortKey) {
    setSort((current) => nextSort(current, key));
  }

  function clearFilters() {
    setTypeFilter("all");
    setYear(ANY_YEAR);
    setQuery("");
  }

  if (alumni.length === 0) {
    return (
      <EmptyState
        surface
        kind="alumni"
        title="No alumni yet"
        description="Offboard from an employee profile, or add someone without a JA account."
        className="py-12"
        action={
          <Link href="/admin/alumni/new" className={cn(buttonVariants())}>
            Add alumni
          </Link>
        }
      />
    );
  }

  const typeChips: { value: TypeFilter; label: string; count: number }[] = [
    { value: "all", label: "All", count: counts.all },
    { value: "profile", label: "Offboarded", count: counts.profile },
    { value: "record", label: "Records", count: counts.record },
  ];

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-3 rounded-xl border border-border bg-card px-3 py-2.5 lg:flex-row lg:items-center">
        <div className="flex flex-wrap items-center gap-2">
          {typeChips.map((chip) => (
            <button
              key={chip.value}
              type="button"
              onClick={() => setTypeFilter(chip.value)}
              aria-pressed={typeFilter === chip.value}
              className={cn(
                "inline-flex h-8 items-center gap-1.5 rounded-md border px-3 text-sm transition-colors",
                typeFilter === chip.value
                  ? "border-[#0070F3] bg-[color-mix(in_srgb,#0070F3_8%,white)] text-foreground"
                  : "border-border bg-background text-muted-foreground hover:bg-muted/40 hover:text-foreground",
              )}
            >
              {chip.label}
              <span className="tabular-nums font-medium text-foreground">
                {chip.count}
              </span>
            </button>
          ))}
        </div>

        <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_11rem] lg:ml-auto lg:w-full lg:max-w-xl">
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search name, email, phone, role"
              aria-label="Search alumni"
              className="pl-8"
            />
          </div>
          <Select
            value={year}
            onValueChange={(next) => {
              if (next !== null) setYear(String(next));
            }}
            items={yearItems}
          >
            <SelectTrigger className="w-full" aria-label="Filter by year left">
              <SelectValue />
            </SelectTrigger>
            <SelectContent alignItemWithTrigger={false} align="start">
              {yearItems.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="md:hidden">
        <SortSelect sort={sort} onSortChange={setSort} items={SORT_ITEMS} />
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <div
          className={cn(
            "hidden gap-4 border-b border-[#E7ECF2] bg-[#F6F8FB] px-4 py-2.5 text-left text-xs font-medium text-[#667085] md:grid",
            GRID_COLUMNS,
          )}
        >
          <SortHeader
            label="Full name"
            sortKey="name"
            sort={sort}
            onSort={toggleSort}
          />
          <SortHeader
            label="Where they worked"
            sortKey="placement"
            sort={sort}
            onSort={toggleSort}
          />
          <span>Contact</span>
          <SortHeader
            label="Tenure"
            sortKey="left"
            sort={sort}
            onSort={toggleSort}
          />
          <SortHeader
            label="Type"
            sortKey="type"
            sort={sort}
            onSort={toggleSort}
          />
          <span>Actions</span>
        </div>

        {visible.length === 0 ? (
          <EmptyState
            size="compact"
            kind="search"
            title={
              query.trim()
                ? `No alumni match "${query.trim()}"`
                : "No alumni in this group"
            }
            action={
              filtered ? (
                <Button variant="outline" size="sm" onClick={clearFilters}>
                  Clear filters
                </Button>
              ) : null
            }
          />
        ) : (
          <ul className="divide-y divide-border">
            {visible.map((entry) => {
              const name = alumniName(entry);
              const href = entryHref(entry);

              return (
                <li
                  key={`${entry.source}-${entry.id}`}
                  className={cn(
                    "grid gap-3 px-4 py-3.5 text-left md:items-center md:gap-4",
                    GRID_COLUMNS,
                  )}
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <UserAvatar
                      name={name}
                      src={entry.source === "profile" ? entry.avatar_url : null}
                      gender={
                        entry.source === "profile"
                          ? normalizeGender(entry.gender)
                          : null
                      }
                      size="sm"
                    />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{name}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {entry.source === "profile"
                          ? (entry.job_title ?? "Former employee")
                          : (entry.job_title ?? "Alumni record")}
                      </p>
                    </div>
                  </div>

                  <p className="truncate text-sm text-muted-foreground">
                    {alumniPlacement(entry)}
                  </p>

                  <p className="truncate text-sm text-muted-foreground">
                    {alumniEmail(entry)}
                  </p>

                  <p className="truncate text-sm tabular-nums text-muted-foreground">
                    {alumniTenure(entry)}
                  </p>

                  <div>{sourceBadge(entry)}</div>

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
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        className={cn(
                          buttonVariants({ variant: "ghost", size: "icon-sm" }),
                        )}
                        aria-label={`More actions for ${name}`}
                      >
                        <MoreHorizontal />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="start" className="min-w-40">
                        <DropdownMenuItem onClick={() => router.push(href)}>
                          Open
                        </DropdownMenuItem>
                        {entry.source === "record" ? (
                          <DropdownMenuItem
                            onClick={() =>
                              router.push(
                                `/admin/alumni/records/${entry.id}/edit`,
                              )
                            }
                          >
                            Edit record
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
          Showing {visible.length} of {alumni.length}{" "}
          {alumni.length === 1 ? "person" : "people"}
        </div>
      </div>
    </div>
  );
}
