/**
 * Every clinic endpoint the app talks to, returning domain types rather than
 * wire shapes. Screens never see a raw API row.
 */
import { API_URL, apiRequest } from "./client";
import {
  toAppointment,
  toBranch,
  toBranchIdsJson,
  toCommissionRule,
  toCourseTemplate,
  toInstant,
  toLedgerEntry,
  toMasterDataItem,
  toPatient,
  toPatientCourse,
  toPatientRequest,
  toPaymentMethod,
  toResource,
  toRoleCode,
  toService,
  toStaff,
  toTransaction,
  toUser,
} from "./mappers";
import type {
  Appointment,
  AppUser,
  Branch,
  CommissionRule,
  CourseLedgerEntry,
  CourseTemplate,
  MasterDataItem,
  Patient,
  PatientCourse,
  PaymentMethod,
  ResourceRoom,
  Role,
  Service,
  Staff,
  Transaction,
} from "@/types";

type Row = Record<string, unknown>;

const query = (params: Record<string, string | number | null | undefined>) => {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== null && value !== undefined && value !== "") search.set(key, String(value));
  }
  const serialised = search.toString();
  return serialised ? `?${serialised}` : "";
};

// -------------------------------------------------------------------- session

export interface LoginResult {
  accessToken: string;
  user: AppUser;
}

export async function login(email: string, password: string): Promise<LoginResult> {
  const session = await apiRequest<{ accessToken: string; tokenType: string }>(
    "/api/v1/auth/login",
    { method: "POST", body: { email, password }, anonymous: true }
  );

  // The profile is fetched with the token login just issued, before the store
  // has had a chance to record it.
  const profile = await fetchMe(session.accessToken);
  const role: Role = profile.roles.includes("ADMIN") ? "ADMIN" : "PHYSIOTHERAPIST";
  return {
    accessToken: session.accessToken,
    user: {
      id: String(profile.id),
      username: profile.email,
      password: "",
      role,
      staffId: profile.staffId == null ? undefined : String(profile.staffId),
      displayName: `${profile.firstName} ${profile.lastName}`.trim() || profile.email,
      branchIds: (profile.branchIds ?? []).map(String),
      status: profile.active ? "ACTIVE" : "INACTIVE",
      lastLogin: new Date().toISOString(),
    },
  };
}

interface MeResponse {
  id: number;
  email: string;
  firstName: string;
  lastName: string;
  active: boolean;
  roles: string[];
  staffId: number | null;
  branchIds: number[];
}

async function fetchMe(accessToken: string): Promise<MeResponse> {
  const response = await fetch(`${API_URL}/api/v1/auth/me`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) throw new Error("Unable to load your profile");
  return (await response.json()) as MeResponse;
}

/** Re-reads the signed-in account, used after a refresh restores a saved token. */
export const me = () => apiRequest<MeResponse>("/api/v1/auth/me");

// ------------------------------------------------------------------- branches

export const listBranches = () =>
  apiRequest<Row[]>("/api/v1/branches").then((rows) => rows.map(toBranch));

export const createBranch = (branch: Omit<Branch, "id">) =>
  apiRequest<Row>("/api/v1/branches", {
    method: "POST",
    body: {
      code: branch.code,
      name: branch.name,
      phone: branch.phone,
      address: branch.address,
      active: branch.status === "ACTIVE",
    },
  }).then(toBranch);

export const updateBranch = (branch: Branch) =>
  apiRequest<Row>(`/api/v1/branches/${branch.id}`, {
    method: "PATCH",
    body: {
      code: branch.code,
      name: branch.name,
      phone: branch.phone,
      address: branch.address,
      active: branch.status === "ACTIVE",
    },
  }).then(toBranch);

export const setBranchActive = (id: string, active: boolean) =>
  apiRequest<Row>(`/api/v1/branches/${id}/status`, { method: "PATCH", body: { active } }).then(
    toBranch
  );

// ---------------------------------------------------------------------- staff

export const listStaff = () =>
  apiRequest<Row[]>("/api/v1/staff").then((rows) => rows.map(toStaff));

export const createStaff = (
  staff: Omit<Staff, "id">,
  account: { role: Role; password: string }
) =>
  apiRequest<{ staffId: number; userId: number | null }>("/api/v1/staff", {
    method: "POST",
    body: {
      name: staff.name,
      nameEn: staff.nameEn || "Staff",
      position: staff.position,
      phone: staff.phone,
      email: staff.email,
      branchIds: toBranchIdsJson(staff.branchIds),
      role: toRoleCode(account.role),
      password: account.password,
      avatarColor: staff.avatarColor,
    },
  });

export const updateStaff = (id: string, staff: Partial<Staff> & { branchIds: string[] }) =>
  apiRequest<Row>(`/api/v1/staff/${id}`, {
    method: "PATCH",
    body: {
      name: staff.name,
      nameEn: staff.nameEn ?? "",
      position: staff.position,
      phone: staff.phone ?? "",
      branchIds: toBranchIdsJson(staff.branchIds),
      status: staff.status,
      avatarColor: staff.avatarColor,
    },
  }).then(toStaff);

export const deleteStaff = (id: string) =>
  apiRequest<void>(`/api/v1/staff/${id}`, { method: "DELETE" });

// ---------------------------------------------------------------------- users

export const listUsers = () =>
  apiRequest<Row[]>("/api/v1/users").then((rows) => rows.map(toUser));

export const updateUser = (id: string, changes: { role?: Role; active?: boolean }) =>
  apiRequest<Row>(`/api/v1/users/${id}`, {
    method: "PATCH",
    body: {
      role: changes.role ? toRoleCode(changes.role) : null,
      active: changes.active ?? null,
    },
  }).then(toUser);

export const setUserBranches = (id: string, branchIds: string[]) =>
  apiRequest<Row>(`/api/v1/users/${id}/branches`, {
    method: "PUT",
    body: { branchIds: toBranchIdsJson(branchIds) },
  }).then(toUser);

export const deleteUser = (id: string) =>
  apiRequest<void>(`/api/v1/users/${id}`, { method: "DELETE" });

export const createUser = (input: {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  role: Role;
}) =>
  apiRequest<void>("/api/v1/auth/users", {
    method: "POST",
    body: { ...input, role: toRoleCode(input.role) },
  });

// ------------------------------------------------------------------ catalogue

export const listServices = () =>
  apiRequest<Row[]>("/api/v1/services").then((rows) => rows.map(toService));

const serviceBody = (service: Omit<Service, "id">) => ({
  nameTh: service.name,
  nameEn: service.name,
  serviceType: service.type,
  durationMinutes: service.duration,
  basePrice: service.price,
  active: service.status === "ACTIVE",
});

export const createService = (service: Omit<Service, "id">) =>
  apiRequest<Row>("/api/v1/services", { method: "POST", body: serviceBody(service) }).then(
    toService
  );

export const updateService = (id: string, service: Omit<Service, "id">) =>
  apiRequest<Row>(`/api/v1/services/${id}`, { method: "PATCH", body: serviceBody(service) }).then(
    toService
  );

export const setServiceActive = (id: string, active: boolean) =>
  apiRequest<Row>(`/api/v1/services/${id}/status`, { method: "PATCH", body: { active } }).then(
    toService
  );

export const listCourseTemplates = () =>
  apiRequest<Row[]>("/api/v1/courses").then((rows) => rows.map(toCourseTemplate));

const courseBody = (course: Omit<CourseTemplate, "id">) => ({
  nameTh: course.name,
  nameEn: course.name,
  description: course.description,
  totalSessions: course.sessions,
  bonusSessions: course.bonusSessions,
  validityDays: course.expiryDays,
  price: course.price,
  active: course.status === "ACTIVE",
});

export const createCourseTemplate = (course: Omit<CourseTemplate, "id">) =>
  apiRequest<Row>("/api/v1/courses", { method: "POST", body: courseBody(course) }).then(
    toCourseTemplate
  );

export const updateCourseTemplate = (id: string, course: Omit<CourseTemplate, "id">) =>
  apiRequest<Row>(`/api/v1/courses/${id}`, { method: "PATCH", body: courseBody(course) }).then(
    toCourseTemplate
  );

export const setCourseTemplateActive = (id: string, active: boolean) =>
  apiRequest<Row>(`/api/v1/courses/${id}/status`, { method: "PATCH", body: { active } }).then(
    toCourseTemplate
  );

export const listPaymentMethods = () =>
  apiRequest<Row[]>("/api/v1/payment-methods").then((rows) => rows.map(toPaymentMethod));

export const setPaymentMethodEnabled = (id: string, active: boolean) =>
  apiRequest<Row>(`/api/v1/payment-methods/${id}/status`, {
    method: "PATCH",
    body: { active },
  }).then(toPaymentMethod);

export const listResources = () =>
  apiRequest<Row[]>("/api/v1/rooms").then((rows) => rows.map(toResource));

const roomBody = (resource: Omit<ResourceRoom, "id">) => ({
  name: resource.name,
  roomType: resource.type,
  branchId: Number(resource.branchId),
  active: resource.status === "ACTIVE",
});

export const createResource = (resource: Omit<ResourceRoom, "id">) =>
  apiRequest<Row>("/api/v1/rooms", { method: "POST", body: roomBody(resource) }).then(toResource);

export const updateResource = (id: string, resource: Omit<ResourceRoom, "id">) =>
  apiRequest<Row>(`/api/v1/rooms/${id}`, { method: "PATCH", body: roomBody(resource) }).then(
    toResource
  );

export const setResourceActive = (id: string, active: boolean) =>
  apiRequest<Row>(`/api/v1/rooms/${id}/status`, { method: "PATCH", body: { active } }).then(
    toResource
  );

export const listMasterData = () =>
  apiRequest<Row[]>("/api/v1/master-data").then((rows) => rows.map(toMasterDataItem));

export const createMasterDataItem = (item: Omit<MasterDataItem, "id">) =>
  apiRequest<Row>("/api/v1/master-data", {
    method: "POST",
    body: { dataType: item.category, nameTh: item.value, active: item.status === "ACTIVE" },
  }).then(toMasterDataItem);

export const updateMasterDataItem = (id: string, item: Partial<MasterDataItem>) =>
  apiRequest<Row>(`/api/v1/master-data/${id}`, {
    method: "PATCH",
    body: {
      dataType: item.category ?? null,
      nameTh: item.value ?? null,
      active: item.status ? item.status === "ACTIVE" : null,
    },
  }).then(toMasterDataItem);

export const setMasterDataActive = (id: string, active: boolean) =>
  apiRequest<Row>(`/api/v1/master-data/${id}/status`, { method: "PATCH", body: { active } }).then(
    toMasterDataItem
  );

export const listCommissionRules = () =>
  apiRequest<Row[]>("/api/v1/commission-rules").then((rows) => rows.map(toCommissionRule));

const ruleBody = (rule: Omit<CommissionRule, "id">) => ({
  name: rule.name,
  appliesTo: rule.appliesTo,
  targetType: rule.targetType,
  targetServiceId:
    rule.targetType === "SERVICE" && rule.targetId ? Number(rule.targetId) : null,
  targetCourseId: rule.targetType === "COURSE" && rule.targetId ? Number(rule.targetId) : null,
  commissionType: rule.commissionType,
  value: rule.value,
  effectiveDate: rule.effectiveDate,
  active: rule.status === "ACTIVE",
});

export const createCommissionRule = (rule: Omit<CommissionRule, "id">) =>
  apiRequest<Row>("/api/v1/commission-rules", { method: "POST", body: ruleBody(rule) }).then(
    toCommissionRule
  );

export const updateCommissionRule = (id: string, rule: Omit<CommissionRule, "id">) =>
  apiRequest<Row>(`/api/v1/commission-rules/${id}`, {
    method: "PATCH",
    body: ruleBody(rule),
  }).then(toCommissionRule);

export const setCommissionRuleActive = (id: string, active: boolean) =>
  apiRequest<Row>(`/api/v1/commission-rules/${id}/status`, {
    method: "PATCH",
    body: { active },
  }).then(toCommissionRule);

// ------------------------------------------------------------------- patients

export const listPatients = (branchId?: string | null) =>
  apiRequest<Row[]>(`/api/v1/patients${query({ branchId })}`).then((rows) => rows.map(toPatient));

export const createPatient = (patient: Omit<Patient, "id" | "hn" | "createdAt">) =>
  apiRequest<Row>("/api/v1/patients", { method: "POST", body: toPatientRequest(patient) }).then(
    toPatient
  );

export const updatePatient = (
  id: string,
  patient: Omit<Patient, "id" | "hn" | "createdAt">
) =>
  apiRequest<Row>(`/api/v1/patients/${id}`, {
    method: "PATCH",
    body: toPatientRequest(patient),
  }).then(toPatient);

// --------------------------------------------------------------- appointments

export const listAppointments = (branchId?: string | null) =>
  apiRequest<Row[]>(`/api/v1/appointments${query({ branchId })}`).then((rows) =>
    rows.map(toAppointment)
  );

export interface AppointmentInput {
  patientId: string;
  date: string;
  startTime: string;
  endTime: string;
  branchId: string;
  physiotherapistId: string;
  serviceId: string;
  resourceId: string;
  note?: string;
}

export const createAppointment = (input: AppointmentInput) =>
  apiRequest<Row>("/api/v1/appointments", {
    method: "POST",
    body: {
      patientId: Number(input.patientId),
      branchId: Number(input.branchId),
      providerStaffId: Number(input.physiotherapistId),
      serviceId: Number(input.serviceId),
      roomId: input.resourceId ? Number(input.resourceId) : null,
      startsAt: toInstant(input.date, input.startTime),
      endsAt: toInstant(input.date, input.endTime),
      patientNote: input.note ?? null,
    },
  }).then(toAppointment);

type AppointmentAction = "confirm" | "arrive" | "start" | "complete" | "cancel" | "noshow";

export const transitionAppointment = (id: string, action: AppointmentAction, reason?: string) =>
  apiRequest<Row>(`/api/v1/appointments/${id}/${action}`, {
    method: "POST",
    body: { reason: reason ?? null },
  }).then(toAppointment);

export const rescheduleAppointment = (
  id: string,
  date: string,
  startTime: string,
  endTime: string,
  reason?: string
) =>
  apiRequest<Row>(`/api/v1/appointments/${id}/reschedule`, {
    method: "POST",
    body: {
      startsAt: toInstant(date, startTime),
      endsAt: toInstant(date, endTime),
      reason: reason ?? null,
    },
  }).then(toAppointment);

// ------------------------------------------------------- courses and ledger

export interface CourseSnapshot {
  patientCourses: PatientCourse[];
  courseLedger: CourseLedgerEntry[];
}

export const listPatientCourses = (branchId?: string | null): Promise<CourseSnapshot> =>
  apiRequest<{ patientCourses: Row[]; ledger: Row[] }>(
    `/api/v1/patient-courses${query({ branchId })}`
  ).then((response) => ({
    patientCourses: response.patientCourses.map(toPatientCourse),
    courseLedger: response.ledger.map(toLedgerEntry),
  }));

export const transferCourseSessions = (
  patientCourseId: string,
  toPatientId: string,
  sessions: number,
  reason?: string
) =>
  apiRequest<Row>("/api/v1/course-transfers", {
    method: "POST",
    body: {
      patientCourseId: Number(patientCourseId),
      toPatientId: Number(toPatientId),
      sessions,
      reason: reason ?? null,
    },
  });

// --------------------------------------------------------------- transactions

export const listTransactions = (branchId?: string | null) =>
  apiRequest<Row[]>(`/api/v1/transactions${query({ branchId })}`).then((rows) =>
    rows.map(toTransaction)
  );

export interface CheckoutAdjustmentInput {
  label: string;
  amount: number;
}

export interface CheckoutInput {
  patientId: string;
  branchId: string;
  appointmentId?: string;
  serviceId?: string;
  purchaseCourseTemplateId?: string;
  useCoursePatientCourseId?: string;
  useSessionsCount?: number;
  useNewlyPurchasedSession?: boolean;
  treatingStaffId?: string;
  salespersonId?: string;
  paymentMethodId: string;
  servicePrice?: number;
  coursePurchasePrice?: number;
  adjustments?: CheckoutAdjustmentInput[];
}

export const checkout = (input: CheckoutInput): Promise<Transaction> =>
  apiRequest<Row>("/api/v1/checkout", {
    method: "POST",
    body: {
      patientId: Number(input.patientId),
      branchId: Number(input.branchId),
      appointmentId: input.appointmentId ? Number(input.appointmentId) : null,
      serviceId: input.serviceId ? Number(input.serviceId) : null,
      purchaseCourseId: input.purchaseCourseTemplateId
        ? Number(input.purchaseCourseTemplateId)
        : null,
      usePatientCourseId: input.useCoursePatientCourseId
        ? Number(input.useCoursePatientCourseId)
        : null,
      useSessionsCount: input.useSessionsCount ?? null,
      useNewlyPurchasedSession: input.useNewlyPurchasedSession ?? false,
      treatingStaffId: input.treatingStaffId ? Number(input.treatingStaffId) : null,
      salespersonId: input.salespersonId ? Number(input.salespersonId) : null,
      paymentMethodId: Number(input.paymentMethodId),
      servicePrice: input.servicePrice ?? null,
      coursePurchasePrice: input.coursePurchasePrice ?? null,
      adjustments: input.adjustments ?? [],
    },
  }).then(toTransaction);

export const voidTransaction = (id: string, reason: string): Promise<Transaction> =>
  apiRequest<Row>(`/api/v1/transactions/${id}/void`, {
    method: "POST",
    body: { reason },
  }).then(toTransaction);

// ------------------------------------------------------------ full hydration

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
  patients: Patient[];
  patientCourses: PatientCourse[];
  courseLedger: CourseLedgerEntry[];
  appointments: Appointment[];
  transactions: Transaction[];
}

/**
 * One round of loading for the whole app. The user list is admin-only, so a
 * physiotherapist simply gets an empty one rather than a failed sign-in.
 */
export async function loadSnapshot(isAdmin: boolean): Promise<ClinicSnapshot> {
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
    patients,
    courses,
    appointments,
    transactions,
  ] = await Promise.all([
    listBranches(),
    listStaff(),
    isAdmin ? listUsers().catch(() => []) : Promise.resolve([]),
    listServices(),
    listCourseTemplates(),
    listPaymentMethods(),
    listResources(),
    listMasterData(),
    listCommissionRules(),
    listPatients(),
    listPatientCourses(),
    listAppointments(),
    listTransactions(),
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
    patients,
    patientCourses: courses.patientCourses,
    courseLedger: courses.courseLedger,
    appointments,
    transactions,
  };
}
