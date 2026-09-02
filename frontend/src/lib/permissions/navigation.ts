import type { Role } from "@/types";

export interface NavItem {
  label: string;
  href: string;
  icon: string; // lucide-react icon name, resolved by <NavIcon />
}

export interface NavGroup {
  title?: string;
  items: NavItem[];
}

/** Pinned entry above the grouped sections — the landing screen for both roles. */
const calendarItem: NavItem = { label: "Calendar", href: "/calendar", icon: "CalendarDays" };

const patientGroup: NavGroup = {
  title: "Patient",
  items: [
    { label: "Patient", href: "/patients", icon: "Users" },
    { label: "Appointment & Visits", href: "/appointments", icon: "CalendarCheck" },
    { label: "Patient Courses", href: "/courses", icon: "ClipboardList" },
    { label: "Courses Transfer", href: "/courses/transfer", icon: "ArrowLeftRight" },
  ],
};

const financeGroup: NavGroup = {
  title: "Finance",
  items: [
    { label: "Checkout", href: "/checkout", icon: "ShoppingCart" },
    { label: "Transactions", href: "/transactions", icon: "CreditCard" },
  ],
};

const reportGroup: NavGroup = {
  title: "Report",
  items: [
    { label: "Revenue", href: "/reports/revenue", icon: "TrendingUp" },
    { label: "Course Balance", href: "/reports/course-balance", icon: "Package" },
    { label: "Staff Sales", href: "/reports/staff-sales", icon: "UserCog" },
    { label: "Commission", href: "/reports/commission", icon: "Banknote" },
  ],
};

const administrationGroup: NavGroup = {
  title: "Administration",
  items: [
    { label: "Branches", href: "/settings/branches", icon: "Building2" },
    { label: "Rooms & Resources", href: "/settings/resources", icon: "DoorOpen" },
    { label: "Staff & Access", href: "/settings/staff-access", icon: "ShieldCheck" },
    { label: "Treatments & Course", href: "/settings/services", icon: "Stethoscope" },
    { label: "Payment Methods", href: "/settings/payment-methods", icon: "Wallet" },
    { label: "Commission Rules", href: "/settings/commission", icon: "Percent" },
    { label: "Master Data", href: "/settings/master-data", icon: "Database" },
  ],
};

export const pinnedByRole: Record<Role, NavItem> = {
  ADMIN: calendarItem,
  PHYSIOTHERAPIST: calendarItem,
};

export const navigationByRole: Record<Role, NavGroup[]> = {
  ADMIN: [patientGroup, financeGroup, reportGroup, administrationGroup],
  PHYSIOTHERAPIST: [patientGroup, financeGroup, reportGroup],
};

export const defaultRouteByRole: Record<Role, string> = {
  ADMIN: "/calendar",
  PHYSIOTHERAPIST: "/calendar",
};

/**
 * Longest-prefix match across the role's own menu, so "/courses/transfer"
 * highlights Courses Transfer rather than its parent Patient Courses.
 */
export function findActiveHref(role: Role, pathname: string): string | null {
  const hrefs = [pinnedByRole[role].href, ...navigationByRole[role].flatMap((g) => g.items.map((i) => i.href))];
  return (
    hrefs
      .filter((href) => pathname === href || pathname.startsWith(href + "/"))
      .sort((a, b) => b.length - a.length)[0] ?? null
  );
}

// Route prefix -> roles allowed, matched by longest prefix. Routes not listed
// are open to any authenticated user; per-action rules live in rolePermissions.
export const routeAccess: { prefix: string; roles: Role[] }[] = [
  { prefix: "/settings", roles: ["ADMIN"] },
];

export function canAccessRoute(role: Role, pathname: string): boolean {
  const matches = routeAccess
    .filter((r) => pathname.startsWith(r.prefix))
    .sort((a, b) => b.prefix.length - a.prefix.length);
  if (matches.length === 0) return true;
  return matches[0].roles.includes(role);
}
