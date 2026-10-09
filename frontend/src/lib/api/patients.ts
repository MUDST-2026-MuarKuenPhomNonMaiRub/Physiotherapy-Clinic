import { apiRequest } from "./client";
import { toPatient, toPatientRequest } from "./mappers";
import type { Patient } from "@/types";
import { forBranches, query, readAllPages } from "./shared";
import type { BranchScope, PageResponse, Row } from "./shared";

// ------------------------------------------------------------------- patients

export const listPatients = (branchId?: string | null) =>
  readAllPages((page, size) =>
    apiRequest<PageResponse<Row>>(`/api/v1/patients/page${query({ branchId, page, size })}`)
  ).then((rows) => rows.map(toPatient));

/** A patient seen at two of the caller's branches is listed once. */
export const listPatientsFor = (scope: BranchScope) =>
  forBranches(scope, listPatients, (p) => p.id).then((rows) =>
    rows.sort((a, b) => Number(b.id) - Number(a.id))
  );

/**
 * The HN the next registration at this branch would be given. Asked of the
 * server because the number comes from a sequence that only moves forward —
 * counting the patients already on file drifts from it the moment one is
 * removed.
 */
export const previewPatientHN = (branchId: string) =>
  apiRequest<{ hn: string }>(`/api/v1/patients/hn-preview${query({ branchId })}`).then(
    (row) => row.hn
  );

export const getPatientById = (id: string) => apiRequest<Row>("/api/v1/patients/" + id).then(toPatient);

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

