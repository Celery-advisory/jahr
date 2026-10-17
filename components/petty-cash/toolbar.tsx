"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { FundSheet } from "@/components/petty-cash/fund-sheet";
import { TransactionSheet } from "@/components/petty-cash/transaction-sheet";
import type {
  DepartmentOption,
  PettyCashCategory,
  PettyCashFund,
  PettyCashPerson,
  PettyCashSettings,
  PettyCashVendor,
} from "@/lib/petty-cash/types";
import { cn } from "@/lib/utils";

export function PettyCashToolbar({
  canManage,
  funds,
  categories,
  vendors,
  settings,
  defaultFundId,
  reconcileFundId,
  reconcile = true,
  expenseOnly = false,
}: {
  canManage: boolean;
  funds: PettyCashFund[];
  categories: PettyCashCategory[];
  vendors: PettyCashVendor[];
  settings: PettyCashSettings;
  defaultFundId: string;
  reconcileFundId?: string;
  reconcile?: boolean;
  expenseOnly?: boolean;
}) {
  const [expenseOpen, setExpenseOpen] = useState(false);
  const [cashInOpen, setCashInOpen] = useState(false);
  const hasActiveFund = funds.some((fund) => fund.status === "active");
  const reconcileTarget = reconcileFundId ?? defaultFundId;
  const reconcileHref = reconcileTarget
    ? `/operations/petty-cash/reconciliations?fund=${reconcileTarget}`
    : "/operations/petty-cash/reconciliations";

  if (!canManage) return null;

  return (
    <div>
      <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap">
        <Button
          type="button"
          className="w-full sm:w-auto"
          onClick={() => setExpenseOpen(true)}
          disabled={!hasActiveFund}
        >
          <Plus />
          Record expense
        </Button>
        {reconcile && !expenseOnly ? (
          <Link href={reconcileHref} className={cn(buttonVariants(), "w-full sm:w-auto")}>
            Reconcile
          </Link>
        ) : null}
        {expenseOnly ? null : (
          <Button
            type="button"
            variant="outline"
            className="w-full sm:w-auto"
            onClick={() => setCashInOpen(true)}
            disabled={!hasActiveFund}
          >
            Record cash received
          </Button>
        )}
      </div>
      <TransactionSheet
        open={expenseOpen}
        onOpenChange={setExpenseOpen}
        mode="expense"
        funds={funds}
        categories={categories}
        vendors={vendors}
        settings={settings}
        defaultFundId={defaultFundId}
      />
      {expenseOnly ? null : (
        <TransactionSheet
          open={cashInOpen}
          onOpenChange={setCashInOpen}
          mode="cash_in"
          funds={funds}
          categories={categories}
          vendors={vendors}
          settings={settings}
          defaultFundId={defaultFundId}
        />
      )}
    </div>
  );
}

export function CreateFundButton({
  settings,
  people,
  departments,
  viewerId,
}: {
  settings: PettyCashSettings;
  people: PettyCashPerson[];
  departments: DepartmentOption[];
  viewerId: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button type="button" variant="outline" className="w-full sm:w-auto" onClick={() => setOpen(true)}>
        Create fund
      </Button>
      <FundSheet
        open={open}
        onOpenChange={setOpen}
        fund={null}
        settings={settings}
        people={people}
        departments={departments}
        viewerId={viewerId}
      />
    </>
  );
}

export function EditFundButton({
  fund,
  settings,
  people,
  departments,
  viewerId,
}: {
  fund: PettyCashFund;
  settings: PettyCashSettings;
  people: PettyCashPerson[];
  departments: DepartmentOption[];
  viewerId: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)}>
        Edit
      </Button>
      <FundSheet
        open={open}
        onOpenChange={setOpen}
        fund={fund}
        settings={settings}
        people={people}
        departments={departments}
        viewerId={viewerId}
      />
    </>
  );
}
