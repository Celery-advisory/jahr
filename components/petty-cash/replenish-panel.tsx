"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { useAsyncAction } from "@/lib/hooks/use-async-action";
import {
  completeReplenishment,
  decideReplenishment,
  saveReplenishment,
} from "@/lib/petty-cash/actions";
import { formatPettyCashMoney } from "@/lib/petty-cash/money";
import type { PettyCashFund, ReplenishmentRow } from "@/lib/petty-cash/types";

const STATUS_LABEL = {
  draft: "Draft",
  pending_approval: "Pending approval",
  rejected: "Rejected",
  approved: "Approved",
  completed: "Completed",
} as const;

export function ReplenishPanel({
  funds,
  rows,
  canManage,
  viewerId,
  initialFundId = "",
}: {
  funds: PettyCashFund[];
  rows: ReplenishmentRow[];
  canManage: boolean;
  viewerId: string;
  initialFundId?: string;
}) {
  const router = useRouter();
  const { pending, run } = useAsyncAction();
  const active = funds.filter((fund) => fund.status === "active");
  const [fundId, setFundId] = useState(
    active.some((fund) => fund.id === initialFundId)
      ? initialFundId
      : (active[0]?.id ?? ""),
  );
  const fund = active.find((item) => item.id === fundId) ?? null;
  const [amount, setAmount] = useState(
    fund ? String(fund.replenishmentAmount || "") : "",
  );
  const [notes, setNotes] = useState("");
  const [rejectReason, setRejectReason] = useState("");

  const fundItems = active.map((item) => ({ value: item.id, label: item.name }));

  function request() {
    void run(async () => {
      const formData = new FormData();
      formData.set("fundId", fundId);
      formData.set("requestedAmount", amount);
      formData.set("notes", notes);
      const result = await saveReplenishment(formData);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Replenishment requested");
      setNotes("");
      router.refresh();
    });
  }

  function decide(id: string, decision: "approve" | "reject") {
    void run(async () => {
      const formData = new FormData();
      formData.set("id", id);
      formData.set("decision", decision);
      formData.set("reason", rejectReason);
      const result = await decideReplenishment(formData);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success(decision === "approve" ? "Replenishment approved" : "Replenishment rejected");
      setRejectReason("");
      router.refresh();
    });
  }

  function complete(id: string) {
    void run(async () => {
      const result = await completeReplenishment(id);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Cash received and posted");
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-6">
      {canManage && fund ? (
        <section className="rounded-xl border border-border bg-card p-4 sm:p-6">
          <h2 className="text-sm font-medium">Request replenishment</h2>
          {fund.needsReplenishment ? (
            <p className="mt-2 text-sm text-muted-foreground">
              {fund.name} is below {formatPettyCashMoney(fund.replenishmentThreshold, fund.currency)}.
              Recommended top-up {formatPettyCashMoney(fund.replenishmentAmount, fund.currency)}.
            </p>
          ) : (
            <p className="mt-2 text-sm text-muted-foreground">
              {fund.name} is above its threshold. Current balance{" "}
              {formatPettyCashMoney(fund.availableBalance, fund.currency)}.
            </p>
          )}
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label>Fund</Label>
              <Select
                value={fundId}
                onValueChange={(value) => {
                  if (!value) return;
                  setFundId(value);
                  const next = active.find((item) => item.id === value);
                  setAmount(next ? String(next.replenishmentAmount || "") : "");
                }}
                items={fundItems}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {fundItems.map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Amount</Label>
              <Input
                inputMode="decimal"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
              />
            </div>
          </div>
          <div className="mt-4 flex flex-col gap-1.5">
            <Label>Notes</Label>
            <Textarea
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              className="rounded-md px-3"
            />
          </div>
          <div className="mt-4 flex sm:justify-end">
            <Button type="button" className="w-full sm:w-auto" onClick={request} disabled={pending}>
              {pending ? <Spinner /> : null}
              Request replenishment
            </Button>
          </div>
        </section>
      ) : null}

      <section className="flex flex-col gap-3">
        {rows.length === 0 ? (
          <EmptyState
            kind="cash"
            surface
            size="compact"
            title="Requests show up here"
          />
        ) : (
          rows.map((row) => (
            <article key={row.id} className="rounded-xl border border-border bg-card p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-medium">{row.fundName}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {STATUS_LABEL[row.status]} · {row.requestedByName}
                  </p>
                </div>
                <p className="text-sm font-medium tabular-nums">
                  {formatPettyCashMoney(row.approvedAmount ?? row.requestedAmount, row.currency)}
                </p>
              </div>
              {row.notes ? (
                <p className="mt-2 text-sm text-muted-foreground">{row.notes}</p>
              ) : null}
              {row.rejectionReason ? (
                <p className="mt-2 text-sm text-destructive">{row.rejectionReason}</p>
              ) : null}
              {row.status === "pending_approval" && row.requestedBy !== viewerId ? (
                <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
                  <Input
                    value={rejectReason}
                    onChange={(event) => setRejectReason(event.target.value)}
                    placeholder="Rejection reason"
                    className="sm:max-w-xs"
                  />
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <Button type="button" size="sm" className="w-full sm:w-auto" disabled={pending} onClick={() => decide(row.id, "approve")}>
                      Approve
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="w-full sm:w-auto"
                      disabled={pending}
                      onClick={() => decide(row.id, "reject")}
                    >
                      Reject
                    </Button>
                  </div>
                </div>
              ) : null}
              {row.status === "approved" && canManage ? (
                <div className="mt-3">
                  <Button type="button" size="sm" className="w-full sm:w-auto" disabled={pending} onClick={() => complete(row.id)}>
                    {pending ? <Spinner /> : null}
                    Cash received
                  </Button>
                </div>
              ) : null}
            </article>
          ))
        )}
      </section>
    </div>
  );
}
