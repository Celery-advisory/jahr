"use client";

import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/petty-cash/confirm-dialog";
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
import { saveFund } from "@/lib/petty-cash/actions";
import { FUND_STATUS_LABELS } from "@/lib/petty-cash/labels";
import { currencyDisplay } from "@/lib/petty-cash/money";
import type {
  DepartmentOption,
  PettyCashFund,
  PettyCashPerson,
  PettyCashSettings,
} from "@/lib/petty-cash/types";
import { REPORTING_CURRENCIES } from "@/lib/payroll/currencies";
import { useResetOnChange } from "@/lib/hooks/use-reset-on-change";

const CURRENCIES = REPORTING_CURRENCIES.map((code) => ({
  value: code,
  label: currencyDisplay(code),
}));

const STATUSES = (Object.keys(FUND_STATUS_LABELS) as Array<
  keyof typeof FUND_STATUS_LABELS
>).map((status) => ({
  value: status,
  label: FUND_STATUS_LABELS[status],
}));

export function FundSheet({
  open,
  onOpenChange,
  fund,
  settings,
  people,
  departments,
  viewerId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fund: PettyCashFund | null;
  settings: PettyCashSettings;
  people: PettyCashPerson[];
  departments: DepartmentOption[];
  viewerId: string;
}) {
  const router = useRouter();
  const { pending, run } = useAsyncAction();
  const editing = fund !== null;
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [currency, setCurrency] = useState(settings.defaultCurrency);
  const [openingBalance, setOpeningBalance] = useState("");
  const [targetBalance, setTargetBalance] = useState("");
  const [threshold, setThreshold] = useState("");
  const [custodianIds, setCustodianIds] = useState<string[]>([]);
  const [departmentId, setDepartmentId] = useState("none");
  const [status, setStatus] = useState("active");
  const [pendingStatus, setPendingStatus] = useState<"suspended" | "closed" | null>(
    null,
  );

  useResetOnChange([open, fund, settings], () => {
    if (!open) return;
    setName(fund?.name ?? "");
    setDescription(fund?.description ?? "");
    setCurrency(fund?.currency ?? settings.defaultCurrency);
    setOpeningBalance("");
    setTargetBalance(
      fund ? String(fund.targetBalance) : String(settings.defaultTargetFloat),
    );
    setThreshold(
      fund
        ? String(fund.replenishmentThreshold)
        : String(settings.defaultReplenishmentThreshold),
    );
    setCustodianIds(
      fund?.custodians.map((person) => person.id) ??
        (fund?.custodianId ? [fund.custodianId] : []),
    );
    setDepartmentId(fund?.departmentId ?? "none");
    setStatus(fund?.status ?? "active");
  });

  const activePeople = people.filter((person) => person.status === "active");
  const selectedCustodians = custodianIds.flatMap((id) => {
    const person = activePeople.find((candidate) => candidate.id === id);
    return person ? [person] : [];
  });
  const availableCustodians = activePeople
    .filter((person) => !custodianIds.includes(person.id))
    .map((person) => ({ value: person.id, label: person.name }));
  const viewerIsCustodian = custodianIds.includes(viewerId);
  const viewerCanJoin = activePeople.some((person) => person.id === viewerId);
  const departmentItems = [
    { value: "none", label: "No department" },
    ...departments.map((department) => ({
      value: department.id,
      label: department.name,
    })),
  ];

  function handleSave() {
    if (
      fund &&
      status !== fund.status &&
      (status === "suspended" || status === "closed")
    ) {
      setPendingStatus(status);
      return;
    }
    persist();
  }

  function persist() {
    setPendingStatus(null);
    void run(async () => {
      const formData = new FormData();
      if (fund) formData.set("id", fund.id);
      formData.set("name", name);
      formData.set("description", description);
      formData.set("currency", currency);
      formData.set("openingBalance", openingBalance);
      formData.set("targetBalance", targetBalance);
      formData.set("replenishmentThreshold", threshold);
      for (const personId of custodianIds) formData.append("custodianId", personId);
      formData.set("departmentId", departmentId === "none" ? "" : departmentId);
      formData.set("status", status);

      const result = await saveFund(formData);
      if (result.error) {
        toast.error(result.error);
        if (!result.id) return;
      } else {
        toast.success(editing ? "Fund updated" : "Fund created");
      }
      onOpenChange(false);
      router.refresh();
    });
  }

  return (
    <>
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="h-dvh w-full! max-w-none! overflow-y-auto overscroll-contain pb-[env(safe-area-inset-bottom)] sm:h-full sm:max-w-md!">
        <SheetHeader className="pr-12">
          <SheetTitle>{editing ? "Edit fund" : "Create fund"}</SheetTitle>
        </SheetHeader>
        <div className="flex flex-col gap-4 px-4 pb-6">
          <Field label="Name">
            <Input value={name} onChange={(event) => setName(event.target.value)} />
          </Field>
          <Field label="Description">
            <Textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              className="rounded-md px-3"
            />
          </Field>
          <Field label="Currency">
            <Select
              value={currency}
              onValueChange={(value) => {
                if (value) setCurrency(value);
              }}
              items={CURRENCIES}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CURRENCIES.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          {editing ? null : (
            <Field label="Opening balance">
              <Input
                inputMode="decimal"
                value={openingBalance}
                onChange={(event) => setOpeningBalance(event.target.value)}
                placeholder="0.00"
              />
            </Field>
          )}
          <Field label="Target float">
            <Input
              inputMode="decimal"
              value={targetBalance}
              onChange={(event) => setTargetBalance(event.target.value)}
            />
          </Field>
          <Field label="Replenishment threshold">
            <Input
              inputMode="decimal"
              value={threshold}
              onChange={(event) => setThreshold(event.target.value)}
            />
          </Field>
          <Field label="Custodians">
            {selectedCustodians.length > 0 ? (
              <ul className="flex flex-col gap-2">
                {selectedCustodians.map((person, index) => (
                  <li
                    key={person.id}
                    className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2"
                  >
                    <span className="text-sm">
                      {person.name}
                      {index === 0 && selectedCustodians.length > 1 ? (
                        <span className="ml-2 text-xs text-muted-foreground">Primary</span>
                      ) : null}
                    </span>
                    <span className="flex shrink-0 gap-1">
                      {index > 0 ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            setCustodianIds((current) => [
                              person.id,
                              ...current.filter((id) => id !== person.id),
                            ])
                          }
                        >
                          Make primary
                        </Button>
                      ) : null}
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          setCustodianIds((current) =>
                            current.filter((id) => id !== person.id),
                          )
                        }
                      >
                        Remove
                      </Button>
                    </span>
                  </li>
                ))}
              </ul>
            ) : null}
            <div className="flex flex-col gap-2">
              {viewerCanJoin && !viewerIsCustodian ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setCustodianIds((current) => [...current, viewerId])}
                >
                  Assign me
                </Button>
              ) : null}
              {availableCustodians.length > 0 ? (
                <Select
                  key={custodianIds.join(",")}
                  onValueChange={(value) => {
                    if (typeof value !== "string" || value.length === 0) return;
                    const personId = value;
                    setCustodianIds((current) =>
                      current.includes(personId) ? current : [...current, personId],
                    );
                  }}
                  items={availableCustodians}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Add a custodian" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableCustodians.map((item) => (
                      <SelectItem key={item.value} value={item.value}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : null}
            </div>
          </Field>
          <Field label="Department">
            <Select
              value={departmentId}
              onValueChange={(value) => {
                if (value) setDepartmentId(value);
              }}
              items={departmentItems}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {departmentItems.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          {editing ? (
            <Field label="Status">
              <Select
                value={status}
                onValueChange={(value) => {
                  if (value) setStatus(value);
                }}
                items={STATUSES}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUSES.map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          ) : null}
          <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end [&_button]:w-full sm:[&_button]:w-auto">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={pending}
            >
              Cancel
            </Button>
            <Button type="button" onClick={handleSave} disabled={pending}>
              {pending ? <Spinner /> : null}
              {editing ? "Save fund" : "Create fund"}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
    <ConfirmDialog
      open={pendingStatus !== null}
      title={pendingStatus === "closed" ? "Close fund?" : "Suspend fund?"}
      description={
        pendingStatus === "closed"
          ? "This fund will no longer accept new transactions. Existing transactions stay on the ledger."
          : "This fund will be paused and will not accept new transactions until it is active again."
      }
      confirmLabel={pendingStatus === "closed" ? "Close" : "Suspend"}
      destructive
      pending={pending}
      onOpenChange={(next) => {
        if (!next && !pending) setPendingStatus(null);
      }}
      onConfirm={persist}
    />
    </>
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
