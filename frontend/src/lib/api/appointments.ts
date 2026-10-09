import { apiRequest } from "./client";
import { toAppointment, toInstant } from "./mappers";

import { forBranches, query, readAllPages } from "./shared";
import type { BranchScope, PageResponse, Row } from "./shared";

// --------------------------------------------------------------- appointments

export const listAppointments = (branchId?: string | null) =>
  readAllPages((page, size) =>
    apiRequest<PageResponse<Row>>(`/api/v1/appointments/page${query({ branchId, page, size })}`)
  ).then((rows) => rows.map(toAppointment));

export const listAppointmentsFor = (scope: BranchScope) =>
  forBranches(scope, listAppointments, (a) => a.id);

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

/**
 * `usePatientCourseId` is only meaningful for "complete": the course the visit
 * is charged against. Left out, the visit is paid per visit at checkout and
 * nothing is deducted from any course.
 */
export const transitionAppointment = (
  id: string,
  action: AppointmentAction,
  reason?: string,
  usePatientCourseId?: string
) =>
  apiRequest<Row>(`/api/v1/appointments/${id}/${action}`, {
    method: "POST",
    body: {
      reason: reason ?? null,
      usePatientCourseId: usePatientCourseId ? Number(usePatientCourseId) : null,
    },
  }).then(toAppointment);

/**
 * The same booking on a new slot — the calendar's drag to move or resize, and
 * to hand it to another physiotherapist when `physioId` is given.
 */
export const changeAppointmentTime = (
  id: string,
  date: string,
  startTime: string,
  endTime: string,
  physioId?: string
) =>
  apiRequest<Row>(`/api/v1/appointments/${id}/time`, {
    method: "PATCH",
    body: {
      startsAt: toInstant(date, startTime),
      endsAt: toInstant(date, endTime),
      providerStaffId: physioId ? Number(physioId) : null,
    },
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

