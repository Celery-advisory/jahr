import { redirect } from "next/navigation";
import { ApprovalsList } from "@/components/leave/approvals-list";
import { getCurrentProfile } from "@/lib/auth/get-profile";
import { getApprovalsWorkspace } from "@/lib/leave/get-approvals";
import { canApproveLeave, isOrgAdmin } from "@/lib/types/database";

export default async function ApprovalsPage() {
  const profile = await getCurrentProfile();
  if (!profile || !canApproveLeave(profile)) {
    redirect("/dashboard");
  }

  const workspace = await getApprovalsWorkspace(profile);
  const orgWideView = isOrgAdmin(profile);

  return (
    <div className="flex w-full flex-col gap-5">
      <div className="space-y-1">
        <h1 className="text-xl font-medium tracking-tight">
          Leave applications
        </h1>
        <p className="text-sm text-muted-foreground">
          {orgWideView
            ? "Decide requests waiting on you. Other open requests stay listed with their manager. Working time is counted on 9–5 days (weekends and Ghana public holidays excluded)."
            : "Approve or decline leave for people who report to you. Working time is counted on 9–5 days (weekends and Ghana public holidays excluded)."}
        </p>
      </div>

      <ApprovalsList
        open={workspace.open}
        closed={workspace.closed}
        teamBalances={workspace.teamBalances}
        logs={workspace.logs}
        orgWideView={orgWideView}
      />
    </div>
  );
}
