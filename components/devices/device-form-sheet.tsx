"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { CurrencySelect } from "@/components/admin/currency-select";
import {
  CONDITION_ITEMS,
  Field,
  NO_CONDITION,
  OptionSelect,
} from "@/components/devices/device-ui";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { createDevice, updateDevice } from "@/lib/devices/actions";
import {
  DEVICE_TEMPLATES,
  isDeviceCondition,
  type DeviceFormOptions,
  type DeviceRecord,
  type DeviceSpecs,
} from "@/lib/devices/types";
import { DEFAULT_PAY_CURRENCY } from "@/lib/payroll/currencies";
import { useAsyncAction } from "@/lib/hooks/use-async-action";
import { useResetOnChange } from "@/lib/hooks/use-reset-on-change";

const NO_ENTITY = "none";

interface FormState {
  categoryId: string;
  name: string;
  serialNumber: string;
  manufacturer: string;
  model: string;
  color: string;
  condition: string;
  location: string;
  purchasedAt: Date | undefined;
  purchaseCost: string;
  purchaseCurrency: string;
  supplier: string;
  orderNumber: string;
  legalEntityId: string;
  warrantyExpiresAt: Date | undefined;
  specs: DeviceSpecs;
  notes: string;
}

function parseDate(value: string | null): Date | undefined {
  return value ? new Date(`${value}T12:00:00`) : undefined;
}

function initialState(
  device: DeviceRecord | null,
  options: DeviceFormOptions,
): FormState {
  const firstCategory = options.categories.find((category) => !category.archived);
  return {
    categoryId: device?.category.id ?? firstCategory?.id ?? "",
    name: device?.name ?? "",
    serialNumber: device?.serial_number ?? "",
    manufacturer: device?.manufacturer ?? "",
    model: device?.model ?? "",
    color: device?.color ?? "",
    condition: device?.condition ?? NO_CONDITION,
    location: device?.location ?? "",
    purchasedAt: parseDate(device?.purchased_at ?? null),
    purchaseCost: device?.purchase_cost != null ? String(device.purchase_cost) : "",
    purchaseCurrency: device?.purchase_currency ?? DEFAULT_PAY_CURRENCY,
    supplier: device?.supplier ?? "",
    orderNumber: device?.order_number ?? "",
    legalEntityId: device?.legal_entity?.id ?? NO_ENTITY,
    warrantyExpiresAt: parseDate(device?.warranty_expires_at ?? null),
    specs: { ...(device?.specs ?? {}) },
    notes: device?.notes ?? "",
  };
}

function Suggestions({ id, values }: { id: string; values: string[] }) {
  return (
    <datalist id={id}>
      {values.map((value) => (
        <option key={value} value={value} />
      ))}
    </datalist>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-4 border-t border-border pt-5 first:border-t-0 first:pt-0">
      <h3 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
        {title}
      </h3>
      {children}
    </section>
  );
}

/** Add a new device, or edit one when `device` is set. */
export function DeviceFormSheet({
  open,
  onOpenChange,
  device,
  options,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  device: DeviceRecord | null;
  options: DeviceFormOptions;
  onSaved?: (deviceId: string) => void;
}) {
  const router = useRouter();
  const { pending, run } = useAsyncAction();
  const [form, setForm] = useState<FormState>(() => initialState(device, options));
  const [error, setError] = useState<string | null>(null);

  useResetOnChange([open, device?.id], () => {
    if (!open) return;
    setForm(initialState(device, options));
    setError(null);
  });

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((current) => ({ ...current, [key]: value }));

  // Archived categories are hidden unless this device already uses one.
  const categoryItems = options.categories
    .filter((category) => !category.archived || category.id === form.categoryId)
    .map((category) => ({ value: category.id, label: category.name }));
  const category = options.categories.find((item) => item.id === form.categoryId);
  const template = DEVICE_TEMPLATES[category?.template ?? "other"];

  function handleSave() {
    setError(null);
    void run(async () => {
      const input = {
        categoryId: form.categoryId,
        name: form.name,
        serialNumber: form.serialNumber,
        manufacturer: form.manufacturer,
        model: form.model,
        color: form.color,
        condition: isDeviceCondition(form.condition) ? form.condition : ("" as const),
        location: form.location,
        purchasedAt: form.purchasedAt ? format(form.purchasedAt, "yyyy-MM-dd") : undefined,
        purchaseCost: form.purchaseCost,
        purchaseCurrency: form.purchaseCurrency,
        supplier: form.supplier,
        orderNumber: form.orderNumber,
        legalEntityId: form.legalEntityId === NO_ENTITY ? "" : form.legalEntityId,
        warrantyExpiresAt: form.warrantyExpiresAt
          ? format(form.warrantyExpiresAt, "yyyy-MM-dd")
          : undefined,
        specs: form.specs,
        notes: form.notes,
      };
      const result = device
        ? await updateDevice(device.id, input)
        : await createDevice(input);
      if (result.error) {
        setError(result.error);
        return;
      }
      onOpenChange(false);
      if (result.deviceId) onSaved?.(result.deviceId);
      router.refresh();
    });
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>{device ? `Edit ${device.asset_tag}` : "Add device"}</SheetTitle>
          <SheetDescription>
            {device
              ? "Changing the category does not change the JA ID."
              : "Only category and name are required, so older devices with missing records can still be logged. A JA ID is assigned on save."}
          </SheetDescription>
        </SheetHeader>

        <div className="flex flex-1 flex-col gap-5 overflow-y-auto px-4 pb-4">
          <Section title="Device">
            <Field label="Category" htmlFor="device-category">
              <OptionSelect
                id="device-category"
                value={form.categoryId}
                onValueChange={(value) => set("categoryId", value)}
                items={categoryItems}
                placeholder="Choose a category"
              />
            </Field>
            <Field label="Name" htmlFor="device-name">
              <Input
                id="device-name"
                value={form.name}
                onChange={(event) => set("name", event.target.value)}
                placeholder="MacBook Pro 14"
              />
            </Field>
            <Field label="Serial number" htmlFor="device-serial" optional>
              <Input
                id="device-serial"
                value={form.serialNumber}
                onChange={(event) => set("serialNumber", event.target.value)}
                placeholder="C02XYZ123456"
                className="font-mono text-sm"
              />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Manufacturer" htmlFor="device-manufacturer" optional>
                <Input
                  id="device-manufacturer"
                  list="device-manufacturers"
                  value={form.manufacturer}
                  onChange={(event) => set("manufacturer", event.target.value)}
                  placeholder="Apple"
                />
                <Suggestions id="device-manufacturers" values={options.manufacturers} />
              </Field>
              <Field label="Model" htmlFor="device-model" optional>
                <Input
                  id="device-model"
                  list="device-models"
                  value={form.model}
                  onChange={(event) => set("model", event.target.value)}
                  placeholder="M3 Pro"
                />
                <Suggestions id="device-models" values={options.models} />
              </Field>
            </div>
            <Field label="Colour" htmlFor="device-color" optional>
              <Input
                id="device-color"
                value={form.color}
                onChange={(event) => set("color", event.target.value)}
                placeholder="Space Black"
              />
            </Field>
          </Section>

          {template.specs.length > 0 ? (
            <Section title={`${category?.name ?? template.label} details`}>
              <div className="grid gap-4 sm:grid-cols-2">
                {template.specs.map((spec) => (
                  <Field
                    key={spec.key}
                    label={spec.label}
                    htmlFor={`device-spec-${spec.key}`}
                    optional
                  >
                    <Input
                      id={`device-spec-${spec.key}`}
                      value={form.specs[spec.key] ?? ""}
                      onChange={(event) =>
                        set("specs", { ...form.specs, [spec.key]: event.target.value })
                      }
                      placeholder={spec.placeholder}
                      className={spec.mono ? "font-mono text-sm" : undefined}
                    />
                  </Field>
                ))}
              </div>
            </Section>
          ) : null}

          <Section title="Where it is">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Location" htmlFor="device-location" optional>
                <Input
                  id="device-location"
                  list="device-locations"
                  value={form.location}
                  onChange={(event) => set("location", event.target.value)}
                  placeholder="Accra HQ"
                />
                <Suggestions id="device-locations" values={options.locations} />
              </Field>
              <Field label="Condition" htmlFor="device-condition" optional>
                <OptionSelect
                  id="device-condition"
                  value={form.condition}
                  onValueChange={(value) => set("condition", value)}
                  items={CONDITION_ITEMS}
                />
              </Field>
            </div>
          </Section>

          <Section title="Purchase and warranty">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Purchased" htmlFor="device-purchased" optional>
                <DatePicker
                  id="device-purchased"
                  value={form.purchasedAt}
                  onChange={(value) => set("purchasedAt", value)}
                  placeholder="Purchase date"
                />
              </Field>
              <Field label="Warranty ends" htmlFor="device-warranty" optional>
                <DatePicker
                  id="device-warranty"
                  value={form.warrantyExpiresAt}
                  onChange={(value) => set("warrantyExpiresAt", value)}
                  placeholder="Warranty end"
                  endMonth={new Date(new Date().getFullYear() + 10, 11)}
                />
              </Field>
            </div>
            <div className="grid gap-4 sm:grid-cols-[1fr_9rem]">
              <Field label="Cost" htmlFor="device-cost" optional>
                <Input
                  id="device-cost"
                  inputMode="decimal"
                  value={form.purchaseCost}
                  onChange={(event) => set("purchaseCost", event.target.value)}
                  placeholder="0.00"
                  className="tabular-nums"
                />
              </Field>
              <Field label="Currency" htmlFor="device-currency">
                <CurrencySelect
                  id="device-currency"
                  value={form.purchaseCurrency}
                  onValueChange={(value) => set("purchaseCurrency", value)}
                />
              </Field>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Supplier" htmlFor="device-supplier" optional>
                <Input
                  id="device-supplier"
                  list="device-suppliers"
                  value={form.supplier}
                  onChange={(event) => set("supplier", event.target.value)}
                  placeholder="iStore Accra"
                />
                <Suggestions id="device-suppliers" values={options.suppliers} />
              </Field>
              <Field label="Invoice or order no." htmlFor="device-order" optional>
                <Input
                  id="device-order"
                  value={form.orderNumber}
                  onChange={(event) => set("orderNumber", event.target.value)}
                  className="font-mono text-sm"
                />
              </Field>
            </div>
            <Field label="Paid by" htmlFor="device-entity" optional>
              <OptionSelect
                id="device-entity"
                value={form.legalEntityId}
                onValueChange={(value) => set("legalEntityId", value)}
                items={[
                  { value: NO_ENTITY, label: "Not recorded" },
                  ...options.legalEntities.map((entity) => ({
                    value: entity.id,
                    label: entity.name,
                  })),
                ]}
              />
            </Field>
          </Section>

          <Section title="Notes">
            <Textarea
              id="device-notes"
              aria-label="Notes"
              value={form.notes}
              onChange={(event) => set("notes", event.target.value)}
              placeholder="Anything worth knowing about this device"
              rows={3}
            />
          </Section>
        </div>

        <SheetFooter>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <Button
            onClick={handleSave}
            disabled={pending || !form.name.trim() || !form.categoryId}
            className="gap-2"
          >
            {pending ? <Spinner /> : null}
            {device ? "Save changes" : "Save device"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
