import { apiRequest } from "./client";
import { toClosingHistoryRow, toClosingPreviewRow, toCommissionSchemes, toCourseCommissionReportRow, toSharedCourseMember, toTreatmentFeeRule } from "./mappers";
import type { ClosingHistoryRow, ClosingPreviewRow, CommissionAuditLog, CommissionLedgerRecord, CommissionScheme, CourseCommissionReportRow, SharedCourseMember, TreatmentFeeRule } from "@/types";
import { query } from "./shared";
import type { Row } from "./shared";

// ------------------------------------------------------- course commission
// The monthly-closing tier/pool model. See CommissionRule above for the
// separate, immediate per-receipt incentive.

export const listCommissionSchemes = (): Promise<CommissionScheme[]> =>
  apiRequest<Row[]>("/api/v1/commission/settings").then(toCommissionSchemes);

export const createCommissionScheme = (scheme: {
  code: string;
  effectiveFrom: string;
  effectiveTo?: string | null;
  tiers: { order: number; min: number; max: number | null; rate: number }[];
}) =>
  apiRequest<Row>("/api/v1/commission/settings", {
    method: "POST",
    body: {
      code: scheme.code,
      effectiveFrom: scheme.effectiveFrom,
      effectiveTo: scheme.effectiveTo ?? null,
      tiers: scheme.tiers,
    },
  });

export const previewClosing = (month: string): Promise<ClosingPreviewRow[]> =>
  apiRequest<Row[]>(`/api/v1/commission/closing/preview${query({ month })}`).then((rows) =>
    rows.map(toClosingPreviewRow)
  );

export const closeMonth = (month: string, earlyClose = false, reason?: string) =>
  apiRequest<{ closedEmployees: number }>("/api/v1/commission/closing/close", {
    method: "POST",
    body: { month, earlyClose, reason: reason ?? null },
  });

export const listClosingHistory = (month?: string, employeeId?: string): Promise<ClosingHistoryRow[]> =>
  apiRequest<Row[]>(`/api/v1/commission/closing/history${query({ month, employeeId })}`).then(
    (rows) => rows.map(toClosingHistoryRow)
  );

export const overrideClosing = (closingId: string, newRate: number, reason: string) =>
  apiRequest<void>(`/api/v1/commission/closing/${closingId}/override`, {
    method: "POST",
    body: { newRate, reason },
  });

export const getCourseCommissionReport = (from: string, to: string, staffId?: string): Promise<CourseCommissionReportRow[]> =>
  apiRequest<Row[]>(`/api/v1/commission/report${query({ from, to, staffId })}`).then((rows) =>
    rows.map(toCourseCommissionReportRow)
  );

export const getCourseCommissionDetail = (patientCourseId: string) =>
  apiRequest<Record<string, unknown>>(`/api/v1/commission/courses/${patientCourseId}/detail`);

export const getCourseCommissionStaffDetail = (staffId: string, from: string, to: string) =>
    apiRequest<Row[]>(`/api/v1/commission/staff/${staffId}/detail${query({ from, to })}`);

export const getCommissionLedgerRecords = (
  from: string,
  to: string,
  branchId?: string,
  staffId?: string
): Promise<CommissionLedgerRecord[]> =>
  apiRequest<Row[]>(`/api/v1/commission/ledger-records${query({ from, to, branchId, staffId })}`).then(
    (rows) =>
      rows.map((row) => ({
        id: `course-${String(row.id)}`,
        staffId: String(row.staff_id ?? ""),
        transactionId: "",
        transactionNo: String(row.transaction_no ?? row.course_id ?? "-"),
        date: String(row.visit_date ?? ""),
        patientId: String(row.patient_id ?? ""),
        branchId: String(row.branch_id ?? ""),
        type: String(row.commission_type) as CommissionLedgerRecord["type"],
        ruleId: String(row.patient_course_id),
        ruleName: "Course Commission",
        amount: Number(row.commission_amount ?? 0),
        reversed: row.allocation_status === "REVERSED",
      }))
      .filter((row) => row.amount !== 0)
  );

export const listCommissionAudit = (filters?: { action?: string; from?: string; to?: string; limit?: number }): Promise<CommissionAuditLog[]> =>
  apiRequest<Row[]>(`/api/v1/commission/audit${query({
    action: filters?.action && filters.action !== "ALL" ? filters.action : undefined,
    from: filters?.from,
    to: filters?.to,
    limit: filters?.limit ?? 200,
  })}`).then((rows) =>
    rows.map((row) => ({
      id: String(row.id),
      occurredAt: String(row.occurred_at),
      actorUserId: row.actor_user_id == null ? undefined : String(row.actor_user_id),
      branchId: row.branch_id == null ? undefined : String(row.branch_id),
      action: String(row.action),
      entityType: String(row.entity_type),
      entityId: String(row.entity_id),
      beforeData: row.before_data,
      afterData: row.after_data,
      reason: row.reason == null ? undefined : String(row.reason),
      requestId: row.request_id == null ? undefined : String(row.request_id),
    }))
  );

export const listSharedCourseMembers = (patientCourseId: string): Promise<SharedCourseMember[]> =>
  apiRequest<Row[]>(`/api/v1/commission/courses/${patientCourseId}/members`).then((rows) =>
    rows.map(toSharedCourseMember)
  );

export const addSharedCourseMember = (patientCourseId: string, patientId: string, visitsFromOwner: number) =>
  apiRequest<void>(`/api/v1/commission/courses/${patientCourseId}/members`, {
    method: "POST",
    body: { patientId: Number(patientId), visitsFromOwner },
  });

export const removeSharedCourseMember = (patientCourseId: string, patientId: string) =>
  apiRequest<void>(`/api/v1/commission/courses/${patientCourseId}/members/${patientId}`, {
    method: "DELETE",
  });

export const refundRemainingVisits = (patientCourseId: string, visits: number, reason: string) =>
  apiRequest<void>(`/api/v1/commission/courses/${patientCourseId}/refund-remaining`, {
    method: "POST",
    body: { visits, reason },
  });

export const listTreatmentFeeRules = () =>
  apiRequest<Row[]>("/api/v1/treatment-fee-rules").then((rows) => rows.map(toTreatmentFeeRule));

export const createTreatmentFeeRule = (rule: {
  employeeId?: string;
  employeeGroup?: string;
  serviceId?: string;
  feeType: TreatmentFeeRule["feeType"];
  feeValue: number;
  percentageBase?: string;
  effectiveFrom: string;
  effectiveTo?: string;
}) =>
  apiRequest<Row>("/api/v1/treatment-fee-rules", {
    method: "POST",
    body: {
      employeeId: rule.employeeId ? Number(rule.employeeId) : null,
      employeeGroup: rule.employeeGroup || null,
      serviceId: rule.serviceId ? Number(rule.serviceId) : null,
      feeType: rule.feeType,
      feeValue: rule.feeValue,
      percentageBase: rule.percentageBase || null,
      effectiveFrom: rule.effectiveFrom,
      effectiveTo: rule.effectiveTo || null,
      active: true,
    },
  }).then(toTreatmentFeeRule);

export const updateTreatmentFeeRule = (id: string, rule: Parameters<typeof createTreatmentFeeRule>[0]) =>
  apiRequest<Row>(`/api/v1/treatment-fee-rules/${id}`, {
    method: "PATCH",
    body: {
      employeeId: rule.employeeId ? Number(rule.employeeId) : null,
      employeeGroup: rule.employeeGroup || null,
      serviceId: rule.serviceId ? Number(rule.serviceId) : null,
      feeType: rule.feeType,
      feeValue: rule.feeValue,
      percentageBase: rule.percentageBase || null,
      effectiveFrom: rule.effectiveFrom,
      effectiveTo: rule.effectiveTo || null,
      active: true,
    },
  }).then(toTreatmentFeeRule);

export const setTreatmentFeeRuleActive = (id: string, active: boolean) =>
  apiRequest<Row>(`/api/v1/treatment-fee-rules/${id}/status`, {
    method: "PATCH",
    body: { active },
  }).then(toTreatmentFeeRule);

