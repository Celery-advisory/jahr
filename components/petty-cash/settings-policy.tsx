"use client";

import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { SettingsSection } from "@/components/petty-cash/confirm-dialog";
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
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import { useAsyncAction } from "@/lib/hooks/use-async-action";
import { updatePettyCashSettings } from "@/lib/petty-cash/actions";
import { currencyDisplay, formatPettyCashMoney } from "@/lib/petty-cash/money";
import type { PettyCashSettings } from "@/lib/petty-cash/types";
import { REPORTING_CURRENCIES } from "@/lib/payroll/currencies";

const CURRENCIES = REPORTING_CURRENCIES.map((code) => ({
  value: code,
  label: currencyDisplay(code),
}));

export function SettingsPolicy({
  settings,
  editing,
  onEditingChange,
}: {
  settings: PettyCashSettings;
  editing: boolean;
  onEditingChange: (editing: boolean) => void;
}) {
  return (
    <SettingsSection
      title="Petty cash policy"
      description="Manage limits and approval rules."
    >
      {editing ? (
        <PolicyEditor
          settings={settings}
          onCancel={() => onEditingChange(false)}
          onSaved={() => onEditingChange(false)}
        />
      ) : (
        <PolicySummary settings={settings} onEdit={() => onEditingChange(true)} />
      )}
    </SettingsSection>
  );
}

function PolicySummary({
  settings,
  onEdit,
}: {
  settings: PettyCashSettings;
  onEdit: () => void;
}) {
  const money = (amount: number) => formatPettyCashMoney(amount, settings.defaultCurrency);

  return (
    <div className="rounded-xl border border-border bg-card p-4 sm:p-6">
      <div className="flex flex-col gap-8">
        <PolicyGroup title="Transaction controls">
          <Fact label="Default currency" value={currencyDisplay(settings.defaultCurrency)} />
          <Fact label="Receipt required above" value={money(settings.receiptRequiredAbove)} />
          <Fact label="Maximum transaction" value={money(settings.maxTransactionAmount)} />
          <Fact label="Auto-approve up to" value={money(settings.autoApproveUpTo)} />
        </PolicyGroup>
        <PolicyGroup title="Fund defaults">
          <Fact label="Default target float" value={money(settings.defaultTargetFloat)} />
          <Fact
            label="Default replenishment threshold"
            value={money(settings.defaultReplenishmentThreshold)}
          />
        </PolicyGroup>
        <PolicyGroup title="Approval and exceptions">
          <Rule
            title="Allow transaction limit exceptions"
            description="Authorized users can submit transactions above the configured maximum."
            value={settings.allowOverLimitException ? "On" : "Off"}
          />
          <Rule
            title="Allow self-approval"
            description="Users can approve transactions they created."
            value={settings.allowSelfApproval ? "On" : "Off"}
          />
          <Rule
            title="Allow negative balances"
            description="Permit transactions that exceed available petty cash."
            value={settings.allowNegativeBalance ? "On" : "Off"}
          />
        </PolicyGroup>
      </div>
      <div className="mt-6 flex justify-end">
        <Button type="button" onClick={onEdit}>
          Edit policy
        </Button>
      </div>
    </div>
  );
}

function PolicyEditor({
  settings,
  onCancel,
  onSaved,
}: {
  settings: PettyCashSettings;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const router = useRouter();
  const { pending, run } = useAsyncAction();
  const [defaultCurrency, setDefaultCurrency] = useState(settings.defaultCurrency);
  const [receiptRequiredAbove, setReceiptRequiredAbove] = useState(
    String(settings.receiptRequiredAbove),
  );
  const [maxTransactionAmount, setMaxTransactionAmount] = useState(
    String(settings.maxTransactionAmount),
  );
  const [autoApproveUpTo, setAutoApproveUpTo] = useState(String(settings.autoApproveUpTo));
  const [defaultTargetFloat, setDefaultTargetFloat] = useState(
    String(settings.defaultTargetFloat),
  );
  const [defaultReplenishmentThreshold, setDefaultReplenishmentThreshold] = useState(
    String(settings.defaultReplenishmentThreshold),
  );
  const [allowOverLimitException, setAllowOverLimitException] = useState(
    settings.allowOverLimitException,
  );
  const [allowSelfApproval, setAllowSelfApproval] = useState(settings.allowSelfApproval);
  const [allowNegativeBalance, setAllowNegativeBalance] = useState(
    settings.allowNegativeBalance,
  );
  const symbol = currencyDisplay(defaultCurrency);

  function save() {
    void run(async () => {
      const formData = new FormData();
      formData.set("defaultCurrency", defaultCurrency);
      formData.set("receiptRequiredAbove", receiptRequiredAbove);
      formData.set("maxTransactionAmount", maxTransactionAmount);
      formData.set("autoApproveUpTo", autoApproveUpTo);
      formData.set("defaultTargetFloat", defaultTargetFloat);
      formData.set("defaultReplenishmentThreshold", defaultReplenishmentThreshold);
      formData.set("allowOverLimitException", String(allowOverLimitException));
      formData.set("allowSelfApproval", String(allowSelfApproval));
      formData.set("allowNegativeBalance", String(allowNegativeBalance));
      const result = await updatePettyCashSettings(formData);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Policy saved");
      onSaved();
      router.refresh();
    });
  }

  return (
    <div className="rounded-xl border border-border bg-card p-4 sm:p-6">
      <div className="flex flex-col gap-8">
        <PolicyGroup title="Transaction controls">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label>Default currency</Label>
              <Select
                value={defaultCurrency}
                onValueChange={(value) => {
                  if (value) setDefaultCurrency(value);
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
            </div>
            <MoneyField
              label="Receipt required above"
              symbol={symbol}
              value={receiptRequiredAbove}
              onChange={setReceiptRequiredAbove}
            />
            <MoneyField
              label="Maximum transaction"
              symbol={symbol}
              value={maxTransactionAmount}
              onChange={setMaxTransactionAmount}
            />
            <MoneyField
              label="Auto-approve up to"
              symbol={symbol}
              value={autoApproveUpTo}
              onChange={setAutoApproveUpTo}
            />
          </div>
        </PolicyGroup>
        <PolicyGroup title="Fund defaults">
          <div className="grid gap-4 sm:grid-cols-2">
            <MoneyField
              label="Default target float"
              symbol={symbol}
              value={defaultTargetFloat}
              onChange={setDefaultTargetFloat}
            />
            <MoneyField
              label="Default replenishment threshold"
              symbol={symbol}
              value={defaultReplenishmentThreshold}
              onChange={setDefaultReplenishmentThreshold}
            />
          </div>
        </PolicyGroup>
        <PolicyGroup title="Approval and exceptions">
          <div className="flex flex-col gap-4">
            <Toggle
              id="allow-over-limit"
              title="Allow transaction limit exceptions"
              description="Authorized users can submit transactions above the configured maximum."
              checked={allowOverLimitException}
              onChange={setAllowOverLimitException}
            />
            <Toggle
              id="allow-self-approval"
              title="Allow self-approval"
              description="Users can approve transactions they created."
              checked={allowSelfApproval}
              onChange={setAllowSelfApproval}
            />
            <Toggle
              id="allow-negative"
              title="Allow negative balances"
              description="Permit transactions that exceed available petty cash."
              checked={allowNegativeBalance}
              onChange={setAllowNegativeBalance}
            />
          </div>
        </PolicyGroup>
      </div>
      <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button type="button" variant="outline" className="w-full sm:w-auto" onClick={onCancel} disabled={pending}>
          Cancel
        </Button>
        <Button type="button" className="w-full sm:w-auto" onClick={save} disabled={pending}>
          {pending ? <Spinner /> : null}
          Save changes
        </Button>
      </div>
    </div>
  );
}

function PolicyGroup({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div>
      <h3 className="text-sm font-medium">{title}</h3>
      <div className="mt-3">{children}</div>
    </div>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-border py-3 last:border-0">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="text-right text-sm font-medium break-words tabular-nums">{value}</dd>
    </div>
  );
}

function Rule({
  title,
  description,
  value,
}: {
  title: string;
  description: string;
  value: string;
}) {
  return (
    <div className="flex flex-col gap-1 border-b border-border py-3 last:border-0 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
      <div className="min-w-0">
        <p className="text-sm font-medium">{title}</p>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      </div>
      <p className="text-sm font-medium sm:shrink-0">{value}</p>
    </div>
  );
}

function MoneyField({
  label,
  symbol,
  value,
  onChange,
}: {
  label: string;
  symbol: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label>{label}</Label>
      <div className="relative">
        <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm text-muted-foreground">
          {symbol}
        </span>
        <Input
          className="pl-12"
          inputMode="decimal"
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
      </div>
    </div>
  );
}

function Toggle({
  id,
  title,
  description,
  checked,
  onChange,
}: {
  id: string;
  title: string;
  description: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <Label htmlFor={id}>{title}</Label>
        <p id={`${id}-hint`} className="mt-1 text-sm text-muted-foreground">
          {description}
        </p>
      </div>
      <Switch
        id={id}
        checked={checked}
        onCheckedChange={onChange}
        aria-describedby={`${id}-hint`}
      />
    </div>
  );
}
