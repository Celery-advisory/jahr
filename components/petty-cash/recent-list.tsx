import Link from "next/link";
import { ArrowDownLeft, ArrowRight, ArrowUpRight } from "lucide-react";
import { TRANSACTION_TYPE_LABELS } from "@/lib/petty-cash/labels";
import { formatPettyCashMoney } from "@/lib/petty-cash/money";
import type { LedgerRow } from "@/lib/petty-cash/types";
import { cn } from "@/lib/utils";

export function RecentTransactions({ rows }: { rows: LedgerRow[] }) {
  return (
    <section className="rounded-xl border border-border bg-card">
      <div className="flex items-start justify-between gap-3 px-5 py-4">
        <div className="space-y-0.5">
          <h2 className="text-sm font-medium">Recent transactions</h2>
          <p className="text-xs text-muted-foreground">Latest activity</p>
        </div>
        <Link
          href="/operations/petty-cash/transactions"
          className="inline-flex shrink-0 items-center gap-1 text-sm whitespace-nowrap text-muted-foreground hover:text-foreground"
        >
          View all
          <ArrowRight className="size-3.5" />
        </Link>
      </div>
      <div className="border-t border-border px-2 py-1">
        {rows.map((row) => {
          const incoming = row.direction === "in";
          const date = dateParts(row.transactionDate);
          const detail = [
            row.categoryName ?? TRANSACTION_TYPE_LABELS[row.transactionType],
            row.transactionNumber,
          ]
            .filter(Boolean)
            .join(" · ");
          return (
            <Link
              key={row.id}
              href={`/operations/petty-cash/transactions/${row.id}`}
              className="flex items-center gap-3 rounded-md px-3 py-2.5 transition-colors duration-150 hover:bg-secondary/60"
            >
              <span className="hidden w-12 shrink-0 text-xs leading-tight text-muted-foreground sm:block">
                <span className="block">{date.primary}</span>
                {date.secondary ? <span className="block">{date.secondary}</span> : null}
              </span>
              <span
                className="flex size-8 shrink-0 items-center justify-center rounded-md"
                style={
                  incoming
                    ? {
                        background: "color-mix(in srgb, #16A34A 12%, white)",
                        color: "#16A34A",
                      }
                    : {
                        background: "color-mix(in srgb, #DC2626 12%, white)",
                        color: "#DC2626",
                      }
                }
              >
                {incoming ? (
                  <ArrowDownLeft className="size-3.5" />
                ) : (
                  <ArrowUpRight className="size-3.5" />
                )}
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-baseline justify-between gap-2">
                  <span className="truncate text-sm font-medium">{row.description}</span>
                  <span
                    className={cn(
                      "shrink-0 text-sm font-medium tabular-nums sm:hidden",
                      incoming ? "text-[#166534]" : "text-[#DC2626]",
                    )}
                  >
                    {incoming ? "+" : "\u2212"} {formatPettyCashMoney(row.amount, row.currency)}
                  </span>
                </span>
                <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                  <span className="sm:hidden">
                    {date.secondary ? `${date.primary} ${date.secondary}` : date.primary}
                    {" · "}
                  </span>
                  {detail}
                </span>
              </span>
              <span
                className={cn(
                  "hidden shrink-0 text-sm font-medium tabular-nums sm:inline",
                  incoming ? "text-[#166534]" : "text-[#DC2626]",
                )}
              >
                {incoming ? "+" : "\u2212"} {formatPettyCashMoney(row.amount, row.currency)}
              </span>
              <ArrowRight className="hidden size-4 shrink-0 text-muted-foreground sm:block" />
            </Link>
          );
        })}
      </div>
      <div className="border-t border-border px-5 py-2.5 text-center">
        <Link
          href="/operations/petty-cash/transactions"
          className="inline-flex shrink-0 items-center gap-1 text-sm whitespace-nowrap text-muted-foreground hover:text-foreground"
        >
          See all transactions
          <ArrowRight className="size-3.5" />
        </Link>
      </div>
    </section>
  );
}

function dateParts(value: string): { primary: string; secondary: string } {
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  if (value === today) return { primary: "Today", secondary: "" };
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return { primary: value, secondary: "" };
  return {
    primary: new Intl.DateTimeFormat("en-GB", {
      day: "2-digit",
      month: "short",
    }).format(new Date(year, month - 1, day)),
    secondary: String(year),
  };
}
