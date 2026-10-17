import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { StatusBadge } from "@/components/petty-cash/status-badge";
import { TransactionActions } from "@/components/petty-cash/transaction-actions";
import { EmptyState } from "@/components/ui/empty-state";
import { getCurrentProfile } from "@/lib/auth/get-profile";
import { canManagePettyCash } from "@/lib/auth/permissions";
import {
  TRANSACTION_TYPE_LABELS,
  directionLabel,
  formatPettyCashDate,
  reasonLabel,
} from "@/lib/petty-cash/labels";
import { getPettyCashBundle, getTransactionExtras } from "@/lib/petty-cash/queries";
import { formatPettyCashMoney } from "@/lib/petty-cash/money";

const ACTIVITY_LABEL: Record<string, string> = {
  created: "Created",
  edited: "Edited",
  submitted: "Submitted for approval",
  rejected: "Rejected",
  posted: "Posted to the ledger",
  voided: "Voided",
  receipt_uploaded: "Receipt uploaded",
};

export default async function PettyCashTransactionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/dashboard");

  const { id } = await params;
  const bundle = await getPettyCashBundle();
  const transaction = bundle.transactions.find((row) => row.id === id);
  if (!transaction) notFound();

  const { receipts, activity } = await getTransactionExtras(id);
  const canManage = canManagePettyCash(profile);

  return (
    <div className="flex flex-col gap-5">
      <div>
        <Link
          href="/operations/petty-cash/transactions"
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          Transactions
        </Link>
        <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between">
          <div className="min-w-0 space-y-1">
            <p className="text-xs text-muted-foreground">
              {transaction.transactionNumber}
            </p>
            <h1 className="text-xl font-medium tracking-tight break-words">
              {transaction.description}
            </h1>
            <p className="text-sm break-words tabular-nums">
              {directionLabel(transaction.direction)}{" "}
              {formatPettyCashMoney(transaction.amount, transaction.currency)}
            </p>
          </div>
          <StatusBadge status={transaction.status} />
        </div>
      </div>

      <TransactionActions
        transactionId={transaction.id}
        status={transaction.status}
        createdByViewer={transaction.createdBy === profile.id}
        canManage={canManage}
      />

      <section className="grid gap-4 rounded-xl border border-border bg-card p-4 sm:grid-cols-2 sm:p-6">
        <Detail label="Date" value={formatPettyCashDate(transaction.transactionDate)} />
        <Detail label="Fund" value={transaction.fundName} />
        <Detail
          label="Type"
          value={TRANSACTION_TYPE_LABELS[transaction.transactionType]}
        />
        <Detail label="Category" value={transaction.categoryName ?? "None"} />
        <Detail label="Vendor" value={transaction.vendorName ?? "None"} />
        <Detail label="Receipt number" value={transaction.receiptNumber ?? "None"} />
        <Detail label="Reference" value={transaction.reference ?? "None"} />
        <Detail label="Created by" value={transaction.createdByName} />
        <Detail label="Approved by" value={transaction.approvedByName ?? "None"} />
        {transaction.balance != null ? (
          <Detail
            label="Balance after posting"
            value={formatPettyCashMoney(transaction.balance, transaction.currency)}
          />
        ) : null}
        {transaction.rejectionReason ? (
          <Detail
            label="Rejection"
            value={reasonLabel(transaction.rejectionReason) || transaction.rejectionReason}
          />
        ) : null}
        {transaction.voidReason ? (
          <Detail label="Void reason" value={transaction.voidReason} />
        ) : null}
        {transaction.notes ? (
          <div className="sm:col-span-2">
            <Detail label="Notes" value={transaction.notes} />
          </div>
        ) : null}
      </section>

      <section className="rounded-xl border border-border bg-card p-4 sm:p-6">
        <h2 className="text-sm font-medium">Receipts</h2>
        {receipts.length === 0 ? (
          <EmptyState kind="documents" size="compact" title="Receipts show up here" />
        ) : (
          <ul className="mt-4 flex flex-col gap-4">
            {receipts.map((receipt) => (
              <li key={receipt.id} className="flex flex-col gap-2">
                {receipt.fileType.startsWith("image/") ? (
                  <img
                    src={`/api/petty-cash/receipts/${receipt.id}`}
                    alt={receipt.fileName}
                    className="max-h-80 max-w-full rounded-md border border-border object-contain"
                  />
                ) : null}
                <div className="flex flex-wrap gap-3 text-sm">
                  <a
                    href={`/api/petty-cash/receipts/${receipt.id}`}
                    className="text-[#0B4FBF] hover:underline"
                  >
                    View
                  </a>
                  <a
                    href={`/api/petty-cash/receipts/${receipt.id}?download=1`}
                    className="text-[#0B4FBF] hover:underline"
                  >
                    Download
                  </a>
                  <span className="min-w-0 text-muted-foreground break-all">{receipt.fileName}</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-xl border border-border bg-card p-4 sm:p-6">
        <h2 className="text-sm font-medium">Activity</h2>
        {activity.length === 0 ? (
          <EmptyState kind="inbox" size="compact" title="Changes show up here" />
        ) : (
          <ol className="mt-4 flex flex-col gap-3">
            {activity.map((entry) => (
              <li key={entry.id} className="text-sm">
                <p>
                  {ACTIVITY_LABEL[entry.action] ?? entry.action} by {entry.performedByName}
                </p>
                <p className="text-xs text-muted-foreground">
                  {formatWhen(entry.createdAt)}
                  {entry.detail ? `. ${entry.detail}` : ""}
                </p>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm break-words">{value}</p>
    </div>
  );
}

function formatWhen(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}
