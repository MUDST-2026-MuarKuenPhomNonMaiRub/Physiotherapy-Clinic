import type { Permission, Role } from "@/types";

/**
 * Two access levels only. The clinic has no front desk of its own: whoever is on
 * shift registers patients, books, treats and takes payment. Physiotherapists
 * therefore get the full operational surface — what they do NOT get is the
 * clinic-wide view (other people's sales, everyone's commission), the ability to
 * reverse money (void), and administration.
 */
export const rolePermissions: Record<Role, Permission[]> = {
  ADMIN: [
    "patient.view",
    "patient.create",
    "patient.edit",
    "appointment.view",
    "appointment.create",
    "appointment.edit",
    "appointment.cancel",
    "checkout.create",
    "course.view",
    "course.use",
    "course.transfer",
    "transaction.view",
    "transaction.void",
    "report.view",
    "report.view.all",
    "dashboard.view",
    // An admin sees everyone's commission, which includes their own.
    "commission.view.own",
    "commission.view.all",
    "settings.manage",
  ],
  PHYSIOTHERAPIST: [
    "patient.view",
    "patient.create",
    "patient.edit",
    "appointment.view",
    "appointment.create",
    "appointment.edit",
    "appointment.cancel",
    "checkout.create",
    "course.view",
    "course.use",
    "course.transfer",
    "transaction.view",
    "report.view",
    "commission.view.own",
  ],
};

export function hasPermission(role: Role, permission: Permission): boolean {
  return rolePermissions[role]?.includes(permission) ?? false;
}

export function hasAnyPermission(role: Role, permissions: Permission[]): boolean {
  return permissions.some((p) => hasPermission(role, p));
}

export const roleLabels: Record<Role, string> = {
  ADMIN: "Admin",
  PHYSIOTHERAPIST: "Physiotherapist",
};

export const roleDescriptions: Record<Role, string> = {
  ADMIN:
    "Full clinic access — day-to-day operations plus reports across every branch and all administration settings.",
  PHYSIOTHERAPIST:
    "Day-to-day operations at their own branches — patients, calendar, checkout and course balances. Sales and commission figures are limited to their own.",
};

export const roleStyles: Record<Role, string> = {
  ADMIN: "border-primary/20 bg-primary/10 text-primary",
  PHYSIOTHERAPIST: "border-info/25 bg-info/10 text-[#1A9DBF]",
};

export const allRoles: Role[] = ["ADMIN", "PHYSIOTHERAPIST"];
