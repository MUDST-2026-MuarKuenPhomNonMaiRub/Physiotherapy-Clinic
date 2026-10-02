"use client";

import { Fragment } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut } from "lucide-react";
import { useSession } from "@/lib/auth/use-session";
import { getRoleLabel } from "@/lib/permissions";
import { BranchSelector } from "@/components/layout/branch-selector";
import { GoogleCalendarMenu } from "@/components/integrations/google-calendar-menu";
import { MobileSidebar } from "@/components/layout/mobile-sidebar";
import { NotificationBell } from "@/components/layout/notification-bell";
import { GlobalSearch } from "@/components/layout/global-search";
import { LanguageToggle } from "@/components/i18n/language-toggle";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "@/components/ui/breadcrumb";

const labelMap: Record<string, string> = {
  calendar: "Calendar",
  patients: "Patient",
  appointments: "Appointment & Visits",
  "google-calendar": "Google Calendar",
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
  "course-commission": "Course Commission",
  "commission-audit": "Commission Audit",
  "commission-scheme": "Commission Tiers",
  "monthly-closing": "Monthly Closing",
  "treatment-fee-rules": "Treatment Fee Rules",
  "my-appointments": "My Appointments",
  "my-commission": "My Commission",
  dashboard: "Dashboard",
  new: "New",
  edit: "Edit",
};

/** Record ids (numeric, or a prefixed number such as "AP-2026-00001") read as "Detail". */
function humanize(segment: string): string {
  if (labelMap[segment]) return labelMap[segment];
  if (/^\d+$/.test(segment) || /^[a-z]{0,4}-?\d/.test(segment)) return "Detail";
  return segment.charAt(0).toUpperCase() + segment.slice(1).replace(/-/g, " ");
}

function initials(name: string) {
  const parts = name.trim().split(" ");
  return parts.length > 1 ? `${parts[0][0]}${parts[1][0]}` : name.slice(0, 2);
}

export function AppHeader() {
  const pathname = usePathname();
  const { user, logout } = useSession();

  if (!user) return null;
  const segments = pathname.split("/").filter(Boolean);

  return (
    <header className="flex h-16 shrink-0 lg:h-[72px] items-center gap-2 border-b border-border bg-card px-3 sm:gap-3 sm:px-4 lg:px-6">
      <MobileSidebar />
      <div className="min-w-0 flex-1">
        {/* The full trail needs room; a phone gets the current screen only. */}
        <p className="truncate text-sm font-medium text-foreground md:hidden">
          {segments.length ? humanize(segments[segments.length - 1]) : "LA BALANCE"}
        </p>
        <Breadcrumb className="hidden md:block">
          <BreadcrumbList className="flex-nowrap overflow-hidden">
            <BreadcrumbItem className="hidden shrink-0 xl:inline-flex">
              <BreadcrumbLink asChild>
                <Link href="/calendar">LA BALANCE</Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            {segments.map((seg, i) => (
              <Fragment key={i}>
                <BreadcrumbSeparator className={i === 0 ? "hidden xl:block" : undefined} />
                <BreadcrumbItem className="min-w-0">
                  {i === segments.length - 1 ? (
                    <BreadcrumbPage className="truncate font-medium text-foreground">
                      {humanize(seg)}
                    </BreadcrumbPage>
                  ) : (
                    <BreadcrumbLink asChild className="truncate">
                      <Link href={`/${segments.slice(0, i + 1).join("/")}`}>
                        {humanize(seg)}
                      </Link>
                    </BreadcrumbLink>
                  )}
                </BreadcrumbItem>
              </Fragment>
            ))}
          </BreadcrumbList>
        </Breadcrumb>
      </div>

      <GlobalSearch />

      <BranchSelector />
      <LanguageToggle />

      <NotificationBell />

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            className="flex shrink-0 cursor-pointer items-center gap-2 rounded-lg border border-border py-1 pl-1 pr-1 transition-colors hover:bg-muted lg:pr-2.5"
            aria-label="Account menu"
          >
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-[11px] font-semibold text-primary-foreground">
              {initials(user.displayName)}
            </div>
            <div className="hidden max-w-40 text-left leading-tight lg:block">
              <p className="truncate text-[13px] font-medium text-foreground">{user.displayName}</p>
            </div>
            <Badge variant="secondary" className="hidden text-[10px] xl:inline-flex">
              {getRoleLabel(user.role)}
            </Badge>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel>
            <p className="text-sm font-medium">{user.displayName}</p>
            <p className="text-xs font-normal text-muted-foreground">{getRoleLabel(user.role)}</p>
          </DropdownMenuLabel>
          <GoogleCalendarMenu />
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={logout} className="flex items-center gap-2 text-destructive focus:text-destructive">
            <LogOut className="h-4 w-4" /> Log out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

    </header>
  );
}
