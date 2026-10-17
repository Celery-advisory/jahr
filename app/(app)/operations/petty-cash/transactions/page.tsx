import Link from "next/link";
import { redirect } from "next/navigation";
import { LedgerFiltersBar } from "@/components/petty-cash/ledger-filters";
import { LedgerSummary } from "@/components/petty-cash/ledger-summary";
import { LedgerTable } from "@/components/petty-cash/ledger-table";
import { PettyCashToolbar } from "@/components/petty-cash/toolbar";
import { buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { getCurrentProfile } from "@/lib/auth/get-profile";
import { canManagePettyCash } from "@/lib/auth/permissions";
import { getPettyCashBundle } from "@/lib/petty-cash/queries";
import { buildLedgerSummary } from "@/lib/petty-cash/summary";
import { emptyFilters, filterLedger, hasLedgerFilters } from "@/lib/petty-cash/types";
import { cn } from "@/lib/utils";

export default async function PettyCashTransactionsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/dashboard");

  const filters = emptyFilters(await searchParams);
  const bundle = await getPettyCashBundle();
  const rows = filterLedger(bundle.transactions, filters);
  const canManage = canManagePettyCash(profile);
  const defaultFundId =
    filters.fundId ||
    bundle.funds.find((fund) => fund.status === "active")?.id ||
    bundle.funds[0]?.id ||
    "";
  const summary = buildLedgerSummary(bundle.transactions, bundle.funds, rows.length, filters);
  const filteredEmpty = rows.length === 0 && hasLedgerFilters(filters);
  const toolbarProps = {
    canManage,
    funds: bundle.funds,
    categories: bundle.categories,
    vendors: bundle.vendors,
    settings: bundle.settings,
    defaultFundId,
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-xl font-medium tracking-tight">Transactions</h1>
          <p className="text-sm text-muted-foreground">
            The ledger balance is calculated from posted transactions.
          </p>
        </div>
        <PettyCashToolbar {...toolbarProps} reconcile={false} />
      </div>

      <LedgerSummary summary={summary} />

      <LedgerFiltersBar
        filters={filters}
        funds={bundle.funds}
        categories={bundle.categories}
      />

      {rows.length === 0 ? (
        filteredEmpty ? (
          <EmptyState
            kind="search"
            surface
            title="Adjust the filters"
            description="Nothing in the ledger matches these filters."
            action={
              <Link
                href="/operations/petty-cash/transactions"
                className={cn(buttonVariants({ variant: "outline" }))}
              >
                Clear filters
              </Link>
            }
          />
        ) : (
          <EmptyState
            kind="cash"
            surface
            title="Record an expense"
            description="Posted, pending, and draft rows show up here."
            action={
              canManage ? <PettyCashToolbar {...toolbarProps} expenseOnly /> : undefined
            }
          />
        )
      ) : (
        <LedgerTable rows={rows} sortable />
      )}
    </div>
  );
}
