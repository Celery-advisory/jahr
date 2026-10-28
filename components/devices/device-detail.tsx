"use client";

import { useRef, useState, type ComponentType, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  FileText,
  History,
  ImageIcon,
  Info,
  Paperclip,
  Receipt,
  Trash2,
  Upload,
  UserRound,
} from "lucide-react";
import { DeviceActions } from "@/components/devices/device-actions";
import {
  AssetTag,
  ConditionText,
  OptionSelect,
  StatusBadge,
  WarrantyText,
  deviceSubtitle,
} from "@/components/devices/device-ui";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { UserAvatar } from "@/components/ui/user-avatar";
import {
  addDeviceNote,
  deleteDeviceFile,
  uploadDeviceFile,
} from "@/lib/devices/actions";
import {
  DEVICE_CONDITION_LABELS,
  DEVICE_FILE_LABELS,
  DEVICE_TEMPLATES,
  formatDeviceDate,
  type DeviceAssignee,
  type DeviceDetail as DeviceDetailRecord,
  type DeviceFileLabel,
  type DeviceFormOptions,
} from "@/lib/devices/types";
import { formatMoney } from "@/lib/payroll/totals";
import { displayName } from "@/lib/types/database";
import { useAsyncAction } from "@/lib/hooks/use-async-action";

function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function Panel({
  title,
  icon: Icon,
  action,
  children,
}: {
  title: string;
  icon: ComponentType<{ className?: string }>;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="rounded-xl border border-border bg-card">
      <div className="flex items-center gap-2.5 border-b border-border px-5 py-3.5">
        <div className="flex size-7 shrink-0 items-center justify-center rounded-md bg-[color-mix(in_srgb,#0070F3_8%,white)] text-[#0070F3]">
          <Icon className="size-3.5" />
        </div>
        <h2 className="flex-1 text-sm font-medium">{title}</h2>
        {action}
      </div>
      <div className="p-5">{children}</div>
    </section>
  );
}

function Facts({ items }: { items: [string, ReactNode][] }) {
  return (
    <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
      {items.map(([label, value]) => (
        <div key={label} className="min-w-0 space-y-0.5">
          <dt className="text-xs text-muted-foreground">{label}</dt>
          <dd className="text-sm break-words">
            {value === null || value === undefined || value === "" ? (
              <span className="text-muted-foreground">-</span>
            ) : (
              value
            )}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function Person({ person }: { person: DeviceAssignee }) {
  return (
    <div className="flex min-w-0 items-center gap-2.5">
      <UserAvatar
        name={displayName(person)}
        src={person.avatar_url}
        gender={person.gender}
        size="sm"
      />
      <div className="min-w-0">
        <Link
          href={`/admin/employees/${person.id}`}
          className="block truncate text-sm font-medium hover:underline"
        >
          {displayName(person)}
        </Link>
        <p className="truncate text-xs text-muted-foreground">
          {person.status === "terminated" ? (
            <span className="text-destructive">Left the company</span>
          ) : (
            person.job_title ?? person.email
          )}
        </p>
      </div>
    </div>
  );
}

function FilesPanel({ device }: { device: DeviceDetailRecord }) {
  const router = useRouter();
  const { pending, run } = useAsyncAction();
  const fileRef = useRef<HTMLInputElement>(null);
  const [label, setLabel] = useState<DeviceFileLabel>("invoice");
  const [error, setError] = useState<string | null>(null);

  function upload(file: File) {
    setError(null);
    void run(async () => {
      const formData = new FormData();
      formData.set("deviceId", device.id);
      formData.set("label", label);
      formData.set("file", file);
      const result = await uploadDeviceFile(formData);
      if (fileRef.current) fileRef.current.value = "";
      if (result.error) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  function remove(fileId: string) {
    setError(null);
    void run(async () => {
      const result = await deleteDeviceFile(fileId);
      if (result.error) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <Panel title="Files" icon={Paperclip}>
      <div className="space-y-4">
        <div className="flex gap-2">
          <OptionSelect
            value={label}
            onValueChange={(value) => setLabel(value as DeviceFileLabel)}
            ariaLabel="File type"
            className="flex-1"
            items={Object.entries(DEVICE_FILE_LABELS).map(([value, text]) => ({
              value,
              label: text,
            }))}
          />
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,application/pdf"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) upload(file);
            }}
          />
          <Button
            variant="outline"
            className="gap-1.5"
            disabled={pending}
            onClick={() => fileRef.current?.click()}
          >
            {pending ? <Spinner /> : <Upload className="size-4" />}
            Upload
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Invoices, photos, warranty cards or wipe certificates. JPG, PNG, WebP or PDF up to 10 MB.
        </p>
        {error ? <p className="text-sm text-destructive">{error}</p> : null}

        {device.files.length === 0 ? (
          <p className="text-sm text-muted-foreground">No files yet.</p>
        ) : (
          <ul className="divide-y divide-border rounded-lg border border-border">
            {device.files.map((file) => {
              const Icon =
                file.label === "photo" || file.file_type.startsWith("image/")
                  ? ImageIcon
                  : file.label === "invoice"
                    ? Receipt
                    : FileText;
              return (
                <li key={file.id} className="flex items-center gap-2.5 px-3 py-2">
                  <Icon className="size-4 shrink-0 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <a
                      href={`/api/devices/files/${file.id}`}
                      target="_blank"
                      rel="noreferrer"
                      className="block truncate text-sm hover:underline"
                    >
                      {file.file_name}
                    </a>
                    <p className="text-xs text-muted-foreground">
                      {DEVICE_FILE_LABELS[file.label]} · {formatBytes(file.file_size)} ·{" "}
                      {formatDeviceDate(file.created_at)}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Delete ${file.file_name}`}
                    disabled={pending}
                    onClick={() => remove(file.id)}
                  >
                    <Trash2 />
                  </Button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </Panel>
  );
}

function ActivityPanel({ device }: { device: DeviceDetailRecord }) {
  const router = useRouter();
  const { pending, run } = useAsyncAction();
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  function save() {
    setError(null);
    void run(async () => {
      const result = await addDeviceNote({ deviceId: device.id, note });
      if (result.error) {
        setError(result.error);
        return;
      }
      setNote("");
      router.refresh();
    });
  }

  return (
    <Panel title="Activity" icon={History}>
      <div className="space-y-5">
        <div className="space-y-2">
          <Textarea
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="Add a note: repair update, spot check, damage report…"
            aria-label="Add a note"
            rows={2}
          />
          <div className="flex items-center justify-between gap-3">
            {error ? <p className="text-sm text-destructive">{error}</p> : <span />}
            <Button size="sm" disabled={pending || !note.trim()} onClick={save} className="gap-1.5">
              {pending ? <Spinner /> : null}
              Add note
            </Button>
          </div>
        </div>

        {device.events.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Changes made from now on will appear here.
          </p>
        ) : (
          <ol className="relative space-y-4 border-l border-border pl-5">
            {device.events.map((event) => (
              <li key={event.id} className="relative">
                <span className="absolute top-1.5 -left-[23.5px] size-2 rounded-full bg-[#0070F3] ring-4 ring-card" />
                <p className="text-sm font-medium">{event.summary}</p>
                {event.details ? (
                  <p className="text-sm whitespace-pre-line text-muted-foreground">
                    {event.details}
                  </p>
                ) : null}
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {formatWhen(event.created_at)}
                  {event.actor_name ? ` · ${event.actor_name}` : ""}
                </p>
              </li>
            ))}
          </ol>
        )}
      </div>
    </Panel>
  );
}

export function DeviceDetail({
  device,
  employees,
  options,
}: {
  device: DeviceDetailRecord;
  employees: DeviceAssignee[];
  options: DeviceFormOptions;
}) {
  const holder = device.current_assignment?.employee ?? null;
  const template = DEVICE_TEMPLATES[device.category.template];
  const specs = template.specs
    .filter((spec) => device.specs[spec.key])
    .map((spec): [string, ReactNode] => [
      spec.label,
      <span key={spec.key} className={spec.mono ? "font-mono text-[13px]" : undefined}>
        {device.specs[spec.key]}
      </span>,
    ]);

  return (
    <div className="flex w-full flex-col gap-5">
      <Link
        href="/admin/devices"
        className="inline-flex w-fit items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-3.5" />
        All devices
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <AssetTag tag={device.asset_tag} className="text-sm" />
            <StatusBadge status={device.status} />
          </div>
          <h1 className="text-xl font-medium tracking-tight">{device.name}</h1>
          <p className="text-sm text-muted-foreground">{deviceSubtitle(device)}</p>
        </div>
        <DeviceActions
          device={device}
          employees={employees}
          options={options}
          showView={false}
        />
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="flex min-w-0 flex-col gap-5">
          <Panel title="Details" icon={Info}>
            <Facts
              items={[
                ["Category", device.category.name],
                [
                  "Serial number",
                  device.serial_number ? (
                    <span className="font-mono text-[13px]">{device.serial_number}</span>
                  ) : null,
                ],
                ["Manufacturer", device.manufacturer],
                ["Model", device.model],
                ["Colour", device.color],
                ...specs,
                ["Location", device.location],
                ["Condition", <ConditionText key="condition" condition={device.condition} />],
              ]}
            />
            {device.notes ? (
              <p className="mt-4 rounded-md bg-secondary/60 px-3 py-2 text-sm whitespace-pre-line">
                {device.notes}
              </p>
            ) : null}
          </Panel>

          <Panel title="Purchase and warranty" icon={Receipt}>
            <Facts
              items={[
                ["Purchased", device.purchased_at ? formatDeviceDate(device.purchased_at) : null],
                [
                  "Cost",
                  device.purchase_cost !== null
                    ? formatMoney(device.purchase_cost, device.purchase_currency ?? "GHS")
                    : null,
                ],
                ["Supplier", device.supplier],
                ["Invoice or order no.", device.order_number],
                ["Paid by", device.legal_entity?.name],
                [
                  "Warranty ends",
                  device.warranty_expires_at ? (
                    <WarrantyText key="warranty" expiresAt={device.warranty_expires_at} />
                  ) : null,
                ],
              ]}
            />
          </Panel>

          <ActivityPanel device={device} />
        </div>

        <div className="flex min-w-0 flex-col gap-5">
          <Panel title="Current holder" icon={UserRound}>
            {holder && device.current_assignment ? (
              <div className="space-y-3">
                <Person person={holder} />
                <p className="text-xs text-muted-foreground">
                  Since {formatDeviceDate(device.current_assignment.assigned_at)}
                  {device.current_assignment.assigned_by_name
                    ? ` · issued by ${device.current_assignment.assigned_by_name}`
                    : ""}
                </p>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                {device.status === "retired" ? "Retired." : "Not assigned to anyone."}
              </p>
            )}
          </Panel>

          <Panel title="Holder history" icon={History}>
            {device.history.length === 0 ? (
              <p className="text-sm text-muted-foreground">Never assigned.</p>
            ) : (
              <ol className="space-y-4">
                {device.history.map((item) => (
                  <li key={item.id} className="space-y-1.5">
                    {item.employee ? (
                      <Person person={item.employee} />
                    ) : (
                      <p className="text-sm text-muted-foreground">Unknown employee</p>
                    )}
                    <p className="text-xs text-muted-foreground">
                      {formatDeviceDate(item.assigned_at)} –{" "}
                      {item.returned_at ? formatDeviceDate(item.returned_at) : "now"}
                      {!item.returned_at && item.condition_out
                        ? ` · issued in ${DEVICE_CONDITION_LABELS[item.condition_out].toLowerCase()} condition`
                        : item.condition_out || item.condition_in
                          ? ` · ${item.condition_out ? DEVICE_CONDITION_LABELS[item.condition_out] : "Unknown"} → ${item.condition_in ? DEVICE_CONDITION_LABELS[item.condition_in] : "Unknown"}`
                          : ""}
                    </p>
                    {item.notes ? (
                      <p className="text-xs whitespace-pre-line text-muted-foreground">
                        {item.notes}
                      </p>
                    ) : null}
                  </li>
                ))}
              </ol>
            )}
          </Panel>

          <FilesPanel device={device} />
        </div>
      </div>
    </div>
  );
}
