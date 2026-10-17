import { redirect } from "next/navigation";
import { ArrowUpRight, Banknote, ClipboardCheck, Wallet } from "lucide-react";
import { DASHBOARD_COLORS } from "@/components/dashboard/shared";
import { FundList } from "@/components/petty-cash/fund-list";
import { FundSpotlight } from "@/components/petty-cash/fund-spotlight";
import {
  OverviewMetrics,
  type OverviewMetric,
} from "@/components/petty-cash/overview-metrics";
import { RecentTransactions } from "@/components/petty-cash/recent-list";
import { SpendPanel } from "@/components/petty-cash/spend-panel";
import { CreateFundButton, PettyCashToolbar } from "@/components/petty-cash/toolbar";
import { EmptyState } from "@/components/ui/empty-state";
import { getCurrentProfile } from "@/lib/auth/get-profile";
import { canManagePettyCash } from "@/lib/auth/permissions";
import { formatPettyCashDate } from "@/lib/petty-cash/labels";
import { floatFillPercent, formatPettyCashMoney, roundMoney } from "@/lib/petty-cash/money";
import { getPettyCashBundle } from "@/lib/petty-cash/queries";
import { buildOverview } from "@/lib/petty-cash/summary";
import type { PettyCashFund } from "@/lib/petty-cash/types";

export default async function PettyCashPage({
  searchParams,
}: {
  searchParams: Promise<{ fund?: string }>;
}) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/dashboard");

  const { fund: fundId = "" } = await searchParams;
  const bundle = await getPettyCashBundle();
  const canManage = canManagePettyCash(profile);
  const now = new Date();
  const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const overview = buildOverview(bundle, fundId, month);
  const currency = overview.currency ?? bundle.settings.defaultCurrency;
  const scopedFund =
    (fundId ? bundle.funds.find((fund) => fund.id === fundId) : null) ??
    (bundle.funds.length === 1 ? bundle.funds[0] : null);
  const mixed = overview.mixedCurrencies;
  const pendingOut = mixed
    ? 0
    : roundMoney(overview.funds.reduce((sum, fund) => sum + fund.pendingOut, 0));
  const replenishmentAmount = scopedFund
    ? scopedFund.replenishmentAmount
    : overview.replenishmentNeeded;
  const defaultFundId = scopedFund?.id || bundle.funds[0]?.id || "";
  const fundQuery = scopedFund ? `?fund=${scopedFund.id}` : "";
  const pendingOutCount = bundle.transactions.filter((row) => {
    if (row.status !== "pending_approval" || row.direction !== "out") return false;
    if (scopedFund) return row.fundId === scopedFund.id;
    return overview.funds.some((fund) => fund.id === row.fundId);
  }).length;
  const count = cashCountCopy(scopedFund ?? null, overview.funds);

  const metrics: OverviewMetric[] = [
    {
      label: "Available cash",
      value: mixed ? "Multiple currencies" : formatPettyCashMoney(overview.available, currency),
      hint: availableHint(scopedFund ?? null, overview.funds.length, mixed),
      href: `/operations/petty-cash/transactions${fundQuery}`,
      icon: Wallet,
      accent: DASHBOARD_COLORS.leave,
      figure: !mixed,
      progress:
        scopedFund && !mixed
          ? floatFillPercent(scopedFund.availableBalance, scopedFund.targetBalance)
          : undefined,
    },
    {
      label: "Pending out",
      value: mixed ? "Multiple currencies" : formatPettyCashMoney(pendingOut, currency),
      hint: pendingHint(pendingOutCount),
      href: `/operations/petty-cash/transactions${fundQuery ? `${fundQuery}&` : "?"}status=pending_approval`,
      icon: ArrowUpRight,
      accent: DASHBOARD_COLORS.people,
      figure: !mixed,
    },
    {
      label: "Recommended top-up",
      value: mixed
        ? "Multiple currencies"
        : formatPettyCashMoney(replenishmentAmount, currency),
      hint: mixed
        ? "Separate currencies"
        : replenishmentAmount > 0
          ? "To reach the target float"
          : "Float is at target",
      href: `/operations/petty-cash/replenishments${fundQuery}`,
      icon: Banknote,
      accent: DASHBOARD_COLORS.payroll,
      figure: !mixed,
    },
    {
      label: "Last reconciliation",
      value: count.value,
      hint: count.hint,
      href: `/operations/petty-cash/reconciliations${fundQuery}`,
      icon: ClipboardCheck,
      accent: DASHBOARD_COLORS.devices,
      figure: false,
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      {bundle.funds.length === 0 ? (
        <EmptyState
          kind="payroll"
          surface
          title="Create a fund"
          description="Name the float people spend from."
          action={
            canManage ? (
              <CreateFundButton
                settings={bundle.settings}
                people={bundle.people}
                departments={bundle.departments}
                viewerId={profile.id}
              />
            ) : null
          }
        />
      ) : (
        <>
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
            <div className="min-w-0 space-y-0.5">
              <h1 className="truncate text-xl font-medium tracking-tight">
                {scopedFund ? scopedFund.name : "All funds"}
              </h1>
              <p className="truncate text-sm text-muted-foreground">
                {heroMeta(scopedFund, overview.funds.length)}
              </p>
            </div>
            {canManage ? (
              <PettyCashToolbar
                canManage={canManage}
                funds={bundle.funds}
                categories={bundle.categories}
                vendors={bundle.vendors}
                settings={bundle.settings}
                defaultFundId={defaultFundId}
                expenseOnly
              />
            ) : null}
          </div>

          <OverviewMetrics items={metrics} />

          <div className="grid gap-3 lg:grid-cols-5">
            <div className="lg:col-span-3">
              {overview.recent.length === 0 ? (
                <EmptyState
                  kind="cash"
                  surface
                  title="Record an expense"
                  description="Expenses and cash received show up here."
                  action={
                    canManage ? (
                      <PettyCashToolbar
                        canManage={canManage}
                        funds={bundle.funds}
                        categories={bundle.categories}
                        vendors={bundle.vendors}
                        settings={bundle.settings}
                        defaultFundId={defaultFundId}
                        expenseOnly
                      />
                    ) : null
                  }
                />
              ) : (
                <RecentTransactions rows={overview.recent} />
              )}
            </div>
            <div className="lg:col-span-2">
              <SpendPanel
                currency={currency}
                mixedCurrencies={mixed}
                categories={overview.categories}
              />
            </div>
          </div>

          <div className="grid gap-3 lg:grid-cols-5">
            <div className="lg:col-span-3">
              <FundList
                funds={bundle.funds}
                selectedId={scopedFund?.id ?? ""}
                canManage={canManage}
              />
            </div>
            <div className="lg:col-span-2">
              <FundSpotlight
                title={count.title}
                body={count.body}
                canManage={canManage}
                reconcileHref={`/operations/petty-cash/reconciliations${fundQuery}`}
                funds={bundle.funds}
                categories={bundle.categories}
                vendors={bundle.vendors}
                settings={bundle.settings}
                defaultFundId={defaultFundId}
              />
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function heroMeta(fund: PettyCashFund | null | undefined, fundCount: number): string {
  if (!fund) return fundCount === 1 ? "1 fund" : `${fundCount} funds`;
  if (fund.custodians.length === 0) return "Unassigned";
  return fund.custodians.map((person) => person.name).join(", ");
}

function availableHint(
  fund: PettyCashFund | null,
  fundCount: number,
  mixed: boolean,
): string {
  if (mixed) return "Separate currencies";
  if (!fund) return fundCount === 1 ? "1 fund" : `${fundCount} funds`;
  const fill = Math.round(floatFillPercent(fund.availableBalance, fund.targetBalance));
  return `${fill}% of ${formatPettyCashMoney(fund.targetBalance, fund.currency)} target float`;
}

function pendingHint(count: number): string {
  if (count === 0) return "No requests waiting";
  if (count === 1) return "1 request waiting";
  return `${count} requests waiting`;
}

function cashCountCopy(
  fund: PettyCashFund | null,
  funds: PettyCashFund[],
): { title: string; body: string; value: string; hint: string } {
  if (fund) return cashCountForFund(fund);

  const missing = funds.filter((item) => !item.lastReconciliation).length;
  if (missing === funds.length) {
    return {
      title: "Cash count",
      body: "Count the cash on hand.",
      value: "None",
      hint: "Not counted",
    };
  }
  if (missing > 0) {
    return {
      title: "Cash count",
      body:
        missing === 1
          ? "1 fund has not been counted."
          : `${missing} funds have not been counted.`,
      value: String(funds.length - missing),
      hint: "Funds counted",
    };
  }

  const latest = [...funds].sort((a, b) =>
    (b.lastReconciliation?.date ?? "").localeCompare(a.lastReconciliation?.date ?? ""),
  )[0];
  const date = latest?.lastReconciliation
    ? formatPettyCashDate(latest.lastReconciliation.date)
    : "None";
  return {
    title: "Last cash count",
    body: `Latest count ${date}.`,
    value: date,
    hint: "Across all funds",
  };
}

function cashCountForFund(fund: PettyCashFund): {
  title: string;
  body: string;
  value: string;
  hint: string;
} {
  const last = fund.lastReconciliation;
  if (!last) {
    return {
      title: "Cash count",
      body: "Count the cash on hand.",
      value: "None",
      hint: "Not counted",
    };
  }
  const date = formatPettyCashDate(last.date);
  if (last.status === "submitted") {
    return {
      title: "Cash count needs review",
      body: `Submitted ${date}.`,
      value: date,
      hint: "Waiting for review",
    };
  }
  return {
    title: "Last cash count",
    body: last.variance === 0 ? `Reviewed ${date}. Balanced.` : `Reviewed ${date}.`,
    value: date,
    hint: last.variance === 0 ? "Balanced" : "Reviewed",
  };
}

