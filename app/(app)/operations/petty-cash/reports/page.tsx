import { redirect } from "next/navigation";
import Link from "next/link";
import { Button, buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { categoryTone } from "@/lib/petty-cash/category-color";
import { getCurrentProfile } from "@/lib/auth/get-profile";
import { canManagePettyCash } from "@/lib/auth/permissions";
import { cn } from "@/lib/utils";
import {
  currencyDisplay,
  formatPettyCashMoney,
  postedBalance,
  roundMoney,
} from "@/lib/petty-cash/money";
import { getPettyCashBundle } from "@/lib/petty-cash/queries";
import type { LedgerRow } from "@/lib/petty-cash/types";

export default async function PettyCashReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ fund?: string; from?: string; to?: string }>;
}) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/dashboard");
  const canManage = canManagePettyCash(profile);

  const params = await searchParams;
  const bundle = await getPettyCashBundle();
  const now = new Date();
  const from = params.from || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
  const to = params.to || now.toISOString().slice(0, 10);
  const fundId = params.fund || "";

  const scoped = bundle.transactions.filter((row) => {
    if (fundId && row.fundId !== fundId) return false;
    return row.status === "posted";
  });
  const currencies = [
    ...new Set(
      scoped.map((row) => row.currency).filter((code) => code.length > 0),
    ),
  ];
  const reportCurrencies =
    currencies.length > 0
      ? currencies
      : [bundle.settings.defaultCurrency];

  return (
    <div className="flex flex-col gap-5">
      <div className="space-y-1">
        <h1 className="text-xl font-medium tracking-tight">Reports</h1>
        <p className="text-sm text-muted-foreground">
          Posted cash only. Drafts and pending items stay off these totals.
        </p>
      </div>

      <form className="grid gap-3 sm:flex sm:flex-wrap sm:items-end" method="get">
        <label className="flex min-w-0 flex-col gap-1.5 text-sm">
          Fund
          <select
            name="fund"
            defaultValue={fundId}
            className="h-10 w-full min-w-0 rounded-md border border-input bg-background px-3 sm:w-48"
          >
            <option value="">All funds</option>
            {bundle.funds.map((fund) => (
              <option key={fund.id} value={fund.id}>
                {fund.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex min-w-0 flex-col gap-1.5 text-sm">
          From
          <input
            type="date"
            name="from"
            defaultValue={from}
            className="h-10 w-full min-w-0 rounded-md border border-input bg-background px-3"
          />
        </label>
        <label className="flex min-w-0 flex-col gap-1.5 text-sm">
          To
          <input
            type="date"
            name="to"
            defaultValue={to}
            className="h-10 w-full min-w-0 rounded-md border border-input bg-background px-3"
          />
        </label>
        <Button type="submit" variant="outline" className="w-full sm:w-auto">
          Apply
        </Button>
      </form>

      <div className="flex flex-col gap-6">
        {reportCurrencies.map((currency) => {
          const inCurrency = scoped.filter((row) => row.currency === currency);
          const inRange = inCurrency.filter(
            (row) => row.transactionDate >= from && row.transactionDate <= to,
          );
          const before = inCurrency.filter((row) => row.transactionDate < from);
          const opening = postedBalance(before);
          const cashIn = roundMoney(
            inRange
              .filter((row) => row.direction === "in")
              .reduce((sum, row) => sum + row.amount, 0),
          );
          const cashOut = roundMoney(
            inRange
              .filter((row) => row.direction === "out")
              .reduce((sum, row) => sum + row.amount, 0),
          );
          const closing = roundMoney(opening + cashIn - cashOut);
          const categories = categoryTotals(
            inRange.filter((row) => row.direction === "out"),
          );

          return (
            <div key={currency} className="flex flex-col gap-3">
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <Stat label={`Opening balance (${currencyDisplay(currency)})`} value={formatPettyCashMoney(opening, currency)} />
                <Stat label={`Cash received (${currencyDisplay(currency)})`} value={formatPettyCashMoney(cashIn, currency)} />
                <Stat label={`Expenses (${currencyDisplay(currency)})`} value={formatPettyCashMoney(cashOut, currency)} />
                <Stat label={`Closing balance (${currencyDisplay(currency)})`} value={formatPettyCashMoney(closing, currency)} />
              </div>
              <section className="overflow-hidden rounded-xl border border-border bg-card">
                <h2 className="border-b border-border px-4 py-3 text-sm font-medium">
                  Expense summary, {currencyDisplay(currency)}
                </h2>
                {categories.length === 0 ? (
                  <EmptyState
                    kind="cash"
                    size="compact"
                    title="Expenses in this range show up here"
                    action={
                      canManage ? (
                        <Link href="/operations/petty-cash" className={cn(buttonVariants(), "w-full sm:w-auto")}>
                          Record an expense
                        </Link>
                      ) : null
                    }
                  />
                ) : (
                  <>
                    <ul className="sm:hidden">
                      {categories.map((category) => (
                        <li
                          key={category.name}
                          className="flex items-center justify-between gap-3 border-t border-[#E7ECF2] px-4 py-3 first:border-0"
                        >
                          <div className="min-w-0">
                            <CategoryPill name={category.name} />
                            <p className="mt-1 text-xs text-muted-foreground tabular-nums">
                              {category.count} {category.count === 1 ? "transaction" : "transactions"}
                            </p>
                          </div>
                          <p className="shrink-0 text-sm font-medium tabular-nums">
                            {formatPettyCashMoney(category.total, currency)}
                          </p>
                        </li>
                      ))}
                    </ul>
                    <table className="hidden w-full text-sm sm:table">
                    <thead className="bg-[#F6F8FB] text-left text-xs font-medium text-[#667085]">
                      <tr>
                        <th className="px-4 py-2.5 font-medium">Category</th>
                        <th className="px-4 py-2.5 text-right font-medium">Count</th>
                        <th className="px-4 py-2.5 text-right font-medium">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {categories.map((category) => (
                        <tr key={category.name} className="border-t border-[#E7ECF2]">
                          <td className="px-4 py-3">
                            <CategoryPill name={category.name} />
                          </td>
                          <td className="px-4 py-3 text-right tabular-nums">{category.count}</td>
                          <td className="px-4 py-3 text-right tabular-nums">
                            {formatPettyCashMoney(category.total, currency)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  </>
                )}
              </section>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function categoryTotals(rows: LedgerRow[]) {
  const totals = new Map<string, { name: string; total: number; count: number }>();
  for (const row of rows) {
    const name = row.categoryName ?? "Uncategorised";
    const current = totals.get(name) ?? { name, total: 0, count: 0 };
    current.total = roundMoney(current.total + row.amount);
    current.count += 1;
    totals.set(name, current);
  }
  return [...totals.values()].sort((a, b) => b.total - a.total);
}

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

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <article className="min-w-0 rounded-xl border border-border bg-card p-4 sm:p-6">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-2 text-xl font-medium tracking-tight break-words tabular-nums">{value}</p>
    </article>
  );
}
