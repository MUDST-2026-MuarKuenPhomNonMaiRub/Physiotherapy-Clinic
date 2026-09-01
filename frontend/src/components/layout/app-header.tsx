"use client";

import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Bell, LogOut, RotateCcw, Search } from "lucide-react";
import { useSession } from "@/lib/auth/use-session";
import { useClinicStore } from "@/lib/store/clinic-store";
import { roleLabels } from "@/lib/permissions";
import { toast } from "sonner";
import { BranchSelector } from "@/components/layout/branch-selector";
import { MobileSidebar } from "@/components/layout/mobile-sidebar";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Breadcrumb, BreadcrumbItem, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "@/components/ui/breadcrumb";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";

const labelMap: Record<string, string> = {
  calendar: "Calendar",
  patients: "Patient",
  appointments: "Appointment & Visits",
  visits: "Visit",
  checkout: "Checkout",
  courses: "Patient Courses",
  transfer: "Courses Transfer",
  transactions: "Transactions",
  settings: "Administration",
  branches: "Branches",
  "staff-access": "Staff & Access",
  services: "Treatments & Course",
  "payment-methods": "Payment Methods",
  resources: "Rooms & Resources",
  commission: "Commission",
  "master-data": "Master Data",
  reports: "Reports",
  revenue: "Revenue",
  "course-balance": "Course Balance",
  "staff-sales": "Staff Sales",
  new: "New",
};

function humanize(segment: string): string {
  if (labelMap[segment]) return labelMap[segment];
  if (/^[a-z]{0,4}-?\d/.test(segment) || segment.length > 12) return "Detail";
  return segment.charAt(0).toUpperCase() + segment.slice(1).replace(/-/g, " ");
}

function initials(name: string) {
  const parts = name.trim().split(" ");
  return parts.length > 1 ? `${parts[0][0]}${parts[1][0]}` : name.slice(0, 2);
}

const notificationsByRole: Record<string, { id: number; title: string; detail: string; time: string }[]> = {
  PHYSIOTHERAPIST: [
    { id: 1, title: "Patient arrived", detail: "สมชาย ใจดี is waiting in Treatment Room 1", time: "5 min ago" },
    { id: 2, title: "Next appointment starting soon", detail: "10:45 Lower Back Pain Therapy with วิชัย ศรีสวัสดิ์", time: "20 min ago" },
    { id: 3, title: "Commission updated", detail: "This month's treatment commission was recalculated", time: "1 day ago" },
  ],
  ADMIN: [
    { id: 1, title: "Weekly revenue report ready", detail: "Sukhumvit branch revenue is up 12% week over week", time: "1 hr ago" },
    { id: 2, title: "Course transfer completed", detail: "3 sessions transferred between patients at Salaya", time: "3 hr ago" },
    { id: 3, title: "Transaction voided", detail: "INV-2026-000042 was voided — duplicate entry", time: "1 day ago" },
  ],
};

export function AppHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout, can } = useSession();
  const resetDemoData = useClinicStore((s) => s.resetDemoData);
  const [query, setQuery] = useState("");
  const [resetOpen, setResetOpen] = useState(false);

  if (!user) return null;
  const segments = pathname.split("/").filter(Boolean);
  const notifications = notificationsByRole[user.role] ?? [];

  const submitSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) router.push(`/patients?q=${encodeURIComponent(query.trim())}`);
  };

  return (
    <header className="flex h-16 shrink-0 items-center gap-3 border-b border-border bg-card px-4 lg:px-6">
      <MobileSidebar />
      <div className="min-w-0 flex-1">
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbPage className="text-muted-foreground">LA BALANCE</BreadcrumbPage>
            </BreadcrumbItem>
            {segments.map((seg, i) => (
              <span key={i} className="flex items-center gap-1.5">
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  <BreadcrumbPage className={i === segments.length - 1 ? "font-medium text-foreground" : "text-muted-foreground"}>
                    {humanize(seg)}
                  </BreadcrumbPage>
                </BreadcrumbItem>
              </span>
            ))}
          </BreadcrumbList>
        </Breadcrumb>
      </div>

      {can("patient.view") && (
        <form onSubmit={submitSearch} className="hidden w-64 shrink-0 items-center md:flex">
          <div className="relative w-full">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search HN, name, phone..."
              className="h-9 pl-8 text-sm"
            />
          </div>
        </form>
      )}

      <BranchSelector />

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="relative flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
            <Bell className="h-4.5 w-4.5" />
            {notifications.length > 0 && (
              <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-destructive" />
            )}
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-80">
          <DropdownMenuLabel>Notifications</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {notifications.map((n) => (
            <DropdownMenuItem key={n.id} className="flex flex-col items-start gap-0.5 whitespace-normal py-2">
              <p className="text-sm font-medium">{n.title}</p>
              <p className="text-xs text-muted-foreground">{n.detail}</p>
              <p className="text-[11px] text-muted-foreground/70">{n.time}</p>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="flex shrink-0 cursor-pointer items-center gap-2 rounded-lg border border-border py-1 pl-1 pr-2.5 transition-colors hover:bg-muted">
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-[11px] font-semibold text-primary-foreground">
              {initials(user.displayName)}
            </div>
            <div className="hidden text-left leading-tight sm:block">
              <p className="text-[13px] font-medium text-foreground">{user.displayName}</p>
            </div>
            <Badge variant="secondary" className="hidden text-[10px] sm:inline-flex">
              {roleLabels[user.role]}
            </Badge>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel>
            <p className="text-sm font-medium">{user.displayName}</p>
            <p className="text-xs font-normal text-muted-foreground">{roleLabels[user.role]}</p>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => setResetOpen(true)} className="flex items-center gap-2">
            <RotateCcw className="h-4 w-4" /> Reset Demo Data
          </DropdownMenuItem>
          <DropdownMenuItem onClick={logout} className="flex items-center gap-2 text-destructive focus:text-destructive">
            <LogOut className="h-4 w-4" /> Log out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <ConfirmDialog
        open={resetOpen}
        onOpenChange={setResetOpen}
        title="Reset Demo Data?"
        description="This will discard all changes made during this session (new patients, appointments, transactions, transfers) and restore the original demo dataset. Your login session will be kept."
        confirmLabel="Reset Data"
        destructive
        onConfirm={() => {
          resetDemoData();
          setResetOpen(false);
          toast.success("Demo data has been reset");
          router.refresh();
        }}
      />
    </header>
  );
}
