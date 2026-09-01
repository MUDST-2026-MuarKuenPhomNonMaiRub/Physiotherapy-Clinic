"use client";

import { useState } from "react";
import { Menu } from "lucide-react";
import { useSession } from "@/lib/auth/use-session";
import { NavContent } from "@/components/layout/nav-content";
import { ClinicBrand, SidebarUserFooter } from "@/components/layout/app-sidebar";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

export function MobileSidebar() {
  const { user } = useSession();
  const [open, setOpen] = useState(false);
  if (!user) return null;

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <button className="flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground lg:hidden">
          <Menu className="h-5 w-5" />
        </button>
      </SheetTrigger>
      <SheetContent
        side="left"
        className="flex w-[268px] flex-col gap-0 border-sidebar-border bg-sidebar p-0 text-sidebar-foreground [&_svg]:shrink-0"
      >
        <SheetTitle className="sr-only">Navigation</SheetTitle>
        <ClinicBrand />
        <NavContent role={user.role} onNavigate={() => setOpen(false)} />
        <SidebarUserFooter />
      </SheetContent>
    </Sheet>
  );
}
