import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { PettyCashSubnav } from "@/components/petty-cash/subnav";
import { getCurrentProfile } from "@/lib/auth/get-profile";
import {
  canAccessPettyCash,
  canManagePettyCash,
} from "@/lib/auth/permissions";

export default async function PettyCashLayout({
  children,
}: {
  children: ReactNode;
}) {
  const profile = await getCurrentProfile();
  if (!profile || !canAccessPettyCash(profile)) {
    redirect("/dashboard");
  }

  return (
    <div className="flex w-full min-w-0 flex-col gap-5">
      <PettyCashSubnav canManage={canManagePettyCash(profile)} />
      {children}
    </div>
  );
}
