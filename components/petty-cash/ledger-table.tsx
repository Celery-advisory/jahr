"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp, ChevronsUpDown } from "lucide-react";
import {
  formatPettyCashDate,
  TRANSACTION_STATUS_LABELS,
  TRANSACTION_TYPE_LABELS,
} from "@/lib/petty-cash/labels";
import { categoryTone } from "@/lib/petty-cash/category-color";
import { formatPettyCashMoney, type TransactionStatus } from "@/lib/petty-cash/money";
import type { LedgerRow } from "@/lib/petty-cash/types";
import { cn } from "@/lib/utils";

const PAGE_SIZES = [15, 25, 50] as const;

type SortKey = "date" | "description" | "type" | "category" | "in" | "out" | "balance" | "status";
type SortDirection = "asc" | "desc";

export function LedgerTable({
  rows,
  sortable = false,
}: {
  rows: LedgerRow[];
  sortable?: boolean;
}) {
  const [sort, setSort] = useState<{ key: SortKey; direction: SortDirection }>({
    key: "date",
    direction: "desc",
  });
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState<(typeof PAGE_SIZES)[number]>(15);
  const rowKey = rows.map((row) => row.id).join("\n");
  const [seen, setSeen] = useState(rowKey);
  if (seen !== rowKey) {
    setSeen(rowKey);
    setPage(0);
  }

  const ordered = sortable ? sortRows(rows, sort) : rows;
  const pageCount = Math.max(1, Math.ceil(ordered.length / pageSize));
  const safePage = Math.min(page, pageCount - 1);
  const start = sortable ? safePage * pageSize : 0;
  const visible = sortable ? ordered.slice(start, start + pageSize) : ordered;
  const showFund = new Set(rows.map((row) => row.fundId)).size > 1;

  function toggleSort(key: SortKey) {
    setSort((current) => {
      if (current.key === key) {
        return { key, direction: current.direction === "asc" ? "desc" : "asc" };
      }
      const numeric = key === "date" || key === "in" || key === "out" || key === "balance";
      return { key, direction: numeric ? "desc" : "asc" };
    });
    setPage(0);
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="hidden overflow-hidden rounded-xl border border-[#E7ECF2] bg-card lg:block">
        <table className="w-full text-sm">
          <thead className="border-b border-[#E7ECF2] bg-[#F6F8FB] text-left text-xs text-[#667085]">
            <tr>
              <Header
                label="Date"
                sortKey="date"
                sort={sort}
                sortable={sortable}
                onSort={toggleSort}
              />
              <Header
                label="Transaction"
                sortKey="description"
                sort={sort}
                sortable={sortable}
                onSort={toggleSort}
              />
              <Header
                label="Type"
                sortKey="type"
                sort={sort}
                sortable={sortable}
                onSort={toggleSort}
              />
              <Header
                label="Category"
                sortKey="category"
                sort={sort}
                sortable={sortable}
                onSort={toggleSort}
              />
              <Header
                label="Money in"
                sortKey="in"
                sort={sort}
                sortable={sortable}
                align="right"
                onSort={toggleSort}
              />
              <Header
                label="Money out"
                sortKey="out"
                sort={sort}
                sortable={sortable}
                align="right"
                onSort={toggleSort}
              />
              <Header
                label="Balance"
                sortKey="balance"
                sort={sort}
                sortable={sortable}
                align="right"
                onSort={toggleSort}
              />
              <Header
                label="Status"
                sortKey="status"
                sort={sort}
                sortable={sortable}
                onSort={toggleSort}
              />
            </tr>
          </thead>
          <tbody>
            {visible.map((row) => (
              <tr
                key={row.id}
                className="relative border-b border-[#E7ECF2] transition-colors duration-150 last:border-0 hover:bg-[#F8FAFC] has-[:focus-visible]:bg-[#F8FAFC]"
              >
                <td className="px-4 py-3.5 whitespace-nowrap text-[#667085]">
                  <Link
                    href={`/operations/petty-cash/transactions/${row.id}`}
                    className="absolute inset-0 z-10 focus-visible:outline-none"
                    aria-label={`${row.description}, ${row.transactionNumber}`}
                  />
                  {formatPettyCashDate(row.transactionDate)}
                </td>
                <td className="max-w-72 px-4 py-3.5">
                  <TransactionIdentity row={row} showFund={showFund} />
                </td>
                <td className="px-4 py-3.5">
                  <span className="inline-flex rounded-md bg-[#F2F4F7] px-2 py-0.5 text-xs font-medium text-[#475467]">
                    {TRANSACTION_TYPE_LABELS[row.transactionType]}
                  </span>
                </td>
                <td className="px-4 py-3.5">
                  {row.categoryName ? <CategoryPill name={row.categoryName} /> : null}
                </td>
                <td
                  className={cn(
                    "px-4 py-3 text-right text-sm font-medium whitespace-nowrap tabular-nums",
                    row.direction === "in" && "text-[#166534]",
                  )}
                >
                  {movementAmount(row, "in")}
                </td>
                <td className="px-4 py-3 text-right text-sm font-medium whitespace-nowrap tabular-nums">
                  {movementAmount(row, "out")}
                </td>
                <td className="px-4 py-3.5 text-right text-sm whitespace-nowrap text-[#667085] tabular-nums">
                  {row.balance == null ? "" : formatPettyCashMoney(row.balance, row.currency)}
                </td>
                <td className="px-4 py-3.5">
                  <StatusMark status={row.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {sortable ? (
          <TablePager
            className="border-t border-[#E7ECF2]"
            total={ordered.length}
            page={safePage}
            pageCount={pageCount}
            pageSize={pageSize}
            onPage={setPage}
            onPageSize={(size) => {
              setPageSize(size);
              setPage(0);
            }}
          />
        ) : null}
      </div>

      <div className="flex flex-col gap-3 lg:hidden">
        {visible.map((row) => (
          <Link
            key={row.id}
            href={`/operations/petty-cash/transactions/${row.id}`}
            className="rounded-xl border border-border bg-card p-4 transition-colors duration-150 hover:bg-muted/40"
          >
            <div className="flex items-start justify-between gap-3">
              <TransactionIdentity row={row} showFund={showFund} />
              <p
                className={cn(
                  "shrink-0 text-sm font-medium tabular-nums",
                  row.direction === "in" && "text-[#166534]",
                )}
              >
                {movementAmount(row, row.direction)}
              </p>
            </div>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                <span className="text-xs text-muted-foreground">
                  {formatPettyCashDate(row.transactionDate)}
                </span>
                {row.categoryName ? <CategoryPill name={row.categoryName} /> : null}
              </div>
              <StatusMark status={row.status} />
            </div>
            {row.balance == null ? null : (
              <p className="mt-2 text-xs text-muted-foreground tabular-nums">
                Balance {formatPettyCashMoney(row.balance, row.currency)}
              </p>
            )}
          </Link>
        ))}
      </div>

      {sortable ? (
        <div className="overflow-hidden rounded-xl border border-border bg-card lg:hidden">
          <TablePager
            total={ordered.length}
            page={safePage}
            pageCount={pageCount}
            pageSize={pageSize}
            onPage={setPage}
            onPageSize={(size) => {
              setPageSize(size);
              setPage(0);
            }}
          />
        </div>
      ) : null}
    </div>
  );
}

const STATUS_DOT: Record<TransactionStatus, string> = {
  posted: "#16A34A",
  approved: "#16A34A",
  pending_approval: "#F59E0B",
  rejected: "#DC2626",
  voided: "#DC2626",
  draft: "#98A2B3",
};

function CategoryPill({ name }: { name: string }) {
  const tone = categoryTone(name);
  return (
    <span
      className="inline-flex max-w-full truncate rounded-md px-2 py-0.5 text-xs font-medium"
      style={{ backgroundColor: tone.bg, color: tone.text }}
    >
      {name}
    </span>
  );
}

function StatusMark({ status }: { status: TransactionStatus }) {
  return (
    <span className="inline-flex items-center gap-2 whitespace-nowrap text-sm text-[#344054]">
      <span
        className="size-1.5 shrink-0 rounded-full"
        style={{ backgroundColor: STATUS_DOT[status] }}
      />
      {TRANSACTION_STATUS_LABELS[status]}
    </span>
  );
}

function TablePager({
  total,
  page,
  pageCount,
  pageSize,
  onPage,
  onPageSize,
  className,
}: {
  total: number;
  page: number;
  pageCount: number;
  pageSize: (typeof PAGE_SIZES)[number];
  onPage: (page: number) => void;
  onPageSize: (size: (typeof PAGE_SIZES)[number]) => void;
  className?: string;
}) {
  const pages = pageWindow(page, pageCount);

  return (
    <div
      className={cn(
        "flex flex-col gap-3 px-4 py-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between",
        className,
      )}
    >
      <p className="text-sm text-[#667085]">Total {total}</p>
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:gap-4">
        <label className="flex items-center justify-between gap-2 text-sm text-[#667085] sm:justify-start">
          Lines per page
          <select
            value={pageSize}
            onChange={(event) => {
              const next = Number(event.target.value);
              if (next === 15 || next === 25 || next === 50) onPageSize(next);
            }}
            className="h-8 rounded-md border border-[#E7ECF2] bg-white px-2 text-sm text-foreground"
          >
            {PAGE_SIZES.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
        </label>
        <div className="flex items-center justify-between gap-1 sm:justify-start">
          <button
            type="button"
            aria-label="Previous page"
            disabled={page === 0}
            onClick={() => onPage(page - 1)}
            className="flex size-8 items-center justify-center rounded-full text-[#667085] hover:bg-muted disabled:opacity-40"
          >
            <ChevronLeft className="size-4" />
          </button>
          <span className="min-w-16 text-center text-sm text-[#667085] tabular-nums sm:hidden">
            {page + 1} / {pageCount}
          </span>
          <div className="hidden items-center gap-1 sm:flex">
            {pages.map((item, index) =>
              item === "gap" ? (
                <span key={`gap-${index}`} className="px-1 text-sm text-[#667085]">
                  ...
                </span>
              ) : (
                <button
                  key={item}
                  type="button"
                  onClick={() => onPage(item)}
                  className={cn(
                    "flex size-8 items-center justify-center rounded-full text-sm",
                    item === page
                      ? "bg-[#171717] text-white"
                      : "text-[#667085] hover:bg-muted",
                  )}
                >
                  {item + 1}
                </button>
              ),
            )}
          </div>
          <button
            type="button"
            aria-label="Next page"
            disabled={page >= pageCount - 1}
            onClick={() => onPage(page + 1)}
            className="flex size-8 items-center justify-center rounded-full text-[#667085] hover:bg-muted disabled:opacity-40"
          >
            <ChevronRight className="size-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

function pageWindow(page: number, pageCount: number): Array<number | "gap"> {
  if (pageCount <= 7) return Array.from({ length: pageCount }, (_, index) => index);
  const items: Array<number | "gap"> = [0];
  const start = Math.max(1, page - 1);
  const end = Math.min(pageCount - 2, page + 1);
  if (start > 1) items.push("gap");
  for (let index = start; index <= end; index += 1) items.push(index);
  if (end < pageCount - 2) items.push("gap");
  items.push(pageCount - 1);
  return items;
}

function TransactionIdentity({
  row,
  showFund,
}: {
  row: LedgerRow;
  showFund: boolean;
}) {
  return (
    <div className="min-w-0">
      <p className="truncate font-medium">{row.description}</p>
      <p className="mt-0.5 text-xs text-muted-foreground">{row.transactionNumber}</p>
      {showFund ? (
        <p className="text-xs text-muted-foreground">{row.fundName}</p>
      ) : null}
    </div>
  );
}

function Header({
  label,
  sortKey,
  sort,
  sortable,
  align = "left",
  onSort,
}: {
  label: string;
  sortKey: SortKey;
  sort: { key: SortKey; direction: SortDirection };
  sortable: boolean;
  align?: "left" | "right";
  onSort: (key: SortKey) => void;
}) {
  const active = sortable && sort.key === sortKey;
  return (
    <th
      className={cn("px-4 py-2.5 font-medium", align === "right" && "text-right")}
      aria-sort={active ? (sort.direction === "asc" ? "ascending" : "descending") : "none"}
    >
      {sortable ? (
        <button
          type="button"
          onClick={() => onSort(sortKey)}
          className={cn(
            "inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground",
            align === "right" && "flex-row-reverse",
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
      ) : (
        label
      )}
    </th>
  );
}

function movementAmount(row: LedgerRow, direction: "in" | "out"): string {
  if (row.direction !== direction) return "";
  const sign = direction === "in" ? "+" : "\u2212";
  return `${sign} ${formatPettyCashMoney(row.amount, row.currency)}`;
}

function sortRows(
  rows: readonly LedgerRow[],
  sort: { key: SortKey; direction: SortDirection },
): LedgerRow[] {
  return [...rows].sort((a, b) => {
    const result = compareRows(a, b, sort.key, sort.direction);
    if (result !== 0) return result;
    const byDate = b.transactionDate.localeCompare(a.transactionDate);
    if (byDate !== 0) return byDate;
    return b.createdAt.localeCompare(a.createdAt);
  });
}

function compareRows(
  a: LedgerRow,
  b: LedgerRow,
  key: SortKey,
  direction: SortDirection,
): number {
  switch (key) {
    case "date":
      return (
        compareText(a.transactionDate, b.transactionDate, direction) ||
        compareText(a.createdAt, b.createdAt, direction)
      );
    case "description":
      return compareText(a.description, b.description, direction);
    case "type":
      return compareText(
        TRANSACTION_TYPE_LABELS[a.transactionType],
        TRANSACTION_TYPE_LABELS[b.transactionType],
        direction,
      );
    case "category":
      return compareText(a.categoryName ?? "", b.categoryName ?? "", direction);
    case "in":
      return compareNullable(
        a.direction === "in" ? a.amount : null,
        b.direction === "in" ? b.amount : null,
        direction,
      );
    case "out":
      return compareNullable(
        a.direction === "out" ? a.amount : null,
        b.direction === "out" ? b.amount : null,
        direction,
      );
    case "balance":
      return compareNullable(a.balance, b.balance, direction);
    case "status":
      return compareText(
        TRANSACTION_STATUS_LABELS[a.status],
        TRANSACTION_STATUS_LABELS[b.status],
        direction,
      );
  }
}

function compareText(a: string, b: string, direction: SortDirection): number {
  const result = a.localeCompare(b, undefined, { sensitivity: "base" });
  return direction === "asc" ? result : -result;
}

function compareNullable(
  a: number | null,
  b: number | null,
  direction: SortDirection,
): number {
  if (a == null && b == null) return 0;
  if (a == null) return 1;
  if (b == null) return -1;
  return direction === "asc" ? a - b : b - a;
}
