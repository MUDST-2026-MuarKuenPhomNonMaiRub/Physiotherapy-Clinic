import { apiRequest } from "./client";

import type { AppUser, Branch, CommissionRule, CourseTemplate, MasterDataItem, PaymentMethod, ResourceRoom, Service, Staff } from "@/types";

import { listBranches, listStaff, listUsers, listServices, listCourseTemplates, listPaymentMethods, listResourcesFor, listMasterData, listCommissionRules } from "./catalog";
import type { BranchScope } from "./shared";

// ------------------------------------------------------------ full hydration

/**
 * The reference data every screen needs. Patients, courses, visits and
 * transactions are not part of it: refreshOperational loads those after the
 * shell is visible, and a refresh leaves the ones already on screen in place
 * until it does.
 */
export interface ClinicSnapshot {
  branches: Branch[];
  staff: Staff[];
  users: AppUser[];
  services: Service[];
  courseTemplates: CourseTemplate[];
  paymentMethods: PaymentMethod[];
  resources: ResourceRoom[];
  masterData: MasterDataItem[];
  commissionRules: CommissionRule[];
}

/**
 * One round of loading for the whole app. The user list is admin-only and the
 * commission rules need settings access, so a physiotherapist simply gets
 * empty ones rather than a failed sign-in, and the branch-scoped lists are
 * read for the branches they are assigned to.
 */
export async function loadSnapshot(
  isAdmin: boolean,
  scope: BranchScope,
  canManageSettings = isAdmin
): Promise<ClinicSnapshot> {
  const [
    branches,
    staff,
    users,
    services,
    courseTemplates,
    paymentMethods,
    resources,
    masterData,
    commissionRules,
  ] = await Promise.all([
    listBranches(),
    listStaff(),
    isAdmin ? listUsers().catch(() => []) : Promise.resolve([]),
    listServices(),
    listCourseTemplates(),
    listPaymentMethods(),
    listResourcesFor(scope),
    listMasterData(),
    canManageSettings ? listCommissionRules() : Promise.resolve([]),
  ]);

  return {
    branches,
    staff,
    users,
    services,
    courseTemplates,
    paymentMethods,
    resources,
    masterData,
    commissionRules,
  };
}

/** One line in the header bell; which fields are set depends on `type`. */
export interface ClinicNotification {
  key: string;
  type: string;
  occurredAt: string;
  href: string;
  read: boolean;
  appointmentNo?: string;
  patientName?: string;
  actorName?: string;
  staffName?: string;
  startsAt?: string;
  endsAt?: string;
  oldStartsAt?: string;
  oldEndsAt?: string;
  minutes?: number;
  count?: number;
  label?: string;
  amount?: number;
  reason?: string;
}

export const listNotifications = () =>
  apiRequest<{ items: ClinicNotification[]; unread: number }>("/api/v1/notifications");

export const markNotificationsRead = (keys: string[]) =>
  apiRequest<void>("/api/v1/notifications/read", { method: "POST", body: { keys } });
