import type { Metadata } from "next";
import { BrandLogo } from "@/components/brand/brand-logo";
import { OrganogramBoard } from "@/components/organogram/organogram-board";
import { getShareOrganogram } from "@/lib/employees/get-directory";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "JA Group organogram",
  description: "Reporting structure across JA Group.",
};

export default async function PublicOrganogramPage() {
  const roots = await getShareOrganogram();

  return (
    <div className="flex h-svh flex-col overflow-hidden bg-[#F5F7FB]">
      <header className="flex h-11 shrink-0 items-center justify-between border-b border-border bg-card px-4">
        <BrandLogo tone="black" priority className="h-6" />
        <h1 className="text-sm font-medium tracking-tight">Organogram</h1>
      </header>
      <OrganogramBoard roots={roots} />
    </div>
  );
}
