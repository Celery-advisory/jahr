"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { useAsyncAction } from "@/lib/hooks/use-async-action";
import {
  approveTransaction,
  deleteDraftTransaction,
  rejectTransaction,
  voidTransaction,
} from "@/lib/petty-cash/actions";
import type { TransactionStatus } from "@/lib/petty-cash/money";

export function TransactionActions({
  transactionId,
  status,
  createdByViewer,
  canManage,
}: {
  transactionId: string;
  status: TransactionStatus;
  createdByViewer: boolean;
  canManage: boolean;
}) {
  const router = useRouter();
  const { pending, run } = useAsyncAction();
  const [rejectOpen, setRejectOpen] = useState(false);
  const [voidOpen, setVoidOpen] = useState(false);
  const [reason, setReason] = useState("");

  function approve() {
    void run(async () => {
      const result = await approveTransaction(transactionId);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Transaction posted");
      router.refresh();
    });
  }

  function reject() {
    void run(async () => {
      const formData = new FormData();
      formData.set("id", transactionId);
      formData.set("reason", reason);
      const result = await rejectTransaction(formData);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Transaction rejected");
      setRejectOpen(false);
      router.refresh();
    });
  }

  function voidPosted() {
    void run(async () => {
      const formData = new FormData();
      formData.set("id", transactionId);
      formData.set("reason", reason);
      const result = await voidTransaction(formData);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Transaction voided");
      setVoidOpen(false);
      router.refresh();
    });
  }

  function removeDraft() {
    void run(async () => {
      const result = await deleteDraftTransaction(transactionId);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Draft deleted");
      router.push("/operations/petty-cash/transactions");
    });
  }

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
      {status === "pending_approval" && !createdByViewer ? (
        <>
          <Button type="button" className="w-full sm:w-auto" onClick={approve} disabled={pending}>
            {pending ? <Spinner /> : null}
            Approve
          </Button>
          <Button
            type="button"
            variant="outline"
            className="w-full sm:w-auto"
            onClick={() => {
              setReason("");
              setRejectOpen(true);
            }}
            disabled={pending}
          >
            Reject
          </Button>
        </>
      ) : null}
      {status === "posted" && canManage ? (
        <Button
          type="button"
          variant="outline"
          className="w-full sm:w-auto"
          onClick={() => {
            setReason("");
            setVoidOpen(true);
          }}
          disabled={pending}
        >
          Void
        </Button>
      ) : null}
      {status === "draft" && createdByViewer ? (
        <Button
          type="button"
          variant="outline"
          className="w-full sm:w-auto"
          onClick={removeDraft}
          disabled={pending}
        >
          {pending ? <Spinner /> : null}
          Delete draft
        </Button>
      ) : null}

      <ReasonDialog
        open={rejectOpen}
        title="Reject transaction"
        description="The requester can edit and submit it again."
        pending={pending}
        reason={reason}
        onReason={setReason}
        onOpenChange={setRejectOpen}
        onConfirm={reject}
        confirmLabel="Reject"
      />
      <ReasonDialog
        open={voidOpen}
        title="Void transaction"
        description="The posted amount will drop out of the balance. The record stays in the ledger."
        pending={pending}
        reason={reason}
        onReason={setReason}
        onOpenChange={setVoidOpen}
        onConfirm={voidPosted}
        confirmLabel="Void"
      />
    </div>
  );
}

function ReasonDialog({
  open,
  title,
  description,
  pending,
  reason,
  onReason,
  onOpenChange,
  onConfirm,
  confirmLabel,
}: {
  open: boolean;
  title: string;
  description: string;
  pending: boolean;
  reason: string;
  onReason: (value: string) => void;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  confirmLabel: string;
}) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <Input
          value={reason}
          onChange={(event) => onReason(event.target.value)}
          placeholder="Reason"
        />
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
          <AlertDialogAction disabled={pending || reason.trim().length === 0} onClick={onConfirm}>
            {pending ? <Spinner /> : null}
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
