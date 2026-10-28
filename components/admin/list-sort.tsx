"use client";

import { ChevronDown, ChevronUp, ChevronsUpDown } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

export type SortDirection = "asc" | "desc";
export type Sort<K extends string> = { key: K; direction: SortDirection };

/** Same column flips direction; a new column starts ascending. */
export function nextSort<K extends string>(current: Sort<K>, key: K): Sort<K> {
  return current.key === key
    ? { key, direction: current.direction === "asc" ? "desc" : "asc" }
    : { key, direction: "asc" };
}

export const sortCollator = new Intl.Collator(undefined, {
  sensitivity: "base",
  numeric: true,
});

/**
 * Compares two cell values in the given direction. Blanks always sort last,
 * whichever way the column is sorted. Returns 0 on a tie so callers can chain
 * a fallback with `||`.
 */
export function compareValues(
  a: string | number | null | undefined,
  b: string | number | null | undefined,
  direction: SortDirection,
): number {
  const aBlank = a === null || a === undefined || a === "";
  const bBlank = b === null || b === undefined || b === "";
  if (aBlank || bBlank) return aBlank === bBlank ? 0 : aBlank ? 1 : -1;
  const diff =
    typeof a === "number" && typeof b === "number"
      ? a - b
      : sortCollator.compare(String(a), String(b));
  return direction === "asc" ? diff : -diff;
}

/** Clickable column label for the desktop table header. */
export function SortHeader<K extends string>({
  label,
  sortKey,
  sort,
  onSort,
}: {
  label: string;
  sortKey: K;
  sort: Sort<K>;
  onSort: (key: K) => void;
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

/** "Sort by" dropdown for small screens, where the header row is hidden. */
export function SortSelect<K extends string>({
  sort,
  onSortChange,
  items,
  className,
}: {
  sort: Sort<K>;
  onSortChange: (sort: Sort<K>) => void;
  /** Values are `key:direction`, e.g. `name:asc`. */
  items: { value: `${K}:${SortDirection}`; label: string }[];
  className?: string;
}) {
  const value = `${sort.key}:${sort.direction}`;
  // A header click can pick an order the menu doesn't list; name it anyway.
  const options = items.some((item) => item.value === value)
    ? items
    : [
        ...items,
        {
          value: value as `${K}:${SortDirection}`,
          label: `${items.find((item) => item.value.startsWith(`${sort.key}:`))?.label ?? "Custom"} (reversed)`,
        },
      ];
  return (
    <Select
      value={value}
      onValueChange={(next) => {
        if (next === null) return;
        const [key, direction] = String(next).split(":");
        onSortChange({ key: key as K, direction: direction as SortDirection });
      }}
      items={options}
    >
      <SelectTrigger className={cn("w-full", className)} aria-label="Sort by">
        <SelectValue />
      </SelectTrigger>
      <SelectContent alignItemWithTrigger={false} align="start">
        {options.map((item) => (
          <SelectItem key={item.value} value={item.value}>
            {item.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
