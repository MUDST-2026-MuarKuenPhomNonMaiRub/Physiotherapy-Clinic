import { apiRequest } from "./client";
import { toBranch, toBranchIdsJson, toCommissionRule, toCourseTemplate, toMasterDataItem, toPaymentMethod, toResource, toRoleCode, toService, toStaff, toUser } from "./mappers";
import type { Branch, CommissionRule, CourseTemplate, MasterDataCategory, MasterDataItem, PaymentMethod, ResourceRoom, Role, Service, Staff } from "@/types";
import { forBranches, query } from "./shared";
import type { BranchScope, Row } from "./shared";

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
  account: { role: Role; password: string } | null
) =>
  apiRequest<{ staffId: number; userId: number | null }>("/api/v1/staff", {
    method: "POST",
    body: {
      name: staff.name,
      nameEn: staff.nameEn || "Staff",
      position: staff.position,
      phone: staff.phone,
      email: account ? staff.email : null,
      branchIds: toBranchIdsJson(staff.branchIds),
      role: account ? toRoleCode(account.role) : null,
      password: account?.password ?? null,
      avatarColor: staff.avatarColor,
      hasAccount: !!account,
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
      commissionEligible: staff.commissionEligible ?? null,
      terminationDate: staff.terminationDate ?? null,
      commissionAfterTerminationPolicy: staff.commissionAfterTerminationPolicy ?? null,
    },
  }).then(toStaff);

export const deleteStaff = (id: string) =>
  apiRequest<void>(`/api/v1/staff/${id}`, { method: "DELETE" });

/** Gives a person who was recorded without a login one of their own. */
export const createStaffAccount = (
  id: string,
  account: { email: string; role: Role; password: string }
) =>
  apiRequest<Row>(`/api/v1/staff/${id}/account`, {
    method: "POST",
    body: { email: account.email, role: toRoleCode(account.role), password: account.password },
  }).then(toStaff);

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
  code: service.code || undefined,
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
  code: course.code || undefined,
  nameTh: course.name,
  nameEn: course.name,
  description: course.description,
  totalSessions: course.sessions,
  bonusSessions: course.bonusSessions,
  validityDays: course.expiryDays,
  price: course.price,
  commissionMode: course.commissionMode,
  specialCommissionType: course.specialCommissionType ?? null,
  specialCommissionValue: course.specialCommissionValue ?? null,
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

export const createPaymentMethod = (data: Pick<PaymentMethod, "name" | "icon" | "enabled">) =>
  apiRequest<Row>("/api/v1/payment-methods", { method: "POST", body: data }).then(toPaymentMethod);

export const updatePaymentMethod = (id: string, data: Pick<PaymentMethod, "name" | "icon" | "enabled">) =>
  apiRequest<Row>(`/api/v1/payment-methods/${id}`, { method: "PATCH", body: data }).then(toPaymentMethod);

export const deletePaymentMethod = (id: string) => apiRequest<void>(`/api/v1/payment-methods/${id}`, { method: "DELETE" });
export const deleteMasterDataItem = (id: string) => apiRequest<void>(`/api/v1/master-data/${id}`, { method: "DELETE" });
export const deleteMasterDataCategory = (code: string) => apiRequest<void>(`/api/v1/master-data-categories/${encodeURIComponent(code)}`, { method: "DELETE" });

const toMasterDataCategory = (row: Row): MasterDataCategory => ({
  code: String(row.code), name: String(row.name), description: String(row.description ?? ""), builtIn: row.built_in === true,
});
export const listMasterDataCategories = () =>
  apiRequest<Row[]>("/api/v1/master-data-categories").then((rows) => rows.map(toMasterDataCategory));
export const createMasterDataCategory = (data: Pick<MasterDataCategory, "name" | "description">) =>
  apiRequest<Row>("/api/v1/master-data-categories", { method: "POST", body: data }).then(toMasterDataCategory);
export const updateMasterDataCategory = (code: string, data: Pick<MasterDataCategory, "name" | "description">) =>
  apiRequest<Row>(`/api/v1/master-data-categories/${encodeURIComponent(code)}`, { method: "PATCH", body: data }).then(toMasterDataCategory);

export const setPaymentMethodEnabled = (id: string, active: boolean) =>
  apiRequest<Row>(`/api/v1/payment-methods/${id}/status`, {
    method: "PATCH",
    body: { active },
  }).then(toPaymentMethod);

export const listResources = (branchId?: string | null) =>
  apiRequest<Row[]>(`/api/v1/rooms${query({ branchId })}`).then((rows) => rows.map(toResource));

export const listResourcesFor = (scope: BranchScope) =>
  forBranches(scope, listResources, (r) => r.id);

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

