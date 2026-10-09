import { apiRequest } from "./client";
import { toTransaction } from "./mappers";
import type { Transaction } from "@/types";
import { forBranches, query, readAllPages } from "./shared";
import type { BranchScope, PageResponse, Row } from "./shared";

// --------------------------------------------------------------- transactions

export const listTransactions = (branchId?: string | null) =>
  readAllPages((page, size) =>
    apiRequest<PageResponse<Row>>(`/api/v1/transactions/page${query({ branchId, page, size })}`)
  ).then((rows) => rows.map(toTransaction));

export const listTransactionsFor = (scope: BranchScope) =>
  forBranches(scope, listTransactions, (t) => t.id);

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
  /** Owner of the course's commission pool; defaults to the salesperson when omitted. */
  caseOwnerEmployeeId?: string;
  commissionSplits?: Array<{
    employeeId: string;
    salesCreditAmount: number;
    visits: number;
  }>;
  paymentMethodId: string;
  /** Cash handed over at the counter. Only meaningful when paying by cash. */
  cashReceived?: number;
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
      caseOwnerEmployeeId: input.caseOwnerEmployeeId ? Number(input.caseOwnerEmployeeId) : null,
      commissionSplits:
        input.commissionSplits?.map((split) => ({
          employeeId: Number(split.employeeId),
          salesCreditAmount: split.salesCreditAmount,
          visits: split.visits,
        })) ?? [],
      paymentMethodId: Number(input.paymentMethodId),
      cashReceived: input.cashReceived ?? null,
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

