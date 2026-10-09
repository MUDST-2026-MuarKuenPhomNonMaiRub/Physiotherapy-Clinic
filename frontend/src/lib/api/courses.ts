import { apiRequest } from "./client";
import { toLedgerEntry, toPatientCourse } from "./mappers";
import type { CourseLedgerEntry, CourseTransferRecord, PatientCourse } from "@/types";
import { query, readAllPages } from "./shared";
import type { BranchScope, PageResponse, PageResult, Row } from "./shared";

// ------------------------------------------------------- courses and ledger

export interface CourseSnapshot {
  patientCourses: PatientCourse[];
  courseLedger: CourseLedgerEntry[];
}

/** Ascending by numeric id; a stable sort keeps a course's owner row ahead of its members. */
const byNumericId = <T extends { id: string }>(rows: T[]) =>
  [...rows].sort((a, b) => Number(a.id) - Number(b.id));

/**
 * Every course balance and ledger entry, read page by page like the other
 * operational lists. A single bounded read used to stop at 1,000 rows, oldest
 * first — so once a clinic passed that, its newest courses and most recent
 * visits silently dropped out of checkout and course history.
 *
 * The pages are read newest first, so a row written mid-read can only repeat
 * at a page boundary, never be skipped; the repeat is dropped here. The result
 * is put back in ascending order, which is what the screens were built on.
 */
export const listPatientCourses = async (branchId?: string | null): Promise<CourseSnapshot> => {
  const [courseRows, ledgerRows] = await Promise.all([
    readAllPages((page, size) =>
      apiRequest<PageResponse<Row>>(`/api/v1/patient-courses/page${query({ branchId, page, size })}`)
    ),
    readAllPages((page, size) =>
      apiRequest<PageResponse<Row>>(`/api/v1/patient-courses/ledger/page${query({ branchId, page, size })}`)
    ),
  ]);
  const courses = new Map<string, PatientCourse>();
  for (const pc of courseRows.map(toPatientCourse)) courses.set(`${pc.id}-${pc.patientId}`, pc);
  const ledger = new Map<string, CourseLedgerEntry>();
  for (const entry of ledgerRows.map(toLedgerEntry)) ledger.set(entry.id, entry);
  return { patientCourses: byNumericId([...courses.values()]), courseLedger: byNumericId([...ledger.values()]) };
};

export const listPatientCoursesPage = async (
  page = 0,
  size = 10,
  search = "",
  branchId?: string | null,
  courseId = "",
  status = ""
): Promise<PageResult<PatientCourse>> => {
  const response = await apiRequest<PageResponse<Row>>(
    `/api/v1/patient-courses/page${query({ branchId, search, courseId, status, page, size })}`
  );
  return { ...response, items: response.items.map(toPatientCourse) };
};

export const listPatientCoursesFor = async (scope: BranchScope): Promise<CourseSnapshot> => {
  if (scope === null) return listPatientCourses();
  const parts = await Promise.all(scope.map((branchId) => listPatientCourses(branchId)));
  const courses = new Map<string, PatientCourse>();
  const ledger = new Map<string, CourseLedgerEntry>();
  for (const part of parts) {
    for (const pc of part.patientCourses) courses.set(`${pc.id}-${pc.patientId}`, pc);
    for (const entry of part.courseLedger) ledger.set(entry.id, entry);
  }
  return { patientCourses: byNumericId([...courses.values()]), courseLedger: byNumericId([...ledger.values()]) };
};

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

export const listCourseTransfers = (branchId?: string): Promise<CourseTransferRecord[]> =>
  apiRequest<Row[]>(`/api/v1/course-transfers${query({ branchId })}`).then((rows) =>
    rows.map((row) => ({
      id: String(row.id ?? ""),
      transferNo: String(row.transfer_no ?? ""),
      patientCourseId: String(row.patient_course_id ?? ""),
      fromPatientId: String(row.from_patient_id ?? ""),
      fromPatientHn: String(row.from_patient_hn ?? ""),
      fromPatientName: String(row.from_patient_name ?? ""),
      toPatientId: String(row.to_patient_id ?? ""),
      toPatientHn: String(row.to_patient_hn ?? ""),
      toPatientName: String(row.to_patient_name ?? ""),
      courseName: String(row.package_name_snapshot ?? ""),
      sessions: Number(row.quantity ?? 0),
      reason: String(row.reason ?? ""),
      date: String(row.created_at ?? ""),
      branchId: String(row.branch_id ?? ""),
      branchName: String(row.branch_name ?? ""),
      courseOwnerEmployeeId: String(row.course_owner_employee_id ?? ""),
      courseOwnerName: String(row.case_owner_name_snapshot ?? ""),
      performedBy: String(row.created_by_name ?? ""),
    }))
  );

