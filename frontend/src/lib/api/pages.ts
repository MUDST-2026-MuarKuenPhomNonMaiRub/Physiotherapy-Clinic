import { apiRequest } from "./client";
import { toAppointment, toPatient, toTransaction } from "./mappers";
import type { Appointment, Patient, Transaction } from "@/types";
import { query } from "./shared";
import type { PageResponse, PageResult, Row } from "./shared";


export const listPatientsPage = async (
  page = 0,
  size = 25,
  search = "",
  branchId?: string | null
): Promise<PageResult<Patient>> => {
  const response = await apiRequest<PageResponse<Row>>(
    "/api/v1/patients/page" + query({ search, branchId, page, size })
  );
  return { ...response, items: response.items.map(toPatient) };
};
export const listAppointmentsPage = async (page = 0, size = 100, branchId?: string | null): Promise<PageResult<Appointment>> => { const response = await apiRequest<PageResponse<Row>>("/api/v1/appointments/page" + query({ branchId, page, size })); return { ...response, items: response.items.map(toAppointment) }; };
export const listTransactionsPage = async (page = 0, size = 100, branchId?: string | null): Promise<PageResult<Transaction>> => { const response = await apiRequest<PageResponse<Row>>("/api/v1/transactions/page" + query({ branchId, page, size })); return { ...response, items: response.items.map(toTransaction) }; };
