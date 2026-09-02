"use client";

import { useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Bell, LogOut, RefreshCw, Search } from "lucide-react";
import { useSession } from "@/lib/auth/use-session";
import { useClinicStore } from "@/lib/store/clinic-store";
import { roleLabels } from "@/lib/permissions";
import { getPatientFullNameTh, today } from "@/lib/domain";
import { daysUntil } from "@/lib/format";
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

interface Notification {
  id: string;
  title: string;
  detail: string;
  href: string;
}

/**
 * Drawn from what is actually happening at this branch today rather than a
 * fixed list — an empty bell means there is genuinely nothing waiting.
 */
function useNotifications(branchId: string | null, canVoid: boolean): Notification[] {
  const appointments = useClinicStore((s) => s.appointments);
  const patients = useClinicStore((s) => s.patients);
  const transactions = useClinicStore((s) => s.transactions);
  const patientCourses = useClinicStore((s) => s.patientCourses);

  return useMemo(() => {
    if (!branchId) return [];
    const currentDate = today();
    const nameOf = (patientId: string) => {
      const patient = patients.find((p) => p.id === patientId);
      return patient ? getPatientFullNameTh(patient) : "A patient";
    };
    const items: Notification[] = [];

    for (const appointment of appointments.filter(
      (a) => a.branchId === branchId && a.date === currentDate && a.status === "ARRIVED"
    )) {
      items.push({
        id: `arrived-${appointment.id}`,
        title: "Patient arrived",
        detail: `${nameOf(appointment.patientId)} is waiting — booked ${appointment.startTime}`,
        href: `/appointments/${appointment.id}`,
      });
    }

    const waitingCheckout = appointments.filter(
      (a) =>
        a.branchId === branchId &&
        a.date === currentDate &&
        a.status === "COMPLETED" &&
        !a.checkedOut
    );
    if (waitingCheckout.length > 0) {
      items.push({
        id: "checkout-queue",
        title: "Visits waiting for checkout",
        detail: `${waitingCheckout.length} completed visit${
          waitingCheckout.length === 1 ? "" : "s"
        } still to be billed`,
        href: "/checkout",
      });
    }

    const expiringSoon = patientCourses.filter((course) => {
      if (course.branchId !== branchId || course.status !== "ACTIVE") return false;
      const days = daysUntil(course.expiryDate);
      return days >= 0 && days <= 30;
    });
    if (expiringSoon.length > 0) {
      items.push({
        id: "expiring-courses",
        title: "Courses expiring soon",
        detail: `${expiringSoon.length} active course${
          expiringSoon.length === 1 ? "" : "s"
        } expire within 30 days`,
        href: "/reports/course-balance",
      });
    }

    if (canVoid) {
      for (const voided of transactions
        .filter((t) => t.branchId === branchId && t.status === "VOID")
        .slice(0, 2)) {
        items.push({
          id: `void-${voided.id}`,
          title: "Transaction voided",
          detail: `${voided.transactionNo} — ${voided.voidInfo?.reason ?? "no reason recorded"}`,
          href: `/transactions/${voided.id}`,
        });
      }
    }

    return items.slice(0, 6);
  }, [appointments, patients, transactions, patientCourses, branchId, canVoid]);
}

export function AppHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout, can, activeBranchId } = useSession();
  const refresh = useClinicStore((s) => s.refresh);
  const loading = useClinicStore((s) => s.loading);
  const [query, setQuery] = useState("");
  const notifications = useNotifications(activeBranchId, can("transaction.void"));

  if (!user) return null;
  const segments = pathname.split("/").filter(Boolean);


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
          {notifications.length === 0 ? (
            <p className="px-2 py-4 text-center text-xs text-muted-foreground">
              Nothing needs your attention right now.
            </p>
          ) : (
            notifications.map((n) => (
              <DropdownMenuItem
                key={n.id}
                onClick={() => router.push(n.href)}
                className="flex flex-col items-start gap-0.5 whitespace-normal py-2"
              >
                <p className="text-sm font-medium">{n.title}</p>
                <p className="text-xs text-muted-foreground">{n.detail}</p>
              </DropdownMenuItem>
            ))
          )}
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
          <DropdownMenuItem
            disabled={loading}
            onClick={async () => {
              await refresh();
              toast.success("Clinic data reloaded");
            }}
            className="flex items-center gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Reload data
          </DropdownMenuItem>
          <DropdownMenuItem onClick={logout} className="flex items-center gap-2 text-destructive focus:text-destructive">
            <LogOut className="h-4 w-4" /> Log out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

    </header>
  );
}
