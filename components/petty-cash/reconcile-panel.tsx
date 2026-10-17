"use client";

import { useMemo, useState } from "react";
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
  reviewReconciliation,
  saveReconciliation,
} from "@/lib/petty-cash/actions";
import { RECONCILIATION_REASONS, reasonLabel } from "@/lib/petty-cash/labels";
import { cashVariance, formatPettyCashMoney } from "@/lib/petty-cash/money";
import type { PettyCashFund, ReconciliationRow } from "@/lib/petty-cash/types";

export function ReconcilePanel({
  funds,
  rows,
  canManage,
  viewerId,
  initialFundId = "",
}: {
  funds: PettyCashFund[];
  rows: ReconciliationRow[];
  canManage: boolean;
  viewerId: string;
  initialFundId?: string;
}) {
  const router = useRouter();
  const { pending, run } = useAsyncAction();
  const activeFunds = funds.filter((fund) => fund.status !== "closed");
  const [fundId, setFundId] = useState(
    activeFunds.some((fund) => fund.id === initialFundId)
      ? initialFundId
      : (activeFunds[0]?.id ?? ""),
  );
  const [date, setDate] = useState(today());
  const [actual, setActual] = useState("");
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");

  const fund = activeFunds.find((item) => item.id === fundId) ?? null;
  const actualAmount = parseCount(actual);
  const variance =
    fund && actualAmount != null
      ? cashVariance(fund.availableBalance, actualAmount)
      : null;

  const fundItems = activeFunds.map((item) => ({
    value: item.id,
    label: item.name,
  }));
  const reasonItems = RECONCILIATION_REASONS.map((item) => ({
    value: item.value,
    label: item.label,
  }));

  const expectedLabel = useMemo(() => {
    if (!fund) return "";
    return formatPettyCashMoney(fund.availableBalance, fund.currency);
  }, [fund]);

  function submit() {
    void run(async () => {
      const formData = new FormData();
      formData.set("fundId", fundId);
      formData.set("reconciliationDate", date);
      formData.set("actualBalance", actual);
      formData.set("reason", reason);
      formData.set("notes", notes);
      const result = await saveReconciliation(formData);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Reconciliation submitted");
      setActual("");
      setNotes("");
      setReason("");
      router.refresh();
    });
  }

  function review(id: string) {
    void run(async () => {
      const result = await reviewReconciliation(id);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Reconciliation reviewed");
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-6">
      {canManage && fund ? (
        <section className="rounded-xl border border-border bg-card p-4 sm:p-6">
          <h2 className="text-sm font-medium">Reconcile petty cash</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label>Fund</Label>
              <Select
                value={fundId}
                onValueChange={(value) => {
                  if (value) setFundId(value);
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
              <Label>Date</Label>
              <Input type="date" value={date} onChange={(event) => setDate(event.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Expected balance</Label>
              <p className="flex h-10 items-center text-sm tabular-nums">{expectedLabel}</p>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Physical cash count</Label>
              <Input
                inputMode="decimal"
                value={actual}
                onChange={(event) => setActual(event.target.value)}
                placeholder="0.00"
              />
            </div>
          </div>
          {variance != null && fund ? (
            <p className="mt-4 text-sm">
              Variance: {formatPettyCashMoney(variance, fund.currency)}
              {variance === 0 ? ". Balanced." : ""}
            </p>
          ) : null}
          {variance != null && variance !== 0 ? (
            <div className="mt-4 flex flex-col gap-1.5">
              <Label>Reason</Label>
              <Select
                value={reason}
                onValueChange={(value) => {
                  if (value) setReason(value);
                }}
                items={reasonItems}
              >
                <SelectTrigger className="w-full sm:max-w-xs">
                  <SelectValue placeholder="Choose a reason" />
                </SelectTrigger>
                <SelectContent>
                  {reasonItems.map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}
          <div className="mt-4 flex flex-col gap-1.5">
            <Label>Notes</Label>
            <Textarea
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              className="rounded-md px-3"
            />
          </div>
          <div className="mt-4 flex sm:justify-end">
            <Button type="button" className="w-full sm:w-auto" onClick={submit} disabled={pending}>
              {pending ? <Spinner /> : null}
              Submit reconciliation
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
            title="Counts show up here"
          />
        ) : (
          rows.map((row) => (
            <article key={row.id} className="rounded-xl border border-border bg-card p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-medium">{row.fundName}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {row.reconciliationDate} · {row.performedByName}
                  </p>
                </div>
                <p className="text-sm tabular-nums">
                  {formatPettyCashMoney(row.variance, row.currency)}
                </p>
              </div>
              <p className="mt-3 text-sm text-muted-foreground">
                Expected {formatPettyCashMoney(row.expectedBalance, row.currency)}, counted{" "}
                {formatPettyCashMoney(row.actualBalance, row.currency)}
                {row.reason ? `. ${reasonLabel(row.reason)}` : ""}
                {row.notes ? `. ${row.notes}` : ""}
              </p>
              <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                <p className="text-xs text-muted-foreground">
                  {row.status === "reviewed"
                    ? `Reviewed by ${row.reviewedByName ?? "someone"}`
                    : "Waiting for review"}
                </p>
                {row.status === "submitted" && row.performedBy !== viewerId ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={pending}
                    onClick={() => review(row.id)}
                  >
                    Mark reviewed
                  </Button>
                ) : null}
              </div>
            </article>
          ))
        )}
      </section>
    </div>
  );
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function parseCount(value: string): number | null {
  const normalized = value.replace(/,/g, "").trim();
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) return null;
  return Number(normalized);
}
