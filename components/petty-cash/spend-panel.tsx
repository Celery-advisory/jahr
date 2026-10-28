import { categoryColor } from "@/lib/petty-cash/category-color";
import { formatPettyCashMoney } from "@/lib/petty-cash/money";
import type { CategorySpend } from "@/lib/petty-cash/summary";
import { EmptyState } from "@/components/ui/empty-state";

export function SpendPanel({
  currency,
  mixedCurrencies,
  categories,
}: {
  currency: string;
  mixedCurrencies: boolean;
  categories: CategorySpend[];
}) {
  const total = categories.reduce((sum, category) => sum + category.total, 0);
  const count = categories.reduce((sum, category) => sum + category.count, 0);

  return (
    <section className="rounded-xl border border-border bg-card p-5">
      <div className="space-y-0.5">
        <h2 className="text-sm font-medium">This month</h2>
        <p className="text-xs text-muted-foreground">Spend by category</p>
      </div>
      {mixedCurrencies ? (
        <p className="mt-4 text-sm text-muted-foreground">
          Spend is split across currencies.
        </p>
      ) : (
        <>
          <dl className="mt-4 grid grid-cols-2 gap-3 border-b border-border pb-4">
            <div>
              <dt className="text-xs text-muted-foreground">Expenses</dt>
              <dd className="mt-1 text-sm font-medium tabular-nums">
                {formatPettyCashMoney(total, currency)}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Transactions</dt>
              <dd className="mt-1 text-sm font-medium tabular-nums">{count}</dd>
            </div>
          </dl>
          {categories.length > 0 ? (
            <div className="mt-5 flex flex-col items-center gap-4">
              <SpendRing total={total} currency={currency} categories={categories} />
              <ul className="flex w-full flex-col gap-2">
                {categories.map((category) => (
                  <li
                    key={category.name}
                    className="flex items-center justify-between gap-3 text-sm"
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      <span
                        className="size-2 shrink-0 rounded-full"
                        style={{ backgroundColor: categoryColor(category.name) }}
                      />
                      <span className="truncate">{category.name}</span>
                    </span>
                    <span className="shrink-0 tabular-nums">
                      {formatPettyCashMoney(category.total, currency)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <EmptyState
              kind="cash"
              size="compact"
              title="This month's expenses show up here"
            />
          )}
        </>
      )}
    </section>
  );
}

function SpendRing({
  total,
  currency,
  categories,
}: {
  total: number;
  currency: string;
  categories: CategorySpend[];
}) {
  const shares = categories.map((category) =>
    total > 0 ? category.total / total : 0,
  );
  const stops = categories.map((category, index) => {
    const start = shares.slice(0, index).reduce((sum, share) => sum + share, 0);
    const end = start + shares[index];
    return `${categoryColor(category.name)} ${start * 100}% ${end * 100}%`;
  });

  return (
    <div
      className="relative size-32 rounded-full"
      style={{ background: `conic-gradient(${stops.join(", ")})` }}
      role="img"
      aria-label="Spending by category"
    >
      <div className="absolute inset-3 flex flex-col items-center justify-center rounded-full bg-card px-2 text-center">
        <p className="text-sm font-medium tracking-tight tabular-nums">
          {formatPettyCashMoney(total, currency)}
        </p>
        <p className="text-[11px] text-muted-foreground">Total spend</p>
      </div>
    </div>
  );
}
