"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { useAsyncAction } from "@/lib/hooks/use-async-action";
import { saveTransaction } from "@/lib/petty-cash/actions";
import { TRANSACTION_TYPE_LABELS } from "@/lib/petty-cash/labels";
import {
  exceedsPettyCashLimit,
  expenseShortfall,
  receiptRequiredFor,
  roundMoney,
  type TransactionType,
} from "@/lib/petty-cash/money";
import { formatPettyCashMoney } from "@/lib/petty-cash/money";
import type {
  PettyCashCategory,
  PettyCashFund,
  PettyCashSettings,
  PettyCashVendor,
} from "@/lib/petty-cash/types";

const EXPENSE_TYPES: TransactionType[] = [
  "expense",
  "cash_withdrawal",
  "adjustment_out",
];

const CASH_IN_TYPES: TransactionType[] = [
  "top_up",
  "cash_return",
  "adjustment_in",
];

export function TransactionSheet({
  open,
  onOpenChange,
  mode,
  funds,
  categories,
  vendors,
  settings,
  defaultFundId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "expense" | "cash_in";
  funds: PettyCashFund[];
  categories: PettyCashCategory[];
  vendors: PettyCashVendor[];
  settings: PettyCashSettings;
  defaultFundId: string;
}) {
  const router = useRouter();
  const { pending, run } = useAsyncAction();
  const fileRef = useRef<HTMLInputElement>(null);
  const activeFunds = funds.filter((fund) => fund.status === "active");
  const [fundId, setFundId] = useState(defaultFundId);
  const [transactionType, setTransactionType] = useState<TransactionType>(
    mode === "expense" ? "expense" : "top_up",
  );
  const [amount, setAmount] = useState("");
  const [transactionDate, setTransactionDate] = useState(today());
  const [categoryId, setCategoryId] = useState("");
  const [description, setDescription] = useState("");
  const [vendorId, setVendorId] = useState("none");
  const [newVendorName, setNewVendorName] = useState("");
  const [receiptNumber, setReceiptNumber] = useState("");
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");
  const [exceptionRequested, setExceptionRequested] = useState(false);

  useEffect(() => {
    if (!open) return;
    const active = funds.filter((item) => item.status === "active");
    const first =
      active.find((item) => item.id === defaultFundId)?.id ?? active[0]?.id ?? "";
    setFundId(first);
    setTransactionType(mode === "expense" ? "expense" : "top_up");
    setAmount("");
    setTransactionDate(today());
    setCategoryId("");
    setDescription("");
    setVendorId("none");
    setNewVendorName("");
    setReceiptNumber("");
    setReference("");
    setNotes("");
    setExceptionRequested(false);
    if (fileRef.current) fileRef.current.value = "";
  }, [open, mode, defaultFundId, funds]);

  const fund = activeFunds.find((item) => item.id === fundId) ?? null;
  const parsedAmount = parseLooseAmount(amount);
  const overLimit =
    parsedAmount != null &&
    exceedsPettyCashLimit(parsedAmount, settings.maxTransactionAmount);
  const shortfall =
    mode === "expense" && fund && parsedAmount != null && !settings.allowNegativeBalance
      ? expenseShortfall(fund.availableBalance, parsedAmount)
      : null;
  const needsReceipt =
    parsedAmount != null &&
    receiptRequiredFor(
      transactionType,
      parsedAmount,
      settings.receiptRequiredAbove,
    );

  const typeOptions = (mode === "expense" ? EXPENSE_TYPES : CASH_IN_TYPES).map(
    (type) => ({ value: type, label: TRANSACTION_TYPE_LABELS[type] }),
  );
  const fundItems = activeFunds.map((item) => ({
    value: item.id,
    label: item.name,
  }));
  const categoryItems = useMemo(() => {
    const activeGroupIds = new Set(
      categories
        .filter((category) => category.isActive && !category.parentId)
        .map((category) => category.id),
    );
    return categories
      .filter(
        (category) =>
          category.isActive &&
          category.parentId != null &&
          activeGroupIds.has(category.parentId),
      )
      .map((category) => ({
        value: category.id,
        label: category.parentName
          ? `${category.parentName} / ${category.name}`
          : category.name,
      }));
  }, [categories]);
  const vendorItems = [
    { value: "none", label: "No vendor" },
    ...vendors
      .filter((vendor) => vendor.isActive)
      .map((vendor) => ({ value: vendor.id, label: vendor.name })),
  ];

  function submit(intent: "draft" | "submit") {
    void run(async () => {
      const formData = new FormData();
      formData.set("intent", intent);
      formData.set("fundId", fundId);
      formData.set("transactionType", transactionType);
      formData.set("amount", amount);
      formData.set("transactionDate", transactionDate);
      formData.set("categoryId", categoryId);
      formData.set("description", description);
      formData.set("vendorId", vendorId === "none" ? "" : vendorId);
      formData.set("newVendorName", newVendorName);
      formData.set("receiptNumber", receiptNumber);
      formData.set("reference", reference);
      formData.set("notes", notes);
      formData.set("exceptionRequested", String(exceptionRequested));
      const file = fileRef.current?.files?.[0];
      if (file) formData.set("receipt", file);

      const result = await saveTransaction(formData);
      if (result.error) {
        toast.error(result.error);
        if (!result.id) return;
      } else {
        toast.success(intent === "draft" ? "Draft saved" : "Transaction submitted");
      }
      onOpenChange(false);
      router.refresh();
    });
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="h-dvh w-full! max-w-none! gap-0 overflow-hidden p-0 sm:h-full sm:max-w-md!">
        <SheetHeader className="shrink-0 border-b border-border pr-12">
          <SheetTitle>
            {mode === "expense" ? "Record petty cash expense" : "Record cash received"}
          </SheetTitle>
        </SheetHeader>
        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto overscroll-contain px-4 py-4">
          <Field label="Fund">
            <Select
              value={fundId}
              onValueChange={(value) => {
                if (value) setFundId(value);
              }}
              items={fundItems}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Choose a fund" />
              </SelectTrigger>
              <SelectContent>
                {fundItems.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Type">
            <Select
              value={transactionType}
              onValueChange={(value) => {
                if (value) setTransactionType(value as TransactionType);
              }}
              items={typeOptions}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {typeOptions.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Amount">
            <Input
              inputMode="decimal"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              placeholder="0.00"
            />
          </Field>
          <Field label="Date">
            <Input
              type="date"
              value={transactionDate}
              onChange={(event) => setTransactionDate(event.target.value)}
            />
          </Field>
          {mode === "expense" ? (
            <Field label="Category">
              <Select
                value={categoryId}
                onValueChange={(value) => {
                  if (value) setCategoryId(value);
                }}
                items={categoryItems}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Choose a category" />
                </SelectTrigger>
                <SelectContent>
                  {categoryItems.map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          ) : null}
          <Field label="Description">
            <Input
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
          </Field>
          {mode === "expense" ? (
            <>
              <Field label="Vendor">
                <Select
                  value={vendorId}
                  onValueChange={(value) => {
                    if (value) setVendorId(value);
                  }}
                  items={vendorItems}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {vendorItems.map((item) => (
                      <SelectItem key={item.value} value={item.value}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="New vendor">
                <Input
                  value={newVendorName}
                  onChange={(event) => setNewVendorName(event.target.value)}
                  placeholder="Leave blank to use the vendor above"
                />
              </Field>
              <Field label="Receipt number">
                <Input
                  value={receiptNumber}
                  onChange={(event) => setReceiptNumber(event.target.value)}
                />
              </Field>
              <Field label="Receipt">
                <Input
                  ref={fileRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,application/pdf"
                  className="file:mr-3"
                />
              </Field>
            </>
          ) : (
            <Field label="Reference">
              <Input
                value={reference}
                onChange={(event) => setReference(event.target.value)}
              />
            </Field>
          )}
          <Field label="Notes">
            <Textarea
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              className="rounded-md px-3"
            />
          </Field>

          {fund && parsedAmount != null && shortfall != null ? (
            <p className="text-sm text-destructive" role="alert">
              Insufficient petty cash balance. Available:{" "}
              {formatPettyCashMoney(fund.availableBalance, fund.currency)}. Requested:{" "}
              {formatPettyCashMoney(parsedAmount, fund.currency)}. Shortfall:{" "}
              {formatPettyCashMoney(shortfall, fund.currency)}.
            </p>
          ) : null}

          {overLimit && fund ? (
            <div className="rounded-md border border-border bg-secondary/40 p-3 text-sm">
              <p>
                This transaction exceeds the petty cash limit of{" "}
                {formatPettyCashMoney(settings.maxTransactionAmount, fund.currency)}.
                Consider procurement for larger purchases.
              </p>
              {settings.allowOverLimitException ? (
                <label className="mt-3 flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={exceptionRequested}
                    onChange={(event) =>
                      setExceptionRequested(event.target.checked)
                    }
                  />
                  Request an exception
                </label>
              ) : null}
            </div>
          ) : null}

          {needsReceipt ? (
            <p className="text-sm text-muted-foreground">
              A receipt is required above{" "}
              {formatPettyCashMoney(
                settings.receiptRequiredAbove,
                fund?.currency ?? settings.defaultCurrency,
              )}
              .
            </p>
          ) : null}
        </div>
        <div className="flex shrink-0 flex-col-reverse gap-2 border-t border-border bg-popover px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="outline"
              className="w-full sm:w-auto"
              disabled={pending}
              onClick={() => submit("draft")}
            >
              {pending ? <Spinner /> : null}
              Save draft
            </Button>
            <Button
              type="button"
              className="w-full sm:w-auto"
              disabled={pending}
              onClick={() => submit("submit")}
            >
              {pending ? <Spinner /> : null}
              {mode === "expense" ? "Submit expense" : "Submit"}
            </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  );
}

function today(): string {
  const date = new Date();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

function parseLooseAmount(value: string): number | null {
  const normalized = value.replace(/,/g, "").trim();
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) return null;
  const amount = roundMoney(Number(normalized));
  return amount > 0 ? amount : null;
}
