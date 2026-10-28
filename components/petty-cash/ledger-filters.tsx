"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronDown, Download, Search } from "lucide-react";
import type { DateRange } from "react-day-picker";
import { buttonVariants } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatPettyCashDate, TRANSACTION_STATUS_LABELS, TRANSACTION_TYPE_LABELS } from "@/lib/petty-cash/labels";
import { TRANSACTION_STATUSES, TRANSACTION_TYPES } from "@/lib/petty-cash/money";
import {
  hasLedgerFilters,
  type LedgerFilters,
  type PettyCashCategory,
  type PettyCashFund,
} from "@/lib/petty-cash/types";
import { cn } from "@/lib/utils";
import { useResetOnChange } from "@/lib/hooks/use-reset-on-change";

export function LedgerFiltersBar({
  filters,
  funds,
  categories,
}: {
  filters: LedgerFilters;
  funds: PettyCashFund[];
  categories: PettyCashCategory[];
}) {
  const router = useRouter();
  const fundItems = [
    { value: "all", label: "All funds" },
    ...funds.map((fund) => ({ value: fund.id, label: fund.name })),
  ];
  const categoryItems = [
    { value: "all", label: "All categories" },
    ...categories
      .filter((category) => category.parentId)
      .map((category) => ({ value: category.id, label: category.name })),
  ];
  const statusItems = [
    { value: "all", label: "All statuses" },
    ...TRANSACTION_STATUSES.map((status) => ({
      value: status,
      label: TRANSACTION_STATUS_LABELS[status],
    })),
  ];
  const typeItems = [
    { value: "all", label: "All types" },
    ...TRANSACTION_TYPES.map((type) => ({
      value: type,
      label: TRANSACTION_TYPE_LABELS[type],
    })),
  ];

  function push(next: Partial<LedgerFilters>) {
    const merged = { ...filters, ...next };
    const params = new URLSearchParams();
    if (merged.q) params.set("q", merged.q);
    if (merged.fundId) params.set("fund", merged.fundId);
    if (merged.categoryId) params.set("category", merged.categoryId);
    if (merged.vendorId) params.set("vendor", merged.vendorId);
    if (merged.status) params.set("status", merged.status);
    if (merged.type) params.set("type", merged.type);
    if (merged.from) params.set("from", merged.from);
    if (merged.to) params.set("to", merged.to);
    const query = params.toString();
    router.push(query ? `/operations/petty-cash/transactions?${query}` : "/operations/petty-cash/transactions");
  }

  const exportParams = new URLSearchParams();
  if (filters.q) exportParams.set("q", filters.q);
  if (filters.fundId) exportParams.set("fund", filters.fundId);
  if (filters.categoryId) exportParams.set("category", filters.categoryId);
  if (filters.vendorId) exportParams.set("vendor", filters.vendorId);
  if (filters.status) exportParams.set("status", filters.status);
  if (filters.type) exportParams.set("type", filters.type);
  if (filters.from) exportParams.set("from", filters.from);
  if (filters.to) exportParams.set("to", filters.to);
  const exportQuery = exportParams.toString();

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
      <form
        className="relative w-full sm:w-64"
        onSubmit={(event) => {
          event.preventDefault();
          const data = new FormData(event.currentTarget);
          push({ q: String(data.get("q") ?? "").trim() });
        }}
      >
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          name="q"
          key={filters.q}
          defaultValue={filters.q}
          placeholder="Search transactions..."
          aria-label="Search transactions"
          className="pl-9"
        />
      </form>
      <div className="grid w-full min-w-0 grid-cols-2 gap-2 sm:ml-auto sm:flex sm:w-auto sm:flex-wrap sm:items-center">
      <FilterSelect
        label="Fund"
        value={filters.fundId || "all"}
        items={fundItems}
        onChange={(value) => push({ fundId: value === "all" ? "" : value })}
      />
      <FilterSelect
        label="Category"
        value={filters.categoryId || "all"}
        items={categoryItems}
        onChange={(value) => push({ categoryId: value === "all" ? "" : value })}
      />
      <FilterSelect
        label="Type"
        value={filters.type || "all"}
        items={typeItems}
        onChange={(value) => push({ type: value === "all" ? "" : value })}
      />
      <FilterSelect
        label="Status"
        value={filters.status || "all"}
        items={statusItems}
        onChange={(value) => push({ status: value === "all" ? "" : value })}
      />
      <DateRangeFilter filters={filters} onChange={(from, to) => push({ from, to })} />
      <a
        href={exportQuery ? `/api/petty-cash/export?${exportQuery}` : "/api/petty-cash/export"}
        className={cn(
          buttonVariants(),
          "col-span-2 w-full bg-[#1f2353] text-white hover:bg-[#2a2f68] sm:col-span-1 sm:w-auto",
        )}
      >
        <Download className="size-4" />
        Export
      </a>
      {hasLedgerFilters(filters) ? (
        <Link
          href="/operations/petty-cash/transactions"
          className={cn(buttonVariants({ variant: "ghost" }), "col-span-2 sm:col-span-1 sm:w-auto")}
        >
          Clear
        </Link>
      ) : null}
      </div>
    </div>
  );
}

function DateRangeFilter({
  filters,
  onChange,
}: {
  filters: LedgerFilters;
  onChange: (from: string, to: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<DateRange | undefined>();

  // Drop any half-picked range once the applied filters change.
  useResetOnChange([filters.from, filters.to], () => setDraft(undefined));

  const applied: DateRange | undefined =
    filters.from || filters.to
      ? { from: parseIso(filters.from), to: parseIso(filters.to) }
      : undefined;

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setDraft(undefined);
      }}
    >
      <PopoverTrigger
        className={cn(
          buttonVariants({ variant: "outline" }),
          "col-span-2 w-full min-w-0 justify-between gap-2 px-3 font-normal sm:col-span-1 sm:w-auto",
        )}
      >
        <span className="truncate">{rangeLabel(filters.from, filters.to)}</span>
        <ChevronDown className="size-4 text-muted-foreground" />
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto max-w-[calc(100vw-2rem)] p-2">
        <Calendar
          mode="range"
          numberOfMonths={1}
          selected={draft ?? applied}
          onSelect={(next) => {
            if (!next?.from) {
              setDraft(undefined);
              return;
            }
            // The first click reports a one-day range. Hold it so the second click can set the end.
            if (!draft?.from || !next.to) {
              setDraft({ from: next.from });
              return;
            }
            setDraft(undefined);
            setOpen(false);
            onChange(toIso(next.from), toIso(next.to));
          }}
        />
        {filters.from || filters.to ? (
          <button
            type="button"
            className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "w-full")}
            onClick={() => {
              setDraft(undefined);
              onChange("", "");
            }}
          >
            Clear dates
          </button>
        ) : null}
      </PopoverContent>
    </Popover>
  );
}

function FilterSelect({
  label,
  value,
  items,
  onChange,
}: {
  label: string;
  value: string;
  items: Array<{ value: string; label: string }>;
  onChange: (value: string) => void;
}) {
  return (
    <Select
      value={value}
      onValueChange={(next) => {
        if (next) onChange(next);
      }}
      items={items}
    >
      <SelectTrigger className="w-full min-w-0 max-w-full sm:w-auto sm:max-w-48" aria-label={label}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {items.map((item) => (
          <SelectItem key={item.value} value={item.value}>
            {item.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function rangeLabel(from: string, to: string): string {
  if (from && to) return `${formatPettyCashDate(from)} to ${formatPettyCashDate(to)}`;
  if (from) return `From ${formatPettyCashDate(from)}`;
  if (to) return `Until ${formatPettyCashDate(to)}`;
  return "Date range";
}

function parseIso(value: string): Date | undefined {
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return undefined;
  return new Date(year, month - 1, day);
}

function toIso(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}
