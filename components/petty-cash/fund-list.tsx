import Link from "next/link";
import { ArrowRight, ChevronRight } from "lucide-react";
import { categoryTone } from "@/lib/petty-cash/category-color";
import { FUND_STATUS_LABELS } from "@/lib/petty-cash/labels";
import { floatFillPercent, formatPettyCashMoney } from "@/lib/petty-cash/money";
import type { PettyCashFund } from "@/lib/petty-cash/types";
import { cn } from "@/lib/utils";

const STATUS_TONE = {
  active: "bg-[#E7F8F6] text-[#0F766E]",
  suspended: "bg-[#FFF6E0] text-[#92600A]",
  closed: "bg-secondary text-muted-foreground",
} as const;

export function FundList({
  funds,
  selectedId,
  canManage,
}: {
  funds: PettyCashFund[];
  selectedId: string;
  canManage: boolean;
}) {
  return (
    <section className="rounded-xl border border-border bg-white">
      <div className="flex flex-col gap-2 px-4 py-4 sm:flex-row sm:items-start sm:justify-between sm:px-5">
        <div className="space-y-0.5">
          <h2 className="text-sm font-medium">Your funds</h2>
          <p className="text-xs text-muted-foreground">Cash on hand in each fund.</p>
        </div>
        {canManage ? (
          <Link
            href="/operations/petty-cash/settings"
            className="inline-flex shrink-0 items-center gap-1 text-sm whitespace-nowrap text-muted-foreground hover:text-foreground"
          >
            Manage funds
            <ArrowRight className="size-3.5" />
          </Link>
        ) : null}
      </div>
      <ul className="flex flex-col gap-2 border-t border-border bg-white px-3 py-3">
        {funds.map((fund) => {
          const selected = fund.id === selectedId;
          const fill = floatFillPercent(fund.availableBalance, fund.targetBalance);
          const tone = categoryTone(fund.name);
          return (
            <li key={fund.id}>
              <Link
                href={selected ? "/operations/petty-cash" : `/operations/petty-cash?fund=${fund.id}`}
                aria-current={selected ? "true" : undefined}
                className={cn(
                  "flex items-center gap-3 rounded-lg bg-[#F5F7FB] px-3 py-3 transition-colors duration-150 hover:bg-[#EEF2F7]",
                  selected && "bg-[#EEF2F7] ring-1 ring-[#E3E8EF]",
                )}
              >
                <span
                  className="flex size-10 shrink-0 items-center justify-center rounded-md text-xs font-medium"
                  style={{ backgroundColor: tone.bg, color: tone.text }}
                >
                  {initials(fund.name)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{fund.name}</span>
                  <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                    {fundMeta(fund)}
                  </span>
                  <span className="mt-1 flex flex-wrap items-center gap-2 sm:hidden">
                    <span className="text-sm font-medium tabular-nums">
                      {formatPettyCashMoney(fund.availableBalance, fund.currency)}
                    </span>
                    <span
                      className={cn(
                        "rounded-md px-2 py-0.5 text-xs font-medium",
                        STATUS_TONE[fund.status],
                      )}
                    >
                      {FUND_STATUS_LABELS[fund.status]}
                    </span>
                  </span>
                  <span className="mt-1.5 block h-1.5 overflow-hidden rounded-full bg-secondary sm:hidden">
                    <span
                      className="block h-1.5 rounded-full"
                      style={{
                        width: `${fill}%`,
                        backgroundColor: fund.needsReplenishment ? "#F6B93B" : "#2EC4B6",
                      }}
                    />
                  </span>
                </span>
                <span className="hidden w-36 shrink-0 sm:block">
                  <span className="block text-right text-sm font-medium tabular-nums">
                    {formatPettyCashMoney(fund.availableBalance, fund.currency)}
                  </span>
                  <span className="mt-1.5 flex items-center gap-2">
                    <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-secondary">
                      <span
                        className="block h-1.5 rounded-full"
                        style={{
                          width: `${fill}%`,
                          backgroundColor: fund.needsReplenishment ? "#F6B93B" : "#2EC4B6",
                        }}
                      />
                    </span>
                  </span>
                  <span className="mt-1 block text-right text-[11px] text-muted-foreground tabular-nums">
                    {Math.round(fill)}% funded
                  </span>
                </span>
                <span
                  className={cn(
                    "hidden shrink-0 rounded-md px-2 py-0.5 text-xs font-medium sm:inline-flex",
                    STATUS_TONE[fund.status],
                  )}
                >
                  {FUND_STATUS_LABELS[fund.status]}
                </span>
                <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function initials(name: string): string {
  const parts = name.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "PC";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase();
}

function fundMeta(fund: PettyCashFund): string {
  const who =
    fund.custodians.length === 0
      ? "Unassigned"
      : fund.custodians.map((person) => person.name).join(", ");
  if (!fund.departmentName) return who;
  return `${who} · ${fund.departmentName}`;
}
