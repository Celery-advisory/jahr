import { formatPettyCashMoney } from "@/lib/petty-cash/money";
import type { LedgerSummaryFigures } from "@/lib/petty-cash/summary";

export function LedgerSummary({ summary }: { summary: LedgerSummaryFigures }) {
  const money = (amount: number) => {
    if (summary.mixedCurrencies) return "Multiple currencies";
    return formatPettyCashMoney(amount, summary.currency ?? "GHS");
  };

  return (
    <section className="rounded-xl border border-border bg-card p-4 sm:p-6">
      <div className="flex flex-col gap-5 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">Current cash</p>
          <p className="mt-2 text-2xl font-medium tracking-tight break-words tabular-nums sm:text-3xl">
            {money(summary.currentCash)}
          </p>
        </div>
        <dl className="grid grid-cols-2 gap-4 border-t border-border pt-4 sm:grid-cols-3 sm:gap-6 sm:border-0 sm:pt-0">
          <Figure label="Money in" value={money(summary.moneyIn)} />
          <Figure label="Money out" value={money(summary.moneyOut)} />
          <Figure label="Transactions" value={summary.count.toLocaleString("en-GH")} />
        </dl>
      </div>
    </section>
  );
}

function Figure({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-1 text-sm font-medium break-words tabular-nums">{value}</dd>
    </div>
  );
}
