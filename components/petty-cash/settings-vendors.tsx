"use client";

import { useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import {
  ConfirmDialog,
  RowMenu,
  SettingsSection,
  formatSettingsDate,
  transactionCountLabel,
} from "@/components/petty-cash/confirm-dialog";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import {
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useAsyncAction } from "@/lib/hooks/use-async-action";
import { saveVendor, setVendorActive } from "@/lib/petty-cash/actions";
import { formatPettyCashMoney, roundMoney } from "@/lib/petty-cash/money";
import type { LedgerRow, PettyCashBundle, PettyCashVendor } from "@/lib/petty-cash/types";

type VendorSheet =
  | { mode: "create" }
  | { mode: "detail"; vendor: PettyCashVendor }
  | { mode: "edit"; vendor: PettyCashVendor };

const VENDOR_DEACTIVATE =
  "Existing transactions using this vendor will remain unchanged. The vendor will no longer be available for new transactions.";

export function SettingsVendors({ bundle }: { bundle: PettyCashBundle }) {
  const router = useRouter();
  const { pending, run } = useAsyncAction();
  const [query, setQuery] = useState("");
  const [sheet, setSheet] = useState<VendorSheet | null>(null);
  const [confirm, setConfirm] = useState<PettyCashVendor | null>(null);
  const [deferredSave, setDeferredSave] = useState<(() => void) | null>(null);
  const activity = useMemo(
    () => vendorActivity(bundle.transactions, bundle.settings.defaultCurrency),
    [bundle.transactions, bundle.settings.defaultCurrency],
  );
  const vendors = bundle.vendors.filter((vendor) =>
    vendor.name.toLowerCase().includes(query.trim().toLowerCase()),
  );
  const selected = sheet && sheet.mode !== "create" ? sheet.vendor : null;
  const selectedActivity = selected
    ? activity.get(selected.id)
    : undefined;

  function refresh(message: string) {
    toast.success(message);
    setConfirm(null);
    setSheet(null);
    router.refresh();
  }

  function toggleActive(vendor: PettyCashVendor) {
    if (vendor.isActive) {
      setConfirm(vendor);
      return;
    }
    void run(async () => {
      const result = await setVendorActive(activeForm(vendor.id, true));
      if (result.error) {
        toast.error(result.error);
        return;
      }
      refresh("Vendor activated");
    });
  }

  return (
    <SettingsSection
      title="Vendors"
      description="Manage vendors."
      action={
        bundle.vendors.length === 0 ? undefined : (
          <Button type="button" onClick={() => setSheet({ mode: "create" })}>
            <Plus />
            Add vendor
          </Button>
        )
      }
    >
      {bundle.vendors.length === 0 ? (
        <EmptyState
          kind="cash"
          surface
          title="Add a vendor"
          description="Save payees you use more than once."
          action={
            <Button type="button" onClick={() => setSheet({ mode: "create" })}>
              <Plus />
              Add vendor
            </Button>
          }
        />
      ) : (
      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <div className="border-b border-border p-4">
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search vendors"
            aria-label="Search vendors"
          />
        </div>
        {vendors.length === 0 ? (
          <EmptyState
            kind="search"
            size="compact"
            title="Try another name"
            action={
              <Button type="button" variant="outline" onClick={() => setQuery("")}>
                Clear search
              </Button>
            }
          />
        ) : (
          <div>
            <div className="hidden grid-cols-[minmax(0,1.4fr)_0.8fr_1.1fr_1fr_0.7fr_2.5rem] gap-3 border-b border-border px-4 py-2 text-xs text-muted-foreground md:grid">
              <span>Vendor</span>
              <span>Transactions</span>
              <span>Total spend</span>
              <span>Last used</span>
              <span>Status</span>
              <span className="sr-only">Actions</span>
            </div>
            <ul>
              {vendors.map((vendor) => {
                const stats = activity.get(vendor.id);
                return (
                  <li key={vendor.id} className="border-b border-border last:border-0">
                    <div className="flex items-start gap-3 px-4 py-3 md:hidden">
                      <button
                        type="button"
                        className="min-w-0 flex-1 text-left"
                        onClick={() => setSheet({ mode: "detail", vendor })}
                      >
                        <p className="truncate text-sm font-medium">{vendor.name}</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {transactionCountLabel(stats?.count ?? 0)}
                          {" · "}
                          {stats?.spendLabel ?? formatPettyCashMoney(0, bundle.settings.defaultCurrency)}
                          {" · "}
                          {stats?.lastUsed ?? "None"}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {vendor.isActive ? "Active" : "Inactive"}
                        </p>
                      </button>
                      <VendorMenu
                        vendor={vendor}
                        onEdit={() => setSheet({ mode: "edit", vendor })}
                        onToggle={() => toggleActive(vendor)}
                      />
                    </div>
                    <div className="hidden grid-cols-[minmax(0,1.4fr)_0.8fr_1.1fr_1fr_0.7fr_2.5rem] items-center gap-3 px-4 py-3 md:grid">
                      <button
                        type="button"
                        className="truncate text-left text-sm font-medium"
                        onClick={() => setSheet({ mode: "detail", vendor })}
                      >
                        {vendor.name}
                      </button>
                      <span className="text-sm tabular-nums">{stats?.count ?? 0}</span>
                      <span className="truncate text-sm tabular-nums">
                        {stats?.spendLabel ??
                          formatPettyCashMoney(0, bundle.settings.defaultCurrency)}
                      </span>
                      <span className="text-sm">{stats?.lastUsed ?? "None"}</span>
                      <span className="text-xs text-muted-foreground">
                        {vendor.isActive ? "Active" : "Inactive"}
                      </span>
                      <VendorMenu
                        vendor={vendor}
                        onEdit={() => setSheet({ mode: "edit", vendor })}
                        onToggle={() => toggleActive(vendor)}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </div>
      )}

      <VendorDetailSheet
        vendor={sheet?.mode === "detail" ? sheet.vendor : null}
        activity={selectedActivity}
        currency={bundle.settings.defaultCurrency}
        onOpenChange={(open) => {
          if (!open) setSheet(null);
        }}
        onEdit={() => {
          if (sheet?.mode === "detail") setSheet({ mode: "edit", vendor: sheet.vendor });
        }}
      />

      <VendorFormSheet
        sheet={sheet?.mode === "detail" ? null : sheet}
        pending={pending}
        onOpenChange={(open) => {
          if (!open && !pending) setSheet(null);
        }}
        onSave={(formData, deactivating) => {
          const persist = () => {
            void run(async () => {
              const result = await saveVendor(formData);
              if (result.error) {
                toast.error(result.error);
                return;
              }
              setDeferredSave(null);
              refresh(formData.get("id") ? "Vendor updated" : "Vendor added");
            });
          };
          if (!deactivating || sheet?.mode !== "edit") {
            persist();
            return;
          }
          setDeferredSave(() => persist);
          setConfirm(sheet.vendor);
        }}
      />

      <ConfirmDialog
        open={confirm !== null}
        title="Deactivate vendor?"
        description={VENDOR_DEACTIVATE}
        confirmLabel="Deactivate"
        destructive
        pending={pending}
        onOpenChange={(open) => {
          if (!open && !pending) {
            setConfirm(null);
            setDeferredSave(null);
          }
        }}
        onConfirm={() => {
          if (deferredSave) {
            deferredSave();
            return;
          }
          if (!confirm) return;
          void run(async () => {
            const result = await setVendorActive(activeForm(confirm.id, false));
            if (result.error) {
              toast.error(result.error);
              return;
            }
            refresh("Vendor deactivated");
          });
        }}
      />
    </SettingsSection>
  );
}

function VendorDetailSheet({
  vendor,
  activity,
  currency,
  onOpenChange,
  onEdit,
}: {
  vendor: PettyCashVendor | null;
  activity: VendorActivity | undefined;
  currency: string;
  onOpenChange: (open: boolean) => void;
  onEdit: () => void;
}) {
  const stats = activity ?? emptyActivity(currency);
  return (
    <Sheet open={vendor !== null} onOpenChange={onOpenChange}>
      <SheetContent className="h-dvh w-full! max-w-none! overflow-y-auto overscroll-contain pb-[env(safe-area-inset-bottom)] sm:h-full sm:max-w-md!">
        {vendor ? (
          <>
            <SheetHeader className="pr-12">
              <SheetTitle>{vendor.name}</SheetTitle>
            </SheetHeader>
            <div className="flex flex-col gap-6 px-4 pb-6">
              <p className="text-xs text-muted-foreground">
                {vendor.isActive ? "Active" : "Inactive"}
              </p>
              <dl>
                <DetailRow label="Transactions" value={transactionCountLabel(stats.count)} />
                <DetailRow label="Total spend" value={stats.spendLabel} />
                <DetailRow label="Last transaction" value={stats.lastUsed} />
                <DetailRow
                  label="Categories"
                  value={stats.categories.length > 0 ? stats.categories.join(", ") : "None"}
                />
                {vendor.phone ? <DetailRow label="Phone" value={vendor.phone} /> : null}
                {vendor.email ? <DetailRow label="Email" value={vendor.email} /> : null}
                {vendor.notes ? <DetailRow label="Notes" value={vendor.notes} /> : null}
              </dl>
              <div className="flex sm:justify-end">
                <Button type="button" className="w-full sm:w-auto" onClick={onEdit}>
                  Edit vendor
                </Button>
              </div>
            </div>
          </>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}

function VendorFormSheet({
  sheet,
  pending,
  onOpenChange,
  onSave,
}: {
  sheet: VendorSheet | null;
  pending: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (formData: FormData, deactivating: boolean) => void;
}) {
  const editing = sheet?.mode === "edit" ? sheet.vendor : null;
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [notes, setNotes] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [seed, setSeed] = useState<string | null>(null);
  const seedKey = sheet?.mode === "edit" ? sheet.vendor.id : sheet?.mode ?? null;

  if (seedKey !== seed) {
    setSeed(seedKey);
    setName(editing?.name ?? "");
    setPhone(editing?.phone ?? "");
    setEmail(editing?.email ?? "");
    setNotes(editing?.notes ?? "");
    setIsActive(editing?.isActive ?? true);
  }

  function save() {
    if (!sheet || sheet.mode === "detail") return;
    const formData = new FormData();
    if (editing) formData.set("id", editing.id);
    formData.set("name", name);
    formData.set("phone", phone);
    formData.set("email", email);
    formData.set("notes", notes);
    formData.set("isActive", String(isActive));
    onSave(formData, Boolean(editing?.isActive && !isActive));
  }

  return (
    <Sheet open={sheet !== null && sheet.mode !== "detail"} onOpenChange={onOpenChange}>
      <SheetContent className="h-dvh w-full! max-w-none! overflow-y-auto overscroll-contain pb-[env(safe-area-inset-bottom)] sm:h-full sm:max-w-md!">
        <SheetHeader className="pr-12">
          <SheetTitle>{editing ? "Edit vendor" : "Add vendor"}</SheetTitle>
        </SheetHeader>
        <div className="flex flex-col gap-4 px-4 pb-6">
          <Field label="Name">
            <Input value={name} onChange={(event) => setName(event.target.value)} />
          </Field>
          <Field label="Phone">
            <Input value={phone} onChange={(event) => setPhone(event.target.value)} />
          </Field>
          <Field label="Email">
            <Input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </Field>
          <Field label="Notes">
            <Textarea
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              className="rounded-md px-3"
            />
          </Field>
          {editing ? (
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-medium">Status</p>
                <p className="text-sm text-muted-foreground">
                  {isActive ? "Active" : "Inactive"}
                </p>
              </div>
              <Switch checked={isActive} onCheckedChange={setIsActive} />
            </div>
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
            <Button type="button" onClick={save} disabled={pending}>
              {pending ? <Spinner /> : null}
              {editing ? "Save changes" : "Add vendor"}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function VendorMenu({
  vendor,
  onEdit,
  onToggle,
}: {
  vendor: PettyCashVendor;
  onEdit: () => void;
  onToggle: () => void;
}) {
  return (
    <RowMenu label={`Actions for ${vendor.name}`}>
      <DropdownMenuItem onClick={onEdit}>Edit</DropdownMenuItem>
      <DropdownMenuSeparator />
      <DropdownMenuItem
        variant={vendor.isActive ? "destructive" : "default"}
        onClick={onToggle}
      >
        {vendor.isActive ? "Deactivate" : "Activate"}
      </DropdownMenuItem>
    </RowMenu>
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

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-border py-3 last:border-0">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="max-w-[60%] text-right text-sm font-medium break-words">{value}</dd>
    </div>
  );
}

interface VendorActivity {
  count: number;
  spendLabel: string;
  lastUsed: string;
  categories: string[];
}

function emptyActivity(currency: string): VendorActivity {
  return {
    count: 0,
    spendLabel: formatPettyCashMoney(0, currency),
    lastUsed: "None",
    categories: [],
  };
}

function vendorActivity(transactions: LedgerRow[], currency: string) {
  const rows = new Map<string, LedgerRow[]>();
  for (const row of transactions) {
    if (!row.vendorId || row.status === "voided") continue;
    const list = rows.get(row.vendorId) ?? [];
    list.push(row);
    rows.set(row.vendorId, list);
  }

  const activity = new Map<string, VendorActivity>();
  for (const [vendorId, list] of rows) {
    const postedOut = list.filter((row) => row.status === "posted" && row.direction === "out");
    const currencies = [...new Set(postedOut.map((row) => row.currency))];
    const spendLabel =
      currencies.length > 1
        ? "Multiple currencies"
        : formatPettyCashMoney(
            roundMoney(postedOut.reduce((sum, row) => sum + row.amount, 0)),
            currencies[0] ?? currency,
          );
    const last = list.reduce<string | null>((latest, row) => {
      if (!latest || row.transactionDate > latest) return row.transactionDate;
      return latest;
    }, null);
    const categories = [
      ...new Set(list.flatMap((row) => (row.categoryName ? [row.categoryName] : []))),
    ].sort((a, b) => a.localeCompare(b));
    activity.set(vendorId, {
      count: list.length,
      spendLabel,
      lastUsed: last ? formatSettingsDate(last) : "None",
      categories,
    });
  }
  return activity;
}

function activeForm(id: string, isActive: boolean): FormData {
  const formData = new FormData();
  formData.set("id", id);
  formData.set("isActive", String(isActive));
  return formData;
}
