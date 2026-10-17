"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { FundSheet } from "@/components/petty-cash/fund-sheet";
import { ConfirmDialog, RowMenu, SettingsSection } from "@/components/petty-cash/confirm-dialog";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import {
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useAsyncAction } from "@/lib/hooks/use-async-action";
import { setFundStatus } from "@/lib/petty-cash/actions";
import { FUND_STATUS_LABELS } from "@/lib/petty-cash/labels";
import { formatPettyCashMoney } from "@/lib/petty-cash/money";
import type { PettyCashBundle, PettyCashFund } from "@/lib/petty-cash/types";

const STATUS_DOT = {
  active: "bg-[#16A34A]",
  suspended: "bg-[#F59E0B]",
  closed: "bg-[#9CA3AF]",
} as const;

export function SettingsFunds({
  bundle,
  viewerId,
}: {
  bundle: PettyCashBundle;
  viewerId: string;
}) {
  const router = useRouter();
  const { pending, run } = useAsyncAction();
  const [detail, setDetail] = useState<PettyCashFund | null>(null);
  const [editing, setEditing] = useState<PettyCashFund | "create" | null>(null);
  const [confirm, setConfirm] = useState<{
    fund: PettyCashFund;
    status: "suspended" | "closed";
  } | null>(null);

  function openEdit(fund: PettyCashFund) {
    setDetail(null);
    setEditing(fund);
  }

  function changeStatus(fund: PettyCashFund, status: PettyCashFund["status"]) {
    void run(async () => {
      const formData = new FormData();
      formData.set("id", fund.id);
      formData.set("status", status);
      const result = await setFundStatus(formData);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      const message =
        status === "closed"
          ? "Fund closed"
          : status === "suspended"
            ? "Fund suspended"
            : "Fund activated";
      toast.success(message);
      setConfirm(null);
      setDetail(null);
      router.refresh();
    });
  }

  return (
    <SettingsSection
      title="Funds"
      description="Manage petty cash accounts."
      action={
        bundle.funds.length === 0 ? undefined : (
          <Button type="button" onClick={() => setEditing("create")}>
            <Plus />
            Create fund
          </Button>
        )
      }
    >
      {bundle.funds.length === 0 ? (
        <EmptyState
          kind="cash"
          surface
          title="Create a fund"
          description="Name the float people spend from."
          action={
            <Button type="button" onClick={() => setEditing("create")}>
              <Plus />
              Create fund
            </Button>
          }
        />
      ) : (
        <ul className="flex flex-col gap-3">
          {bundle.funds.map((fund) => (
            <li key={fund.id}>
              <FundCard
                fund={fund}
                onOpen={() => setDetail(fund)}
                onEdit={() => openEdit(fund)}
                onSuspend={() => setConfirm({ fund, status: "suspended" })}
                onClose={() => setConfirm({ fund, status: "closed" })}
                onActivate={() => changeStatus(fund, "active")}
              />
            </li>
          ))}
        </ul>
      )}

      <FundDetailSheet
        fund={detail}
        onOpenChange={(open) => {
          if (!open) setDetail(null);
        }}
        onEdit={() => {
          if (detail) openEdit(detail);
        }}
      />

      <FundSheet
        open={editing !== null}
        onOpenChange={(open) => {
          if (!open) setEditing(null);
        }}
        fund={editing && editing !== "create" ? editing : null}
        settings={bundle.settings}
        people={bundle.people}
        departments={bundle.departments}
        viewerId={viewerId}
      />

      <ConfirmDialog
        open={confirm !== null}
        title={confirm?.status === "closed" ? "Close fund?" : "Suspend fund?"}
        description={
          confirm?.status === "closed"
            ? "This fund will no longer accept new transactions. Existing transactions stay on the ledger."
            : "This fund will be paused and will not accept new transactions until it is active again."
        }
        confirmLabel={confirm?.status === "closed" ? "Close" : "Suspend"}
        destructive
        pending={pending}
        onOpenChange={(open) => {
          if (!open && !pending) setConfirm(null);
        }}
        onConfirm={() => {
          if (confirm) changeStatus(confirm.fund, confirm.status);
        }}
      />
    </SettingsSection>
  );
}

function FundCard({
  fund,
  onOpen,
  onEdit,
  onSuspend,
  onClose,
  onActivate,
}: {
  fund: PettyCashFund;
  onOpen: () => void;
  onEdit: () => void;
  onSuspend: () => void;
  onClose: () => void;
  onActivate: () => void;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 sm:p-6">
      <div className="flex items-start gap-3">
        <button type="button" onClick={onOpen} className="min-w-0 flex-1 text-left">
          <p className="truncate text-sm font-medium">{fund.name}</p>
          <p className="mt-1 text-sm tabular-nums text-muted-foreground">
            {formatPettyCashMoney(fund.availableBalance, fund.currency)} available
          </p>
        </button>
        <div className="flex items-center gap-2">
          <FundStatus status={fund.status} />
          <FundMenu
            fund={fund}
            onEdit={onEdit}
            onSuspend={onSuspend}
            onClose={onClose}
            onActivate={onActivate}
          />
        </div>
      </div>
      <button
        type="button"
        onClick={onOpen}
        className="mt-4 grid w-full gap-2 text-left sm:grid-cols-3"
      >
        <Fact label="Custodian" value={custodianSummary(fund)} />
        <Fact
          label="Target float"
          value={formatPettyCashMoney(fund.targetBalance, fund.currency)}
        />
        <Fact
          label="Threshold"
          value={formatPettyCashMoney(fund.replenishmentThreshold, fund.currency)}
        />
      </button>
    </div>
  );
}

function FundDetailSheet({
  fund,
  onOpenChange,
  onEdit,
}: {
  fund: PettyCashFund | null;
  onOpenChange: (open: boolean) => void;
  onEdit: () => void;
}) {
  return (
    <Sheet open={fund !== null} onOpenChange={onOpenChange}>
      <SheetContent className="h-dvh w-full! max-w-none! overflow-y-auto overscroll-contain pb-[env(safe-area-inset-bottom)] sm:h-full sm:max-w-md!">
        {fund ? (
          <>
            <SheetHeader className="pr-12">
              <SheetTitle>Fund details</SheetTitle>
            </SheetHeader>
            <div className="flex flex-col gap-6 px-4 pb-6">
              <div className="space-y-2">
                <p className="text-sm font-medium">{fund.name}</p>
                <FundStatus status={fund.status} />
                {fund.description ? (
                  <p className="text-sm text-muted-foreground">{fund.description}</p>
                ) : null}
              </div>
              <dl className="flex flex-col">
                <DetailRow
                  label="Balance"
                  value={formatPettyCashMoney(fund.availableBalance, fund.currency)}
                />
                <DetailRow label="Custodian" value={custodianSummary(fund)} />
                <DetailRow
                  label="Target float"
                  value={formatPettyCashMoney(fund.targetBalance, fund.currency)}
                />
                <DetailRow
                  label="Replenishment threshold"
                  value={formatPettyCashMoney(fund.replenishmentThreshold, fund.currency)}
                />
                <DetailRow label="Department" value={fund.departmentName ?? "No department"} />
              </dl>
              <div className="flex sm:justify-end">
                <Button type="button" className="w-full sm:w-auto" onClick={onEdit}>
                  Edit fund
                </Button>
              </div>
            </div>
          </>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}

function FundMenu({
  fund,
  onEdit,
  onSuspend,
  onClose,
  onActivate,
}: {
  fund: PettyCashFund;
  onEdit: () => void;
  onSuspend: () => void;
  onClose: () => void;
  onActivate: () => void;
}) {
  return (
    <RowMenu label={`Actions for ${fund.name}`}>
      <DropdownMenuItem onClick={onEdit}>Edit</DropdownMenuItem>
      <DropdownMenuSeparator />
      {fund.status === "active" ? (
        <DropdownMenuItem variant="destructive" onClick={onSuspend}>
          Suspend
        </DropdownMenuItem>
      ) : (
        <DropdownMenuItem onClick={onActivate}>Activate</DropdownMenuItem>
      )}
      {fund.status === "closed" ? null : (
        <DropdownMenuItem variant="destructive" onClick={onClose}>
          Close
        </DropdownMenuItem>
      )}
    </RowMenu>
  );
}

function FundStatus({ status }: { status: PettyCashFund["status"] }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium">
      <span className={`size-1.5 rounded-full ${STATUS_DOT[status]}`} aria-hidden />
      {FUND_STATUS_LABELS[status]}
    </span>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <span className="min-w-0">
      <span className="block text-xs text-muted-foreground">{label}</span>
      <span className="mt-0.5 block truncate text-sm">{value}</span>
    </span>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-border py-3 last:border-0">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="max-w-[60%] text-right text-sm font-medium break-words">{value}</dd>
    </div>
  );
}

function custodianSummary(fund: PettyCashFund): string {
  const names = fund.custodians.map((person) => person.name);
  if (names.length === 0) return fund.custodianName ?? "No custodian";
  if (names.length === 1) return names[0] ?? "No custodian";
  return `${names[0]} + ${names.length - 1}`;
}
