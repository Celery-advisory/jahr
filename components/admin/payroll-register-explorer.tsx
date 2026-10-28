"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Download, Search } from "lucide-react";
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
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import {
  UNASSIGNED_ENTITY_KEY,
  UNASSIGNED_ENTITY_LABEL,
} from "@/lib/payroll/entity-analysis";
import type { PayrollRegisterEntry } from "@/lib/payroll/types";
import { cn } from "@/lib/utils";

type SortKey = "reference" | "employee" | "period" | "net" | "generated";

const SORT_ITEMS: { value: `${SortKey}:${SortDirection}`; label: string }[] = [
  { value: "generated:desc", label: "Newest generated" },
  { value: "generated:asc", label: "Oldest generated" },
  { value: "period:desc", label: "Latest period" },
  { value: "period:asc", label: "Earliest period" },
  { value: "employee:asc", label: "Employee A–Z" },
  { value: "employee:desc", label: "Employee Z–A" },
  { value: "net:desc", label: "Net pay: highest first" },
  { value: "net:asc", label: "Net pay: lowest first" },
  { value: "reference:asc", label: "Reference ascending" },
  { value: "reference:desc", label: "Reference descending" },
];

const GRID_COLUMNS =
  "lg:grid-cols-[7.5rem_minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,0.9fr)_minmax(0,0.9fr)_7rem]";

/**
 * Net pay only compares within a currency, so payslips group by currency
 * first and sort by amount inside each group.
 */
function compareEntries(
  a: PayrollRegisterEntry,
  b: PayrollRegisterEntry,
  sort: Sort<SortKey>,
): number {
  const fallback = () =>
    compareValues(a.generated_at, b.generated_at, "desc") ||
    sortCollator.compare(a.employee.name, b.employee.name);
  switch (sort.key) {
    case "reference":
      return (
        compareValues(a.reference, b.reference, sort.direction) || fallback()
      );
    case "employee":
      return (
        compareValues(a.employee.name, b.employee.name, sort.direction) ||
        compareValues(a.period_start, b.period_start, "desc")
      );
    case "period":
      return (
        compareValues(a.period_start, b.period_start, sort.direction) ||
        fallback()
      );
    case "net":
      return (
        compareValues(a.currency, b.currency, "asc") ||
        compareValues(a.net_pay, b.net_pay, sort.direction) ||
        fallback()
      );
    case "generated":
      return (
        compareValues(a.generated_at, b.generated_at, sort.direction) ||
        sortCollator.compare(a.employee.name, b.employee.name)
      );
  }
}

function formatMoney(amount: number | null, currency: string): string {
  if (amount === null) return "—";
  return `${currency} ${amount.toLocaleString("en-GH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatGeneratedAt(value: string | null): string {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

function entryHaystack(entry: PayrollRegisterEntry): string {
  return [
    entry.reference,
    entry.period_label,
    entry.employee.name,
    entry.employee.employee_number,
    entry.employee.job_title,
    entry.legal_entity_paying,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function yearFromPeriod(periodStart: string): string {
  return periodStart.slice(0, 4);
}

export function PayrollRegisterExplorer({
  entries,
}: {
  entries: PayrollRegisterEntry[];
}) {
  const [query, setQuery] = useState("");
  const [year, setYear] = useState<string>("all");
  const [entity, setEntity] = useState<string>("all");
  const [sort, setSort] = useState<Sort<SortKey>>({
    key: "generated",
    direction: "desc",
  });

  function toggleSort(key: SortKey) {
    setSort((current) => nextSort(current, key));
  }

  const entities = useMemo(() => {
    const counts = new Map<string, number>();
    let unassigned = 0;
    for (const entry of entries) {
      const value = entry.legal_entity_paying?.trim();
      if (!value) {
        unassigned += 1;
        continue;
      }
      counts.set(value, (counts.get(value) ?? 0) + 1);
    }
    const named = [...counts.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .map(([label, count]) => ({ key: label, label, count }));
    if (unassigned > 0) {
      named.push({
        key: UNASSIGNED_ENTITY_KEY,
        label: UNASSIGNED_ENTITY_LABEL,
        count: unassigned,
      });
    }
    return named;
  }, [entries]);

  const years = useMemo(() => {
    const values = new Set<string>();
    for (const entry of entries) {
      values.add(yearFromPeriod(entry.period_start));
    }
    return [...values].sort((a, b) => b.localeCompare(a));
  }, [entries]);

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return entries
      .filter((entry) => {
        if (year !== "all" && yearFromPeriod(entry.period_start) !== year) {
          return false;
        }
        if (entity === UNASSIGNED_ENTITY_KEY) {
          if (entry.legal_entity_paying?.trim()) return false;
        } else if (entity !== "all" && entry.legal_entity_paying !== entity) {
          return false;
        }
        if (!normalized) return true;
        return entryHaystack(entry).includes(normalized);
      })
      .sort((a, b) => compareEntries(a, b, sort));
  }, [entries, query, year, entity, sort]);

  if (entries.length === 0) {
    return (
      <EmptyState
        surface
        kind="payroll"
        title="No payslips yet"
        description="Generated payslips with reference numbers."
        className="py-12"
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-sm">
          <Search
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Reference, name, payroll no., period"
            aria-label="Search payslips"
            className="pl-9"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <FilterChip
            active={year === "all"}
            onClick={() => setYear("all")}
            label="All years"
          />
          {years.map((value) => (
            <FilterChip
              key={value}
              active={year === value}
              onClick={() => setYear(value)}
              label={value}
            />
          ))}
        </div>
      </div>

      {entities.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          <FilterChip
            active={entity === "all"}
            onClick={() => setEntity("all")}
            label="All entities"
          />
          {entities.map((row) => (
            <FilterChip
              key={row.key}
              active={entity === row.key}
              onClick={() => setEntity(row.key)}
              label={row.label}
            />
          ))}
        </div>
      ) : null}

      {filtered.length === 0 ? (
        <EmptyState
          surface
          size="compact"
          kind="search"
          title="No matching payslips"
          description="Try a reference like PS26-0100, an employee name, or a different year."
        />
      ) : (
        <>
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
                label="Reference"
                sortKey="reference"
                sort={sort}
                onSort={toggleSort}
              />
              <SortHeader
                label="Employee"
                sortKey="employee"
                sort={sort}
                onSort={toggleSort}
              />
              <SortHeader
                label="Period"
                sortKey="period"
                sort={sort}
                onSort={toggleSort}
              />
              <SortHeader
                label="Net pay"
                sortKey="net"
                sort={sort}
                onSort={toggleSort}
              />
              <SortHeader
                label="Generated"
                sortKey="generated"
                sort={sort}
                onSort={toggleSort}
              />
              <span>Actions</span>
            </div>

            <ul className="divide-y divide-border">
              {filtered.map((entry) => (
                <li
                  key={entry.id}
                  className={cn(
                    "grid gap-3 px-4 py-3.5 lg:items-center lg:gap-4",
                    GRID_COLUMNS,
                  )}
                >
                  <div>
                    <Badge
                      variant="outline"
                      className="rounded-md font-mono text-[11px] font-normal"
                    >
                      {entry.reference ?? "—"}
                    </Badge>
                  </div>

                  <div className="min-w-0">
                    <Link
                      href={`/admin/payroll/register/${entry.id}`}
                      className="truncate text-sm font-medium hover:underline"
                    >
                      {entry.employee.name}
                    </Link>
                    <p className="truncate text-xs text-muted-foreground">
                      {entry.employee.employee_number ?? "No payroll no."}
                      {entry.employee.job_title
                        ? ` · ${entry.employee.job_title}`
                        : ""}
                      {entry.legal_entity_paying
                        ? ` · ${entry.legal_entity_paying}`
                        : ""}
                    </p>
                  </div>

                  <p className="text-sm text-muted-foreground">
                    {entry.period_label}
                  </p>

                  <p className="text-sm tabular-nums text-muted-foreground">
                    {formatMoney(entry.net_pay, entry.currency)}
                  </p>

                  <p className="text-sm text-muted-foreground">
                    {formatGeneratedAt(entry.generated_at)}
                  </p>

                  <div className="flex flex-wrap items-center gap-2">
                    <Link
                      href={`/admin/payroll/register/${entry.id}`}
                      className={cn(
                        buttonVariants({ size: "sm", variant: "ghost" }),
                      )}
                    >
                      View
                    </Link>
                    <a
                      href={`/api/payslips/${entry.id}/pdf`}
                      className={cn(
                        buttonVariants({ size: "sm", variant: "secondary" }),
                      )}
                    >
                      <Download className="size-3.5" />
                      PDF
                    </a>
                  </div>
                </li>
              ))}
            </ul>

            <div className="border-t border-border px-4 py-3 text-xs text-muted-foreground">
              Showing {filtered.length} of {entries.length} locked records
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function FilterChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex h-8 items-center rounded-md border px-3 text-sm transition-colors",
        active
          ? "border-[#0070F3] bg-[color-mix(in_srgb,#0070F3_8%,white)] text-foreground"
          : "border-border bg-background text-muted-foreground hover:bg-muted/40 hover:text-foreground",
      )}
    >
      {label}
    </button>
  );
}
