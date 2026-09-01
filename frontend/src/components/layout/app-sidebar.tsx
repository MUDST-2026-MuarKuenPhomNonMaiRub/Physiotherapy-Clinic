"use client";

import { LogOut } from "lucide-react";
import { useSession } from "@/lib/auth/use-session";
import { roleLabels } from "@/lib/permissions";
import { NavContent } from "@/components/layout/nav-content";
import { ClinicLogo } from "@/components/layout/clinic-logo";

export function ClinicBrand() {
  return (
    <div className="flex h-[72px] items-center gap-3 border-b border-sidebar-border px-5">
      <ClinicLogo className="h-9 w-9 shrink-0 text-white" />
      <div className="leading-none">
        <p className="font-heading text-[15px] font-bold tracking-[0.14em] text-white">
          LA BALANCE
        </p>
        <p className="mt-1 text-[9px] font-medium uppercase tracking-[0.16em] text-white/55">
          Physical Therapy Clinic
        </p>
      </div>
    </div>
  );
}

export function SidebarUserFooter() {
  const { user, logout } = useSession();
  if (!user) return null;
  return (
    <div className="border-t border-sidebar-border px-4 py-3.5">
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/10 text-white">
          <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.6">
            <circle cx="12" cy="12" r="9.5" />
            <circle cx="12" cy="10" r="3" />
            <path d="M5.6 19.2a7 7 0 0 1 12.8 0" strokeLinecap="round" />
          </svg>
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-semibold text-white">{roleLabels[user.role]}</p>
          <p className="truncate text-[11px] text-white/55">{user.displayName}</p>
        </div>
        <button
          type="button"
          onClick={logout}
          className="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-lg text-white/70 transition-colors hover:bg-sidebar-accent hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sidebar-ring"
          title="Log out"
          aria-label="Log out"
        >
          <LogOut className="h-4.5 w-4.5" />
        </button>
      </div>
    </div>
  );
}

export function AppSidebar() {
  const { user } = useSession();
  if (!user) return null;

  return (
    <aside className="hidden w-[268px] shrink-0 flex-col bg-sidebar text-sidebar-foreground lg:flex">
      <ClinicBrand />
      <NavContent role={user.role} />
      <SidebarUserFooter />
    </aside>
  );
}
