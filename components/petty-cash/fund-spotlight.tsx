"use client";

import { useState } from "react";
import Link from "next/link";
import { CalendarCheck } from "lucide-react";
import { TransactionSheet } from "@/components/petty-cash/transaction-sheet";
import { Button, buttonVariants } from "@/components/ui/button";
import type {
  PettyCashCategory,
  PettyCashFund,
  PettyCashSettings,
  PettyCashVendor,
} from "@/lib/petty-cash/types";
import { cn } from "@/lib/utils";

export function FundSpotlight({
  title,
  body,
  canManage,
  reconcileHref,
  funds,
  categories,
  vendors,
  settings,
  defaultFundId,
}: {
  title: string;
  body: string;
  canManage: boolean;
  reconcileHref: string;
  funds: PettyCashFund[];
  categories: PettyCashCategory[];
  vendors: PettyCashVendor[];
  settings: PettyCashSettings;
  defaultFundId: string;
}) {
  const [open, setOpen] = useState(false);
  const hasActiveFund = funds.some((fund) => fund.status === "active");

  return (
    <section className="flex h-full min-h-52 flex-col justify-between gap-5 rounded-xl bg-[#1f2353] p-5 text-white">
      <div>
        <div className="flex size-9 items-center justify-center rounded-md bg-white/15">
          <CalendarCheck className="size-4" />
        </div>
        <h2 className="mt-4 text-sm font-medium">{title}</h2>
        <p className="mt-1 text-sm text-white/80">{body}</p>
      </div>
      {canManage ? (
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          <Button
            type="button"
            className="w-full bg-white text-[#171717] hover:bg-white/90 sm:w-auto"
            onClick={() => setOpen(true)}
            disabled={!hasActiveFund}
          >
            Record cash received
          </Button>
          <Link
            href={reconcileHref}
            className={cn(
              buttonVariants({ variant: "outline" }),
              "w-full border-white/25 bg-transparent text-white hover:bg-white/10 hover:text-white sm:w-auto",
            )}
          >
            Reconcile
          </Link>
        </div>
      ) : (
        <Link
          href={reconcileHref}
          className={cn(
            buttonVariants({ variant: "outline" }),
            "w-fit border-white/25 bg-transparent text-white hover:bg-white/10 hover:text-white",
          )}
        >
          Reconcile
        </Link>
      )}
      {canManage ? (
        <TransactionSheet
          open={open}
          onOpenChange={setOpen}
          mode="cash_in"
          funds={funds}
          categories={categories}
          vendors={vendors}
          settings={settings}
          defaultFundId={defaultFundId}
        />
      ) : null}
    </section>
  );
}
