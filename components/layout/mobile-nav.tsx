"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { useResetOnChange } from "@/lib/hooks/use-reset-on-change";
import type { ProfileWithOrg } from "@/lib/types/database";

interface MobileNavProps {
  profile: ProfileWithOrg;
}

export function MobileNav({ profile }: MobileNavProps) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  // Close the drawer after navigating.
  useResetOnChange([pathname], () => setOpen(false));

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        render={
          <Button variant="ghost" size="icon" className="md:hidden" />
        }
      >
        <Menu className="size-5" />
        <span className="sr-only">Open navigation</span>
      </SheetTrigger>
      <SheetContent
        side="left"
        className="w-[min(100vw,280px)] max-w-[280px] gap-0 overflow-hidden p-0 sm:max-w-[280px]"
      >
        <SheetHeader className="sr-only">
          <SheetTitle>Navigation</SheetTitle>
        </SheetHeader>
        <AppSidebar profile={profile} variant="drawer" />
      </SheetContent>
    </Sheet>
  );
}
