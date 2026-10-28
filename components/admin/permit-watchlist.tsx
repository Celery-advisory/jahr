"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  differenceInCalendarDays,
  format,
  parseISO,
  startOfDay,
} from "date-fns";
import { Eye, Search } from "lucide-react";
import {
  SortHeader,
  SortSelect,
  compareValues,
  nextSort,
  sortCollator,
  type Sort,
  type SortDirection,
} from "@/components/admin/list-sort";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { EmptyIllustration, EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { UserAvatar } from "@/components/ui/user-avatar";
import {
  IMMIGRATION_STATUS_LABELS,
  isImmigrationStatus,
} from "@/lib/employees/immigration";
import type { PermitWatchlistPerson } from "@/lib/employees/get-permit-watchlist";
import { displayName } from "@/lib/types/database";
import { cn } from "@/lib/utils";

type UrgencyFilter = "expired" | "d30" | "d60" | "d90" | "all";
type SortKey = "name" | "office" | "immigration" | "permit" | "expiry";

const SORT_ITEMS: { value: `${SortKey}:${SortDirection}`; label: string }[] = [
  { value: "expiry:asc", label: "Expiring soonest" },
  { value: "expiry:desc", label: "Expiring latest" },
  { value: "name:asc", label: "Name A–Z" },
  { value: "name:desc", label: "Name Z–A" },
  { value: "office:asc", label: "Office A–Z" },
  { value: "office:desc", label: "Office Z–A" },
  { value: "immigration:asc", label: "Immigration status A–Z" },
  { value: "immigration:desc", label: "Immigration status Z–A" },
  { value: "permit:asc", label: "Permit no. ascending" },
  { value: "permit:desc", label: "Permit no. descending" },
];

const GRID_COLUMNS =
  "lg:grid-cols-[minmax(0,1.8fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_7.5rem_6.5rem_3rem]";

function sortValue(person: PermitWatchlistPerson, key: SortKey): string | null {
  switch (key) {
    case "name":
      return displayName(person);
    case "office":
      return person.office_location;
    case "immigration":
      return person.immigration_status
        ? immigrationLabel(person.immigration_status)
        : null;
    case "permit":
      return person.work_permit_number;
    case "expiry":
      return person.work_permit_expiry;
  }
}

function searchText(person: PermitWatchlistPerson): string {
  return [
    displayName(person),
    person.first_name,
    person.last_name,
    person.email,
    person.employee_number,
    person.office_location,
    immigrationLabel(person.immigration_status),
    person.work_permit_number,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function daysUntilExpiry(expiry: string, today: Date): number {
  return differenceInCalendarDays(startOfDay(parseISO(expiry)), today);
}

function immigrationLabel(value: string | null): string {
  if (!value) return "-";
  if (isImmigrationStatus(value)) return IMMIGRATION_STATUS_LABELS[value];
  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function urgencyBadge(days: number): { label: string; className: string } {
  if (days < 0) {
    return {
      label: `${Math.abs(days)}d overdue`,
      className: "border-transparent bg-destructive/10 text-destructive",
    };
  }
  if (days === 0) {
    return {
      label: "Expires today",
      className: "border-transparent bg-destructive/10 text-destructive",
    };
  }
  if (days <= 30) {
    return {
      label: `${days}d left`,
      className: "border-transparent bg-amber-500/10 text-amber-700",
    };
  }
  if (days <= 60) {
    return {
      label: `${days}d left`,
      className:
        "border-transparent bg-[color-mix(in_srgb,#F6B93B_16%,white)] text-[#B45309]",
    };
  }
  return {
    label: `${days}d left`,
    className: "border-transparent bg-secondary text-muted-foreground",
  };
}

function matchesFilter(days: number, filter: UrgencyFilter): boolean {
  if (filter === "all") return true;
  if (filter === "expired") return days < 0;
  if (filter === "d30") return days < 0 || days <= 30;
  if (filter === "d60") return days < 0 || days <= 60;
  return days < 0 || days <= 90;
}

export function PermitWatchlist({
  people,
}: {
  people: PermitWatchlistPerson[];
}) {
  const [filter, setFilter] = useState<UrgencyFilter>("d90");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<Sort<SortKey>>({
    key: "expiry",
    direction: "asc",
  });
  const today = useMemo(() => startOfDay(new Date()), []);

  const enriched = useMemo(
    () =>
      people.map((person) => {
        const days = daysUntilExpiry(person.work_permit_expiry, today);
        return { person, days, text: searchText(person) };
      }),
    [people, today],
  );

  const counts = useMemo(() => {
    let expired = 0;
    let d30 = 0;
    let d60 = 0;
    let d90 = 0;
    for (const row of enriched) {
      if (row.days < 0) expired += 1;
      if (row.days < 0 || row.days <= 30) d30 += 1;
      if (row.days < 0 || row.days <= 60) d60 += 1;
      if (row.days < 0 || row.days <= 90) d90 += 1;
    }
    return { expired, d30, d60, d90, all: enriched.length };
  }, [enriched]);

  const visible = useMemo(() => {
    const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
    return enriched
      .filter(
        (row) =>
          matchesFilter(row.days, filter) &&
          terms.every((term) => row.text.includes(term)),
      )
      .sort(
        (a, b) =>
          compareValues(
            sortValue(a.person, sort.key),
            sortValue(b.person, sort.key),
            sort.direction,
          ) ||
          sortCollator.compare(displayName(a.person), displayName(b.person)),
      );
  }, [enriched, filter, query, sort]);

  function toggleSort(key: SortKey) {
    setSort((current) => nextSort(current, key));
  }

  if (people.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-card px-6 py-12">
        <div className="mx-auto flex max-w-md flex-col items-center text-center">
          <EmptyIllustration
            kind="permit"
            className="mb-4 h-[104px] w-[148px]"
          />
          <p className="text-sm font-medium tracking-tight">
            No work permits to track yet
          </p>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Employees with a permit expiry date on file.
          </p>
          <ol className="mt-6 w-full space-y-2.5 rounded-xl border border-border bg-background px-4 py-4 text-left text-sm">
            <li className="flex gap-3">
              <span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-secondary text-xs font-medium text-foreground">
                1
              </span>
              <span className="pt-0.5 text-muted-foreground">
                Open an employee from{" "}
                <span className="font-medium text-foreground">Employees</span>
              </span>
            </li>
            <li className="flex gap-3">
              <span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-secondary text-xs font-medium text-foreground">
                2
              </span>
              <span className="pt-0.5 text-muted-foreground">
                Click <span className="font-medium text-foreground">Edit</span>,
                then find{" "}
                <span className="font-medium text-foreground">
                  IDs &amp; immigration
                </span>
              </span>
            </li>
            <li className="flex gap-3">
              <span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-secondary text-xs font-medium text-foreground">
                3
              </span>
              <span className="pt-0.5 text-muted-foreground">
                Set immigration status, permit number, and{" "}
                <span className="font-medium text-foreground">
                  work permit expiry
                </span>
                , then save
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

  const chips: Array<{ id: UrgencyFilter; label: string; count: number }> = [
    { id: "expired", label: "Expired", count: counts.expired },
    { id: "d30", label: "Within 30 days", count: counts.d30 },
    { id: "d60", label: "Within 60 days", count: counts.d60 },
    { id: "d90", label: "Within 90 days", count: counts.d90 },
    { id: "all", label: "All with date", count: counts.all },
  ];

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-3 rounded-xl border border-border bg-card px-3 py-2.5 xl:flex-row xl:items-center">
        <div className="flex flex-wrap items-center gap-2">
          {chips.map((chip) => (
            <button
              key={chip.id}
              type="button"
              onClick={() => setFilter(chip.id)}
              className={cn(
                "inline-flex h-8 items-center gap-1.5 rounded-md border px-3 text-sm transition-colors",
                filter === chip.id
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
        <div className="relative xl:ml-auto xl:w-72">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search name, office, permit no."
            aria-label="Search work permits"
            className="pl-8"
          />
        </div>
      </div>

      <div className="lg:hidden">
        <SortSelect sort={sort} onSortChange={setSort} items={SORT_ITEMS} />
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <div
          className={cn(
            "hidden gap-4 border-b border-[#E7ECF2] bg-[#F6F8FB] px-4 py-2.5 text-left text-xs font-medium text-[#667085] lg:grid",
            GRID_COLUMNS,
          )}
        >
          <SortHeader
            label="Employee"
            sortKey="name"
            sort={sort}
            onSort={toggleSort}
          />
          <SortHeader
            label="Office"
            sortKey="office"
            sort={sort}
            onSort={toggleSort}
          />
          <SortHeader
            label="Immigration"
            sortKey="immigration"
            sort={sort}
            onSort={toggleSort}
          />
          <SortHeader
            label="Permit no."
            sortKey="permit"
            sort={sort}
            onSort={toggleSort}
          />
          <SortHeader
            label="Expiry"
            sortKey="expiry"
            sort={sort}
            onSort={toggleSort}
          />
          <span>Urgency</span>
          <span />
        </div>

        {visible.length === 0 ? (
          <EmptyState
            size="compact"
            kind="search"
            title={
              query.trim()
                ? `No one matches "${query.trim()}"`
                : "No people in this window"
            }
          />
        ) : (
          <ul className="divide-y divide-border">
            {visible.map(({ person, days }) => {
              const name = displayName(person);
              const href = `/admin/employees/${person.id}`;
              const badge = urgencyBadge(days);

              return (
                <li
                  key={person.id}
                  className={cn(
                    "grid gap-3 px-4 py-3.5 text-left lg:items-center lg:gap-4",
                    GRID_COLUMNS,
                  )}
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <UserAvatar
                      name={name}
                      src={person.avatar_url}
                      gender={person.gender}
                      size="sm"
                    />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{name}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {[person.employee_number, person.email]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                    </div>
                  </div>

                  <p className="truncate text-sm text-muted-foreground">
                    <span className="lg:hidden text-xs">Office · </span>
                    {person.office_location ?? "-"}
                  </p>

                  <p className="truncate text-sm">
                    <span className="lg:hidden text-xs text-muted-foreground">
                      Status ·{" "}
                    </span>
                    {immigrationLabel(person.immigration_status)}
                  </p>

                  <p className="truncate font-mono text-sm tabular-nums">
                    <span className="font-sans lg:hidden text-xs text-muted-foreground">
                      Permit ·{" "}
                    </span>
                    {person.work_permit_number ?? "-"}
                  </p>

                  <p className="text-sm tabular-nums">
                    {format(parseISO(person.work_permit_expiry), "d MMM yyyy")}
                  </p>

                  <div>
                    <Badge
                      variant="outline"
                      className={cn(
                        "w-fit rounded-md font-normal",
                        badge.className,
                      )}
                    >
                      {badge.label}
                    </Badge>
                  </div>

                  <div className="flex justify-start lg:justify-end">
                    <Link
                      href={href}
                      aria-label={`View ${name}`}
                      className={cn(
                        buttonVariants({ variant: "ghost", size: "icon-sm" }),
                      )}
                    >
                      <Eye />
                    </Link>
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        <div className="border-t border-border px-4 py-3 text-xs text-muted-foreground">
          Showing {visible.length} of {people.length}{" "}
          {people.length === 1 ? "result" : "results"}
        </div>
      </div>
    </div>
  );
}
