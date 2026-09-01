import type { Appointment } from "@/types";

export const appointments: Appointment[] = [
  // ---- Today (2026-08-12) — used for Physiotherapist "Today" demo & Front Desk visit board ----
  {
    id: "apt-101", patientId: "p-004", date: "2026-08-12", startTime: "09:00", endTime: "09:45",
    branchId: "br-bkk", physiotherapistId: "stf-phy1", serviceId: "svc-back", resourceId: "res-bkk-1",
    status: "CONFIRMED", createdAt: "2026-08-05T10:00:00",
  },
  {
    id: "apt-102", patientId: "p-001", date: "2026-08-12", startTime: "10:00", endTime: "10:45",
    branchId: "br-bkk", physiotherapistId: "stf-phy1", serviceId: "svc-office", resourceId: "res-bkk-1",
    status: "ARRIVED", createdAt: "2026-08-04T09:00:00", note: "ปวดคอ-บ่าจากนั่งทำงานนาน",
  },
  {
    id: "apt-103", patientId: "p-005", date: "2026-08-12", startTime: "11:00", endTime: "12:00",
    branchId: "br-sal", physiotherapistId: "stf-phy3", serviceId: "svc-sports", resourceId: "res-sal-1",
    status: "COMPLETED", createdAt: "2026-07-30T09:00:00", checkedOut: false,
  },
  {
    id: "apt-104", patientId: "p-002", date: "2026-08-12", startTime: "13:30", endTime: "14:15",
    branchId: "br-bkk", physiotherapistId: "stf-phy2", serviceId: "svc-back", resourceId: "res-bkk-2",
    status: "CONFIRMED", createdAt: "2026-08-06T11:00:00",
  },
  {
    id: "apt-105", patientId: "p-006", date: "2026-08-12", startTime: "14:30", endTime: "15:30",
    branchId: "br-cnx", physiotherapistId: "stf-phy4", serviceId: "svc-postop", resourceId: "res-cnx-1",
    status: "IN_SERVICE", createdAt: "2026-08-07T13:00:00",
  },
  {
    id: "apt-106", patientId: "p-009", date: "2026-08-12", startTime: "15:30", endTime: "16:00",
    branchId: "br-cnx", physiotherapistId: "stf-phy4", serviceId: "svc-dryneedle", resourceId: "res-cnx-1",
    status: "CONFIRMED", createdAt: "2026-08-08T10:00:00",
  },
  {
    id: "apt-107", patientId: "p-007", date: "2026-08-12", startTime: "16:00", endTime: "17:00",
    branchId: "br-bkk", physiotherapistId: "stf-phy5", serviceId: "svc-postop", resourceId: "res-bkk-2",
    status: "COMPLETED", createdAt: "2026-07-28T09:00:00", checkedOut: true,
  },

  // ---- Upcoming ----
  {
    id: "apt-201", patientId: "p-003", date: "2026-08-14", startTime: "10:00", endTime: "10:45",
    branchId: "br-sal", physiotherapistId: "stf-phy3", serviceId: "svc-office", resourceId: "res-sal-1",
    status: "CONFIRMED", createdAt: "2026-08-02T09:00:00", note: "นัดต่อเนื่องคอร์ส Office Syndrome",
  },
  {
    id: "apt-202", patientId: "p-001", date: "2026-08-15", startTime: "10:00", endTime: "10:45",
    branchId: "br-bkk", physiotherapistId: "stf-phy1", serviceId: "svc-office", resourceId: "res-bkk-1",
    status: "CONFIRMED", createdAt: "2026-08-05T09:00:00",
  },
  {
    id: "apt-203", patientId: "p-011", date: "2026-08-16", startTime: "09:30", endTime: "10:15",
    branchId: "br-sal", physiotherapistId: "stf-phy3", serviceId: "svc-office", resourceId: "res-sal-2",
    status: "CONFIRMED", createdAt: "2026-08-09T09:00:00",
  },
  {
    id: "apt-204", patientId: "p-012", date: "2026-08-18", startTime: "13:00", endTime: "13:45",
    branchId: "br-bkk", physiotherapistId: "stf-phy2", serviceId: "svc-office", resourceId: "res-bkk-1",
    status: "CONFIRMED", createdAt: "2026-08-09T09:00:00",
  },
  {
    id: "apt-205", patientId: "p-008", date: "2026-08-19", startTime: "11:00", endTime: "11:45",
    branchId: "br-sal", physiotherapistId: "stf-phy3", serviceId: "svc-sports", resourceId: "res-sal-1",
    status: "CONFIRMED", createdAt: "2026-08-10T09:00:00",
  },
  {
    id: "apt-206", patientId: "p-002", date: "2026-08-20", startTime: "14:00", endTime: "14:45",
    branchId: "br-bkk", physiotherapistId: "stf-phy2", serviceId: "svc-back", resourceId: "res-bkk-2",
    status: "CONFIRMED", createdAt: "2026-08-11T09:00:00",
  },
  {
    id: "apt-207", patientId: "p-014", date: "2026-08-21", startTime: "09:00", endTime: "09:30",
    branchId: "br-cnx", physiotherapistId: "stf-phy4", serviceId: "svc-dryneedle", resourceId: "res-cnx-1",
    status: "CONFIRMED", createdAt: "2026-08-11T09:00:00",
  },
  {
    id: "apt-208", patientId: "p-016", date: "2026-08-25", startTime: "10:00", endTime: "11:00",
    branchId: "br-bkk", physiotherapistId: "stf-phy5", serviceId: "svc-shockwave", resourceId: "res-bkk-1",
    status: "CONFIRMED", createdAt: "2026-08-11T09:00:00",
  },

  // ---- History (past, completed/cancelled/no-show/rescheduled) ----
  {
    id: "apt-301", patientId: "p-001", date: "2026-08-05", startTime: "10:00", endTime: "10:45",
    branchId: "br-bkk", physiotherapistId: "stf-phy1", serviceId: "svc-office", resourceId: "res-bkk-1",
    status: "COMPLETED", createdAt: "2026-07-29T09:00:00", checkedOut: true,
  },
  {
    id: "apt-302", patientId: "p-003", date: "2026-08-07", startTime: "10:00", endTime: "10:45",
    branchId: "br-sal", physiotherapistId: "stf-phy3", serviceId: "svc-office", resourceId: "res-sal-1",
    status: "COMPLETED", createdAt: "2026-07-30T09:00:00", checkedOut: true,
  },
  {
    id: "apt-303", patientId: "p-002", date: "2026-07-28", startTime: "13:00", endTime: "13:45",
    branchId: "br-bkk", physiotherapistId: "stf-phy2", serviceId: "svc-back", resourceId: "res-bkk-2",
    status: "COMPLETED", createdAt: "2026-07-20T09:00:00", checkedOut: true,
  },
  {
    id: "apt-304", patientId: "p-010", date: "2026-07-25", startTime: "09:00", endTime: "10:00",
    branchId: "br-bkk", physiotherapistId: "stf-phy1", serviceId: "svc-sports", resourceId: "res-bkk-1",
    status: "NO_SHOW", createdAt: "2026-07-18T09:00:00",
  },
  {
    id: "apt-305", patientId: "p-013", date: "2026-07-22", startTime: "15:00", endTime: "15:45",
    branchId: "br-sal", physiotherapistId: "stf-phy3", serviceId: "svc-back", resourceId: "res-sal-1",
    status: "CANCELLED", createdAt: "2026-07-15T09:00:00", note: "ลูกค้าติดธุระด่วน",
  },
  {
    id: "apt-306", patientId: "p-015", date: "2026-07-30", startTime: "11:00", endTime: "11:30",
    branchId: "br-cnx", physiotherapistId: "stf-phy4", serviceId: "svc-dryneedle", resourceId: "res-cnx-1",
    status: "RESCHEDULED", createdAt: "2026-07-20T09:00:00", note: "ย้ายไปสัปดาห์ถัดไป",
  },
  {
    id: "apt-307", patientId: "p-007", date: "2026-08-01", startTime: "16:00", endTime: "17:00",
    branchId: "br-bkk", physiotherapistId: "stf-phy5", serviceId: "svc-postop", resourceId: "res-bkk-2",
    status: "COMPLETED", createdAt: "2026-07-25T09:00:00", checkedOut: true,
  },
  {
    id: "apt-308", patientId: "p-005", date: "2026-07-18", startTime: "11:00", endTime: "12:00",
    branchId: "br-sal", physiotherapistId: "stf-phy3", serviceId: "svc-sports", resourceId: "res-sal-1",
    status: "COMPLETED", createdAt: "2026-07-10T09:00:00", checkedOut: true,
  },
  {
    id: "apt-309", patientId: "p-006", date: "2026-07-15", startTime: "14:00", endTime: "15:00",
    branchId: "br-cnx", physiotherapistId: "stf-phy4", serviceId: "svc-postop", resourceId: "res-cnx-1",
    status: "COMPLETED", createdAt: "2026-07-05T09:00:00", checkedOut: true,
  },
  {
    id: "apt-310", patientId: "p-009", date: "2026-08-02", startTime: "09:30", endTime: "10:00",
    branchId: "br-cnx", physiotherapistId: "stf-phy4", serviceId: "svc-assess", resourceId: "res-cnx-1",
    status: "COMPLETED", createdAt: "2026-07-28T09:00:00", checkedOut: true,
  },
];

export function getAppointmentById(id: string): Appointment | undefined {
  return appointments.find((a) => a.id === id);
}

export function getAppointmentsByPatient(patientId: string): Appointment[] {
  return appointments
    .filter((a) => a.patientId === patientId)
    .sort((a, b) => `${b.date}T${b.startTime}`.localeCompare(`${a.date}T${a.startTime}`));
}

export function getAppointmentsByPhysio(physioId: string): Appointment[] {
  return appointments.filter((a) => a.physiotherapistId === physioId);
}
